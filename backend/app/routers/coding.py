import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.mongo import get_notes_collection
from app.services import note_analyzer
from app.services.ai_engine import AIEngineUnavailable

router = APIRouter(prefix="/patients/{patient_id}/notes/{note_id}/analyze", tags=["coding"])


@router.post("", response_model=schemas.ClinicalNoteOut)
def analyze_note(
    patient_id: int,
    note_id: str,
    db: Session = Depends(get_db),
):
    patient = db.get(models.Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    col = get_notes_collection()
    doc = col.find_one({"_id": ObjectId(note_id), "patient_id": patient_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Note not found")

    try:
        analysis: schemas.NoteAnalysis = note_analyzer.analyze_note(
            patient_id=patient_id,
            note_type=doc["note_type"],
            author_role=doc["author_role"],
            content=doc["content"],
        )
    except AIEngineUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    analysis_dict = analysis.model_dump()
    now = datetime.datetime.utcnow()
    col.update_one(
        {"_id": ObjectId(note_id)},
        {"$set": {"analysis": analysis_dict, "analyzed_at": now}},
    )

    # Persist denial-risk flags from the note as Alerts so they appear in the dashboard
    for flag in analysis.denial_risks:
        existing = (
            db.query(models.Alert)
            .filter(
                models.Alert.patient_id == patient_id,
                models.Alert.type == flag.type,
                models.Alert.message == flag.message,
                models.Alert.resolved == False,
            )
            .first()
        )
        if not existing:
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

    doc["analysis"] = analysis_dict
    doc["analyzed_at"] = now

    analysis_out = schemas.NoteAnalysis(**analysis_dict)
    return schemas.ClinicalNoteOut(
        id=str(doc["_id"]),
        patient_id=doc["patient_id"],
        note_type=doc["note_type"],
        author_role=doc["author_role"],
        content=doc["content"],
        created_at=doc["created_at"],
        analysis=analysis_out,
        analyzed_at=now,
    )
