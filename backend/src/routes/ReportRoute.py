import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.Report import ReportTable
from src.models.ReportImage import ReportImageTable
from src.models.User import UserTable
from src.schemas.report_schema import (
    PublicReportOut,
    ReportCreate,
    ReportImageOut,
    ReportOut,
    StatusUpdate,
)
from src.utils.deps import get_db, get_current_user
from src.utils.image_storage import (
    delete_report_dir,
    delete_report_image_file,
    save_report_image,
)

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
    # Hard cap of 100 — the page can't blow up. TODO: pagination when public
    # reports exceed ~100.
    limit: int = Query(100, ge=1, le=100),
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
    # Re-fetch with images eagerly loaded: commit expires attributes and a bare
    # db.refresh() would not reload the `images` relationship, so serialising it
    # through ReportOut would lazy-load under async → MissingGreenlet.
    refreshed = await _get_report_with_images(report_id, db)
    return ReportOut.model_validate(refreshed)


# AUTH REQUIRED — attach a before/after photo to a report the caller owns.
# Images are saved under src/statics/reports/<id>/ and served at /static/reports/...
@route.post("/{report_id}/images", response_model=ReportImageOut)
async def upload_report_image(
    report_id: int,
    file: UploadFile = File(...),
    image_type: str = Form(...),
    # Client sets this true for the auto-attached annotated detection frame
    # (the canvas snapshot with boxes), false for manual photo uploads.
    is_annotated: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    if image_type not in ("before", "after"):
        raise HTTPException(status_code=422, detail="image_type must be 'before' or 'after'")

    result = await db.execute(select(ReportTable).where(ReportTable.id == report_id))
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail=f"Report with id {report_id} not found")
    if report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this report")

    image_url = await save_report_image(file, report_id, image_type)
    new_image = ReportImageTable(
        report_id=report_id,
        image_url=image_url,
        image_type=image_type,
        is_annotated=is_annotated,
    )
    db.add(new_image)
    await db.commit()
    await db.refresh(new_image)
    return ReportImageOut.model_validate(new_image)


# AUTH REQUIRED — owner-only. Deletes the report, its on-disk image files, and
# its report_images rows. ReportTable.images uses cascade="all, delete-orphan",
# so deleting the parent removes the image rows automatically.
# TODO: once authorities drive status, restrict delete to
# status == "submitted" or switch to soft-delete (is_deleted flag).
@route.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    # Eager-load images so the cascade delete-orphan can run without a lazy
    # load at flush time (which would raise MissingGreenlet under async).
    report = await _get_report_with_images(report_id, db)
    if report is None:
        raise HTTPException(status_code=404, detail=f"Report with id {report_id} not found")
    if report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this report")

    delete_report_dir(report_id)
    await db.delete(report)
    await db.commit()


# AUTH REQUIRED — owner-only. Removes a single image (file + row) from a report.
@route.delete("/{report_id}/images/{image_id}", status_code=204)
async def delete_report_image(
    report_id: int,
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    result = await db.execute(select(ReportTable).where(ReportTable.id == report_id))
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail=f"Report with id {report_id} not found")
    if report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this report")

    result = await db.execute(select(ReportImageTable).where(ReportImageTable.id == image_id))
    image = result.scalar_one_or_none()
    if image is None or image.report_id != report_id:
        raise HTTPException(status_code=404, detail=f"Image with id {image_id} not found")

    delete_report_image_file(image.image_url)
    await db.delete(image)
    await db.commit()
