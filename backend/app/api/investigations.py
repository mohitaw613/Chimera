"""
Investigations and Dashboard API router.
Source: 02_ARCHITECTURE_DATA_API.md §5.1.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.connection import get_db
from app.database.models import (
    Investigation,
    Event,
    Entity,
    Signal,
    Gap,
    Relationship,
)
from app.schemas.investigation import (
    InvestigationCreate,
    InvestigationResponse,
    InvestigationCounts,
    DashboardSummary,
)
from app.utils.ids import generate_investigation_id

router = APIRouter(tags=["investigations"])


def _build_investigation_response(inv: Investigation, db: Session) -> InvestigationResponse:
    event_count = db.query(func.count(Event.id)).filter(Event.investigation_id == inv.id).scalar() or 0
    entity_count = db.query(func.count(Entity.id)).filter(Entity.investigation_id == inv.id).scalar() or 0
    gap_count = db.query(func.count(Gap.id)).filter(Gap.investigation_id == inv.id).scalar() or 0

    return InvestigationResponse(
        id=inv.id,
        name=inv.name,
        description=inv.description,
        created_at=inv.created_at,
        status=inv.status,
        analyzed_at=inv.analyzed_at,
        is_synthetic=inv.is_synthetic,
        counts=InvestigationCounts(
            events=event_count,
            entities=entity_count,
            open_gaps=gap_count,
        ),
    )


@router.post("/investigations", response_model=InvestigationResponse, status_code=status.HTTP_201_CREATED)
def create_investigation(payload: InvestigationCreate, db: Session = Depends(get_db)):
    inv_id = generate_investigation_id()
    inv = Investigation(
        id=inv_id,
        name=payload.name,
        description=payload.description,
        is_synthetic=payload.is_synthetic,
        status="created",
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return _build_investigation_response(inv, db)


@router.get("/investigations", response_model=List[InvestigationResponse])
def list_investigations(db: Session = Depends(get_db)):
    investigations = db.query(Investigation).order_by(Investigation.created_at.desc()).all()
    return [_build_investigation_response(inv, db) for inv in investigations]


@router.get("/investigations/{investigation_id}", response_model=InvestigationResponse)
def get_investigation(investigation_id: str, db: Session = Depends(get_db)):
    inv = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": f"Investigation {investigation_id} not found", "code": "NOT_FOUND"},
        )
    return _build_investigation_response(inv, db)


@router.delete("/investigations/{investigation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_investigation(investigation_id: str, db: Session = Depends(get_db)):
    inv = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": f"Investigation {investigation_id} not found", "code": "NOT_FOUND"},
        )
    db.delete(inv)
    db.commit()
    return None


@router.get("/dashboard", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    total_invs = db.query(func.count(Investigation.id)).scalar() or 0
    total_evts = db.query(func.count(Event.id)).scalar() or 0
    total_sigs = db.query(func.count(Signal.id)).scalar() or 0
    total_ents = db.query(func.count(Entity.id)).scalar() or 0
    total_gaps = db.query(func.count(Gap.id)).scalar() or 0

    recent_invs = db.query(Investigation).order_by(Investigation.created_at.desc()).limit(5).all()
    recent_responses = [_build_investigation_response(inv, db) for inv in recent_invs]

    return DashboardSummary(
        total_investigations=total_invs,
        total_events=total_evts,
        total_signals=total_sigs,
        total_entities=total_ents,
        open_gaps=total_gaps,
        recent=recent_responses,
    )
