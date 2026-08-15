from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.Model import ModelTable
from src.schemas.model_schema import ModelOut
from src.utils.deps import get_db

route = APIRouter(prefix="/api/v1/models")


async def _has_fulltext_index(db: AsyncSession) -> bool:
    """True if a FULLTEXT index exists on the `models` table in the current schema."""
    result = await db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM information_schema.STATISTICS
            WHERE table_schema = DATABASE()
              AND table_name = 'models'
              AND index_type = 'FULLTEXT'
            """
        )
    )
    return (result.scalar() or 0) > 0


# PUBLIC — no auth dependency. Free tier works without login.
@route.get("", response_model=list[ModelOut])
async def list_models(
    q: str | None = None,
    task: str | None = None,
    domain: str | None = None,
    runtime: str | None = None,
    device: str | None = None,
    optimization: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List catalog models with optional metadata filters.

    All filters are backed by stored model metadata. Fields with no verified
    value stay NULL and therefore are never presented as made-up capabilities.
    """
    stmt = select(ModelTable)

    if q:
        if await _has_fulltext_index(db):
            # Requires the FULLTEXT index documented in the SQL snippet below.
            match = text(
                "MATCH(name, description, industry) "
                "AGAINST (:q IN NATURAL LANGUAGE MODE)"
            ).bindparams(q=q)
            stmt = stmt.where(match)
        else:
            # Fallback: case-insensitive LIKE across the same columns.
            like = f"%{q}%"
            stmt = stmt.where(
                or_(
                    ModelTable.name.ilike(like),
                    ModelTable.description.ilike(like),
                    ModelTable.industry.ilike(like),
                )
            )

    if task:
        stmt = stmt.where(ModelTable.task_type == task)
    if domain:
        stmt = stmt.where(ModelTable.industry == domain)
    if runtime:
        stmt = stmt.where(ModelTable.runtime == runtime)
    if optimization:
        stmt = stmt.where(ModelTable.optimization == optimization)
    if device:
        # Device targets are stored as a JSON string. This matches an exact
        # quoted element without requiring MySQL JSON column migration.
        stmt = stmt.where(ModelTable.supported_devices.ilike(f'%"{device}"%'))

    result = await db.execute(stmt.order_by(ModelTable.name.asc()))
    return result.scalars().all()


# PUBLIC — no auth dependency.
@route.get("/{model_id}", response_model=ModelOut)
async def get_model(model_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelTable).where(ModelTable.id == model_id))
    model = result.scalar_one_or_none()
    if model is None:
        raise HTTPException(status_code=404, detail=f"Model with id {model_id} not found")
    return model
