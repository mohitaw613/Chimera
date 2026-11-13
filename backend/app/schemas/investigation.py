"""
Investigation schemas.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class InvestigationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_synthetic: bool = False


class InvestigationCounts(BaseModel):
    events: int = 0
    entities: int = 0
    open_gaps: int = 0


class InvestigationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    status: str
    analyzed_at: Optional[datetime] = None
    is_synthetic: bool
    counts: Optional[InvestigationCounts] = None


class DashboardSummary(BaseModel):
    total_investigations: int
    total_events: int
    total_signals: int
    total_entities: int
    open_gaps: int
    recent: List[InvestigationResponse]
