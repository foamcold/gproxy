from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.gemini_service import gemini_service
from app.api import deps
from app.core.database import get_db
from app.models.user import User
from sqlalchemy.future import select
from app.models.system_config import SystemConfig

router = APIRouter()

async def ensure_log_level(db: AsyncSession):
    """Ensure service logger level matches system config"""
    result = await db.execute(select(SystemConfig))
    config = result.scalars().first()
    if config and config.log_level:
        gemini_service.update_log_level(config.log_level)

@router.get("/v1beta/models")
async def list_models_gemini(
    request: Request,
    background_tasks: BackgroundTasks,
    key_info: tuple = Depends(deps.get_official_key_from_proxy),
    db: AsyncSession = Depends(get_db)
):
    await ensure_log_level(db)
    """
    Gemini模型列表的专用处理器，确保正确的身份验证。
    代理请求并直接流式传输响应。
    """
    official_key, _ = key_info

    # 2. 准备并发送请求到Gemini
    target_url = "/v1beta/models"
    headers = {"x-goog-api-key": official_key}
    
    # 提取需要转发的查询参数（例如pageToken）
    params = dict(request.query_params)
    # 如果存在，从参数中移除key，因为它已通过请求头处理
    params.pop("key", None)

    try:
        req = gemini_service.client.build_request(
            "GET",
            target_url,
            headers=headers,
            params=params
        )
        
        response = await gemini_service.client.send(req, stream=True)

        # 异步更新密钥状态
        status_code = str(response.status_code)
        # 注意：这里需要创建一个新的 session 或者使用其他方式，因为 background_tasks 在 response 发送后执行，那时的 db session 可能已经关闭
        # 简单起见，这里直接调用，但更好的方式是在 service 中处理 session 生命周期，或者在依赖注入中处理
        # 鉴于 fastAPI 的 background tasks 机制，我们可以传递 db session，但要注意并发问题
        # 这里为了确保正确性，我们直接在 service 方法中处理更新，并 await 它 (虽然会增加一点延迟)
        # 或者使用 BackgroundTasks，但需要确保 db session 有效。
        # 这里的 key_info[0] 就是 official_key string
        await gemini_service.update_key_status(db, official_key, status_code)

        # 检查上游API的响应状态码
        if response.status_code >= 400:
            # 读取错误内容并立即返回
            error_content = await response.aread()
            return Response(content=error_content, status_code=response.status_code, media_type=response.headers.get("content-type"))
        
        # 过滤响应头
        excluded_headers = {"content-encoding", "content-length", "transfer-encoding", "connection"}
        headers = {
            k: v for k, v in response.headers.items()
            if k.lower() not in excluded_headers
        }

        return StreamingResponse(
            response.aiter_bytes(),
            status_code=response.status_code,
            headers=headers,
            background=None
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Proxy error: {exc}")

@router.api_route("/v1beta/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_v1beta(
    path: str,
    request: Request,
    key_info: tuple = Depends(deps.get_official_key_from_proxy),
    db: AsyncSession = Depends(get_db)
):
    await ensure_log_level(db)
    """
    原生Gemini API /v1beta的透传。
    使用新的依赖项进行身份验证和密钥处理。
    """
    official_key, _ = key_info
    
    # 提取请求头
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)
    headers.pop("authorization", None) # 移除原始认证头
    headers["x-goog-api-key"] = official_key # 使用处理过的官方密钥
    
    # 提取查询参数
    params = dict(request.query_params)
    params.pop("key", None) # 移除查询参数中的 key
    
    # 读取请求体
    body = await request.body()
    
    try:
        req = gemini_service.client.build_request(
            request.method,
            f"/v1beta/{path}",
            headers=headers,
            params=params,
            content=body
        )
        
        response = await gemini_service.client.send(req, stream=True)

        # 异步更新密钥状态
        status_code = str(response.status_code)
        await gemini_service.update_key_status(db, official_key, status_code)

        # 检查上游API的响应状态码
        if response.status_code >= 400:
            # 读取错误内容并立即返回
            error_content = await response.aread()
            return Response(content=error_content, status_code=response.status_code, media_type=response.headers.get("content-type"))
        
        # 过滤响应头
        excluded_headers = {"content-encoding", "content-length", "transfer-encoding", "connection"}
        headers = {
            k: v for k, v in response.headers.items()
            if k.lower() not in excluded_headers
        }

        return StreamingResponse(
            response.aiter_bytes(),
            status_code=response.status_code,
            headers=headers,
            background=None
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Proxy error: {exc}")
