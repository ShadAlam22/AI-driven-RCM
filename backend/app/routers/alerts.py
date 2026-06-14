from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/patients/{patient_id}/alerts", tags=["alerts"])


@router.get("", response_model=list[schemas.AlertOut])
def list_alerts(
    patient_id: int,
    resolved: bool | None = None,
    db: Session = Depends(get_db),
):
    if not db.get(models.Patient, patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    q = db.query(models.Alert).filter(models.Alert.patient_id == patient_id)
    if resolved is not None:
        q = q.filter(models.Alert.resolved == resolved)
    return q.order_by(models.Alert.created_at.desc()).all()


@router.patch("/{alert_id}/resolve", response_model=schemas.AlertOut)
def resolve_alert(patient_id: int, alert_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Patient, patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    alert = db.get(models.Alert, alert_id)
    if not alert or alert.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved = True
    db.commit()
    db.refresh(alert)
    return alert
