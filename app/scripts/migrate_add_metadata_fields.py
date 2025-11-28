"""
数据库迁移工具
用于为现有数据库添加新字段和表
"""
from sqlalchemy import text
from app.core.database import engine
import asyncio


async def migrate_add_metadata_fields():
    """为现有的presets和regex_rules表添加creator_username和updated_at字段"""
    async with engine.begin() as conn:
        # 检查数据库类型
        result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        tables = [row[0] for row in result]
        
        print(f"找到的表: {tables}")
        
        # 为regex_rules表添加字段
        if 'regex_rules' in tables:
            try:
                # SQLite不支持ALTER TABLE ADD COLUMN IF NOT EXISTS，所以需要检查
                result = await conn.execute(text("PRAGMA table_info(regex_rules)"))
                columns = [row[1] for row in result]
                
                if 'creator_username' not in columns:
                    await conn.execute(text(
                        "ALTER TABLE regex_rules ADD COLUMN creator_username VARCHAR"
                    ))
                    print("✓ 为regex_rules添加了creator_username字段")
                
                if 'updated_at' not in columns:
                    await conn.execute(text(
                        "ALTER TABLE regex_rules ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                    ))
                    print("✓ 为regex_rules添加了updated_at字段")
            except Exception as e:
                print(f"✗ 迁移regex_rules失败: {e}")
        
        # 为presets表添加字段
        if 'presets' in tables:
            try:
                result = await conn.execute(text("PRAGMA table_info(presets)"))
                columns = [row[1] for row in result]
                
                if 'creator_username' not in columns:
                    await conn.execute(text(
                        "ALTER TABLE presets ADD COLUMN creator_username VARCHAR"
                    ))
                    print("✓ 为presets添加了creator_username字段")
                
                if 'updated_at' not in columns:
                    await conn.execute(text(
                        "ALTER TABLE presets ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                    ))
                    print("✓ 为presets添加了updated_at字段")
            except Exception as e:
                print(f"✗ 迁移presets失败: {e}")
        
        print("迁移完成！")


if __name__ == "__main__":
    print("开始数据库迁移...")
    asyncio.run(migrate_add_metadata_fields())
