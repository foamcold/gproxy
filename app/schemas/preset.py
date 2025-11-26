from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class PresetBase(BaseModel):
    name: str
    content: str # JSON string
    is_active: Optional[bool] = True
    sort_order: Optional[int] = 0

class PresetCreate(PresetBase):
    pass

class PresetUpdate(PresetBase):
    pass

class Preset(PresetBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
