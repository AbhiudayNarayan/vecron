"""Small, idempotent schema upgrade for catalog metadata.

The project does not have Alembic yet. Keeping this upgrade explicit and
idempotent lets existing development and production databases gain nullable
metadata columns without dropping or rewriting any model data.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


MODEL_METADATA_COLUMNS = {
    "runtime": "VARCHAR(32) NULL",
    "model_size_mb": "FLOAT NULL",
    "latency_ms": "FLOAT NULL",
    "optimization": "VARCHAR(32) NULL",
    "supported_devices": "TEXT NULL",
}


async def ensure_model_metadata_columns(conn: AsyncConnection) -> None:
    result = await conn.execute(
        text(
            """
            SELECT COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE table_schema = DATABASE() AND table_name = 'models'
            """
        )
    )
    existing = set(result.scalars().all())

    for column, definition in MODEL_METADATA_COLUMNS.items():
        if column not in existing:
            await conn.execute(
                text(f"ALTER TABLE models ADD COLUMN {column} {definition}")
            )
