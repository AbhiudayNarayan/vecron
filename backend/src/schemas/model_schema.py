import json

from pydantic import BaseModel, ConfigDict, field_validator


class ModelOut(BaseModel):
    # Pydantic v2: read straight from ORM objects (replaces v1 orm_mode).
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    task_type: str | None = None
    industry: str | None = None
    accuracy: float | None = None
    onnx_url: str
    input_size: int | None = None
    labels: list[str] = []
    license: str | None = None
    is_free: bool
    cloud_eligible: bool = False

    @field_validator("labels", mode="before")
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
