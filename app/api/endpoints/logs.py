from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.api import deps
from app.models.log import Log
from app.models.user import User
from pydantic import BaseModel
from datetime import datetime, timezone

router = APIRouter()

class LogSchema(BaseModel):
    id: int
    model: str
    status: str
    status_code: Optional[int]
    latency: float
    ttft: float
    is_stream: bool
    input_tokens: int
    output_tokens: int
    created_at: datetime
    exclusive_key_key: Optional[str] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
        }

@router.get("/", response_model=List[LogSchema])
async def read_logs(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve logs.
    """
    query = select(Log).filter(Log.user_id == current_user.id).order_by(Log.created_at.desc())
    # Eager load exclusive key to show the key string if needed, 
    # but Log model has exclusive_key_id. 
    # Let's join or load relationship.
    query = query.options(selectinload(Log.exclusive_key))
    
    result = await db.execute(query.offset(skip).limit(limit))
    logs = result.scalars().all()
    
    # Map to schema manually or let pydantic handle it if structure matches
    # We need to flatten exclusive_key.key to exclusive_key_key
    results = []
    
    for log in logs:
        log_data = {
            "id": log.id,
            "model": log.model,
            "status": log.status,
            "status_code": log.status_code,
            "latency": log.latency,
            "ttft": log.ttft,
            "is_stream": log.is_stream,
            "input_tokens": log.input_tokens,
            "output_tokens": log.output_tokens,
            "created_at": log.created_at,
            "exclusive_key_key": log.exclusive_key.key if log.exclusive_key else None
        }
        results.append(LogSchema(**log_data))
        
    return results
