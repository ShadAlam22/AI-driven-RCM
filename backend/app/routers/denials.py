from fastapi import APIRouter, Depends
from sqlalchemy import Integer, cast, func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/denials", tags=["denials"])


@router.get("", response_model=list[schemas.DenialOut])
def list_denials(db: Session = Depends(get_db)):
    return db.query(models.Denial).order_by(models.Denial.created_at.desc()).all()


@router.get("/dashboard", response_model=schemas.DenialDashboard)
def denial_dashboard(db: Session = Depends(get_db)):
    total_claims = db.query(func.count(models.Claim.id)).scalar() or 0
    total_denials = db.query(func.count(models.Denial.id)).scalar() or 0

    rows = (
        db.query(
            models.Denial.category,
            func.count(models.Denial.id),
            func.sum(cast(models.Denial.preventable, Integer)),
        )
        .group_by(models.Denial.category)
        .all()
    )

    patterns = [
        schemas.DenialPattern(
            category=cat,
            count=count,
            preventable_count=int(preventable or 0),
        )
        for cat, count, preventable in rows
    ]
    patterns.sort(key=lambda p: p.count, reverse=True)

    denial_rate = (total_denials / total_claims) if total_claims else 0.0

    return schemas.DenialDashboard(
        total_denials=total_denials,
        total_claims=total_claims,
        denial_rate=round(denial_rate, 3),
        patterns=patterns,
    )
