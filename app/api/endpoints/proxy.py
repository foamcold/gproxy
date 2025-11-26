import json
import time
import httpx
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
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

router = APIRouter()

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
    # TODO: Implement complex preset injection logic (sorting, system/user/ai roles)
    # For now, simple injection of system prompt if preset has it
    if presets:
        # This is a simplified implementation. Real one needs to parse preset content JSON
        pass

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

    # 8. Get Official Key
    try:
        official_key = await gemini_service.get_active_key(db)
    except HTTPException as e:
        raise e

    # 9. Send Request
    start_time = time.time()
    ttft = 0
    
    method = "streamGenerateContent" if openai_request.stream else "generateContent"
    target_url = f"/v1beta/models/{model}:{method}"
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
