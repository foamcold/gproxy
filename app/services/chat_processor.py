import json
import time
import httpx
import logging
from typing import AsyncGenerator, Tuple, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.openai import ChatCompletionRequest, ChatMessage
from app.services.universal_converter import universal_converter, ApiFormat
from app.services.variable_service import variable_service
from app.services.regex_service import regex_service
from app.models.user import User
from app.models.key import ExclusiveKey
from app.models.preset import Preset
from app.models.regex import RegexRule
from app.models.preset_regex import PresetRegexRule
from app.models.log import Log
from app.core.config import settings
from sqlalchemy.future import select
from fastapi import Request

logger = logging.getLogger(__name__)

class ChatProcessor:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=120.0)

    async def process_request(
        self,
        request: Request,
        db: AsyncSession,
        official_key: str,
        exclusive_key: ExclusiveKey,
        user: User,
        log_level: str
    ) -> Tuple[Dict[str, Any], int, ApiFormat]:
        """
        处理聊天请求的核心逻辑，包括格式转换、预设、正则等。
        """
        # 1. 解析和转换请求
        body = await request.json()
        target_format = "gemini" # 目前上游固定为Gemini
        
        converted_body, original_format = universal_converter.convert(body, "openai")
        openai_request = ChatCompletionRequest(**converted_body)

        # 2. 加载预设和正则
        presets, regex_rules, preset_regex_rules = await self._load_context(db, exclusive_key)

        # 3. 应用前置处理（正则 -> 预设 -> 变量）
        openai_request = self._apply_preprocessing(openai_request, presets, regex_rules, preset_regex_rules)

        # 4. 再次转换到目标格式
        final_payload, _ = universal_converter.convert(openai_request.dict(), target_format)
        
        # 5. 发送到上游并处理响应
        if openai_request.stream:
            return self.stream_chat_completion(
                final_payload, target_format, original_format, openai_request.model,
                global_rules=regex_rules, local_rules=preset_regex_rules
            )
        else:
            return await self.non_stream_chat_completion(
                final_payload, target_format, original_format, openai_request.model,
                global_rules=regex_rules, local_rules=preset_regex_rules
            )

    async def _load_context(self, db: AsyncSession, exclusive_key: ExclusiveKey) -> Tuple[List, List, List]:
        """从数据库加载预设和正则规则"""
        presets, regex_rules, preset_regex_rules = [], [], []
        if exclusive_key.preset_id:
            result = await db.execute(select(Preset).filter(Preset.id == exclusive_key.preset_id))
            preset = result.scalars().first()
            if preset:
                await db.refresh(preset)
                presets.append({"id": preset.id, "name": preset.name, "content": preset.content})
                result = await db.execute(select(PresetRegexRule).filter(PresetRegexRule.preset_id == preset.id, PresetRegexRule.is_active == True))
                preset_regex_rules = result.scalars().all()
        
        if exclusive_key.enable_regex:
            result = await db.execute(select(RegexRule).filter(RegexRule.is_active == True))
            regex_rules = result.scalars().all()
            
        return presets, regex_rules, preset_regex_rules

    def _apply_preprocessing(
        self,
        request: ChatCompletionRequest,
        presets: List,
        global_rules: List,
        local_rules: List
    ) -> ChatCompletionRequest:
        """应用所有前置处理: 全局正则 -> 局部正则 -> 预设 -> 变量"""
        # 1. 应用正则
        global_pre = [r for r in global_rules if r.type == "pre"]
        local_pre = [r for r in local_rules if r.type == "pre"]
        for msg in request.messages:
            if isinstance(msg.content, str):
                msg.content = regex_service.process(msg.content, global_pre)
                msg.content = regex_service.process(msg.content, local_pre)

        # 2. 应用预设
        if presets and request.messages:
            for preset in presets:
                try:
                    content_str = preset.get('content')
                    if not content_str: continue
                    preset_content = json.loads(content_str) if isinstance(content_str, str) else content_str
                    items = preset_content.get('preset') or preset_content.get('items', [])
                    if not items: continue

                    sorted_items = sorted(items, key=lambda x: x.get('order', 0))
                    processed_messages, original_messages = [], list(request.messages)
                    last_user_message = next((msg for msg in reversed(original_messages) if msg.role == 'user'), None)
                    history_messages = [msg for msg in original_messages if msg != last_user_message]
                    
                    for item in sorted_items:
                        if not item.get('enabled', True): continue
                        item_type = item.get('type', 'normal')
                        if item_type == 'normal':
                            processed_messages.append({'role': item.get('role', 'system'), 'content': item.get('content', '')})
                        elif item_type == 'user_input' and last_user_message:
                            processed_messages.append({'role': last_user_message.role, 'content': last_user_message.content})
                        elif item_type == 'history':
                            processed_messages.extend([{'role': h.role, 'content': h.content if isinstance(h.content, str) else str(h.content)} for h in history_messages])
                    
                    if processed_messages:
                        request.messages = [ChatMessage(**msg) for msg in processed_messages]
                except Exception as e:
                    logger.error(f"预设处理失败: {e}")
                    continue

        # 3. 应用变量
        for msg in request.messages:
            if isinstance(msg.content, str):
                msg.content = variable_service.parse_variables(msg.content)
        
        return request

    def _apply_postprocessing(self, content: str, global_rules: List, local_rules: List) -> str:
        """应用所有后置处理: 局部正则 -> 全局正则"""
        local_post = [r for r in local_rules if r.type == "post"]
        global_post = [r for r in global_rules if r.type == "post"]
        content = regex_service.process(content, local_post)
        content = regex_service.process(content, global_post)
        return content

    async def non_stream_chat_completion(
        self, payload: Dict, upstream_format: ApiFormat, original_format: ApiFormat, model: str,
        official_key: str, global_rules: List, local_rules: List
    ) -> Tuple[Dict, int, ApiFormat]:
        """处理非流式请求"""
        target_url = f"{settings.GEMINI_BASE_URL}/v1beta/models/{model}:generateContent"
        headers = {"Content-Type": "application/json", "x-goog-api-key": official_key}
        
        response = await self.client.post(target_url, json=payload, headers=headers)
        
        if response.status_code != 200:
            openai_error = universal_converter.generic_error_to_openai(response.content, response.status_code, upstream_format)
            return openai_error, response.status_code, "openai" # 错误总是返回OpenAI格式

        gemini_response = response.json()
        openai_response = universal_converter.gemini_to_openai(gemini_response, model)
        
        if openai_response['choices'][0]['message'].get('content'):
            content = openai_response['choices'][0]['message']['content']
            content = self._apply_postprocessing(content, global_rules, local_rules)
            openai_response['choices'][0]['message']['content'] = content

        final_response, _ = universal_converter.convert(openai_response, original_format)
        return final_response, 200, original_format

    async def stream_chat_completion(
        self, payload: Dict, upstream_format: ApiFormat, original_format: ApiFormat, model: str,
        official_key: str, global_rules: List, local_rules: List
    ) -> AsyncGenerator[bytes, None]:
        """处理流式请求"""
        target_url = f"{settings.GEMINI_BASE_URL}/v1beta/models/{model}:streamGenerateContent"
        headers = {"Content-Type": "application/json", "x-goog-api-key": official_key}

        async with self.client.stream("POST", target_url, json=payload, headers=headers) as response:
            if response.status_code != 200:
                error_content = await response.aread()
                openai_error = universal_converter.generic_error_to_openai(error_content, response.status_code, upstream_format)
                yield f"data: {json.dumps(openai_error)}\n\n".encode()
                return

            buffer = ""
            async for chunk in response.aiter_text():
                buffer += chunk
                # (此处省略处理JSON块的详细逻辑, 与proxy.py类似)
                # ...
                try:
                    gemini_chunk = json.loads(buffer) # 简化表示
                    buffer = "" # 清空缓冲区
                    
                    openai_chunk = universal_converter.gemini_to_openai_chunk(gemini_chunk, model)
                    if openai_chunk['choices'][0]['delta'].get('content'):
                        content = openai_chunk['choices'][0]['delta']['content']
                        content = self._apply_postprocessing(content, global_rules, local_rules)
                        openai_chunk['choices'][0]['delta']['content'] = content
                    
                    final_chunk, _ = universal_converter.convert(openai_chunk, original_format) # 注意：这里需要流式转换器
                    yield f"data: {json.dumps(final_chunk)}\n\n".encode()

                except json.JSONDecodeError:
                    continue # 继续接收数据
        
        yield b"data: [DONE]\n\n"

chat_processor = ChatProcessor()