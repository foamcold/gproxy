from typing import Any, List
from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.api import deps
from app.core import security
from app.models.user import User
from app.schemas.user import User as UserSchema, UserUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter()

@router.get("/", response_model=PaginatedResponse[UserSchema])
async def read_users(
    db: AsyncSession = Depends(deps.get_db),
    page: int = 1,
    size: int = 20,
    q: str = None,
    current_user: User = Depends(deps.get_current_active_admin),
) -> Any:
    """
    Retrieve users with pagination and search.
    """
    skip = (page - 1) * size
    query = select(User)

    if q:
        # 尝试按ID搜索
        try:
            user_id = int(q)
            query = query.filter(User.id == user_id)
        except ValueError:
            # 按用户名或邮箱模糊搜索
            query = query.filter(
                (User.username.ilike(f"%{q}%")) |
                (User.email.ilike(f"%{q}%"))
            )
    
    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    result = await db.execute(query.offset(skip).limit(size))
    users = result.scalars().all()
    
    # 手动将 SQLAlchemy 模型转换为 Pydantic Schema，并处理验证错误
    user_schemas = []
    for user in users:
        try:
            user_schemas.append(UserSchema.from_orm(user))
        except Exception:
            # 如果有脏数据导致验证失败，跳过该用户
            continue
    
    return PaginatedResponse(
        total=total,
        items=user_schemas,
        page=page,
        size=size
    )

@router.post("/create", response_model=UserSchema)
async def create_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    email: str = Body(...),
    password: str = Body(...),
    username: str = Body(...),
    current_user: User = Depends(deps.get_current_active_admin),
) -> Any:
    """
    Create new user by admin.
    """
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
    current_user: User = Depends(deps.get_current_active_admin),
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
    current_user: User = Depends(deps.get_current_active_admin),
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

@router.put("/{user_id}", response_model=UserSchema)
async def update_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_id: int,
    user_in: UserUpdate,
    current_user: User = Depends(deps.get_current_active_admin),
) -> Any:
    """
    Update a user.
    """
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this username does not exist in the system.",
        )
    
    # 更新字段
    update_data = user_in.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        user.password_hash = security.get_password_hash(update_data["password"])
        del update_data["password"] # 从待更新字典中移除，避免直接赋值
    
    for field, value in update_data.items():
        setattr(user, field, value)

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

