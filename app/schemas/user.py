from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone

class UserBase(BaseModel):
    email: EmailStr
    username: str
    is_active: Optional[bool] = True
    role: Optional[str] = "user"

class UserCreate(UserBase):
    password: str

class UserUpdate(UserBase):
    password: Optional[str] = None

class UserInDBBase(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
        }

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    hashed_password: str
