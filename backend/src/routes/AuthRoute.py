from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.User import User as UserModel, UserTable
from src.utils.hashing import hash_password, verify_password, create_access_token
from src.utils.deps import get_db, get_current_user

route = APIRouter(prefix="/api/v1/auth")


class LoginModel(BaseModel):                                      # ← NEW
    email: EmailStr                                               # ← NEW
    password: str                                                 # ← NEW


@route.post("/register")
async def registerView(data: UserModel, db: AsyncSession = Depends(get_db)):
    user = UserTable(
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
        address=data.address,
        mobile=data.mobile,
    )
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    return {
        "msg": "Account created successfully",
        "data": data.model_dump(exclude={"password"}),
    }


@route.post("/login")                                             # ← NEW
async def loginView(data: LoginModel, db: AsyncSession = Depends(get_db)):  # ← NEW
    result = await db.execute(                                    # ← NEW
        select(UserTable).where(UserTable.email == data.email)    # ← NEW
    )                                                             # ← NEW
    user = result.scalar_one_or_none()                            # ← NEW
                                                                  # ← NEW
    if not user or not verify_password(data.password, user.password):  # ← NEW
        raise HTTPException(status_code=401, detail="Invalid email or password.")  # ← NEW
                                                                  # ← NEW
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"access_token": token, "token_type": "bearer"}


@route.get("/me")
async def me(current_user: UserTable = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "address": current_user.address,
        "mobile": current_user.mobile,
        "created_at": current_user.created_at,
    }