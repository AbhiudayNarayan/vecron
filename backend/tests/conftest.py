"""
Test fixtures for the reports API.

Runs the real FastAPI app against an in-memory SQLite database (via an
override of get_db), so the auth/ownership logic and the image-upload flow
are exercised end-to-end without touching MySQL or the dev statics dir.
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.app import app
from src.config.db import Base
from src.models.User import UserTable
# Import the models so their tables are registered on Base before create_all.
from src.models.Report import ReportTable  # noqa: F401
from src.models.ReportImage import ReportImageTable  # noqa: F401
from src.utils.deps import get_db
from src.utils.hashing import create_access_token, hash_password
from src.utils import image_storage


@pytest_asyncio.fixture
async def db_sessionmaker():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    yield maker
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_sessionmaker, tmp_path, monkeypatch):
    # Save uploaded images into a temp dir instead of src/statics/reports.
    monkeypatch.setattr(image_storage, "REPORTS_STATIC_DIR", tmp_path / "reports")

    async def override_get_db():
        async with db_sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def _make_user(db_sessionmaker, email: str) -> UserTable:
    async with db_sessionmaker() as session:
        user = UserTable(name=email.split("@")[0], email=email, password=hash_password("pw"))
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


def _auth_header(user: UserTable) -> dict:
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def user_a(db_sessionmaker):
    return await _make_user(db_sessionmaker, "alice@example.com")


@pytest_asyncio.fixture
async def user_b(db_sessionmaker):
    return await _make_user(db_sessionmaker, "bob@example.com")


@pytest.fixture
def auth_a(user_a):
    return _auth_header(user_a)


@pytest.fixture
def auth_b(user_b):
    return _auth_header(user_b)


# Minimal JPEG byte payload (SOI + filler + EOI). The upload endpoint validates
# by Content-Type, not by decoding pixels, so this is enough to exercise the path.
TINY_JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64 + b"\xff\xd9"
