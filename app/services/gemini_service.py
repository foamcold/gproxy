import httpx
import logging
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.key import OfficialKey
from app.models.system_config import SystemConfig
from app.core.config import settings

logger = logging.getLogger(__name__)

# Basic Logger Configuration
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

class GeminiService:
    def __init__(self):
        limits = httpx.Limits(max_keepalive_connections=100, max_connections=1000)
        timeout = httpx.Timeout(60.0, connect=10.0)
        
        self.client = httpx.AsyncClient(
            base_url=settings.GEMINI_BASE_URL,
            timeout=timeout,
            limits=limits,
            follow_redirects=True
        )

    def update_log_level(self, level_name: str):
        """Update logger level dynamically"""
        level = getattr(logging, level_name.upper(), logging.INFO)
        logger.setLevel(level)
        for handler in logger.handlers:
            handler.setLevel(level)

    async def close(self):
        await self.client.aclose()

    async def get_active_key(self, db: AsyncSession) -> str:
        """
        Get an active official key using a sequential round-robin strategy.
        It retrieves the next key based on the last used key ID stored in SystemConfig.
        """
        # 1. Get all active keys, sorted by ID
        result = await db.execute(select(OfficialKey).filter(OfficialKey.is_active == True).order_by(OfficialKey.id))
        keys = result.scalars().all()
        
        if not keys:
            raise HTTPException(status_code=503, detail="No active official keys available")

        # 2. Get system config to find the last used key ID
        config_result = await db.execute(select(SystemConfig))
        config = config_result.scalars().first()
        if not config:
            # This should not happen in a properly initialized system, but handle it gracefully
            config = SystemConfig()
            db.add(config)
        
        last_key_id = config.last_used_official_key_id

        # 3. Find the next key
        next_key = None
        if last_key_id:
            try:
                # Find the index of the last used key
                last_key_index = next(i for i, key in enumerate(keys) if key.id == last_key_id)
                # Get the next index, wrapping around if necessary
                next_key_index = (last_key_index + 1) % len(keys)
                next_key = keys[next_key_index]
            except StopIteration:
                # If last_key_id is not in the active key list (e.g., it was deleted), start from the first key
                next_key = keys[0]
        else:
            # If no key was used before, start from the first one
            next_key = keys[0]

        # 4. Update the last used key ID in the config
        config.last_used_official_key_id = next_key.id
        await db.commit()

        return next_key.key

    async def update_key_status(self, db: AsyncSession, key_str: str, status: str, input_tokens: int = 0, output_tokens: int = 0):
        result = await db.execute(select(OfficialKey).filter(OfficialKey.key == key_str))
        key = result.scalars().first()
        if key:
            key.last_status = status
            key.usage_count += 1  # Always increment usage count

            if status in ["401", "403"]:  # Invalid key
                key.is_active = False

            # Increment error count if status is not a success (2xx)
            if not status.startswith("2"):
                if key.error_count is None:
                    key.error_count = 0
                key.error_count += 1
            
            # Update total tokens
            if key.total_tokens is None:
                key.total_tokens = 0
            key.total_tokens += (input_tokens + output_tokens)
            
            await db.commit()

gemini_service = GeminiService()
