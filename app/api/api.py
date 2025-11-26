from fastapi import APIRouter
from app.api.endpoints import auth, users, keys, presets, regex, proxy, logs

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(keys.router, prefix="/keys", tags=["keys"])
api_router.include_router(presets.router, prefix="/presets", tags=["presets"])
api_router.include_router(regex.router, prefix="/regex", tags=["regex"])
api_router.include_router(logs.router, prefix="/logs", tags=["logs"])
api_router.include_router(proxy.router, tags=["proxy"]) # No prefix for /v1/chat/completions
