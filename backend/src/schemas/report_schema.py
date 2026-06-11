import json
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

ALLOWED_STATUSES = ("submitted", "under_review", "in_progress", "resolved")


def _parse_detection_data(v):
    """`detection_data` is stored as a JSON string in the DB; expose it parsed."""
    if v is None or v == "":
        return None
    if isinstance(v, (dict, list)):
        return v
    try:
        return json.loads(v)
    except (json.JSONDecodeError, TypeError):
        return None


class ReportImageOut(BaseModel):
    # Pydantic v2: read straight from ORM objects (replaces v1 orm_mode).
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_url: str
    image_type: str
    is_annotated: bool = False
    created_at: datetime | None = None


class ReportCreate(BaseModel):
    # No user_id here — it always comes from the auth token, never the client.
    # No status either — every new report starts as "submitted".
    category: str
    title: str | None = None
    description: str | None = None
    detection_data: dict | list | None = None
    model_id: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_text: str | None = None
    is_public: bool = False


class ReportOut(BaseModel):
    """PRIVATE/owner view — includes user_id. Never return this to non-owners."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    category: str
    title: str | None = None
    description: str | None = None
    detection_data: dict | list | None = None
    model_id: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_text: str | None = None
    status: str
    is_public: bool
    created_at: datetime
    updated_at: datetime | None = None
    images: list[ReportImageOut] = []

    @field_validator("detection_data", mode="before")
    @classmethod
    def parse_detection_data(cls, v):
        return _parse_detection_data(v)


class PublicReportOut(BaseModel):
    """PUBLIC view — structurally anonymous: there is no user_id (or any other
    reporter-identifying) field on this schema, so it cannot leak identity."""

    model_config = ConfigDict(from_attributes=True)

    id: int  # report id only — needed to fetch detail; identifies the report, not the reporter
    category: str
    title: str | None = None
    description: str | None = None
    detection_data: dict | list | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_text: str | None = None
    status: str
    created_at: datetime
    images: list[ReportImageOut] = []

    @field_validator("detection_data", mode="before")
    @classmethod
    def parse_detection_data(cls, v):
        return _parse_detection_data(v)


class StatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def check_status(cls, v):
        if v not in ALLOWED_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(ALLOWED_STATUSES)}")
        return v
