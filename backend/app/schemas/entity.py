"""
Entity schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class EntityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    investigation_id: str
    entity_type: str
    label: str
    attributes: Dict[str, Any]
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None


class CytoscapeNodeData(BaseModel):
    id: str
    label: str
    type: str
    first_seen: Optional[str] = None
    signal_ids: List[str] = []
    suspicious: bool = False


class CytoscapeNode(BaseModel):
    data: CytoscapeNodeData
