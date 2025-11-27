from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
import httpx
from app.services.gemini_service import gemini_service

router = APIRouter()

@router.get("/v1beta/models")
async def list_models_gemini(request: Request):
    """
    Gemini模型列表的专用处理器，确保正确的身份验证。
    代理请求并直接流式传输响应。
    """
    # 1. 提取API密钥
    auth_header = request.headers.get("Authorization")
    api_key = None
    if auth_header and auth_header.startswith("Bearer "):
        api_key = auth_header.split(" ")[1]
    
    if not api_key:
        api_key = request.headers.get("x-goog-api-key")

    if not api_key:
        api_key = request.query_params.get("key")
        
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    # 2. 准备并发送请求到Gemini
    target_url = "/v1beta/models"
    headers = {"x-goog-api-key": api_key}
    
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
async def proxy_v1beta(path: str, request: Request):
    """
    原生Gemini API /v1beta的透传。
    如果需要，自动将OpenAI Bearer令牌转换为Gemini格式。
    """
    # 提取请求头
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)
    
    # 提取查询参数
    params = dict(request.query_params)
    
    # 检查是否需要将Authorization头转换为Gemini格式
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        api_key = auth_header.split(" ")[1]
        # 移除Authorization头并添加Gemini风格的身份验证
        headers.pop("authorization", None)
        # 使用x-goog-api-key请求头，更可靠
        if "x-goog-api-key" not in headers:
            headers["x-goog-api-key"] = api_key
    
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
