import asyncio
import sys
import os

# 将项目根目录添加到 python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        try:
            # 检查列是否存在 (SQLite specific check)
            # 对于其他数据库，可能需要不同的检查方式，但 ALTER TABLE ADD COLUMN IF NOT EXISTS 在 SQLite 3.35+ 支持
            # 为了兼容性，我们直接尝试添加，捕获错误
            await conn.execute(text("ALTER TABLE official_keys ADD COLUMN error_count INTEGER DEFAULT 0"))
            print("Successfully added error_count column to official_keys table.")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("Column error_count already exists.")
            else:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())