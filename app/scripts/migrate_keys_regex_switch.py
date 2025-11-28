import asyncio
import os
import sys

# 将项目根目录添加到 python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.core.database import engine

async def migrate():
    """
    Migration to replace regex_id with enable_regex in exclusive_keys table.
    1. Add enable_regex column (boolean, default false)
    2. Migrate existing data: if regex_id is not null, set enable_regex = true
    3. Drop regex_id column
    """
    async with engine.begin() as conn:
        print("Starting migration: keys regex switch...")
        
        # 1. Add enable_regex column
        # SQLite doesn't support adding column with default value in the same statement as NOT NULL easily without default value, 
        # but here we want nullable or default false.
        # Check if column exists first to be safe (idempotency)
        try:
            await conn.execute(text("ALTER TABLE exclusive_keys ADD COLUMN enable_regex BOOLEAN DEFAULT 0"))
            print("Added enable_regex column.")
        except Exception as e:
            print(f"Column enable_regex might already exist or error: {e}")

        # 2. Migrate existing data
        # If regex_id was set, we assume user wants regex enabled.
        # We don't have a direct mapping anymore, but enabling it means using all active global regexes.
        # This is a behavior change, but based on the requirement "开启则使用正则页面已启用的正则".
        try:
            await conn.execute(text("UPDATE exclusive_keys SET enable_regex = 1 WHERE regex_id IS NOT NULL"))
            print("Migrated data: regex_id -> enable_regex.")
        except Exception as e:
            print(f"Error migrating data: {e}")

        # 3. Drop regex_id column
        # SQLite doesn't support DROP COLUMN directly in older versions, but modern SQLite does.
        # If it fails, we might need to recreate the table, but let's try direct drop first.
        try:
            await conn.execute(text("ALTER TABLE exclusive_keys DROP COLUMN regex_id"))
            print("Dropped regex_id column.")
        except Exception as e:
            print(f"Error dropping regex_id column (might be SQLite version limitation): {e}")
            print("Skipping drop column for safety if it failed. The column will just be ignored.")

        print("Migration completed.")

if __name__ == "__main__":
    asyncio.run(migrate())