from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, BigInteger
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class OfficialKey(Base):
    __tablename__ = "official_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    usage_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    total_tokens = Column(BigInteger, default=0)
    last_status = Column(String, default="active") # "active", "429", "401", etc.
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")

class ExclusiveKey(Base):
    __tablename__ = "exclusive_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False) # gapi-...
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    preset_id = Column(Integer, ForeignKey("presets.id"), nullable=True)
    enable_regex = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    preset = relationship("Preset")
