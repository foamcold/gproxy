import json
import time
import httpx
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.models.user import User
from app.models.key import ExclusiveKey, OfficialKey
from app.models.preset import Preset
from app.models.regex import RegexRule
from app.models.log import Log
from app.schemas.openai import ChatCompletionRequest
from app.services.gemini_service import gemini_service
from app.services.converter import converter
from app.services.variable_service import variable_service
from app.services.regex_service import regex_service
from app.core.config import settings

router = APIRouter()


@router.get("/v1/models")
async def list_models(request: Request):
    """
    处理 GET /v1/models 请求，通过代理到 Google API 列出可用模型。
    """
    # 1. 提取 API 密钥
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供 API 密钥")
    
    api_key = auth_header.split(" ")[1]

    # 2. 代理到 Google API
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://generativelanguage.googleapis.com/v1beta/models",
                params={"key": api_key}
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"请求 Google API 时出错: {e}")

    # 3. 转换响应
    try:
        gemini_response = response.json()
        models = gemini_response.get("models", [])
        
        openai_models = []
        for model in models:
            model_id = model.get("name", "").replace("models/", "")
            openai_models.append({
                "id": model_id,
                "object": "model",
                "created": int(time.time()),
                "owned_by": "google"
            })
            
        return {
            "object": "list",
            "data": openai_models
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析或转换模型列表时出错: {e}")


def get_api_key(request: Request) -> str:
    """
    从请求中提取 API 密钥。
    支持从 Authorization 头、x-goog-api-key 头或 key 查询参数中提取。
    """
    # 1. 从 Authorization 头提取
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        key = auth_header.split(" ")[1]
        if key:
            return key

    # 2. 从 x-goog-api-key 头提取
    x_goog_api_key = request.headers.get("x-goog-api-key")
    if x_goog_api_key:
        return x_goog_api_key

    # 3. 从 key 查询参数提取
    key_param = request.query_params.get("key")
    if key_param:
        return key_param

    raise HTTPException(status_code=401, detail="未提供 API 密钥")


@router.api_route("/v1beta/{path:path}", methods=["POST", "PUT", "DELETE", "GET"])
async def proxy_beta_requests(request: Request, path: str):
    """
    通用代理，处理 /v1beta/ 下的所有请求，并以流的形式返回响应。
    """
    api_key = get_api_key(request)
    
    target_url = f"https://generativelanguage.googleapis.com/v1beta/{path}"

    # 移除 Host, Authorization, x-goog-api-key, key 等头部，避免冲突
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ["host", "authorization", "x-goog-api-key", "key"]}
    
    params = dict(request.query_params)
    params['key'] = api_key

    body = await request.body()

    async def response_generator():
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                async with client.stream(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    params=params,
                    content=body,
                ) as response:
                    if response.status_code >= 400:
                        error_content = await response.aread()
                        error_detail = error_content.decode()
                        print(f"Error from Google API: {response.status_code} - {error_detail}")
                        yield json.dumps({"error": {"message": error_detail, "code": response.status_code}}).encode('utf-8')
                        return

                    async for chunk in response.aiter_bytes():
                        yield chunk
            except Exception as e:
                print(f"Error proxying request to Google API: {e}")
                error_message = json.dumps({"error": {"message": f"An error occurred during proxying: {str(e)}", "code": 500}})
                yield error_message.encode('utf-8')

    return StreamingResponse(response_generator(), media_type="application/json")

@router.post("/v1/chat/completions")
async def chat_completions(
    request: Request,
    db: AsyncSession = Depends(deps.get_db)
):
    # 1. Auth & Key Validation
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing API key")
    
    api_key = auth_header.split(" ")[1]
    
    # Check if it's an exclusive key
    result = await db.execute(select(ExclusiveKey).filter(ExclusiveKey.key == api_key, ExclusiveKey.is_active == True))
    exclusive_key = result.scalars().first()
    
    user = None
    if exclusive_key:
        result = await db.execute(select(User).filter(User.id == exclusive_key.user_id))
        user = result.scalars().first()
    else:
        # Check if it's a direct official key (optional, for admin testing or if allowed)
        # For now, we enforce exclusive keys for registered users features
        # But if the key starts with 'gapi-', it must be exclusive.
        if api_key.startswith("gapi-"):
             raise HTTPException(status_code=401, detail="Invalid exclusive key")
        # If it's a raw key, we might allow it but without user context (or default user)
        # For this system, let's assume raw keys are passed through but no user features
        pass

    # 2. Parse Request
    try:
        body = await request.json()
        openai_request = ChatCompletionRequest(**body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {e}")

    # 3. Load User Context (Presets, Regex) if user exists
    presets = []
    regex_rules = []
    if user:
        # Load Presets
        result = await db.execute(select(Preset).filter(Preset.user_id == user.id, Preset.is_active == True).order_by(Preset.sort_order))
        presets = result.scalars().all()
        
        # Load Regex Rules
        result = await db.execute(select(RegexRule).filter(RegexRule.user_id == user.id, RegexRule.is_active == True).order_by(RegexRule.sort_order))
        regex_rules = result.scalars().all()

    # 4. Apply Presets (Inject into messages)
    if presets and openai_request.messages:
        for preset in presets:
            try:
                preset_content = json.loads(preset.content)
                items = preset_content.get('items', [])
                
                if not items:
                    continue
                
                # 排序条目
                sorted_items = sorted(items, key=lambda x: x.get('order', 0))
                
                # 构建新的消息列表
                processed_messages = []
                original_messages = list(openai_request.messages)
                
                # 分离最后一条用户消息和历史消息
                last_user_message = None
                history_messages = []
                
                for msg in reversed(original_messages):
                    if msg.role == 'user' and last_user_message is None:
                        last_user_message = msg
                    else:
                        history_messages.insert(0, msg)
                
                for item in sorted_items:
                    item_type = item.get('type', 'normal')
                    item_role = item.get('role', 'system')
                    item_content = item.get('content', '')
                    
                    if item_type == 'normal':
                        # 直接注入普通条目
                        processed_messages.append({
                            'role': item_role,
                            'content': item_content
                        })
                    elif item_type == 'user_input':
                        # 注入最后一条用户消息
                        if last_user_message:
                            processed_messages.append({
                                'role': last_user_message.role,
                                'content': last_user_message.content
                            })
                    elif item_type == 'history':
                        # 注入历史消息
                        for hist_msg in history_messages:
                            processed_messages.append({
                                'role': hist_msg.role,
                                'content': hist_msg.content if isinstance(hist_msg.content, str) else str(hist_msg.content)
                            })
                
                # 如果处理后有消息，替换原始消息
                if processed_messages:
                    from app.schemas.openai import Message
                    openai_request.messages = [Message(role=msg['role'], content=msg['content']) for msg in processed_messages]
                    
            except Exception as e:
                # 如果预设解析失败，跳过该预设
                print(f"预设解析失败: {e}")
                continue

    # 5. Variable Processing
    # Apply variables to all string content in messages
    for msg in openai_request.messages:
        if isinstance(msg.content, str):
            msg.content = variable_service.parse_variables(msg.content)

    # 6. Pre-processing Regex
    pre_rules = [r for r in regex_rules if r.type == "pre"]
    for msg in openai_request.messages:
        if isinstance(msg.content, str):
            msg.content = regex_service.process(msg.content, pre_rules)

    # 7. Model Mapping & Conversion
    model = openai_request.model
    # Simple mapping
    if model.startswith("gpt-"):
        model = "gemini-1.5-flash"
    
    gemini_payload = await converter.openai_to_gemini(openai_request)

    # 8. Get API Key (Official or User's)
    try:
        if exclusive_key:
            # Registered user: use official key pool
            official_key = await gemini_service.get_active_key(db)
        else:
            # Non-registered user: pass through user's key
            official_key = api_key
            
    except HTTPException as e:
        raise e

    # 9. Send Request
    start_time = time.time()
    ttft = 0
    
    method = "streamGenerateContent" if openai_request.stream else "generateContent"
    target_url = f"{settings.GEMINI_BASE_URL}/v1beta/models/{model}:{method}"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": official_key
    }

    # Log entry creation (initial)
    log_entry = Log(
        exclusive_key_id=exclusive_key.id if exclusive_key else None,
        user_id=user.id if user else None,
        model=model,
        status="pending",
        is_stream=openai_request.stream
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)

    async def response_generator():
        nonlocal ttft
        first_token_received = False
        full_response_text = ""
        
        try:
            async with gemini_service.client.stream("POST", target_url, json=gemini_payload, headers=headers, timeout=60.0) as response:
                if response.status_code != 200:
                    # Handle error
                    error_content = await response.aread()
                    # Update log
                    log_entry.status = "error"
                    log_entry.status_code = response.status_code
                    await db.commit()
                    
                    yield f"data: {json.dumps({'error': {'message': error_content.decode(), 'code': response.status_code}})}\n\n"
                    return

                buffer = ""
                async for chunk in response.aiter_text():
                    if not first_token_received:
                        ttft = time.time() - start_time
                        first_token_received = True
                    
                    buffer += chunk
                    while True:
                        try:
                            start = buffer.find('{')
                            if start == -1:
                                break
                            
                            brace_count = 0
                            end = -1
                            for i, char in enumerate(buffer[start:], start):
                                if char == '{':
                                    brace_count += 1
                                elif char == '}':
                                    brace_count -= 1
                                    if brace_count == 0:
                                        end = i + 1
                                        break
                            
                            if end != -1:
                                json_str = buffer[start:end]
                                buffer = buffer[end:]
                                
                                try:
                                    gemini_chunk = json.loads(json_str)
                                    openai_chunk = converter.gemini_to_openai_chunk(gemini_chunk, model)
                                    
                                    # Post-processing Regex on chunk content
                                    post_rules = [r for r in regex_rules if r.type == "post"]
                                    if openai_chunk['choices'][0]['delta'].get('content'):
                                        content = openai_chunk['choices'][0]['delta']['content']
                                        processed_content = regex_service.process(content, post_rules)
                                        openai_chunk['choices'][0]['delta']['content'] = processed_content
                                        full_response_text += processed_content
                                    
                                    yield f"data: {json.dumps(openai_chunk)}\n\n"
                                except json.JSONDecodeError:
                                    pass
                            else:
                                break
                        except Exception:
                            break
                            
            yield "data: [DONE]\n\n"
            
            # Finalize Log
            log_entry.status = "ok"
            log_entry.status_code = 200
            log_entry.latency = time.time() - start_time
            log_entry.ttft = ttft
            # Estimate tokens (very rough)
            log_entry.output_tokens = len(full_response_text) // 4
            await db.commit()

        except Exception as e:
            log_entry.status = "error"
            await db.commit()
            yield f"data: {json.dumps({'error': {'message': str(e)}})}\n\n"

    if openai_request.stream:
        return StreamingResponse(response_generator(), media_type="text/event-stream")
    else:
        # Non-streaming logic
        try:
            response = await gemini_service.client.post(
                target_url,
                json=gemini_payload,
                headers=headers,
                timeout=60.0
            )
            if response.status_code != 200:
                log_entry.status = "error"
                log_entry.status_code = response.status_code
                await db.commit()
                return Response(content=response.content, status_code=response.status_code)
                
            gemini_response = response.json()
            openai_response = converter.gemini_to_openai(gemini_response, model)
            
            # Post-processing Regex
            post_rules = [r for r in regex_rules if r.type == "post"]
            if openai_response['choices'][0]['message'].get('content'):
                content = openai_response['choices'][0]['message']['content']
                processed_content = regex_service.process(content, post_rules)
                openai_response['choices'][0]['message']['content'] = processed_content
            
            # Log
            log_entry.status = "ok"
            log_entry.status_code = 200
            log_entry.latency = time.time() - start_time
            await db.commit()
            
            return openai_response
        except Exception as e:
             log_entry.status = "error"
             await db.commit()
             raise HTTPException(status_code=500, detail=str(e))
