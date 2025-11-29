from typing import Generator, Optional, Tuple
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core import security
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.key import ExclusiveKey
from app.schemas.token import TokenPayload
from app.services.gemini_service import gemini_service

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.VITE_API_STR}/auth/login/access-token"
)

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(reusable_oauth2)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无法验证凭据",
        )
    
    result = await db.execute(select(User).filter(User.id == int(token_data.sub)))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="用户已被禁用")
    return current_user

async def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=403, detail="需要超级管理员权限"
        )
    return current_user

async def get_current_active_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=403, detail="需要管理员权限"
        )
    return current_user

async def get_optional_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    token = request.headers.get("Authorization")
    if token:
        try:
            # 去除 "Bearer " 前缀
            token = token.split(" ")[1]
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
            )
            token_data = TokenPayload(**payload)
            result = await db.execute(select(User).filter(User.id == int(token_data.sub)))
            user = result.scalars().first()
            return user
        except (JWTError, ValidationError, IndexError):
            # Token 无效或格式错误
            return None
    return None

async def get_official_key_from_proxy(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Tuple[str, Optional[User]]:
    """
    从代理请求中提取、验证并返回一个有效的官方API密钥。
    - 如果提供的是专属密钥 (gapi-...), 则验证并返回一个轮询的官方密钥。
    - 如果提供的是普通密钥, 则直接返回。
    - 同时返回关联的用户对象（如果存在）。
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        # 兼容某些客户端可能使用的 x-goog-api-key 或 key 参数
        client_key = request.headers.get("x-goog-api-key") or request.query_params.get("key")
        if not client_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未提供 API 密钥")
    else:
        client_key = auth_header.split(" ")[1]

    if client_key.startswith("gapi-"):
        # 是专属密钥，需要验证并轮询
        result = await db.execute(
            select(ExclusiveKey).filter(ExclusiveKey.key == client_key, ExclusiveKey.is_active == True)
        )
        exclusive_key = result.scalars().first()
        
        if not exclusive_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的专属密钥")
            
        user_result = await db.execute(select(User).filter(User.id == exclusive_key.user_id))
        user = user_result.scalars().first()
        
        official_key = await gemini_service.get_active_key_str(db)
        return official_key, user
    else:
        # 是普通密钥，直接透传, 没有关联用户
        return client_key, None
