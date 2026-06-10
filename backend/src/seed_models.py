"""
Idempotent seed script for the `models` table.

Run from the backend/ directory:
    python -m src.seed_models

Reads BASE_URL from the environment (loaded via .env in config/db.py),
defaulting to http://localhost:8000 for dev — so production only changes
one env var, never the seeded row.
"""
import argparse
import asyncio
import os

from sqlalchemy import select

from src.config.db import AsyncSessionLocal, engine, Base
from src.models.Model import ModelTable  # noqa: F401 — registers table on Base

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

SEED_NAME = "Fire & Smoke Detection"
GARBAGE_NAME = "Garbage Classification"

# Descriptive columns kept in sync on every run (id and name are never touched;
# onnx_url is only updated when --force is passed — see upsert()).
DESCRIPTIVE_FIELDS = (
    "description", "task_type", "industry", "accuracy",
    "input_size", "labels", "license", "is_free", "cloud_eligible",
)

SEED_MODELS = [
    {
        "name": SEED_NAME,
        "description": (
            "Detects fire and smoke in images and video. Useful for early "
            "warning in forests, warehouses, and industrial sites."
        ),
        "task_type": "detection",
        "industry": "safety",
        "accuracy": None,  # TODO: fill in measured mAP once evaluated
        "onnx_url": f"{BASE_URL}/static/models/fire_smoke_v1.onnx",
        "input_size": 640,
        "labels": '["smoke", "fire"]',
        "license": "unknown",  # TODO: confirm base model license before going paid
        "is_free": True,
        # TODO: flip to True only once the license is confirmed non-AGPL/permissive.
        "cloud_eligible": False,
    },
    {
        "name": GARBAGE_NAME,
        "description": (
            "Detects and sorts common waste types — biodegradable, "
            "cardboard, glass, metal, paper, and plastic — in images and video."
        ),
        "task_type": "detection",
        "industry": "waste management",
        "accuracy": None,  # TODO: fill in measured mAP once evaluated
        "onnx_url": f"{BASE_URL}/static/models/Garbage_classification.onnx",
        "input_size": 640,
        "labels": '["BIODEGRADABLE","CARDBOARD","GLASS","METAL","PAPER","PLASTIC"]',
        "license": "unknown",  # NOTE: onnx metadata reports AGPL-3.0
        "is_free": True,
        # AGPL-3.0 per onnx metadata — free, in-browser tier only. Never cloud.
        "cloud_eligible": False,
    },
]


async def upsert(session, data, force=False):
    """Insert by name, or update descriptive fields in place. Returns the
    action taken: "inserted" / "updated" / "unchanged"."""
    existing = (
        await session.execute(
            select(ModelTable).where(ModelTable.name == data["name"])
        )
    ).scalar_one_or_none()

    if existing is None:
        session.add(ModelTable(**data))
        return "inserted"

    changed = False
    for field in DESCRIPTIVE_FIELDS:
        if getattr(existing, field) != data[field]:
            setattr(existing, field, data[field])
            changed = True
    if force and existing.onnx_url != data["onnx_url"]:
        existing.onnx_url = data["onnx_url"]
        changed = True
    return "updated" if changed else "unchanged"


async def seed(force=False):
    # Ensure the table exists (mirrors app.py startup) so this can run standalone.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        for data in SEED_MODELS:
            action = await upsert(session, data, force=force)
            print(f"[seed] {action} '{data['name']}'.")
        await session.commit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Idempotently seed the models table.")
    parser.add_argument(
        "--force", action="store_true",
        help="also update onnx_url when it differs (default: leave it untouched)",
    )
    args = parser.parse_args()
    asyncio.run(seed(force=args.force))
