import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services import denial_engine
from app.services.ai_engine import AIEngineUnavailable

router = APIRouter(tags=["claims"])


def _claim_or_404(claim_id: int, db: Session) -> models.Claim:
    claim = db.get(models.Claim, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


def retrieve_similar_denials(
    db: Session,
    *,
    cpt_code: str,
    payer_name: str,
    icd_code: str | None,
    setting: models.CareSetting,
    limit: int = 10,
) -> list[models.Denial]:
    """Retrieval step of the learning loop.

    Structured query: past denials whose claim shares the CPT code, payer,
    ICD code, or care setting with the claim being assessed, most recent first.
    Swap this for FAISS / pgvector semantic search to upgrade to vector RAG.
    """
    conditions = [
        models.Claim.cpt_code == cpt_code,
        models.Claim.payer_name == payer_name,
        models.Claim.setting == setting,
    ]
    if icd_code:
        conditions.append(models.Claim.icd_code == icd_code)

    return (
        db.query(models.Denial)
        .join(models.Claim, models.Denial.claim_id == models.Claim.id)
        .filter(or_(*conditions))
        .order_by(models.Denial.created_at.desc())
        .limit(limit)
        .all()
    )


# ---- Claim CRUD ----


@router.post("/patients/{patient_id}/claims", response_model=schemas.ClaimOut, status_code=201)
def create_claim(
    patient_id: int,
    payload: schemas.ClaimCreate,
    db: Session = Depends(get_db),
):
    patient = db.get(models.Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    payer_name = payload.payer_name or (
        patient.insurance.payer_name if patient.insurance else None
    )
    if not payer_name:
        raise HTTPException(
            status_code=422,
            detail="No payer specified and patient has no insurance on file.",
        )

    claim = models.Claim(
        patient_id=patient_id,
        cpt_code=payload.cpt_code,
        icd_code=payload.icd_code,
        setting=payload.setting,
        payer_name=payer_name,
        charge_amount=payload.charge_amount,
        status=models.ClaimStatus.DRAFT,
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim


@router.get("/patients/{patient_id}/claims", response_model=list[schemas.ClaimOut])
def list_patient_claims(patient_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Patient, patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    return (
        db.query(models.Claim)
        .filter(models.Claim.patient_id == patient_id)
        .order_by(models.Claim.created_at.desc())
        .all()
    )


@router.get("/claims", response_model=list[schemas.ClaimOut])
def list_all_claims(db: Session = Depends(get_db)):
    return db.query(models.Claim).order_by(models.Claim.created_at.desc()).all()


@router.get("/claims/{claim_id}", response_model=schemas.ClaimOut)
def get_claim(claim_id: int, db: Session = Depends(get_db)):
    return _claim_or_404(claim_id, db)


# ---- Lifecycle: submit / accept / deny ----


@router.post("/claims/{claim_id}/submit", response_model=schemas.ClaimOut)
def submit_claim(claim_id: int, db: Session = Depends(get_db)):
    claim = _claim_or_404(claim_id, db)
    if claim.status in (models.ClaimStatus.DRAFT, models.ClaimStatus.DENIED):
        claim.status = (
            models.ClaimStatus.RESUBMITTED
            if claim.status == models.ClaimStatus.DENIED
            else models.ClaimStatus.SUBMITTED
        )
        claim.submitted_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(claim)
    return claim


@router.post("/claims/{claim_id}/accept", response_model=schemas.ClaimOut)
def accept_claim(claim_id: int, db: Session = Depends(get_db)):
    claim = _claim_or_404(claim_id, db)
    claim.status = models.ClaimStatus.ACCEPTED
    db.commit()
    db.refresh(claim)
    return claim


@router.post("/claims/{claim_id}/deny", response_model=schemas.ClaimOut)
def deny_claim(
    claim_id: int,
    payload: schemas.DenyClaimRequest,
    db: Session = Depends(get_db),
):
    """Simulate a payer denial (in production this arrives via an 835 remittance).

    The raw denial text is run through the AI denial-reason parser, stored as a
    structured Denial, and surfaced back to the team as a patient Alert.
    """
    claim = _claim_or_404(claim_id, db)

    category = models.DenialCategory.OTHER
    root_cause = None
    preventable = True
    recommendation = None

    try:
        parsed = denial_engine.parse_denial(
            cpt_code=claim.cpt_code,
            icd_code=claim.icd_code,
            setting=claim.setting.value,
            payer_name=claim.payer_name,
            charge_amount=claim.charge_amount,
            raw_reason=payload.raw_reason,
        )
        category = parsed.category
        root_cause = parsed.root_cause
        preventable = parsed.preventable
        recommendation = parsed.recommendation
    except AIEngineUnavailable:
        # Record the denial unparsed — the payer denied regardless of our AI.
        root_cause = "(AI parser unavailable — denial stored unclassified)"

    denial = models.Denial(
        claim_id=claim.id,
        raw_reason=payload.raw_reason,
        category=category,
        root_cause=root_cause,
        preventable=preventable,
        recommendation=recommendation,
    )
    db.add(denial)

    claim.status = models.ClaimStatus.DENIED

    # Close the loop: surface the denial as an alert on the patient.
    db.add(
        models.Alert(
            patient_id=claim.patient_id,
            type=models.AlertType.DENIAL_RISK,
            severity=models.AlertSeverity.HIGH
            if preventable
            else models.AlertSeverity.MEDIUM,
            message=f"Claim #{claim.id} ({claim.cpt_code}) denied: {root_cause or payload.raw_reason}",
            recommendation=recommendation,
        )
    )

    db.commit()
    db.refresh(claim)
    return claim


# ---- Learning loop: pre-submission risk assessment ----


@router.post("/claims/{claim_id}/assess-risk", response_model=schemas.ClaimRiskResponse)
def assess_claim_risk(claim_id: int, db: Session = Depends(get_db)):
    claim = _claim_or_404(claim_id, db)

    similar = retrieve_similar_denials(
        db,
        cpt_code=claim.cpt_code,
        payer_name=claim.payer_name,
        icd_code=claim.icd_code,
        setting=claim.setting,
    )
    # Don't let a claim's own prior denials leak in as "history" of others —
    # but DO include them (resubmission learns from its own past). Keep all.
    history = [
        {
            "category": d.category.value,
            "cpt_code": d.claim.cpt_code,
            "setting": d.claim.setting.value,
            "payer_name": d.claim.payer_name,
            "root_cause": d.root_cause or d.raw_reason,
            "recommendation": d.recommendation or "n/a",
        }
        for d in similar
    ]

    try:
        assessment = denial_engine.assess_denial_risk(
            cpt_code=claim.cpt_code,
            icd_code=claim.icd_code,
            setting=claim.setting.value,
            payer_name=claim.payer_name,
            charge_amount=claim.charge_amount,
            historical_denials=history,
        )
    except AIEngineUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return schemas.ClaimRiskResponse(
        assessment=assessment,
        historical_denials_considered=len(history),
    )
