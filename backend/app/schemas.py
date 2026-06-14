import datetime

from pydantic import BaseModel, ConfigDict

from app.models import (
    AlertSeverity,
    AlertType,
    CareSetting,
    ClaimStatus,
    DenialCategory,
    EligibilityStatus,
    PlanType,
    PriorAuthStatus,
)

# ---- Insurance ----


class InsuranceInfoCreate(BaseModel):
    payer_name: str
    member_id: str
    plan_type: PlanType


class InsuranceInfoOut(InsuranceInfoCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int


# ---- Patient ----


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: datetime.date
    phone: str | None = None
    email: str | None = None
    insurance: InsuranceInfoCreate | None = None


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    date_of_birth: datetime.date
    phone: str | None
    email: str | None
    created_at: datetime.datetime
    insurance: InsuranceInfoOut | None = None


# ---- Eligibility ----


class EligibilityCheckRequest(BaseModel):
    cpt_code: str
    description: str | None = None
    setting: CareSetting
    diagnosis: str | None = None


class EligibilityCheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    status: EligibilityStatus
    payer_response: dict
    ai_summary: str | None
    checked_at: datetime.datetime


# ---- Prior Authorization ----


class PriorAuthCreate(BaseModel):
    cpt_code: str
    description: str | None = None
    setting: CareSetting


class PriorAuthUpdate(BaseModel):
    status: PriorAuthStatus


class PriorAuthOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    cpt_code: str
    description: str | None
    setting: CareSetting
    status: PriorAuthStatus
    requested_at: datetime.datetime | None


# ---- Alerts ----


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    type: AlertType
    severity: AlertSeverity
    message: str
    recommendation: str | None
    resolved: bool
    created_at: datetime.datetime


# ---- AI structured output (used internally by ai_engine, exposed via eligibility/alerts) ----


class AIFlag(BaseModel):
    """A single structured finding produced by the AI rule engine."""

    type: AlertType
    severity: AlertSeverity
    message: str
    recommendation: str


class AIAnalysis(BaseModel):
    """Structured response the LLM is asked to produce for an intake review."""

    summary: str
    flags: list[AIFlag]


# ---- Brick 2: Clinical Notes (stored in MongoDB) ----

import enum as _enum


class NoteType(str, _enum.Enum):
    PROGRESS = "progress_note"
    ADMISSION = "admission"
    DISCHARGE = "discharge"
    PROCEDURE = "procedure"
    NURSING = "nursing"


class AuthorRole(str, _enum.Enum):
    PHYSICIAN = "physician"
    PA = "physician_assistant"
    MA = "medical_assistant"
    NURSE = "nurse"


class ExtractedCode(BaseModel):
    code: str
    description: str
    confidence: str  # high / medium / low


class MissingDocItem(BaseModel):
    item: str
    reason: str


class NoteAnalysis(BaseModel):
    """Structured AI output for a clinical note (Brick 2 coding assistant)."""

    cpt_codes: list[ExtractedCode]
    icd_codes: list[ExtractedCode]
    missing_documentation: list[MissingDocItem]
    copy_paste_detected: bool
    copy_paste_explanation: str | None
    denial_risks: list[AIFlag]
    summary: str


class ClinicalNoteCreate(BaseModel):
    note_type: NoteType
    author_role: AuthorRole
    content: str


class ClinicalNoteOut(BaseModel):
    id: str
    patient_id: int
    note_type: NoteType
    author_role: AuthorRole
    content: str
    created_at: datetime.datetime
    analysis: NoteAnalysis | None = None
    analyzed_at: datetime.datetime | None = None


# ---- Brick 3: Claims & Denial Management ----


class ClaimCreate(BaseModel):
    cpt_code: str
    icd_code: str | None = None
    setting: CareSetting
    charge_amount: float = 0.0
    payer_name: str | None = None  # defaults to patient's insurance payer if omitted


class DenialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    claim_id: int
    raw_reason: str
    category: DenialCategory
    root_cause: str | None
    preventable: bool
    recommendation: str | None
    created_at: datetime.datetime


class ClaimOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    cpt_code: str
    icd_code: str | None
    setting: CareSetting
    payer_name: str
    charge_amount: float
    status: ClaimStatus
    submitted_at: datetime.datetime | None
    created_at: datetime.datetime
    denials: list[DenialOut] = []


class DenyClaimRequest(BaseModel):
    raw_reason: str


# --- AI structured outputs (denial engine) ---


class DenialParseResult(BaseModel):
    """Structured classification the LLM produces from a raw payer denial."""

    category: DenialCategory
    root_cause: str
    preventable: bool
    recommendation: str
    summary: str


class ClaimRiskWarning(BaseModel):
    severity: AlertSeverity
    message: str
    recommendation: str


class ClaimRiskAssessment(BaseModel):
    """Learning-loop output: denial risk for a claim, informed by past denials."""

    risk_level: AlertSeverity
    warnings: list[ClaimRiskWarning]
    summary: str


class ClaimRiskResponse(BaseModel):
    """API wrapper adding retrieval metadata around the AI assessment."""

    assessment: ClaimRiskAssessment
    historical_denials_considered: int


# --- Denial analytics (dashboard) ---


class DenialPattern(BaseModel):
    category: DenialCategory
    count: int
    preventable_count: int


class DenialDashboard(BaseModel):
    total_denials: int
    total_claims: int
    denial_rate: float
    patterns: list[DenialPattern]
