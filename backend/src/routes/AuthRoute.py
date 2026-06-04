from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from src.models.User import User as UserModel
from src.config.db import db as MongoDB

route = APIRouter(prefix="/api/v1/auth")

# Pydantic model — FastAPI uses this to validate the JSON body automatically.
# If the client sends wrong data (e.g. invalid email), FastAPI rejects it with 422.



@route.post("/register")
async def registerView(data : UserModel):
    await authCollection.insert_one(data.dict())
    return {
        "msg": "Account created successfully",
        "data": data.dict()
        
    }
