from sqlalchemy import Column, Integer, String, Text, Float, Boolean
from src.config.db import Base


class ModelTable(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=False)
    task_type = Column(String(50))
    industry = Column(String(80))
    accuracy = Column(Float, nullable=True)
    runtime = Column(String(32), nullable=True)
    model_size_mb = Column(Float, nullable=True)
    latency_ms = Column(Float, nullable=True)
    optimization = Column(String(32), nullable=True)
    supported_devices = Column(Text, nullable=True)  # JSON string, e.g. ["edge", "cpu"]
    onnx_url = Column(String(255), nullable=False)
    input_size = Column(Integer, default=640)
    labels = Column(Text)                       # JSON string of class names, e.g. '["smoke", "fire"]'
    license = Column(String(50), default="unknown")
    is_free = Column(Boolean, default=True)
    # Whether the model's license permits offering it on the paid cloud tier.
    # AGPL/unknown-license models must stay False (free, in-browser tier only).
    cloud_eligible = Column(Boolean, default=False)
