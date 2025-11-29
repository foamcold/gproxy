from typing import AsyncGenerator
from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse, Response, JSONResponse
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.gemini_service import gemini_service
from app.api import deps
from app.core.database import get_db
from app.models.user import User
from sqlalchemy.future import select
from app.models.system_config import SystemConfig

from app.services.chat_processor import chat_processor
from app.models.key import ExclusiveKey

router = APIRouter()

async def ensure_log_level(db: AsyncSession) -> str:
    """Ensure service logger level matches system config and return it"""
    result = await db.execute(select(SystemConfig))
    config = result.scalars().first()
    log_level = "INFO"
    if config and config.log_level:
        log_level = config.log_level
        gemini_service.update_log_level(log_level)
    return log_level

@router.api_route("/v1beta/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_v1beta(
    path: str,
    request: Request,
    key_info: tuple = Depends(deps.get_official_key_from_proxy),
    db: AsyncSession = Depends(get_db)
):
    log_level = await ensure_log_level(db)
    official_key, user = key_info
    
    # 判断是否为 gapi- key
    is_exclusive = user is not None
    # 强制将 path 转为 str，以防万一
    path_str = str(path)
    print(f"DEBUG: Path repr: {repr(path_str)}")
    
    # 显式检查生成内容的端点
    is_generate_content = "generateContent" in path_str or "streamGenerateContent" in path_str
    print(f"DEBUG: Is generateContent: {is_generate_content}")

    # 如果是 gapi- key 并且是 chat completion 请求，则使用 ChatProcessor
    if is_exclusive and is_generate_content and request.method == "POST":
        print(f"DEBUG: 检测到专属 Key 请求，转入 ChatProcessor 处理: {path_str}")
        # 获取 exclusive_key 对象
        # 修复：需要支持从 header 或 query params 中获取 key，与 deps 逻辑保持一致
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            client_key = auth_header.split(" ")[1]
        else:
            client_key = request.headers.get("x-goog-api-key") or request.query_params.get("key")
        
        print(f"DEBUG: 提取到的 Client Key: {client_key}")
        
        result = await db.execute(select(ExclusiveKey).filter(ExclusiveKey.key == client_key))
        exclusive_key = result.scalars().first()
        
        if not exclusive_key:
            raise HTTPException(status_code=401, detail="Invalid exclusive key")

        # 尝试从路径中解析模型名称
        # path 示例: models/gemini-1.5-flash:streamGenerateContent
        model_override = None
        if "models/" in path_str and ":" in path_str:
            try:
                # 提取 models/ 和 : 之间的部分
                start_idx = path_str.find("models/") + len("models/")
                end_idx = path_str.find(":", start_idx)
                if end_idx > start_idx:
                    model_override = path_str[start_idx:end_idx]
                    print(f"DEBUG: 解析到的模型名称: {model_override}")
            except Exception as e:
                print(f"DEBUG: 解析模型名称失败: {e}")

        result = await chat_processor.process_request(
            request=request, db=db, official_key=official_key,
            exclusive_key=exclusive_key, user=user, log_level=log_level,
            model_override=model_override
        )
        
        if isinstance(result, AsyncGenerator):
            return StreamingResponse(result, media_type="text/event-stream")
        else:
            response_content, status_code, _ = result
            return JSONResponse(content=response_content, status_code=status_code)

    # --- 对于非 gapi- key 或非聊天请求，保持透传 ---
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ['host', 'authorization']}
    headers["x-goog-api-key"] = official_key
    params = dict(request.query_params)
    body = await request.body()

    try:
        req = gemini_service.client.build_request(
            request.method, f"/v1beta/{path}", headers=headers, params=params, content=body
        )
        response = await gemini_service.client.send(req, stream=True)
        
        # 异步更新密钥状态
        await gemini_service.update_key_status(db, official_key, response.status_code)
        
        if response.status_code >= 400:
            error_content = await response.aread()
            return Response(content=error_content, status_code=response.status_code, media_type=response.headers.get("content-type"))

        excluded_headers = {"content-encoding", "content-length", "transfer-encoding", "connection"}
        response_headers = {k: v for k, v in response.headers.items() if k.lower() not in excluded_headers}

        return StreamingResponse(
            response.aiter_bytes(),
            status_code=response.status_code,
            headers=response_headers
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Proxy error: {exc}")
