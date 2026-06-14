from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services import ai_engine, mock_payer

router = APIRouter(prefix="/patients/{patient_id}/eligibility", tags=["eligibility"])


@router.post("", response_model=schemas.EligibilityCheckOut, status_code=201)
def run_eligibility_check(
    patient_id: int,
    payload: schemas.EligibilityCheckRequest,
    db: Session = Depends(get_db),
):
    patient = db.get(models.Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not patient.insurance:
        raise HTTPException(
            status_code=422,
            detail="Patient has no insurance on file — add insurance before running eligibility check.",
        )

    # 1. Mock payer call
    status, payer_response = mock_payer.check_eligibility(patient.insurance)

    # 2. Derive prior-auth status for this CPT code
    existing_pa = (
        db.query(models.PriorAuthorization)
        .filter(
            models.PriorAuthorization.patient_id == patient_id,
            models.PriorAuthorization.cpt_code == payload.cpt_code,
        )
        .first()
    )
    prior_auth_status = existing_pa.status.value if existing_pa else "not_requested"

    # 3. AI analysis (degrades gracefully if key not set)
    ai_summary: str | None = None
    ai_flags: list[schemas.AIFlag] = []
    try:
        analysis: schemas.AIAnalysis = ai_engine.analyze_intake(
            patient=patient,
            insurance=patient.insurance,
            eligibility_status=status,
            eligibility_response=payer_response,
            cpt_code=payload.cpt_code,
            description=payload.description,
            setting=payload.setting,
            diagnosis=payload.diagnosis,
            prior_auth_status=prior_auth_status,
        )
        ai_summary = analysis.summary
        ai_flags = analysis.flags
    except ai_engine.AIEngineUnavailable as exc:
        ai_summary = f"[AI engine unavailable] {exc}"

    # 4. Persist eligibility check
    check = models.EligibilityCheck(
        patient_id=patient_id,
        status=status,
        payer_response=payer_response,
        ai_summary=ai_summary,
    )
    db.add(check)
    db.flush()

    # 5. Persist AI-generated alerts
    for flag in ai_flags:
        db.add(
            models.Alert(
                patient_id=patient_id,
                type=flag.type,
                severity=flag.severity,
                message=flag.message,
                recommendation=flag.recommendation,
            )
        )

    db.commit()
    db.refresh(check)
    return check


@router.get("", response_model=list[schemas.EligibilityCheckOut])
def list_eligibility_checks(patient_id: int, db: Session = Depends(get_db)):
    patient = db.get(models.Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return (
        db.query(models.EligibilityCheck)
        .filter(models.EligibilityCheck.patient_id == patient_id)
        .order_by(models.EligibilityCheck.checked_at.desc())
        .all()
    )
