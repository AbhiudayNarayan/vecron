import json

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ModelOut(BaseModel):
    # Pydantic v2: read straight from ORM objects (replaces v1 orm_mode).
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    task_type: str | None = None
    industry: str | None = None
    accuracy: float | None = None
    runtime: str | None = None
    model_size_mb: float | None = None
    latency_ms: float | None = None
    optimization: str | None = None
    supported_devices: list[str] = Field(default_factory=list)
    onnx_url: str
    input_size: int | None = None
    labels: list[str] = Field(default_factory=list)
    license: str | None = None
    is_free: bool
    cloud_eligible: bool = False

    @field_validator("labels", "supported_devices", mode="before")
    @classmethod
    def parse_labels(cls, v):
        """`labels` is stored as a JSON string in the DB; expose it as a list."""
        if v is None or v == "":
            return []
        if isinstance(v, list):
            return v
        try:
            parsed = json.loads(v)
            return parsed if isinstance(parsed, list) else []
        except (json.JSONDecodeError, TypeError):
            return []
