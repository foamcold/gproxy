from datetime import timedelta, datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.models.verification_code import VerificationCode
from app.models.system_config import SystemConfig
from app.schemas.token import Token
from app.schemas.verification_code import SendCodeRequest, VerifyCodeRequest
from app.services.email_service import email_service

router = APIRouter()

@router.post("/login/access-token", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    # Authenticate user
    result = await db.execute(select(User).filter(User.username == form_data.username))
    user = result.scalars().first()
    
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="用户已被禁用")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/send-code")
async def send_verification_code(
    *,
    db: AsyncSession = Depends(deps.get_db),
    request: SendCodeRequest
) -> Any:
    """
    发送验证码到邮箱
    
    - **email**: 邮箱地址
    - **type**: 验证码类型 (register/reset_password)
    """
    # 获取系统配置
    config_result = await db.execute(select(SystemConfig).filter(SystemConfig.id == 1))
    system_config = config_result.scalars().first()
    
    if not system_config:
        raise HTTPException(status_code=500, detail="未找到系统配置")
    
    # 检查是否需要邮箱验证
    if request.type == "register" and not system_config.require_email_verification:
        raise HTTPException(status_code=400, detail="系统未开启邮箱验证")
    
    # 邮箱白名单验证
    if system_config.email_whitelist_enabled:
        domain = request.email.split('@')[1]
        whitelist = system_config.email_whitelist or []
        if domain not in whitelist:
            raise HTTPException(status_code=403, detail="该邮箱域名不被允许")
    
    
    # 检查是否在60秒内已发送过验证码
    time_60s_ago = datetime.now(timezone.utc) - timedelta(seconds=60)
    recent_code = await db.execute(
        select(VerificationCode).filter(
            VerificationCode.email == request.email,
            VerificationCode.type == request.type,
            VerificationCode.created_at > time_60s_ago
        ).order_by(VerificationCode.created_at.desc())
    )
    if recent_code.scalars().first():
        raise HTTPException(status_code=429, detail="请等待60秒后再试")
    
    # 生成验证码
    code = VerificationCode.generate_code()
    verification_code = VerificationCode(
        email=request.email,
        code=code,
        type=request.type,
        expires_at=VerificationCode.get_expiration_time()
    )
    db.add(verification_code)
    await db.commit()
    
    # 配置并发送邮件
    await email_service.configure(system_config)
    
    if not email_service.is_configured():
        raise HTTPException(status_code=500, detail="邮件服务未配置")
    
    try:
        if request.type == "register":
            success = await email_service.send_verification_email(
                request.email,
                code,
                system_config.site_name or "Gproxy"
            )
        else:  # reset_password
            success = await email_service.send_password_reset_email(
                request.email,
                code,
                system_config.site_name or "Gproxy"
            )
        
        if not success:
            raise Exception("发送邮件失败")
            
        return {"message": "验证码已发送", "expires_in": 300}  # 5 minutes
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"发送邮件失败: {str(e)}")

@router.post("/verify-code")
async def verify_code(
    *,
    db: AsyncSession = Depends(deps.get_db),
    request: VerifyCodeRequest
) -> Any:
    """
    验证验证码
    
    - **email**: 邮箱地址
    - **code**: 验证码
    - **type**: 验证码类型
    """
    # 查找验证码
    result = await db.execute(
        select(VerificationCode).filter(
            VerificationCode.email == request.email,
            VerificationCode.code == request.code,
            VerificationCode.type == request.type,
            VerificationCode.is_used == False
        ).order_by(VerificationCode.created_at.desc())
    )
    verification_code = result.scalars().first()
    
    if not verification_code:
        raise HTTPException(status_code=400, detail="无效的验证码")
    
    if verification_code.is_expired():
        raise HTTPException(status_code=400, detail="验证码已过期")
    
    # 标记为已使用
    verification_code.is_used = True
    await db.commit()
    
    return {"message": "验证成功", "email": request.email}
