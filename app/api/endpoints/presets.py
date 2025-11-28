from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.api import deps
from app.models.preset import Preset
from app.models.preset_item import PresetItem
from app.models.user import User
from app.schemas.preset import Preset as PresetSchema, PresetCreate, PresetUpdate
from app.schemas.preset_item import PresetItem as PresetItemSchema, PresetItemCreate, PresetItemUpdate

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
    query = select(Preset).filter(Preset.user_id == current_user.id).order_by(Preset.sort_order).options(selectinload(Preset.items))
    result = await db.execute(query.offset(skip).limit(limit))
    presets = result.scalars().unique().all()
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
        user_id=current_user.id,
        is_active=preset_in.is_active,
        sort_order=preset_in.sort_order,
        creator_username=current_user.username,  # 自动设置创建者用户名
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


# Preset Items

@router.post("/{preset_id}/items/", response_model=PresetItemSchema)
async def create_preset_item(
    *,
    db: AsyncSession = Depends(deps.get_db),
    preset_id: int,
    item_in: PresetItemCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new preset item for a preset.
    """
    result = await db.execute(select(Preset).filter(Preset.id == preset_id, Preset.user_id == current_user.id))
    preset = result.scalars().first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    item = PresetItem(
        **item_in.dict(),
        preset_id=preset_id,
        creator_username=current_user.username,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.put("/{preset_id}/items/{item_id}", response_model=PresetItemSchema)
async def update_preset_item(
    *,
    db: AsyncSession = Depends(deps.get_db),
    preset_id: int,
    item_id: int,
    item_in: PresetItemUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update a preset item.
    """
    result = await db.execute(
        select(PresetItem)
        .join(Preset)
        .filter(PresetItem.id == item_id, PresetItem.preset_id == preset_id, Preset.user_id == current_user.id)
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Preset item not found")
        
    update_data = item_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
        
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/{preset_id}/items/{item_id}", response_model=PresetItemSchema)
async def delete_preset_item(
    *,
    db: AsyncSession = Depends(deps.get_db),
    preset_id: int,
    item_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete a preset item.
    """
    result = await db.execute(
        select(PresetItem)
        .join(Preset)
        .filter(PresetItem.id == item_id, PresetItem.preset_id == preset_id, Preset.user_id == current_user.id)
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Preset item not found")
        
    await db.delete(item)
    await db.commit()
    return item
