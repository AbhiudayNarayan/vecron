import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.Report import ReportTable
from src.models.ReportImage import ReportImageTable  # noqa: F401 — registers the table with Base for create_all
from src.models.User import UserTable
from src.schemas.report_schema import (
    PublicReportOut,
    ReportCreate,
    ReportOut,
    StatusUpdate,
)
from src.utils.deps import get_db, get_current_user

route = APIRouter(prefix="/api/v1/reports")


async def _get_report_with_images(report_id: int, db: AsyncSession) -> ReportTable | None:
    # selectinload: relationships must be eagerly loaded under the async session,
    # lazy loading at serialization time would fail.
    result = await db.execute(
        select(ReportTable)
        .options(selectinload(ReportTable.images))
        .where(ReportTable.id == report_id)
    )
    return result.scalar_one_or_none()


# AUTH REQUIRED — user_id always comes from the token, never the request body.
@route.post("", response_model=ReportOut, status_code=201)
async def create_report(
    data: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    report = ReportTable(
        user_id=current_user.id,
        category=data.category,
        title=data.title,
        description=data.description,
        detection_data=json.dumps(data.detection_data) if data.detection_data is not None else None,
        model_id=data.model_id,
        latitude=data.latitude,
        longitude=data.longitude,
        location_text=data.location_text,
        is_public=data.is_public,
    )
    db.add(report)
    await db.commit()
    created = await _get_report_with_images(report.id, db)
    return ReportOut.model_validate(created)


# NOTE: /mine and /public are declared before /{report_id} so they are not
# captured by the path parameter.

# AUTH REQUIRED — the current user's own reports, newest first.
@route.get("/mine", response_model=list[ReportOut])
async def my_reports(
    db: AsyncSession = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    result = await db.execute(
        select(ReportTable)
        .options(selectinload(ReportTable.images))
        .where(ReportTable.user_id == current_user.id)
        .order_by(ReportTable.created_at.desc())
    )
    return [ReportOut.model_validate(r) for r in result.scalars().all()]


# PUBLIC — no auth dependency. PublicReportOut has no user_id field, so the
# reporter's identity is structurally absent from this response.
@route.get("/public", response_model=list[PublicReportOut])
async def public_reports(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReportTable)
        .options(selectinload(ReportTable.images))
        .where(ReportTable.is_public == True)  # noqa: E712 — SQLAlchemy comparison, not Python bool
        .order_by(ReportTable.created_at.desc())
        .limit(limit)
    )
    return [PublicReportOut.model_validate(r) for r in result.scalars().all()]


# AUTH REQUIRED — owner gets the full private view; anyone else only gets the
# anonymous public view, and only if the report is public. Private reports
# return 404 (not 403) so their existence is never revealed.
@route.get("/{report_id}")
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    not_found = HTTPException(status_code=404, detail=f"Report with id {report_id} not found")
    report = await _get_report_with_images(report_id, db)
    if report is None:
        raise not_found
    if report.user_id == current_user.id:
        return ReportOut.model_validate(report)
    if report.is_public:
        return PublicReportOut.model_validate(report)
    raise not_found


# AUTH REQUIRED — only the report's owner may change status.
# TODO: expand this permission to officials/authorities once roles exist.
@route.patch("/{report_id}/status", response_model=ReportOut)
async def update_status(
    report_id: int,
    data: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    report = await _get_report_with_images(report_id, db)
    # Non-owners get the same 404 as a missing report — don't reveal it exists.
    if report is None or report.user_id != current_user.id:
        raise HTTPException(status_code=404, detail=f"Report with id {report_id} not found")
    report.status = data.status
    await db.commit()
    await db.refresh(report)
    return ReportOut.model_validate(report)
