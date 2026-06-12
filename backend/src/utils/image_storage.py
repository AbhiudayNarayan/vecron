"""
Image storage utility for report images.
Dev: saves to src/statics/reports/<report_id>/<uuid>_<image_type>.jpg
     served at /static/reports/...  (the app already mounts /static -> src/statics)
Prod-ready: swap save_report_image() to upload to R2 and return a CDN URL.
"""
import shutil
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException
import aiofiles

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB

REPORTS_STATIC_DIR = Path(__file__).parent.parent / "statics" / "reports"


async def save_report_image(
    file: UploadFile,
    report_id: int,
    image_type: str,  # "before" | "after"
) -> str:
    """
    Validate, save, and return the URL path for a report image.
    Returns a relative URL like /static/reports/<report_id>/<filename>
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type: {file.content_type}. "
                   f"Allowed: jpeg, png, webp"
        )

    # Read with size guard
    contents = await file.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large (max {MAX_IMAGE_BYTES // (1024*1024)} MB)"
        )

    ext = file.content_type.split("/")[-1].replace("jpeg", "jpg")
    filename = f"{uuid.uuid4().hex}_{image_type}.{ext}"

    dest_dir = REPORTS_STATIC_DIR / str(report_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest_path = dest_dir / filename
    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(contents)

    return f"/static/reports/{report_id}/{filename}"


# When this swaps to R2 later, delete_report_dir and delete_report_image_file
# are the only thing that changes (drop a key / a prefix instead of files).

def delete_report_dir(report_id: int) -> None:
    """Remove the whole on-disk image dir for a report. No-op if absent."""
    dest_dir = REPORTS_STATIC_DIR / str(report_id)
    if dest_dir.exists():
        shutil.rmtree(dest_dir, ignore_errors=True)


def delete_report_image_file(image_url: str) -> None:
    """Remove a single image file given its stored /static/reports/... URL.
    No-op if the file is missing. Resolve safely under REPORTS_STATIC_DIR
    and refuse paths that escape it."""
    prefix = "/static/reports/"
    if not image_url.startswith(prefix):
        return
    relative = image_url[len(prefix):]
    base = REPORTS_STATIC_DIR.resolve()
    dest_path = (REPORTS_STATIC_DIR / relative).resolve()
    # Refuse anything that resolves outside REPORTS_STATIC_DIR (e.g. via ../).
    try:
        dest_path.relative_to(base)
    except ValueError:
        return
    if dest_path.is_file():
        dest_path.unlink()
