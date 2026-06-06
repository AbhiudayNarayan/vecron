from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from src.config.db import Base


class UserTable(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    address = Column(String(255), default="")
    mobile = Column(String(20), default="")


class User(BaseModel):
    name: str = Field(..., description="name is required")
    email: EmailStr = Field(..., description="email is required")
    password: str = Field(..., description="password is required")
    address: str = ""
    mobile: str = ""
