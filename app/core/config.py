from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Gproxy"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "your-super-secret-key-change-it-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/sql_app.db"

    # Proxy
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com"

    class Config:
        env_file = ".env"

settings = Settings()
