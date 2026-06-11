from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from src.config.db import Base


class ReportTable(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    # PRIVATE — never exposed publicly. PublicReportOut has no user_id field at all.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String(50), nullable=False)               # e.g. "pothole", "garbage"
    title = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)
    detection_data = Column(Text, nullable=True)                # JSON string of model output (classes/counts/conf)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_text = Column(String(255), nullable=True)
    # allowed: submitted, under_review, in_progress, resolved
    status = Column(String(30), nullable=False, default="submitted")
    is_public = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    images = relationship(
        "ReportImageTable",
        back_populates="report",
        cascade="all, delete-orphan",
    )
