"""
Blast radius and Report schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class PathStep(BaseModel):
    edge_id: str
    type: str
    status: str
    direction: str  # forward or reverse


class BlastRadiusItem(BaseModel):
    entity_id: str
    entity_type: str
    classification: str  # directly_associated, indirectly_associated, unverified
    hops: int
    path: List[PathStep]
    weakest_status: str
    explanation: str


class BlastRadiusSummary(BaseModel):
    directly_associated: int = 0
    indirectly_associated: int = 0
    unverified: int = 0


class BlastRadiusResponse(BaseModel):
    start: str
    max_hops: int
    label: str = "Potential exposure — not confirmed compromise"
    summary: BlastRadiusSummary
    items: List[BlastRadiusItem]


class ReportOverview(BaseModel):
    investigation_id: str
    investigation_name: str
    is_synthetic: bool
    status: str
    total_events: int
    total_entities: int
    total_relationships: int
    total_signals: int
    open_gaps: int
    time_span_start: Optional[str] = None
    time_span_end: Optional[str] = None
    synthetic_badge: str = "Synthetic data — for evaluation and demonstration only"


class ReportResponse(BaseModel):
    overview: ReportOverview
    finding: Dict[str, Any]
    initial_access: List[Dict[str, Any]]
    hypotheses: List[Dict[str, Any]]
    blast_radius: Optional[BlastRadiusResponse] = None
    key_entities: List[Dict[str, Any]]
    suspicious_relationships: List[Dict[str, Any]]
    signals: List[Dict[str, Any]]
    gaps: List[Dict[str, Any]]
    narrative: str
    reproducibility: Dict[str, Any]
