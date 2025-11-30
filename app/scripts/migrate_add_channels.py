import asyncio
import os
import sys

# 将项目根目录添加到 python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.core.database import engine

async def migrate():
    """
    添加渠道管理功能的数据库迁移：
    1. 创建 channels 表
    2. 为 official_keys 添加 channel_id 字段
    3. 为 exclusive_keys 添加 channel_id 字段
    4. 创建3个默认渠道(Gemini、OpenAI、Claude)
    5. 将现有官方密钥迁移到Gemini渠道
    """
    async with engine.begin() as conn:
        print("开始数据库迁移: 添加渠道管理功能...")
        
        # 1. 创建 channels 表
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS channels (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    api_url TEXT NOT NULL,
                    user_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """))
            print("✓ 创建 channels 表")
        except Exception as e:
            print(f"✗ 创建 channels 表失败: {e}")
        
        # 2. 为 official_keys 添加 channel_id 字段
        try:
            await conn.execute(text("ALTER TABLE official_keys ADD COLUMN channel_id INTEGER"))
            print("✓ 为 official_keys 添加 channel_id 字段")
        except Exception as e:
            print(f"  channel_id 字段可能已存在于 official_keys: {e}")
        
        # 3. 为 exclusive_keys 添加 channel_id 字段
        try:
            await conn.execute(text("ALTER TABLE exclusive_keys ADD COLUMN channel_id INTEGER"))
            print("✓ 为 exclusive_keys 添加 channel_id 字段")
        except Exception as e:
            print(f"  channel_id 字段可能已存在于 exclusive_keys: {e}")
        
        # 4. 获取所有用户ID，为每个用户创建默认渠道
        try:
            result = await conn.execute(text("SELECT id FROM users"))
            user_ids = [row[0] for row in result.fetchall()]
            
            default_channels = [
                {
                    "name": "Gemini",
                    "type": "gemini",
                    "api_url": "https://generativelanguage.googleapis.com"
                },
                {
                    "name": "OpenAI",
                    "type": "openai",
                    "api_url": "https://api.openai.com"
                },
                {
                    "name": "Claude",
                    "type": "claude",
                    "api_url": "https://api.anthropic.com"
                }
            ]
            
            for user_id in user_ids:
                for channel in default_channels:
                    # 检查渠道是否已存在
                    check_result = await conn.execute(
                        text("SELECT id FROM channels WHERE user_id = :user_id AND type = :type"),
                        {"user_id": user_id, "type": channel["type"]}
                    )
                    existing = check_result.fetchone()
                    
                    if not existing:
                        await conn.execute(
                            text("""
                                INSERT INTO channels (name, type, api_url, user_id) 
                                VALUES (:name, :type, :api_url, :user_id)
                            """),
                            {
                                "name": channel["name"],
                                "type": channel["type"],
                                "api_url": channel["api_url"],
                                "user_id": user_id
                            }
                        )
                        print(f"✓ 为用户 {user_id} 创建默认渠道: {channel['name']}")
                    else:
                        print(f"  用户 {user_id} 的 {channel['name']} 渠道已存在")
            
        except Exception as e:
            print(f"✗ 创建默认渠道失败: {e}")
        
        # 5. 将现有官方密钥迁移到Gemini渠道
        try:
            # 对每个用户，获取其Gemini渠道ID，并更新其所有官方密钥
            for user_id in user_ids:
                gemini_result = await conn.execute(
                    text("SELECT id FROM channels WHERE user_id = :user_id AND type = 'gemini' LIMIT 1"),
                    {"user_id": user_id}
                )
                gemini_channel = gemini_result.fetchone()
                
                if gemini_channel:
                    gemini_channel_id = gemini_channel[0]
                    # 更新该用户的所有官方密钥到Gemini渠道
                    result = await conn.execute(
                        text("UPDATE official_keys SET channel_id = :channel_id WHERE user_id = :user_id AND channel_id IS NULL"),
                        {"channel_id": gemini_channel_id, "user_id": user_id}
                    )
                    print(f"✓ 将用户 {user_id} 的现有官方密钥迁移到Gemini渠道 (受影响行数: {result.rowcount})")
        except Exception as e:
            print(f"✗ 迁移官方密钥失败: {e}")
        
        print("数据库迁移完成!")

if __name__ == "__main__":
    asyncio.run(migrate())
