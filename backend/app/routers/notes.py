import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.mongo import get_notes_collection

router = APIRouter(prefix="/patients/{patient_id}/notes", tags=["clinical-notes"])


def _patient_or_404(patient_id: int, db: Session) -> models.Patient:
    p = db.get(models.Patient, patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    return p


def _doc_to_out(doc: dict) -> schemas.ClinicalNoteOut:
    analysis = None
    if doc.get("analysis"):
        analysis = schemas.NoteAnalysis(**doc["analysis"])
    return schemas.ClinicalNoteOut(
        id=str(doc["_id"]),
        patient_id=doc["patient_id"],
        note_type=doc["note_type"],
        author_role=doc["author_role"],
        content=doc["content"],
        created_at=doc["created_at"],
        analysis=analysis,
        analyzed_at=doc.get("analyzed_at"),
    )


@router.post("", response_model=schemas.ClinicalNoteOut, status_code=201)
def create_note(
    patient_id: int,
    payload: schemas.ClinicalNoteCreate,
    db: Session = Depends(get_db),
):
    _patient_or_404(patient_id, db)
    col = get_notes_collection()
    doc = {
        "patient_id": patient_id,
        "note_type": payload.note_type.value,
        "author_role": payload.author_role.value,
        "content": payload.content,
        "created_at": datetime.datetime.utcnow(),
        "analysis": None,
        "analyzed_at": None,
    }
    result = col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_out(doc)


@router.get("", response_model=list[schemas.ClinicalNoteOut])
def list_notes(patient_id: int, db: Session = Depends(get_db)):
    _patient_or_404(patient_id, db)
    col = get_notes_collection()
    docs = col.find({"patient_id": patient_id}).sort("created_at", -1)
    return [_doc_to_out(d) for d in docs]


@router.get("/{note_id}", response_model=schemas.ClinicalNoteOut)
def get_note(patient_id: int, note_id: str, db: Session = Depends(get_db)):
    _patient_or_404(patient_id, db)
    col = get_notes_collection()
    doc = col.find_one({"_id": ObjectId(note_id), "patient_id": patient_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Note not found")
    return _doc_to_out(doc)
