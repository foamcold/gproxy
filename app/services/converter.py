from typing import List, Dict, Any, Optional
from app.schemas.openai import ChatCompletionRequest, ChatMessage
import time
import uuid
import httpx
import base64
import json

class Converter:
    @staticmethod
    async def openai_to_gemini(request: ChatCompletionRequest) -> Dict[str, Any]:
        contents = []
        system_instruction = None
        
        for msg in request.messages:
            if msg.role == "system":
                system_instruction = {"parts": [{"text": msg.content}]}
            elif msg.role == "user":
                parts = []
                if isinstance(msg.content, str):
                    parts.append({"text": msg.content})
                elif isinstance(msg.content, list):
                    for item in msg.content:
                        if item.get("type") == "text":
                            parts.append({"text": item["text"]})
                        elif item.get("type") == "image_url":
                            image_url = item["image_url"]["url"]
                            mime_type = "image/jpeg" # 默认
                            data = None

                            if image_url.startswith("data:"):
                                # Base64编码
                                header, encoded = image_url.split(",", 1)
                                data = encoded
                                if "image/png" in header:
                                    mime_type = "image/png"
                                elif "image/jpeg" in header:
                                    mime_type = "image/jpeg"
                                elif "image/webp" in header:
                                    mime_type = "image/webp"
                                elif "image/heic" in header:
                                    mime_type = "image/heic"
                            else:
                                # URL - 下载它
                                async with httpx.AsyncClient() as client:
                                    resp = await client.get(image_url)
                                    if resp.status_code == 200:
                                        data = base64.b64encode(resp.content).decode("utf-8")
                                        content_type = resp.headers.get("content-type")
                                        if content_type:
                                            mime_type = content_type
                            
                            if data:
                                parts.append({
                                    "inline_data": {
                                        "mime_type": mime_type,
                                        "data": data
                                    }
                                })
                contents.append({"role": "user", "parts": parts})
            elif msg.role == "assistant":
                parts = []
                if msg.tool_calls:
                    for tool_call in msg.tool_calls:
                        parts.append({
                            "functionCall": {
                                "name": tool_call["function"]["name"],
                                "args": json.loads(tool_call["function"]["arguments"])
                            }
                        })
                if msg.content:
                    parts.append({"text": msg.content})
                contents.append({"role": "model", "parts": parts})
            elif msg.role == "tool":
                function_name = msg.name
                if not function_name:
                    for prev_msg in reversed(request.messages):
                        if prev_msg.role == "assistant" and prev_msg.tool_calls:
                            for tc in prev_msg.tool_calls:
                                if tc["id"] == msg.tool_call_id:
                                    function_name = tc["function"]["name"]
                                    break
                        if function_name:
                            break
                
                if function_name:
                    contents.append({
                        "role": "function",
                        "parts": [{
                            "functionResponse": {
                                "name": function_name,
                                "response": {"content": msg.content}
                            }
                        }]
                    })
                else:
                    contents.append({"role": "user", "parts": [{"text": f"Tool output: {msg.content}"}]})

        tools = None
        if request.tools:
            tools_list = []
            for tool in request.tools:
                if tool["type"] == "function":
                    tools_list.append({
                        "name": tool["function"]["name"],
                        "description": tool["function"].get("description"),
                        "parameters": tool["function"].get("parameters")
                    })
            if tools_list:
                tools = [{"function_declarations": tools_list}]
        
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature,
                "topP": request.top_p,
                "maxOutputTokens": request.max_tokens,
                "stopSequences": request.stop if isinstance(request.stop, list) else [request.stop] if request.stop else None
            }
        }
        
        if tools:
            payload["tools"] = tools
            
        if request.tool_choice:
            mode = "AUTO"
            allowed_function_names = None
            
            if isinstance(request.tool_choice, str):
                if request.tool_choice == "none":
                    mode = "NONE"
                elif request.tool_choice == "auto":
                    mode = "AUTO"
                elif request.tool_choice == "required":
                    mode = "ANY"
            elif isinstance(request.tool_choice, dict):
                if request.tool_choice.get("type") == "function":
                    mode = "ANY"
                    allowed_function_names = [request.tool_choice["function"]["name"]]
            
            tool_config = {
                "function_calling_config": {
                    "mode": mode
                }
            }
            if allowed_function_names:
                tool_config["function_calling_config"]["allowed_function_names"] = allowed_function_names
            
            payload["tool_config"] = tool_config
        
        if system_instruction:
            payload["system_instruction"] = system_instruction
            
        return payload

    @staticmethod
    def gemini_to_openai(response: Dict[str, Any], model: str) -> Dict[str, Any]:
        choices = []
        if "candidates" in response:
            for i, candidate in enumerate(response["candidates"]):
                message = {"role": "assistant", "content": None}
                finish_reason = "stop"
                
                if "content" in candidate and "parts" in candidate["content"]:
                    content_str = ""
                    tool_calls = []
                    
                    for part in candidate["content"]["parts"]:
                        if "text" in part:
                            content_str += part["text"]
                        elif "functionCall" in part:
                            fc = part["functionCall"]
                            tool_calls.append({
                                "id": f"call_{uuid.uuid4().hex[:8]}",
                                "type": "function",
                                "function": {
                                    "name": fc["name"],
                                    "arguments": json.dumps(fc["args"])
                                }
                            })
                    
                    if content_str:
                        message["content"] = content_str
                    if tool_calls:
                        message["tool_calls"] = tool_calls
                        finish_reason = "tool_calls"
                
                if candidate.get("finishReason") == "MAX_TOKENS":
                    finish_reason = "length"
                
                choices.append({
                    "index": i,
                    "message": message,
                    "finish_reason": finish_reason
                })
        
        # 从Gemini响应中提取真实的token使用数据
        usage = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0
        }
        
        if "usageMetadata" in response:
            metadata = response["usageMetadata"]
            usage["prompt_tokens"] = metadata.get("promptTokenCount", 0)
            usage["completion_tokens"] = metadata.get("candidatesTokenCount", 0)
            usage["total_tokens"] = metadata.get("totalTokenCount", 0)
        
        return {
            "id": f"chatcmpl-{uuid.uuid4()}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": choices,
            "usage": usage
        }

    @staticmethod
    def gemini_to_openai_chunk(response: Dict[str, Any], model: str) -> Dict[str, Any]:
        choices = []
        if "candidates" in response:
            for i, candidate in enumerate(response["candidates"]):
                content = ""
                tool_calls = None
                
                if "content" in candidate and "parts" in candidate["content"]:
                    for part in candidate["content"]["parts"]:
                        if "text" in part:
                            content += part["text"]
                        elif "functionCall" in part:
                            fc = part["functionCall"]
                            tool_calls = [{
                                "index": 0,
                                "id": f"call_{uuid.uuid4().hex[:8]}",
                                "type": "function",
                                "function": {
                                    "name": fc["name"],
                                    "arguments": json.dumps(fc["args"])
                                }
                            }]
                
                finish_reason = None
                if candidate.get("finishReason") == "MAX_TOKENS":
                    finish_reason = "length"
                elif candidate.get("finishReason") == "STOP":
                    finish_reason = "stop"
                
                delta = {}
                if content:
                    delta["content"] = content
                if tool_calls:
                    delta["tool_calls"] = tool_calls
                
                choices.append({
                    "index": i,
                    "delta": delta,
                    "finish_reason": finish_reason
                })
        
        return {
            "id": f"chatcmpl-{uuid.uuid4()}",
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": model,
            "choices": choices
        }

    @staticmethod
    def gemini_error_to_openai(error_content: bytes, status_code: int) -> Dict[str, Any]:
        """
        将 Gemini 错误响应转换为 OpenAI 格式
        
        Args:
            error_content: Gemini 错误响应的内容（bytes）
            status_code: HTTP 状态码
            
        Returns:
            符合 OpenAI 格式的错误对象
        """
        error_message = "An error occurred"
        error_code = None
        error_type = "api_error"
        
        try:
            # 解码内容
            decoded_content = error_content.decode('utf-8')
            print(f"[DEBUG] 原始错误内容: {decoded_content[:200]}")
            
            # 尝试解析 Gemini 错误响应
            gemini_error = json.loads(decoded_content)
            print(f"[DEBUG] 解析后类型: {type(gemini_error)}")
            
            # 如果是列表，取第一个元素
            if isinstance(gemini_error, list) and len(gemini_error) > 0:
                print(f"[DEBUG] 是列表，提取第一个元素")
                gemini_error = gemini_error[0]
            
            print(f"[DEBUG] 最终对象类型: {type(gemini_error)}")
            if isinstance(gemini_error, dict):
                print(f"[DEBUG] 对象键: {list(gemini_error.keys())}")
            
            # Gemini 错误格式通常为: {"error": {"code": xxx, "message": "...", "status": "..."}}
            if isinstance(gemini_error, dict) and "error" in gemini_error:
                error_obj = gemini_error["error"]
                print(f"[DEBUG]  错误对象内容: {error_obj}")
                
                # 提取 message
                if "message" in error_obj:
                    error_message = error_obj["message"]
                    print(f"[DEBUG] 提取的 message: {error_message[:100]}")
                
                # 提取 code
                if "code" in error_obj:
                    error_code = str(error_obj["code"])
                    print(f"[DEBUG] 提取的 code: {error_code}")
                
                # 根据 status 或 code 推断错误类型
                if "status" in error_obj:
                    status = error_obj["status"]
                    print(f"[DEBUG] status: {status}")
                    if "INVALID" in status or "PERMISSION_DENIED" in status:
                        error_type = "invalid_request_error"
                    elif "UNAUTHENTICATED" in status:
                        error_type = "authentication_error"
                    elif "RESOURCE_EXHAUSTED" in status:
                        error_type = "rate_limit_error"
            else:
                # 如果不是预期的格式，使用原始内容作为错误消息
                print(f"[DEBUG] 非预期格式，使用原始内容")
                error_message = decoded_content
                
        except Exception as e:
            # 如果解析失败，使用原始内容
            print(f"[DEBUG] 解析失败: {e}")
            import traceback
            traceback.print_exc()
            try:
                error_message = error_content.decode('utf-8')
            except:
                error_message = f"HTTP {status_code} Error"
        
        # 如果没有提取到 code，使用 HTTP 状态码的字符串形式
        if error_code is None:
            # 常见的 API key 错误码映射
            if status_code == 400:
                error_code = "invalid_api_key"
            elif status_code == 401:
                error_code = "invalid_api_key"
            elif status_code == 403:
                error_code = "permission_denied"
            elif status_code == 429:
                error_code = "rate_limit_exceeded"
            else:
                error_code = f"http_{status_code}"
        
        print(f"[DEBUG] 最终返回 - message前50字符: {error_message[:50]}, code: {error_code}, type: {error_type}")
        
        return {
            "error": {
                "message": error_message,
                "type": error_type,
                "param": None,
                "code": error_code
            }
        }

converter = Converter()
