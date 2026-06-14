"""AI rule-engine for Brick 1 (intake/eligibility).

Uses an LLM (Claude, via langchain-anthropic) with structured output so the
response is a typed Pydantic object rather than free text — mirroring the
"AI Rules Engine -> Real-time Alerting UI" flow in the architecture doc.

Requires ANTHROPIC_API_KEY. If it isn't set, analyze_intake() raises
AIEngineUnavailable so callers can degrade gracefully instead of crashing.
"""
import os

from app.models import CareSetting, EligibilityStatus, InsuranceInfo, Patient
from app.schemas import AIAnalysis

_SYSTEM_PROMPT = """\
You are an AI rules engine embedded in a healthcare Revenue Cycle Management \
(RCM) system, working in the "front-end intake" stage — before a claim is \
ever submitted. Your job is to review a patient's registration, insurance \
eligibility, and the planned procedure, then flag anything likely to cause a \
denial or delay.

Pay particular attention to:
- Missing or not-yet-requested prior authorization for procedures that \
typically require it
- Mismatches between the authorized care setting (inpatient vs outpatient) \
and the planned setting — a common, costly source of denials
- Inactive or soon-to-expire insurance coverage
- Anything else that looks like it would lead to a denial or underpayment

Only raise flags that are actually supported by the data given to you. If \
everything looks fine, return an empty flags list. Be concise and specific \
in messages and recommendations — write for a billing/registration staff \
member who needs to act on this immediately.
"""

_USER_TEMPLATE = """\
Patient: {first_name} {last_name}, DOB {dob}

Insurance:
  Payer: {payer_name}
  Plan type: {plan_type}
  Member ID: {member_id}

Eligibility check result:
  Status: {eligibility_status}
  Details: {eligibility_note}

Planned procedure:
  CPT code: {cpt_code}
  Description: {description}
  Care setting: {setting}
  Diagnosis: {diagnosis}

Prior authorization on file: {prior_auth_status}

Review this intake and return your structured analysis.
"""


class AIEngineUnavailable(RuntimeError):
    pass


def _build_chain():
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise AIEngineUnavailable(
            "ANTHROPIC_API_KEY is not configured — AI analysis is unavailable. "
            "Set it in your .env file to enable AI-driven intake review."
        )

    # Imported lazily so the module can be imported (e.g. for type checking)
    # even when langchain-anthropic isn't installed in some environments.
    from langchain_anthropic import ChatAnthropic
    from langchain_core.prompts import ChatPromptTemplate

    llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0, api_key=api_key)
    structured_llm = llm.with_structured_output(AIAnalysis)

    prompt = ChatPromptTemplate.from_messages(
        [("system", _SYSTEM_PROMPT), ("user", _USER_TEMPLATE)]
    )
    return prompt | structured_llm


def analyze_intake(
    patient: Patient,
    insurance: InsuranceInfo,
    eligibility_status: EligibilityStatus,
    eligibility_response: dict,
    cpt_code: str,
    description: str | None,
    setting: CareSetting,
    diagnosis: str | None,
    prior_auth_status: str,
) -> AIAnalysis:
    chain = _build_chain()

    return chain.invoke(
        {
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "dob": patient.date_of_birth.isoformat(),
            "payer_name": insurance.payer_name,
            "plan_type": insurance.plan_type.value,
            "member_id": insurance.member_id,
            "eligibility_status": eligibility_status.value,
            "eligibility_note": eligibility_response.get("note", "n/a"),
            "cpt_code": cpt_code,
            "description": description or "n/a",
            "setting": setting.value,
            "diagnosis": diagnosis or "not provided",
            "prior_auth_status": prior_auth_status,
        }
    )
