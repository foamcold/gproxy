import asyncio
import sys
import os

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.core.database import engine

async def migrate():
    print("Starting migration: Add last_used_official_key_id to system_config")
    
    async with engine.begin() as conn:
        # Check if column exists
        try:
            # Try to select the column
            await conn.execute(text("SELECT last_used_official_key_id FROM system_config LIMIT 1"))
            print("Column 'last_used_official_key_id' already exists.")
        except Exception:
            # Column doesn't exist, add it
            print("Adding 'last_used_official_key_id' column...")
            try:
                # Add a nullable integer column
                await conn.execute(text("ALTER TABLE system_config ADD COLUMN last_used_official_key_id INTEGER"))
                print("Column 'last_used_official_key_id' added successfully.")
            except Exception as e:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())