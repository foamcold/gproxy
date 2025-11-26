from typing import Any, List
import hashlib
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.models.key import OfficialKey, ExclusiveKey
from app.models.user import User
from app.schemas.key import OfficialKey as OfficialKeySchema, OfficialKeyCreate, OfficialKeyUpdate
from app.schemas.key import ExclusiveKey as ExclusiveKeySchema, ExclusiveKeyCreate

router = APIRouter()

# --- Official Keys ---

@router.get("/official", response_model=List[OfficialKeySchema])
async def read_official_keys(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve official keys.
    """
    query = select(OfficialKey).filter(OfficialKey.user_id == current_user.id)
    result = await db.execute(query.offset(skip).limit(limit))
    keys = result.scalars().all()
    return keys

@router.post("/official", response_model=OfficialKeySchema)
async def create_official_key(
    *,
    db: AsyncSession = Depends(deps.get_db),
    key_in: OfficialKeyCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new official key.
    """
    key = OfficialKey(
        key=key_in.key,
        user_id=current_user.id,
        is_active=key_in.is_active,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return key

@router.delete("/official/{key_id}", response_model=OfficialKeySchema)
async def delete_official_key(
    *,
    db: AsyncSession = Depends(deps.get_db),
    key_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete official key.
    """
    result = await db.execute(select(OfficialKey).filter(OfficialKey.id == key_id, OfficialKey.user_id == current_user.id))
    key = result.scalars().first()
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    await db.delete(key)
    await db.commit()
    return key

# --- Exclusive Keys ---

@router.get("/exclusive", response_model=List[ExclusiveKeySchema])
async def read_exclusive_keys(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve exclusive keys.
    """
    query = select(ExclusiveKey).filter(ExclusiveKey.user_id == current_user.id)
    result = await db.execute(query.offset(skip).limit(limit))
    keys = result.scalars().all()
    return keys

@router.post("/exclusive", response_model=ExclusiveKeySchema)
async def create_exclusive_key(
    *,
    db: AsyncSession = Depends(deps.get_db),
    key_in: ExclusiveKeyCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Generate new exclusive key.
    """
    # Generate key logic: gapi- + user_id + timestamp + hash
    timestamp = str(int(time.time()))
    raw_str = f"{current_user.id}{timestamp}{current_user.email}"
    hash_str = hashlib.sha256(raw_str.encode()).hexdigest()[:16]
    generated_key = f"gapi-{current_user.id}-{timestamp}-{hash_str}"
    
    key = ExclusiveKey(
        key=generated_key,
        name=key_in.name,
        user_id=current_user.id,
        is_active=key_in.is_active,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return key

@router.delete("/exclusive/{key_id}", response_model=ExclusiveKeySchema)
async def delete_exclusive_key(
    *,
    db: AsyncSession = Depends(deps.get_db),
    key_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete exclusive key.
    """
    result = await db.execute(select(ExclusiveKey).filter(ExclusiveKey.id == key_id, ExclusiveKey.user_id == current_user.id))
    key = result.scalars().first()
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    await db.delete(key)
    await db.commit()
    return key
