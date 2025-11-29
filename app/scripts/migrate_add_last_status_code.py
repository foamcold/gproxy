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
            # 尝试添加 last_status_code 列
            await conn.execute(text("ALTER TABLE official_keys ADD COLUMN last_status_code INTEGER"))
            print("Successfully added last_status_code column to official_keys table.")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("Column last_status_code already exists.")
            else:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())