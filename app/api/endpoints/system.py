import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.models.system_config import SystemConfig as SystemConfigModel
from app.models.user import User
from app.schemas.system_config import SystemConfig, SystemConfigUpdate

router = APIRouter()

@router.get("/config", response_model=SystemConfig)
async def get_system_config(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    获取系统配置（所有用户可见，但敏感信息仅管理员可见）
    """
    result = await db.execute(select(SystemConfigModel))
    config = result.scalars().first()
    
    if not config:
        # 如果没有配置，创建默认配置
        config = SystemConfigModel()
        db.add(config)
        await db.commit()
        await db.refresh(config)
    
    # 将email_whitelist从JSON字符串转换为列表
    config_dict = {
        "id": config.id,
        "site_name": config.site_name,
        "server_url": config.server_url,
        "allow_registration": config.allow_registration,
        "allow_password_login": config.allow_password_login,
        "require_email_verification": config.require_email_verification,
        "enable_turnstile": config.enable_turnstile,
        "email_whitelist_enabled": config.email_whitelist_enabled,
        "email_whitelist": json.loads(config.email_whitelist) if config.email_whitelist else [],
        "email_alias_restriction": config.email_alias_restriction,
        "log_level": config.log_level,
    }
    
    # 敏感信息仅管理员可见
    if current_user.role == "admin":
        config_dict.update({
            "smtp_host": config.smtp_host,
            "smtp_port": config.smtp_port,
            "smtp_user": config.smtp_user,
            "smtp_password": config.smtp_password,
            "smtp_from": config.smtp_from,
            "smtp_use_tls": config.smtp_use_tls,
            "turnstile_site_key": config.turnstile_site_key,
            "turnstile_secret_key": config.turnstile_secret_key,
        })
    else:
        # 普通用户只能看到公开信息
        config_dict.update({
            "smtp_host": None,
            "smtp_port": 587,
            "smtp_user": None,
            "smtp_password": None,
            "smtp_from": None,
            "smtp_use_tls": True,
            "turnstile_site_key": config.turnstile_site_key if config.enable_turnstile else None,
            "turnstile_secret_key": None,
        })
    
    return config_dict

@router.put("/config", response_model=SystemConfig)
async def update_system_config(
    *,
    db: AsyncSession = Depends(deps.get_db),
    config_in: SystemConfigUpdate,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    更新系统配置（仅管理员）
    """
    result = await db.execute(select(SystemConfigModel))
    config = result.scalars().first()
    
    if not config:
        config = SystemConfigModel()
        db.add(config)
    
    # 更新配置
    config.site_name = config_in.site_name
    config.server_url = config_in.server_url
    config.allow_registration = config_in.allow_registration
    config.allow_password_login = config_in.allow_password_login
    config.require_email_verification = config_in.require_email_verification
    config.enable_turnstile = config_in.enable_turnstile
    config.email_whitelist_enabled = config_in.email_whitelist_enabled
    config.email_whitelist = json.dumps(config_in.email_whitelist)
    config.email_alias_restriction = config_in.email_alias_restriction
    
    # SMTP配置
    config.smtp_host = config_in.smtp_host
    config.smtp_port = config_in.smtp_port
    config.smtp_user = config_in.smtp_user
    if config_in.smtp_password:  # 只在提供了密码时更新
        config.smtp_password = config_in.smtp_password
    config.smtp_from = config_in.smtp_from
    config.smtp_use_tls = config_in.smtp_use_tls
    
    # Turnstile配置
    config.turnstile_site_key = config_in.turnstile_site_key
    if config_in.turnstile_secret_key:  # 只在提供了密钥时更新
        config.turnstile_secret_key = config_in.turnstile_secret_key
    
    # 日志配置
    config.log_level = config_in.log_level

    await db.commit()
    await db.refresh(config)
    
    # 返回完整配置
    return {
        "id": config.id,
        "site_name": config.site_name,
        "server_url": config.server_url,
        "allow_registration": config.allow_registration,
        "allow_password_login": config.allow_password_login,
        "require_email_verification": config.require_email_verification,
        "enable_turnstile": config.enable_turnstile,
        "email_whitelist_enabled": config.email_whitelist_enabled,
        "email_whitelist": json.loads(config.email_whitelist),
        "email_alias_restriction": config.email_alias_restriction,
        "smtp_host": config.smtp_host,
        "smtp_port": config.smtp_port,
        "smtp_user": config.smtp_user,
        "smtp_password": config.smtp_password,
        "smtp_from": config.smtp_from,
        "smtp_use_tls": config.smtp_use_tls,
        "turnstile_site_key": config.turnstile_site_key,
        "turnstile_secret_key": config.turnstile_secret_key,
        "log_level": config.log_level,
    }
