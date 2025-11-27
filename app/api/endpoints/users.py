from typing import Any, List
from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core import security
from app.models.user import User
from app.schemas.user import User as UserSchema, UserUpdate

router = APIRouter()

@router.get("/", response_model=List[UserSchema])
async def read_users(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Retrieve users.
    """
    result = await db.execute(select(User))
    users = result.scalars().all()
    return users

@router.put("/me", response_model=UserSchema)
async def update_user_me(
    *,
    db: AsyncSession = Depends(deps.get_db),
    password: str = Body(None),
    email: str = Body(None),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update own user.
    """
    current_user_data = jsonable_encoder(current_user)
    user_in = UserUpdate(**current_user_data)
    if password:
        user_in.password = password
    if email:
        user_in.email = email
        
    if user_in.password:
        current_user.password_hash = security.get_password_hash(user_in.password)
    if user_in.email:
        current_user.email = user_in.email
        
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.get("/me", response_model=UserSchema)
async def read_user_me(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.post("/open", response_model=UserSchema)
async def create_user_open(
    *,
    db: AsyncSession = Depends(deps.get_db),
    password: str = Body(...),
    email: str = Body(...),
    username: str = Body(...),
) -> Any:
    """
    Create new user without login.
    """
    # TODO: Add registration config check (is_open_registration)
    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
        
    user = User(
        email=email,
        username=username,
        password_hash=security.get_password_hash(password),
        is_active=True,
        role="user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.put("/{user_id}/toggle-active", response_model=UserSchema)
async def toggle_user_active(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_id: int,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Toggle user active status (enable/disable).
    """
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot disable yourself")
    
    user.is_active = not user.is_active
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/{user_id}", response_model=UserSchema)
async def delete_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_id: int,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Delete (deactivate) user.
    """
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # 软删除：设置为不活跃
    user.is_active = False
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/search", response_model=List[UserSchema])
async def search_users(
    *,
    db: AsyncSession = Depends(deps.get_db),
    q: str = "",
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Search users by ID or username.
    """
    if not q:
        # 如果没有搜索词，返回所有用户
        result = await db.execute(select(User))
        users = result.scalars().all()
        return users
    
    # 尝试按ID搜索
    try:
        user_id = int(q)
        result = await db.execute(select(User).filter(User.id == user_id))
        user = result.scalars().first()
        return [user] if user else []
    except ValueError:
        pass
    
    # 按用户名模糊搜索
    result = await db.execute(
        select(User).filter(User.username.ilike(f"%{q}%"))
    )
    users = result.scalars().all()
    return users
