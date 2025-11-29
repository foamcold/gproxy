from typing import Dict, Any, Tuple, Literal
import json
import time
import uuid
import httpx
import base64
from app.schemas.openai import ChatCompletionRequest

# 定义支持的API格式
ApiFormat = Literal["openai", "gemini", "claude"]

class UniversalConverter:
    """
    一个通用的API格式转换器，用于在OpenAI、Gemini和Claude格式之间进行转换。
    """

    # --- 格式检测 ---
    def detect_format(self, body: Dict[str, Any]) -> ApiFormat:
        """
        通过请求体的结构检测API格式。

        Args:
            body: 请求体内容。

        Returns:
            检测到的API格式 ("openai", "gemini", "claude")。
        """
        if "contents" in body and isinstance(body["contents"], list):
            return "gemini"
        if "messages" in body and "max_tokens" in body: # Claude-specific field
            return "claude"
        if "messages" in body:
            return "openai"
        raise ValueError("无法检测到API格式或格式不支持")

    # --- 主转换入口 ---
    def convert(self, body: Dict[str, Any], to_format: ApiFormat) -> Tuple[Dict[str, Any], ApiFormat]:
        """
        将请求体从一种格式转换为另一种格式。

        Args:
            body: 原始请求体。
            to_format: 目标API格式。

        Returns:
            一个元组，包含转换后的请求体和原始请求体的格式。
        """
        from_format = self.detect_format(body)
        if from_format == to_format:
            return body, from_format

        # 中转枢纽：任何格式都先转为OpenAI格式
        openai_body = body
        if from_format != "openai":
            converter_func = getattr(self, f"{from_format}_to_openai", None)
            if not callable(converter_func):
                raise NotImplementedError(f"从 {from_format} 到 openai 的转换未实现")
            # 注意：这里的转换函数需要适配不同的输入结构
            openai_body = converter_func(body, model=body.get("model", "unknown"))

        # 如果目标是OpenAI，直接返回
        if to_format == "openai":
            return openai_body, from_format

        # 从OpenAI格式转换为目标格式
        final_converter_func = getattr(self, f"openai_to_{to_format}", None)
        if not callable(final_converter_func):
            raise NotImplementedError(f"从 openai 到 {to_format} 的转换未实现")
        
        # 为了调用openai_to_gemini，我们需要一个ChatCompletionRequest对象
        # 注意：这部分可能需要根据实际情况调整，特别是对于从非openai格式转换来的情况
        # 这里假设经过to_openai转换后，结构是兼容ChatCompletionRequest的
        if not isinstance(openai_body, ChatCompletionRequest):
             openai_request = ChatCompletionRequest(**openai_body)
        else:
             openai_request = openai_body
        
        converted_body = final_converter_func(openai_request)

        return converted_body, from_format

    # --- OpenAI <-> Gemini ---
    async def openai_to_gemini(self, request: ChatCompletionRequest) -> Dict[str, Any]:
        """复用并扩展现有的 openai_to_gemini 逻辑"""
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
                            # 图像处理逻辑（保持不变）
                            image_url = item["image_url"]["url"]
                            mime_type = "image/jpeg"
                            data = None
                            if image_url.startswith("data:"):
                                header, encoded = image_url.split(",", 1)
                                data = encoded
                                mime_type = header.split(";")[0].split(":")[1]
                            else:
                                async with httpx.AsyncClient() as client:
                                    resp = await client.get(image_url)
                                    if resp.status_code == 200:
                                        data = base64.b64encode(resp.content).decode("utf-8")
                                        content_type = resp.headers.get("content-type")
                                        if content_type:
                                            mime_type = content_type
                            if data:
                                parts.append({"inline_data": {"mime_type": mime_type, "data": data}})
                contents.append({"role": "user", "parts": parts})
            elif msg.role == "assistant":
                parts = []
                if msg.tool_calls:
                    for tool_call in msg.tool_calls:
                        parts.append({"functionCall": {"name": tool_call["function"]["name"], "args": json.loads(tool_call["function"]["arguments"])}})
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
                        "parts": [{"functionResponse": {"name": function_name, "response": {"content": msg.content}}}]
                    })
                else:
                    contents.append({"role": "user", "parts": [{"text": f"Tool output: {msg.content}"}]})
        
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature,
                "topP": request.top_p,
                "maxOutputTokens": request.max_tokens,
                "stopSequences": request.stop if isinstance(request.stop, list) else [request.stop] if request.stop else []
            }
        }
        if system_instruction:
            payload["system_instruction"] = system_instruction
        
        # 工具和工具选择的转换
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
                payload["tools"] = [{"function_declarations": tools_list}]
        
        if request.tool_choice:
            mode = "AUTO"
            allowed_function_names = None
            if isinstance(request.tool_choice, str):
                if request.tool_choice == "none": mode = "NONE"
                elif request.tool_choice == "auto": mode = "AUTO"
                elif request.tool_choice == "required": mode = "ANY"
            elif isinstance(request.tool_choice, dict):
                if request.tool_choice.get("type") == "function":
                    mode = "ANY"
                    allowed_function_names = [request.tool_choice["function"]["name"]]
            
            tool_config = {"function_calling_config": {"mode": mode}}
            if allowed_function_names:
                tool_config["function_calling_config"]["allowed_function_names"] = allowed_function_names
            payload["tool_config"] = tool_config
            
        return payload

    def gemini_to_openai(self, response: Dict[str, Any], model: str) -> Dict[str, Any]:
        """复用现有的 gemini_to_openai 逻辑"""
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
        
        usage = response.get("usageMetadata", {})
        return {
            "id": f"chatcmpl-{uuid.uuid4()}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": choices,
            "usage": {
                "prompt_tokens": usage.get("promptTokenCount", 0),
                "completion_tokens": usage.get("candidatesTokenCount", 0),
                "total_tokens": usage.get("totalTokenCount", 0),
            },
        }

    # --- OpenAI <-> Claude ---
    def openai_to_claude(self, request: ChatCompletionRequest) -> Dict[str, Any]:
        """将OpenAI格式转换为Claude格式"""
        system_prompt = None
        messages = []
        for msg in request.messages:
            if msg.role == "system":
                system_prompt = msg.content
            else:
                # Claude 的消息格式需要特殊处理
                # 特别是对于多模态内容
                messages.append({"role": msg.role, "content": msg.content})

        return {
            "model": request.model,
            "system": system_prompt,
            "messages": messages,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "stream": request.stream,
            # 其他参数映射...
        }

    def claude_to_openai(self, response: Dict[str, Any], model: str) -> Dict[str, Any]:
        """将Claude格式转换为OpenAI格式"""
        # 实现逻辑...
        # 这需要根据Claude的具体响应格式来定
        return {
            "id": f"chatcmpl-{uuid.uuid4()}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": response.get("content", [{}])[0].get("text", "")
                    },
                    "finish_reason": "stop" # 简化处理
                }
            ],
            "usage": {
                "prompt_tokens": 0, # Claude响应中可能没有token信息
                "completion_tokens": 0,
                "total_tokens": 0,
            }
        }
        
    # --- 流式和错误处理辅助函数 ---
    def gemini_to_openai_chunk(self, response: Dict[str, Any], model: str) -> Dict[str, Any]:
        """将Gemini流式块转换为OpenAI格式"""
        choices = []
        if "candidates" in response:
            for i, candidate in enumerate(response["candidates"]):
                delta = {}
                finish_reason = None
                
                if "content" in candidate and "parts" in candidate["content"]:
                    content_str = ""
                    tool_calls = []
                    for part in candidate["content"]["parts"]:
                        if "text" in part:
                            content_str += part["text"]
                        elif "functionCall" in part:
                            fc = part["functionCall"]
                            tool_calls.append({
                                "index": 0,
                                "id": f"call_{uuid.uuid4().hex[:8]}",
                                "type": "function",
                                "function": {"name": fc["name"], "arguments": json.dumps(fc["args"])}
                            })
                    if content_str:
                        delta["content"] = content_str
                    if tool_calls:
                        delta["tool_calls"] = tool_calls

                if candidate.get("finishReason") == "MAX_TOKENS": finish_reason = "length"
                elif candidate.get("finishReason") == "STOP": finish_reason = "stop"

                choices.append({"index": i, "delta": delta, "finish_reason": finish_reason})
        
        return {
            "id": f"chatcmpl-{uuid.uuid4()}",
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": model,
            "choices": choices
        }

    def claude_to_openai_chunk(self, chunk: Dict[str, Any], model: str) -> Dict[str, Any]:
        """将Claude流式块转换为OpenAI格式"""
        # Claude流式响应需要特殊处理
        # 例如: event: message_delta, data: {"type":"message_delta",...}
        delta_content = ""
        if chunk.get("type") == "content_block_delta":
            delta_content = chunk.get("delta", {}).get("text", "")

        return {
            "id": f"chatcmpl-{uuid.uuid4()}",
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": model,
            "choices": [{"index": 0, "delta": {"content": delta_content}, "finish_reason": None}]
        }
        
    def generic_error_to_openai(self, error_content: bytes, status_code: int, from_format: ApiFormat) -> Dict[str, Any]:
        """将任何源API的错误响应转换为OpenAI格式"""
        if from_format == "gemini":
            return self.gemini_error_to_openai(error_content, status_code)
        
        # 为其他格式提供通用回退
        error_message = "An unknown error occurred"
        error_type = "api_error"
        error_code = f"http_{status_code}"
        try:
            decoded_content = error_content.decode('utf-8')
            error_data = json.loads(decoded_content)
            if isinstance(error_data, dict) and "error" in error_data:
                error_obj = error_data["error"]
                error_message = error_obj.get("message", decoded_content)
                error_type = error_obj.get("type", "api_error")
                error_code = error_obj.get("code", f"http_{status_code}")
            else:
                error_message = decoded_content
        except Exception:
            try:
                error_message = error_content.decode('utf-8')
            except:
                error_message = f"HTTP {status_code} Error from upstream"

        return {
            "error": {
                "message": error_message,
                "type": error_type,
                "param": None,
                "code": error_code
            }
        }

    def gemini_error_to_openai(self, error_content: bytes, status_code: int) -> Dict[str, Any]:
        """将 Gemini 错误响应转换为 OpenAI 格式"""
        try:
            gemini_error = json.loads(error_content.decode('utf-8'))
            error_obj = gemini_error.get("error", {})
            error_message = error_obj.get("message", "Gemini API error")
            status = error_obj.get("status")
            
            error_type = "api_error"
            if status in ["INVALID_ARGUMENT", "PERMISSION_DENIED"]:
                error_type = "invalid_request_error"
            elif status == "UNAUTHENTICATED":
                error_type = "authentication_error"
            elif status == "RESOURCE_EXHAUSTED":
                error_type = "rate_limit_error"

            return {
                "error": {
                    "message": error_message,
                    "type": error_type,
                    "param": None,
                    "code": status
                }
            }
        except Exception:
            return self.generic_error_to_openai(error_content, status_code, "gemini")

# 创建单例
universal_converter = UniversalConverter()