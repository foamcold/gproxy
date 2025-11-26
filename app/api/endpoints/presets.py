from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.models.preset import Preset
from app.models.user import User
from app.schemas.preset import Preset as PresetSchema, PresetCreate, PresetUpdate

router = APIRouter()

@router.get("/", response_model=List[PresetSchema])
async def read_presets(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve presets.
    """
    query = select(Preset).filter(Preset.user_id == current_user.id).order_by(Preset.sort_order)
    result = await db.execute(query.offset(skip).limit(limit))
    presets = result.scalars().all()
    return presets

@router.post("/", response_model=PresetSchema)
async def create_preset(
    *,
    db: AsyncSession = Depends(deps.get_db),
    preset_in: PresetCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new preset.
    """
    preset = Preset(
        name=preset_in.name,
        content=preset_in.content,
        user_id=current_user.id,
        is_active=preset_in.is_active,
        sort_order=preset_in.sort_order,
    )
    db.add(preset)
    await db.commit()
    await db.refresh(preset)
    return preset

@router.put("/{preset_id}", response_model=PresetSchema)
async def update_preset(
    *,
    db: AsyncSession = Depends(deps.get_db),
    preset_id: int,
    preset_in: PresetUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update preset.
    """
    result = await db.execute(select(Preset).filter(Preset.id == preset_id, Preset.user_id == current_user.id))
    preset = result.scalars().first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    preset.name = preset_in.name
    preset.content = preset_in.content
    preset.is_active = preset_in.is_active
    preset.sort_order = preset_in.sort_order
    
    db.add(preset)
    await db.commit()
    await db.refresh(preset)
    return preset

@router.delete("/{preset_id}", response_model=PresetSchema)
async def delete_preset(
    *,
    db: AsyncSession = Depends(deps.get_db),
    preset_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete preset.
    """
    result = await db.execute(select(Preset).filter(Preset.id == preset_id, Preset.user_id == current_user.id))
    preset = result.scalars().first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    await db.delete(preset)
    await db.commit()
    return preset
