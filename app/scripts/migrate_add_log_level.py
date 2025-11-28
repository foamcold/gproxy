import asyncio
import sys
import os

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.core.database import engine

async def migrate():
    print("Starting migration: Add log_level to system_config")
    
    async with engine.begin() as conn:
        # Check if column exists
        try:
            # Try to select the column
            await conn.execute(text("SELECT log_level FROM system_config LIMIT 1"))
            print("Column 'log_level' already exists.")
        except Exception:
            # Column doesn't exist, add it
            print("Adding 'log_level' column...")
            try:
                # SQLite syntax
                if "sqlite" in str(engine.url):
                    await conn.execute(text("ALTER TABLE system_config ADD COLUMN log_level VARCHAR DEFAULT 'INFO'"))
                else:
                    # Generic/Postgres/MySQL syntax (might need adjustment if not using SQLite)
                    await conn.execute(text("ALTER TABLE system_config ADD COLUMN log_level VARCHAR(20) DEFAULT 'INFO'"))
                print("Column 'log_level' added successfully.")
            except Exception as e:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())