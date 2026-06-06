import bcrypt
import hashlib
import os
from datetime import datetime, timedelta
from jose import jwt

def _prehash(plain: str) -> bytes:
    # SHA-256 hex digest is 64 bytes — always within bcrypt's 72-byte limit
    return hashlib.sha256(plain.encode()).hexdigest().encode()


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_prehash(plain), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_prehash(plain), hashed.encode())

# ── JWT — add everything below this line ──────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-before-production")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)