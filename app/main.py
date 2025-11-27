from fastapi import FastAPI
from contextlib import asynccontextmanager
import os
from sqlalchemy import select
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models import * # noqa
from app.models.user import User

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
    
    # Create initial superuser
    async with SessionLocal() as session:
        result = await session.execute(select(User).filter(User.username == settings.FIRST_SUPERUSER))
        user = result.scalars().first()
        if not user:
            user = User(
                username=settings.FIRST_SUPERUSER,
                email=settings.FIRST_SUPERUSER_EMAIL,
                password_hash=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
                is_active=True,
                role="admin"
            )
            session.add(user)
            await session.commit()
            
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

from app.api.api import api_router
from app.api.endpoints import generic_proxy
from app.api.endpoints import proxy

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(proxy.router)
app.include_router(generic_proxy.router, tags=["generic_proxy"])

@app.get("/")
async def root():
    return {"message": "Welcome to Gproxy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
