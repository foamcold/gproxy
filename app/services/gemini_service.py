import httpx
import logging
import random
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.key import OfficialKey
from app.core.config import settings

logger = logging.getLogger(__name__)

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

    async def close(self):
        await self.client.aclose()

    async def get_active_key(self, db: AsyncSession) -> str:
        """
        Get an active official key using round-robin or random strategy.
        For now, we use random for simplicity, but we should implement proper round-robin.
        """
        result = await db.execute(select(OfficialKey).filter(OfficialKey.is_active == True))
        keys = result.scalars().all()
        
        if not keys:
            raise HTTPException(status_code=503, detail="No active official keys available")
            
        # Simple random selection for now
        selected_key = random.choice(keys)
        return selected_key.key

    async def update_key_status(self, db: AsyncSession, key_str: str, status: str):
        result = await db.execute(select(OfficialKey).filter(OfficialKey.key == key_str))
        key = result.scalars().first()
        if key:
            key.last_status = status
            if status in ["401", "403"]: # Invalid key
                key.is_active = False
            key.usage_count += 1
            await db.commit()

gemini_service = GeminiService()
