import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/patients/{patient_id}/prior-auth", tags=["prior-auth"])


def _get_patient_or_404(patient_id: int, db: Session) -> models.Patient:
    patient = db.get(models.Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.post("", response_model=schemas.PriorAuthOut, status_code=201)
def create_prior_auth(
    patient_id: int,
    payload: schemas.PriorAuthCreate,
    db: Session = Depends(get_db),
):
    _get_patient_or_404(patient_id, db)
    pa = models.PriorAuthorization(
        patient_id=patient_id,
        cpt_code=payload.cpt_code,
        description=payload.description,
        setting=payload.setting,
        status=models.PriorAuthStatus.REQUESTED,
        requested_at=datetime.datetime.utcnow(),
    )
    db.add(pa)
    db.commit()
    db.refresh(pa)
    return pa


@router.get("", response_model=list[schemas.PriorAuthOut])
def list_prior_auths(patient_id: int, db: Session = Depends(get_db)):
    _get_patient_or_404(patient_id, db)
    return (
        db.query(models.PriorAuthorization)
        .filter(models.PriorAuthorization.patient_id == patient_id)
        .all()
    )


@router.patch("/{pa_id}", response_model=schemas.PriorAuthOut)
def update_prior_auth_status(
    patient_id: int,
    pa_id: int,
    payload: schemas.PriorAuthUpdate,
    db: Session = Depends(get_db),
):
    _get_patient_or_404(patient_id, db)
    pa = db.get(models.PriorAuthorization, pa_id)
    if not pa or pa.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="Prior authorization not found")
    pa.status = payload.status
    db.commit()
    db.refresh(pa)
    return pa
