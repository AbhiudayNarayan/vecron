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
async def list_models(q: str | None = None, db: AsyncSession = Depends(get_db)):
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

    result = await db.execute(stmt)
    return result.scalars().all()


# PUBLIC — no auth dependency.
@route.get("/{model_id}", response_model=ModelOut)
async def get_model(model_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelTable).where(ModelTable.id == model_id))
    model = result.scalar_one_or_none()
    if model is None:
        raise HTTPException(status_code=404, detail=f"Model with id {model_id} not found")
    return model
