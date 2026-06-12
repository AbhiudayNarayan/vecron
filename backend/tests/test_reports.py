"""Tests for the report image-upload endpoint and its ownership/validation rules."""
from sqlalchemy import select

from src.models.ReportImage import ReportImageTable
from tests.conftest import TINY_JPEG


async def _upload_image(client, report_id, auth, image_type="before"):
    res = await client.post(
        f"/api/v1/reports/{report_id}/images",
        files={"file": (f"{image_type}.jpg", TINY_JPEG, "image/jpeg")},
        data={"image_type": image_type},
        headers=auth,
    )
    assert res.status_code == 200, res.text
    return res.json()


async def _create_report(client, auth, **overrides):
    body = {"category": "pothole", "title": "Broken road", "is_public": False}
    body.update(overrides)
    res = await client.post("/api/v1/reports", json=body, headers=auth)
    assert res.status_code == 201, res.text
    return res.json()


async def test_upload_image_to_own_report(client, auth_a):
    report = await _create_report(client, auth_a)
    res = await client.post(
        f"/api/v1/reports/{report['id']}/images",
        files={"file": ("before.jpg", TINY_JPEG, "image/jpeg")},
        data={"image_type": "before"},
        headers=auth_a,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["image_url"].startswith("/static/reports/")
    assert body["image_type"] == "before"
    assert body["report_id"] == report["id"]


async def test_upload_annotated_image(client, auth_a):
    # The auto-attached detection frame is sent with is_annotated="true".
    report = await _create_report(client, auth_a)
    res = await client.post(
        f"/api/v1/reports/{report['id']}/images",
        files={"file": ("before.jpg", TINY_JPEG, "image/jpeg")},
        data={"image_type": "before", "is_annotated": "true"},
        headers=auth_a,
    )
    assert res.status_code == 200, res.text
    assert res.json()["is_annotated"] is True


async def test_upload_defaults_not_annotated(client, auth_a):
    # Backwards-compatible default: no is_annotated field → False (manual upload).
    report = await _create_report(client, auth_a)
    res = await client.post(
        f"/api/v1/reports/{report['id']}/images",
        files={"file": ("before.jpg", TINY_JPEG, "image/jpeg")},
        data={"image_type": "before"},
        headers=auth_a,
    )
    assert res.status_code == 200, res.text
    assert res.json()["is_annotated"] is False


async def test_get_report_exposes_is_annotated(client, auth_a):
    report = await _create_report(client, auth_a)
    await client.post(
        f"/api/v1/reports/{report['id']}/images",
        files={"file": ("before.jpg", TINY_JPEG, "image/jpeg")},
        data={"image_type": "before", "is_annotated": "true"},
        headers=auth_a,
    )
    res = await client.get(f"/api/v1/reports/{report['id']}", headers=auth_a)
    assert res.status_code == 200, res.text
    img = res.json()["images"][0]
    assert "is_annotated" in img
    assert img["is_annotated"] is True


async def test_upload_image_wrong_user(client, auth_a, auth_b):
    report = await _create_report(client, auth_a)
    res = await client.post(
        f"/api/v1/reports/{report['id']}/images",
        files={"file": ("before.jpg", TINY_JPEG, "image/jpeg")},
        data={"image_type": "before"},
        headers=auth_b,
    )
    assert res.status_code == 403, res.text


async def test_upload_image_missing_report(client, auth_a):
    res = await client.post(
        "/api/v1/reports/99999/images",
        files={"file": ("before.jpg", TINY_JPEG, "image/jpeg")},
        data={"image_type": "before"},
        headers=auth_a,
    )
    assert res.status_code == 404, res.text


async def test_upload_image_bad_type(client, auth_a):
    report = await _create_report(client, auth_a)
    res = await client.post(
        f"/api/v1/reports/{report['id']}/images",
        files={"file": ("note.txt", b"not an image", "text/plain")},
        data={"image_type": "before"},
        headers=auth_a,
    )
    assert res.status_code == 415, res.text


async def test_get_report_includes_images(client, auth_a):
    report = await _create_report(client, auth_a)
    upload = await client.post(
        f"/api/v1/reports/{report['id']}/images",
        files={"file": ("after.jpg", TINY_JPEG, "image/jpeg")},
        data={"image_type": "after"},
        headers=auth_a,
    )
    assert upload.status_code == 200, upload.text

    res = await client.get(f"/api/v1/reports/{report['id']}", headers=auth_a)
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["images"]) == 1
    assert body["images"][0]["image_url"].startswith("/static/reports/")


async def test_delete_own_report(client, auth_a):
    report = await _create_report(client, auth_a)
    res = await client.delete(f"/api/v1/reports/{report['id']}", headers=auth_a)
    assert res.status_code == 204, res.text
    res = await client.get(f"/api/v1/reports/{report['id']}", headers=auth_a)
    assert res.status_code == 404, res.text


async def test_delete_report_wrong_user(client, auth_a, auth_b):
    report = await _create_report(client, auth_a)
    res = await client.delete(f"/api/v1/reports/{report['id']}", headers=auth_b)
    assert res.status_code == 403, res.text
    # Still there for the owner.
    res = await client.get(f"/api/v1/reports/{report['id']}", headers=auth_a)
    assert res.status_code == 200, res.text


async def test_delete_missing_report(client, auth_a):
    res = await client.delete("/api/v1/reports/99999", headers=auth_a)
    assert res.status_code == 404, res.text


async def test_delete_report_removes_images(client, auth_a, db_sessionmaker):
    report = await _create_report(client, auth_a)
    await _upload_image(client, report["id"], auth_a)

    res = await client.delete(f"/api/v1/reports/{report['id']}", headers=auth_a)
    assert res.status_code == 204, res.text

    async with db_sessionmaker() as session:
        rows = (
            await session.execute(
                select(ReportImageTable).where(ReportImageTable.report_id == report["id"])
            )
        ).scalars().all()
    assert rows == []


async def test_delete_single_image(client, auth_a):
    report = await _create_report(client, auth_a)
    await _upload_image(client, report["id"], auth_a, "before")
    after = await _upload_image(client, report["id"], auth_a, "after")

    res = await client.delete(
        f"/api/v1/reports/{report['id']}/images/{after['id']}", headers=auth_a
    )
    assert res.status_code == 204, res.text

    res = await client.get(f"/api/v1/reports/{report['id']}", headers=auth_a)
    assert res.status_code == 200, res.text
    images = res.json()["images"]
    assert len(images) == 1
    assert after["id"] not in [img["id"] for img in images]


# ── Public feed ──────────────────────────────────────────────────────────
# The public feed is the anonymous, no-login view. It must require no auth,
# return only public reports, and leak zero reporter identity.


async def test_public_feed_no_auth(client, auth_a):
    # A public report exists, but the feed itself is hit with NO token.
    await _create_report(client, auth_a, is_public=True)
    res = await client.get("/api/v1/reports/public")
    assert res.status_code == 200, res.text


async def test_public_feed_only_public(client, auth_a):
    public = await _create_report(client, auth_a, title="Public one", is_public=True)
    await _create_report(client, auth_a, title="Private one", is_public=False)

    res = await client.get("/api/v1/reports/public")
    assert res.status_code == 200, res.text
    body = res.json()
    assert [r["id"] for r in body] == [public["id"]]


async def test_public_feed_strips_identity(client, auth_a):
    report = await _create_report(client, auth_a, is_public=True)
    await _upload_image(client, report["id"], auth_a)

    res = await client.get("/api/v1/reports/public")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body, "expected at least one public report"
    for r in body:
        assert "user_id" not in r
        for img in r["images"]:
            assert "user_id" not in img


async def test_public_feed_newest_first(client, auth_a):
    first = await _create_report(client, auth_a, title="Older", is_public=True)
    second = await _create_report(client, auth_a, title="Newer", is_public=True)

    res = await client.get("/api/v1/reports/public")
    assert res.status_code == 200, res.text
    ids = [r["id"] for r in res.json()]
    assert ids == [second["id"], first["id"]]
