from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from src.config.db import Base


class ReportImageTable(Base):
    __tablename__ = "report_images"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    image_url = Column(String(255), nullable=False)
    image_type = Column(String(20), nullable=False, default="before")  # allowed: before, after
    is_annotated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

    report = relationship("ReportTable", back_populates="images")
