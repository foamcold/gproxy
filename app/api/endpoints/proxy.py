import json
import time
import httpx
import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.models.user import User
from app.models.key import ExclusiveKey, OfficialKey
from app.models.preset import Preset
from app.models.regex import RegexRule
from app.models.preset_regex import PresetRegexRule
from app.models.log import Log
from app.models.system_config import SystemConfig
from app.schemas.openai import ChatCompletionRequest
from app.services.gemini_service import gemini_service
from app.services.converter import converter
from app.services.variable_service import variable_service
from app.services.regex_service import regex_service
from app.core.config import settings

router = APIRouter()

# Configure logger
logger = logging.getLogger(__name__)
current_log_level = "INFO"

async def get_log_level(db: AsyncSession):
    global current_log_level
    result = await db.execute(select(SystemConfig))
    config = result.scalars().first()
    if config and config.log_level:
        current_log_level = config.log_level
        return config.log_level
    current_log_level = "INFO"
    return "INFO"

def update_logger_level(level_name: str):
    level = getattr(logging, level_name.upper(), logging.INFO)
    logger.setLevel(level)
    
    # Ensure handler exists and set level for handler as well
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    for handler in logger.handlers:
        handler.setLevel(level)

def debug_log(message: str):
    """
    Wrapper for debug logging.
    """
    if current_log_level == "DEBUG":
        logger.debug(message)


@router.get("/v1/models")
async def list_models(
    key_info: tuple = Depends(deps.get_official_key_from_proxy)
):
    """
    处理 GET /v1/models 请求，通过代理到 Google API 列出可用模型。
    使用新的依赖项处理密钥。
    """
    official_key, _ = key_info

    # 2. 代理到 Google API
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://generativelanguage.googleapis.com/v1beta/models",
                params={"key": official_key}
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


@router.api_route("/v1beta/{path:path}", methods=["POST", "PUT", "DELETE", "GET"])
async def proxy_beta_requests(
    request: Request,
    path: str,
    key_info: tuple = Depends(deps.get_official_key_from_proxy)
):
    """
    通用代理，处理 /v1beta/ 下的所有请求，并以流的形式返回响应。
    修复了错误状态码无法正确透传的问题。
    """
    official_key, _ = key_info
    
    target_url = f"https://generativelanguage.googleapis.com/v1beta/{path}"

    headers = {k: v for k, v in request.headers.items() if k.lower() not in ["host", "authorization", "x-goog-api-key", "key"]}
    params = dict(request.query_params)
    params['key'] = official_key
    body = await request.body()

    try:
        client = httpx.AsyncClient(timeout=120.0)
        
        req = client.build_request(
            method=request.method,
            url=target_url,
            headers=headers,
            params=params,
            content=body
        )
        
        response = await client.send(req, stream=True)
        
        if response.status_code >= 400:
            error_content = await response.aread()
            await response.aclose()
            await client.aclose()
            return Response(content=error_content, status_code=response.status_code, media_type=response.headers.get("content-type"))
            
        excluded_headers = {"content-encoding", "content-length", "transfer-encoding", "connection"}
        response_headers = {k: v for k, v in response.headers.items() if k.lower() not in excluded_headers}

        async def safe_stream_generator(response):
            try:
                async for chunk in response.aiter_bytes():
                    yield chunk
            except (httpx.ReadError, httpx.ConnectError) as e:
                logger.error(f"Proxy stream connection error: {e}")
            except Exception as e:
                logger.error(f"Unexpected proxy stream error: {e}")
            finally:
                await response.aclose()

        return StreamingResponse(
            safe_stream_generator(response),
            status_code=response.status_code,
            headers=response_headers,
            background=None # background task is handled in finally block
        )

    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Proxy error to Google API: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@router.post("/v1/chat/completions")
async def chat_completions(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    key_info: tuple = Depends(deps.get_official_key_from_proxy)
):
    # 0. Configure Logging Level
    log_level = await get_log_level(db)
    update_logger_level(log_level)

    # 1. Auth & Key Validation
    official_key, user = key_info
    
    # 检查是否是专属密钥的逻辑现在由 get_official_key_from_proxy 处理
    # 如果 user 不为 None, 则说明是有效的专属密钥
    is_exclusive = user is not None
    exclusive_key = None
    if is_exclusive:
        # 为了日志记录，可能需要获取 exclusive_key 对象
        auth_header = request.headers.get("Authorization")
        client_key = auth_header.split(" ")[1] if auth_header and auth_header.startswith("Bearer ") else ""
        if client_key:
            result = await db.execute(select(ExclusiveKey).filter(ExclusiveKey.key == client_key))
            exclusive_key = result.scalars().first()
            debug_log(f"处理专属 Key 请求. Key ID: {exclusive_key.id}, 名称: {exclusive_key.name}")
    else:
        debug_log(f"处理官方 Key 请求.")

    # 2. Parse Request
    try:
        body = await request.json()
        openai_request = ChatCompletionRequest(**body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {e}")

    # 3. Load User Context (Presets, Regex) if user exists
    presets = []
    regex_rules = []
    preset_regex_rules = []
    
    if exclusive_key:
        # Load Linked Preset
        if exclusive_key.preset_id:
            result = await db.execute(select(Preset).filter(Preset.id == exclusive_key.preset_id))
            preset = result.scalars().first()
            if preset:
                presets.append(preset)
                # Load Linked Preset Regex Rules (Local Regex)
                # Ensure they are loaded if preset exists
                result = await db.execute(select(PresetRegexRule).filter(PresetRegexRule.preset_id == preset.id, PresetRegexRule.is_active == True))
                preset_regex_rules = result.scalars().all()
                debug_log(f"已加载 {len(preset_regex_rules)} 条局部正则规则 (预设: {preset.name})")
        
        # Load Linked Regex Rule (Global Regex)
        if exclusive_key.enable_regex:
            result = await db.execute(select(RegexRule).filter(RegexRule.is_active == True))
            regex_rules = result.scalars().all()
            debug_log(f"已加载 {len(regex_rules)} 条全局正则规则")

    # 4. Pre-processing Regex (Order: Global Pre -> Local Pre)
    # Global Pre-processing
    global_pre_rules = [r for r in regex_rules if r.type == "pre"]
    debug_log(f"应用 {len(global_pre_rules)} 条全局前置正则规则 (Global Pre)")
    for msg in openai_request.messages:
        if isinstance(msg.content, str):
            original_content = msg.content
            msg.content = regex_service.process(msg.content, global_pre_rules)
            if original_content != msg.content:
                 debug_log(f"全局前置正则处理: '{original_content}' -> '{msg.content}'")

    # Local Pre-processing
    local_pre_rules = [r for r in preset_regex_rules if r.type == "pre"]
    debug_log(f"应用 {len(local_pre_rules)} 条局部前置正则规则 (Local Pre)")
    for msg in openai_request.messages:
        if isinstance(msg.content, str):
            original_content = msg.content
            msg.content = regex_service.process(msg.content, local_pre_rules)
            if original_content != msg.content:
                 debug_log(f"局部前置正则处理: '{original_content}' -> '{msg.content}'")

    # 5. Apply Presets (Inject into messages)
    if presets and openai_request.messages:
        for preset in presets:
            debug_log(f"开始处理预设: {preset.name}")
            try:
                preset_content = json.loads(preset.content)
                items = preset_content.get('items', [])
                
                if not items:
                    debug_log(f"预设 {preset.name} 内容为空")
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
                
                debug_log(f"预设条目处理: 共有 {len(sorted_items)} 个条目")
                
                for item in sorted_items:
                    item_type = item.get('type', 'normal')
                    item_role = item.get('role', 'system')
                    item_content = item.get('content', '')
                    item_enabled = item.get('enabled', True)

                    if not item_enabled:
                        debug_log(f"跳过禁用条目: 类型={item_type}")
                        continue
                    
                    if item_type == 'normal':
                        # 直接注入普通条目
                        debug_log(f"注入普通条目: role={item_role}, content_len={len(item_content)}")
                        processed_messages.append({
                            'role': item_role,
                            'content': item_content
                        })
                    elif item_type == 'user_input':
                        # 注入最后一条用户消息
                        if last_user_message:
                            debug_log(f"注入用户输入: content_len={len(str(last_user_message.content))}")
                            processed_messages.append({
                                'role': last_user_message.role,
                                'content': last_user_message.content
                            })
                        else:
                            debug_log("未找到用户输入消息")
                    elif item_type == 'history':
                        # 注入历史消息
                        count = len(history_messages)
                        debug_log(f"注入历史消息: {count} 条")
                        for hist_msg in history_messages:
                            processed_messages.append({
                                'role': hist_msg.role,
                                'content': hist_msg.content if isinstance(hist_msg.content, str) else str(hist_msg.content)
                            })
                
                # 如果处理后有消息，替换原始消息
                if processed_messages:
                    from app.schemas.openai import ChatMessage
                    openai_request.messages = [ChatMessage(role=msg['role'], content=msg['content']) for msg in processed_messages]
                    debug_log(f"预设处理完成, 新的消息列表长度: {len(openai_request.messages)}")
                    
            except Exception as e:
                # 如果预设解析失败，跳过该预设
                logger.error(f"预设解析失败: {e}")
                continue

    # 6. Variable Processing
    # Apply variables to all string content in messages
    debug_log("开始变量处理")
    for msg in openai_request.messages:
        if isinstance(msg.content, str):
            original_content = msg.content
            msg.content = variable_service.parse_variables(msg.content)
            if original_content != msg.content:
                debug_log(f"变量替换: '{original_content}' -> '{msg.content}'")

    # 7. Model Mapping & Conversion
    model = openai_request.model
    # Simple mapping
    if model.startswith("gpt-"):
        model = "gemini-1.5-flash"
    
    gemini_payload = await converter.openai_to_gemini(openai_request)
    debug_log(f"发送给 Gemini 的最终 Payload: {json.dumps(gemini_payload, ensure_ascii=False, indent=2)}")

    # 8. Get API Key (Official or User's) - This is now handled by the dependency

    # 9. Send Request
    start_time = time.time()
    ttft = 0
    
    method = "streamGenerateContent" if openai_request.stream else "generateContent"
    target_url = f"{settings.GEMINI_BASE_URL}/v1beta/models/{model}:{method}"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": official_key
    }

    # 计算输入token - 使用实际发送的gemini_payload而非原始body
    input_tokens_estimate = len(json.dumps(gemini_payload)) // 4

    # Log entry creation (initial)
    log_entry = Log(
        exclusive_key_id=exclusive_key.id if exclusive_key else None,
        user_id=user.id if user else None,
        model=model,
        status="pending",
        is_stream=openai_request.stream,
        input_tokens=input_tokens_estimate
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)

    async def response_generator(response):
        debug_log("Entering response_generator")
        nonlocal ttft
        first_token_received = False
        full_response_text = ""
        buffer = ""
        # 用于存储从Gemini流式响应中提取的token统计
        usage_metadata = None
        
        try:
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
                                
                                # 检查是否是流的最后一个chunk（包含finishReason和usageMetadata）
                                # Gemini API在流式响应中，只在最后一个chunk中返回usageMetadata
                                # 通过检测finishReason确保我们只保存最后一条的metadata
                                if "usageMetadata" in gemini_chunk:
                                    # 检查是否有candidates且包含finishReason（流结束标志）
                                    has_finish_reason = False
                                    if "candidates" in gemini_chunk:
                                        for candidate in gemini_chunk["candidates"]:
                                            if candidate.get("finishReason"):
                                                has_finish_reason = True
                                                break
                                    
                                    # 只在检测到流结束时保存usageMetadata，或者无条件保存（后者会被最后一个覆盖）
                                    # 为了健壮性，我们采用无条件保存策略，确保即使API行为变化也能获取到最后的metadata
                                    usage_metadata = gemini_chunk["usageMetadata"]
                                    if has_finish_reason:
                                        debug_log(f"检测到流结束，保存usageMetadata: {usage_metadata}")
                                    else:
                                        debug_log(f"获取到usageMetadata（流未结束）: {usage_metadata}")
                                
                                openai_chunk = converter.gemini_to_openai_chunk(gemini_chunk, model)
                                
                                # Post-processing Regex on chunk content (Order: Local Post -> Global Post)
                                local_post_rules = [r for r in preset_regex_rules if r.type == "post"]
                                global_post_rules = [r for r in regex_rules if r.type == "post"]
                                
                                if openai_chunk['choices'][0]['delta'].get('content'):
                                    content = openai_chunk['choices'][0]['delta']['content']
                                    original_chunk_content = content

                                    # Local Post
                                    content = regex_service.process(content, local_post_rules)
                                    if original_chunk_content != content:
                                        debug_log(f"流式局部后置正则处理: '{original_chunk_content}' -> '{content}'")
                                    
                                    # Global Post
                                    intermediate_content = content
                                    content = regex_service.process(content, global_post_rules)
                                    if intermediate_content != content:
                                        debug_log(f"流式全局后置正则处理: '{intermediate_content}' -> '{content}'")
                                    
                                    openai_chunk['choices'][0]['delta']['content'] = content
                                    full_response_text += content
                                
                                yield f"data: {json.dumps(openai_chunk)}\n\n"
                            except json.JSONDecodeError:
                                pass
                        else:
                            break
                    except Exception:
                        break
                        
            yield "data: [DONE]\n\n"
        
        except (httpx.ReadError, httpx.ConnectError) as e:
            logger.error(f"Stream connection error: {e}")
            error_data = {
                "error": {
                    "message": f"Stream connection error: {str(e)}",
                    "type": "stream_error",
                    "code": "connection_error"
                }
            }
            yield f"data: {json.dumps(error_data)}\n\n"
        except Exception as e:
            logger.error(f"Unexpected stream error: {e}")
            error_data = {
                "error": {
                    "message": f"Unexpected stream error: {str(e)}",
                    "type": "stream_error",
                    "code": "internal_error"
                }
            }
            yield f"data: {json.dumps(error_data)}\n\n"
        
        finally:
            # Finalize Log - 使用Gemini返回的真实token数据（如果可用）
            log_entry.status = "ok"
            log_entry.status_code = 200
            log_entry.latency = time.time() - start_time
            log_entry.ttft = ttft
            
            # 如果Gemini流式响应返回了usageMetadata，使用真实数据
            if usage_metadata:
                log_entry.input_tokens = usage_metadata.get("promptTokenCount", log_entry.input_tokens)
                log_entry.output_tokens = usage_metadata.get("candidatesTokenCount", 0)
                debug_log(f"使用Gemini返回的真实token数据 - input: {log_entry.input_tokens}, output: {log_entry.output_tokens}")
            else:
                # Fallback: 使用文本长度估算输出token
                log_entry.output_tokens = len(full_response_text) // 4
                debug_log(f"使用估算的token数据 - input: {log_entry.input_tokens}, output: {log_entry.output_tokens}")
            
            await db.commit()
            
            # 更新密钥状态
            if response.status_code:
                await gemini_service.update_key_status(
                    db, 
                    official_key, 
                    response.status_code,
                    input_tokens=log_entry.input_tokens,
                    output_tokens=log_entry.output_tokens
                )

            await response.aclose()
            
    if openai_request.stream:
        try:
            client = httpx.AsyncClient(timeout=120.0)
            req = client.build_request("POST", target_url, json=gemini_payload, headers=headers)
            response = await client.send(req, stream=True)

            if response.status_code != 200:
                error_content = await response.aread()
                log_entry.status = "error"
                log_entry.status_code = response.status_code
                await db.commit()
                await response.aclose()
                # 将 Gemini 错误转换为 OpenAI 格式并直接返回 JSON
                openai_error = converter.gemini_error_to_openai(error_content, response.status_code)
                # 在返回前更新密钥状态
                await gemini_service.update_key_status(
                    db, 
                    official_key, 
                    response.status_code,
                    input_tokens=log_entry.input_tokens
                )
                return JSONResponse(content=openai_error, status_code=response.status_code)
            
            async def safe_chat_stream_generator(response, client):
                debug_log("Entering safe_chat_stream_generator")
                try:
                    async for chunk in response_generator(response):
                        yield chunk
                except (httpx.ReadError, httpx.ConnectError) as e:
                    logger.error(f"Chat stream connection error: {e}")
                    error_data = {
                        "error": {
                            "message": f"Chat stream connection error: {str(e)}",
                            "type": "stream_error",
                            "code": "connection_error"
                        }
                    }
                    yield f"data: {json.dumps(error_data)}\n\n"
                except Exception as e:
                    logger.error(f"Unexpected chat stream error: {e}", exc_info=True)
                    error_data = {
                        "error": {
                            "message": f"Unexpected chat stream error: {str(e)}",
                            "type": "stream_error",
                            "code": "internal_error"
                        }
                    }
                    yield f"data: {json.dumps(error_data)}\n\n"
                finally:
                    await client.aclose()
                    debug_log("Chat stream client closed")

            debug_log("Creating StreamingResponse with safe_chat_stream_generator")
            return StreamingResponse(safe_chat_stream_generator(response, client), media_type="text/event-stream")
        
        except Exception as e:
            log_entry.status = "error"
            log_entry.status_code = 500
            await db.commit()
            await gemini_service.update_key_status(
                db, 
                official_key, 
                500,
                input_tokens=log_entry.input_tokens
            )
            raise HTTPException(status_code=500, detail=str(e))
    else:
        # Non-streaming logic
        try:
            response = await gemini_service.client.post(
                target_url,
                json=gemini_payload,
                headers=headers,
                timeout=120.0
            )
            
            # 正确处理非200状态码
            if response.status_code != 200:
                log_entry.status = "error"
                log_entry.status_code = response.status_code
                await db.commit()
                # 将 Gemini 错误转换为 OpenAI 格式
                openai_error = converter.gemini_error_to_openai(response.content, response.status_code)
                # 在返回前更新密钥状态
                await gemini_service.update_key_status(
                    db, 
                    official_key, 
                    response.status_code,
                    input_tokens=log_entry.input_tokens
                )
                return JSONResponse(content=openai_error, status_code=response.status_code)
            
            gemini_response = response.json()
            openai_response = converter.gemini_to_openai(gemini_response, model)
            
            # Post-processing Regex (Order: Local Post -> Global Post)
            local_post_rules = [r for r in preset_regex_rules if r.type == "post"]
            global_post_rules = [r for r in regex_rules if r.type == "post"]
            
            if openai_response['choices'][0]['message'].get('content'):
                content = openai_response['choices'][0]['message']['content']
                original_content = content

                # Local Post
                content = regex_service.process(content, local_post_rules)
                if original_content != content:
                     debug_log(f"非流式局部后置正则处理: '{original_content}' -> '{content}'")

                # Global Post
                intermediate_content = content
                content = regex_service.process(content, global_post_rules)
                if intermediate_content != content:
                     debug_log(f"非流式全局后置正则处理: '{intermediate_content}' -> '{content}'")
                
                openai_response['choices'][0]['message']['content'] = content
            
            # Log - 使用Gemini返回的真实token数据
            log_entry.status = "ok"
            log_entry.status_code = 200
            log_entry.latency = time.time() - start_time
            
            # 从响应中获取真实的token统计
            usage = openai_response.get('usage', {})
            if usage.get('prompt_tokens', 0) > 0:
                # 使用Gemini返回的真实数据
                log_entry.input_tokens = usage['prompt_tokens']
                log_entry.output_tokens = usage['completion_tokens']
            else:
                # Fallback: 如果没有真实数据，使用估算值
                log_entry.output_tokens = len(json.dumps(openai_response)) // 4
            
            await db.commit()

            # 更新密钥状态
            await gemini_service.update_key_status(
                db, 
                official_key, 
                response.status_code,
                input_tokens=log_entry.input_tokens,
                output_tokens=log_entry.output_tokens
            )
            
            return JSONResponse(content=openai_response)
        except Exception as e:
             log_entry.status = "error"
             log_entry.status_code = 500
             await db.commit()
             await gemini_service.update_key_status(
                 db, 
                 official_key, 
                 500,
                 input_tokens=log_entry.input_tokens
             )
             raise HTTPException(status_code=500, detail=str(e))
