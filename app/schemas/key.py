from typing import Optional
from pydantic import BaseModel
from datetime import datetime

# Official Key Schemas
class OfficialKeyBase(BaseModel):
    key: str
    is_active: Optional[bool] = True

class OfficialKeyCreate(OfficialKeyBase):
    pass

class OfficialKeyUpdate(BaseModel):
    is_active: Optional[bool] = None
    key: Optional[str] = None

class OfficialKey(OfficialKeyBase):
    id: int
    user_id: int
    usage_count: int
    total_tokens: int
    last_status: str
    created_at: datetime

    class Config:
        from_attributes = True

# Exclusive Key Schemas
class ExclusiveKeyBase(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = True
    preset_id: Optional[int] = None
    regex_id: Optional[int] = None

class ExclusiveKeyCreate(ExclusiveKeyBase):
    pass

class ExclusiveKeyUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    preset_id: Optional[int] = None
    regex_id: Optional[int] = None

class ExclusiveKey(ExclusiveKeyBase):
    id: int
    key: str
    user_id: int
    created_at: datetime
    preset_id: Optional[int] = None
    regex_id: Optional[int] = None

    class Config:
        from_attributes = True
