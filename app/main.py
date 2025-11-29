from fastapi import FastAPI
from contextlib import asynccontextmanager
import os
from app.core.config import settings
from app.core.database import engine, Base
from app.models import * # noqa


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure data directory exists
    if "sqlite" in settings.DATABASE_URL:
        db_path = settings.DATABASE_URL.split("///")[1]
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir)

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Note: 管理员账户现在通过 Web 界面初始化流程创建
    # 请访问应用首页完成初始化设置
            
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.VITE_API_STR}/openapi.json",
    lifespan=lifespan
)

from app.api.api import api_router
from app.api.endpoints import generic_proxy
from app.api.endpoints import proxy
from app.api.endpoints import gemini_routes

app.include_router(api_router, prefix=settings.VITE_API_STR)

# 根路径路由挂载顺序至关重要
# 1. Gemini Native Routes (/v1beta...) - 优先匹配，处理新逻辑
app.include_router(gemini_routes.router)

# 2. OpenAI Compatible Routes (/v1...) - 包含旧的 /v1beta 透传逻辑（会被上面的 gemini_routes 覆盖）
app.include_router(proxy.router)

# 3. Generic Proxy (Catch-all) - 最后匹配
app.include_router(generic_proxy.router, tags=["generic_proxy"])

@app.get("/")
async def root():
    return {"message": "Welcome to Gproxy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
