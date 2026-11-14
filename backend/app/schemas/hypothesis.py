"""
Hypothesis, Signal, Gap, and Initial Access schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class SignalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    investigation_id: str
    signal: str
    entity_id: str
    event_id: Optional[str] = None
    reason: str
    severity: str
    kind: str


class GapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    investigation_id: str
    severity: str
    title: str
    description: str
    related_edge_ids: List[str]
    resolves_with: str


class RuleContribution(BaseModel):
    rule_id: str
    label: str
    e: int  # -1, 0, 1
    w: int
    event_ids: List[str] = []


class HypothesisResponse(BaseModel):
    id: str
    key: str  # H1, H2, H3
    name: str
    score: int
    score_type: str = "heuristic"
    status: str  # under_investigation, leading, unlikely
    label: str = "Heuristic investigation score — not attack probability"
    explanation: Optional[str] = None
    supporting_evidence: List[str] = []
    contradicting_evidence: List[str] = []
    missing_evidence: List[str] = []
    contributions: List[RuleContribution] = []


class InitialAccessCandidateResponse(BaseModel):
    rank: int
    event_id: str
    entity_id: str
    reason: str
    evidence_ids: List[str]
    caveat: str
    technique: Optional[Dict[str, str]] = None
    event_time: Optional[datetime] = None
    source_ip: Optional[str] = None
    target: Optional[str] = None


class FindingSummary(BaseModel):
    text: str
    open_gaps: int
    incomplete: bool


class HypothesesOverviewResponse(BaseModel):
    hypotheses: List[HypothesisResponse]
    gaps: List[GapResponse]
    initial_access: List[InitialAccessCandidateResponse]
    finding: FindingSummary
