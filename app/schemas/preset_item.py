from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class PresetItemBase(BaseModel):
    name: str
    role: str
    type: str
    content: str
    enabled: Optional[bool] = True
    sort_order: Optional[int] = 0

class PresetItemCreate(PresetItemBase):
    pass

class PresetItemUpdate(PresetItemBase):
    pass

class PresetItem(PresetItemBase):
    id: int
    preset_id: int
    creator_username: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True