"""
SQLAlchemy ORM models for CHIMERA.
Derived strictly from 02_ARCHITECTURE_DATA_API.md §4.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.database.connection import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    status = Column(String(32), default="created", nullable=False)  # created, ingested, analyzed, stale, error
    analyzed_at = Column(DateTime, nullable=True)
    is_synthetic = Column(Boolean, default=False, nullable=False)

    # Relationships with cascade deletion
    files = relationship("UploadedFile", back_populates="investigation", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="investigation", cascade="all, delete-orphan")
    entities = relationship("Entity", back_populates="investigation", cascade="all, delete-orphan")
    relationships = relationship("Relationship", back_populates="investigation", cascade="all, delete-orphan")
    signals = relationship("Signal", back_populates="investigation", cascade="all, delete-orphan")
    gaps = relationship("Gap", back_populates="investigation", cascade="all, delete-orphan")
    hypotheses = relationship("Hypothesis", back_populates="investigation", cascade="all, delete-orphan")
    initial_access_candidates = relationship("InitialAccessCandidate", back_populates="investigation", cascade="all, delete-orphan")


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(String(64), primary_key=True)
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_path = Column(String(512), nullable=False)
    sha256 = Column(String(64), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    uploaded_at = Column(DateTime, default=utc_now, nullable=False)
    rows_total = Column(Integer, default=0, nullable=False)
    rows_ok = Column(Integer, default=0, nullable=False)
    rows_flagged = Column(Integer, default=0, nullable=False)
    rows_failed = Column(Integer, default=0, nullable=False)

    investigation = relationship("Investigation", back_populates="files")
    events = relationship("Event", back_populates="file", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id = Column(String(64), primary_key=True)  # evt_000001
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    file_id = Column(String(64), ForeignKey("uploaded_files.id", ondelete="CASCADE"), nullable=True)
    row_number = Column(Integer, nullable=False)
    event_time = Column(DateTime, nullable=True, index=True)
    ingested_at = Column(DateTime, nullable=False)
    event_type = Column(String(64), nullable=False)
    source = Column(String(128), nullable=False)
    actor = Column(String(128), nullable=True, index=True)
    source_device = Column(String(128), nullable=True, index=True)
    target = Column(String(128), nullable=True, index=True)
    source_ip = Column(String(64), nullable=True)
    outcome = Column(String(32), default="unknown", nullable=False)
    timestamp_status = Column(String(32), default="ok", nullable=False)
    arrival_flags = Column(JSON, default=list, nullable=False)
    delay_seconds = Column(Integer, nullable=True)
    raw_record = Column(JSON, nullable=False)
    attributes = Column(JSON, default=dict, nullable=False)

    investigation = relationship("Investigation", back_populates="events")
    file = relationship("UploadedFile", back_populates="events")

    __table_args__ = (
        Index("idx_events_inv_time", "investigation_id", "event_time"),
    )


class Entity(Base):
    __tablename__ = "entities"

    id = Column(String(128), primary_key=True)  # user:jdoe
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), primary_key=True)
    entity_type = Column(String(32), nullable=False)  # USER, DEVICE, SERVICE, IP, EVENT, EXTERNAL
    label = Column(String(128), nullable=False)
    attributes = Column(JSON, default=dict, nullable=False)
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)

    investigation = relationship("Investigation", back_populates="entities")


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String(64), primary_key=True)  # edge_xxxxxxxx
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    source_entity_id = Column(String(128), nullable=False, index=True)
    target_entity_id = Column(String(128), nullable=False, index=True)
    relationship_type = Column(String(64), nullable=False)
    status = Column(String(32), nullable=False)  # observed, inferred, needs_verification
    confidence = Column(Float, nullable=False)
    confidence_breakdown = Column(JSON, default=list, nullable=False)
    explanation = Column(Text, nullable=False)
    epistemic_note = Column(Text, nullable=False)
    first_event_time = Column(DateTime, nullable=True)
    last_event_time = Column(DateTime, nullable=True)

    investigation = relationship("Investigation", back_populates="relationships")
    evidence_links = relationship("EvidenceLink", back_populates="relationship", cascade="all, delete-orphan")


class EvidenceLink(Base):
    __tablename__ = "evidence_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_id = Column(String(64), ForeignKey("relationships.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(String(64), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_role = Column(String(32), default="direct", nullable=False)  # direct, corroborating, motivating

    relationship = relationship("Relationship", back_populates="evidence_links")


class Signal(Base):
    __tablename__ = "signals"

    id = Column(String(64), primary_key=True)
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    signal = Column(String(64), nullable=False)
    entity_id = Column(String(128), nullable=False)
    event_id = Column(String(64), ForeignKey("events.id", ondelete="SET NULL"), nullable=True)
    reason = Column(Text, nullable=False)
    severity = Column(String(32), nullable=False)  # low, medium, high
    kind = Column(String(32), default="anomaly", nullable=False)  # anomaly, first_observed

    investigation = relationship("Investigation", back_populates="signals")


class Gap(Base):
    __tablename__ = "gaps"

    id = Column(String(64), primary_key=True)
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    severity = Column(String(32), nullable=False)  # low, medium, high
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    related_edge_ids = Column(JSON, default=list, nullable=False)
    resolves_with = Column(Text, nullable=False)

    investigation = relationship("Investigation", back_populates="gaps")


class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id = Column(String(64), primary_key=True)
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    key = Column(String(16), nullable=False)  # H1, H2, H3
    name = Column(String(255), nullable=False)
    score = Column(Integer, nullable=False)
    score_type = Column(String(32), default="heuristic", nullable=False)
    status = Column(String(32), nullable=False)  # under_investigation, leading, unlikely
    explanation = Column(Text, nullable=False)
    missing_evidence = Column(JSON, default=list, nullable=False)
    contributions = Column(JSON, default=list, nullable=False)

    investigation = relationship("Investigation", back_populates="hypotheses")
    evidence_rows = relationship("HypothesisEvidence", back_populates="hypothesis", cascade="all, delete-orphan")


class HypothesisEvidence(Base):
    __tablename__ = "hypothesis_evidence"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hypothesis_id = Column(String(64), ForeignKey("hypotheses.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(String(64), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    contribution = Column(Integer, nullable=False)  # -1, 0, 1
    rule_id = Column(String(32), nullable=False)
    explanation = Column(Text, nullable=False)

    hypothesis = relationship("Hypothesis", back_populates="evidence_rows")


class InitialAccessCandidate(Base):
    __tablename__ = "initial_access_candidates"

    id = Column(String(64), primary_key=True)
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    rank = Column(Integer, nullable=False)
    event_id = Column(String(64), nullable=False)
    entity_id = Column(String(128), nullable=False)
    reason = Column(Text, nullable=False)
    evidence_ids = Column(JSON, default=list, nullable=False)
    caveat = Column(Text, nullable=False)

    investigation = relationship("Investigation", back_populates="initial_access_candidates")
