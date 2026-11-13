"""
Relationship and Edge Evidence Panel schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ConfidenceDelta(BaseModel):
    label: str
    delta: float


class CytoscapeEdgeData(BaseModel):
    id: str
    source: str
    target: str
    label: str
    status: str
    confidence: float
    evidence_ids: List[str]
    event_time: Optional[str] = None


class CytoscapeEdge(BaseModel):
    data: CytoscapeEdgeData


class GraphFinding(BaseModel):
    text: str
    incomplete: bool
    open_gaps: int


class GraphLegend(BaseModel):
    status: List[str] = ["observed", "inferred", "needs_verification"]


class GraphResponse(BaseModel):
    nodes: List[CytoscapeNode]
    edges: List[CytoscapeEdge]
    finding: GraphFinding
    legend: GraphLegend = GraphLegend()


# Edge detail for the centerpiece Evidence Panel (spec 02 §5.5)
class EntitySummary(BaseModel):
    id: str
    label: str
    type: str


class EvidenceItem(BaseModel):
    event_id: str
    role: str  # direct, corroborating, motivating
    event_time: Optional[str] = None
    source: str
    summary: str
    raw_record: Dict[str, Any]
    file: Optional[str] = None
    row_number: Optional[int] = None
    status: str


class EvidenceCheck(BaseModel):
    label: str
    state: str  # observed, inferred, unverified


class GapSummary(BaseModel):
    id: str
    title: str


class EdgeDetailResponse(BaseModel):
    id: str
    source: EntitySummary
    target: EntitySummary
    relationship_type: str
    status: str
    confidence: float
    confidence_breakdown: List[ConfidenceDelta]
    why: str
    epistemic_note: str
    evidence: List[EvidenceItem]
    checks: List[EvidenceCheck]
    gaps: List[GapSummary]
    conclusion: str
