import bcrypt
import hashlib
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from jose import jwt

# This module reads env at import time and may be imported before config/db.py
# runs its own load_dotenv() — load here too (idempotent) so SECRET_KEY is found.
load_dotenv()

def _prehash(plain: str) -> bytes:
    # SHA-256 hex digest is 64 bytes — always within bcrypt's 72-byte limit
    return hashlib.sha256(plain.encode()).hexdigest().encode()


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_prehash(plain), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_prehash(plain), hashed.encode())

# ── JWT — add everything below this line ──────────────────────────────────────
# No insecure fallback: a missing SECRET_KEY must stop the app, never start it
# with a known key (which would let anyone forge tokens).
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is not set. Generate one with:\n"
        '  python -c "import secrets; print(secrets.token_urlsafe(32))"\n'
        "and put it in backend/.env as SECRET_KEY=<value>."
    )
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)