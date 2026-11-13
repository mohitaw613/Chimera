"""
Event and timeline schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class FileProvenance(BaseModel):
    filename: str
    row_number: int
    sha256: str


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    investigation_id: str
    file_id: Optional[str] = None
    row_number: int
    event_time: Optional[datetime] = None
    ingested_at: datetime
    event_type: str
    source: str
    actor: Optional[str] = None
    source_device: Optional[str] = None
    target: Optional[str] = None
    source_ip: Optional[str] = None
    outcome: str
    timestamp_status: str
    arrival_flags: List[str]
    delay_seconds: Optional[int] = None
    raw_record: Dict[str, Any]
    attributes: Dict[str, Any]


class EventDetailResponse(EventResponse):
    file: Optional[FileProvenance] = None
    used_by_relationships: List[str] = []


class EventsListResponse(BaseModel):
    items: List[EventResponse]
    total: int
    page: int
    page_size: int


class TimelineEvent(BaseModel):
    id: str
    event_time: Optional[datetime] = None
    ingested_at: datetime
    delay_seconds: Optional[int] = None
    event_type: str
    source: str
    actor: Optional[str] = None
    source_device: Optional[str] = None
    target: Optional[str] = None
    outcome: str
    flags: List[str]
    primary_flag: str
    ordering_ambiguous: bool
    signal_ids: List[str] = []


class TimelineResponse(BaseModel):
    events: List[TimelineEvent]
    arrival_sequence: List[str]
    inversions: int
    unordered: List[TimelineEvent]
