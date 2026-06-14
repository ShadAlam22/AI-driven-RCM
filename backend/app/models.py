import datetime
import enum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlanType(str, enum.Enum):
    HMO = "HMO"
    PPO = "PPO"
    EPO = "EPO"
    MEDICARE = "MEDICARE"
    MEDICAID = "MEDICAID"


class EligibilityStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"


class CareSetting(str, enum.Enum):
    INPATIENT = "inpatient"
    OUTPATIENT = "outpatient"


class PriorAuthStatus(str, enum.Enum):
    NOT_REQUESTED = "not_requested"
    REQUESTED = "requested"
    APPROVED = "approved"
    DENIED = "denied"


class AlertType(str, enum.Enum):
    MISSING_AUTH = "missing_auth"
    DENIAL_RISK = "denial_risk"
    SETTING_MISMATCH = "setting_mismatch"
    ELIGIBILITY_ISSUE = "eligibility_issue"
    DOCUMENTATION_GAP = "documentation_gap"


class AlertSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    date_of_birth: Mapped[datetime.date] = mapped_column(Date)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )

    insurance: Mapped["InsuranceInfo | None"] = relationship(
        back_populates="patient", uselist=False, cascade="all, delete-orphan"
    )
    eligibility_checks: Mapped[list["EligibilityCheck"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    prior_authorizations: Mapped[list["PriorAuthorization"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    alerts: Mapped[list["Alert"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )


class InsuranceInfo(Base):
    __tablename__ = "insurance_info"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), unique=True)
    payer_name: Mapped[str] = mapped_column(String(150))
    member_id: Mapped[str] = mapped_column(String(50))
    plan_type: Mapped[PlanType] = mapped_column(Enum(PlanType))

    patient: Mapped["Patient"] = relationship(back_populates="insurance")


class EligibilityCheck(Base):
    __tablename__ = "eligibility_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    status: Mapped[EligibilityStatus] = mapped_column(Enum(EligibilityStatus))
    payer_response: Mapped[dict] = mapped_column(JSON)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    checked_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )

    patient: Mapped["Patient"] = relationship(back_populates="eligibility_checks")


class PriorAuthorization(Base):
    __tablename__ = "prior_authorizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    cpt_code: Mapped[str] = mapped_column(String(10))
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    setting: Mapped[CareSetting] = mapped_column(Enum(CareSetting))
    status: Mapped[PriorAuthStatus] = mapped_column(
        Enum(PriorAuthStatus), default=PriorAuthStatus.NOT_REQUESTED
    )
    requested_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    patient: Mapped["Patient"] = relationship(back_populates="prior_authorizations")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    type: Mapped[AlertType] = mapped_column(Enum(AlertType))
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity))
    message: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )

    patient: Mapped["Patient"] = relationship(back_populates="alerts")


# ---- Brick 3: Claims & Denial Management ----


class ClaimStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    DENIED = "denied"
    RESUBMITTED = "resubmitted"


class DenialCategory(str, enum.Enum):
    MISSING_PRIOR_AUTH = "missing_prior_auth"
    MEDICAL_NECESSITY = "medical_necessity"
    CODING_ERROR = "coding_error"
    ELIGIBILITY = "eligibility"
    DUPLICATE_CLAIM = "duplicate_claim"
    SETTING_MISMATCH = "setting_mismatch"
    MISSING_DOCUMENTATION = "missing_documentation"
    TIMELY_FILING = "timely_filing"
    OTHER = "other"


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    cpt_code: Mapped[str] = mapped_column(String(10))
    icd_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    setting: Mapped[CareSetting] = mapped_column(Enum(CareSetting))
    payer_name: Mapped[str] = mapped_column(String(150))
    charge_amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[ClaimStatus] = mapped_column(
        Enum(ClaimStatus), default=ClaimStatus.DRAFT
    )
    submitted_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )

    patient: Mapped["Patient"] = relationship()
    denials: Mapped[list["Denial"]] = relationship(
        back_populates="claim", cascade="all, delete-orphan"
    )


class Denial(Base):
    __tablename__ = "denials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"))
    raw_reason: Mapped[str] = mapped_column(Text)
    category: Mapped[DenialCategory] = mapped_column(
        Enum(DenialCategory), default=DenialCategory.OTHER
    )
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    preventable: Mapped[bool] = mapped_column(Boolean, default=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )

    claim: Mapped["Claim"] = relationship(back_populates="denials")
