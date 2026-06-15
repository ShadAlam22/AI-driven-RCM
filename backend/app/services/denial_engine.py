"""Brick 3 AI service: post-bill denial management & learning loop.

Two responsibilities, mirroring the architecture diagram's
"Denial Reason Parser (AI)" and "Insights Sent to Brick 1 & 2":

1. parse_denial()        -> classify a raw payer denial into a structured
                            category + root cause + prevention recommendation
                            (the "Denial Reason Parser").
2. assess_denial_risk()  -> given a draft claim and RETRIEVED historical
                            denials, predict denial risk and produce warnings
                            BEFORE submission (the learning loop closing back
                            to the front-end / coding team).

The retrieval step (which past denials to feed in) lives in the claims router
as retrieve_similar_denials(). Today that is a structured query over Postgres;
it can be swapped for FAISS / pgvector semantic search without touching this
module — the AI prompt just receives a list of relevant past denials.
"""
from app.llm import AIEngineUnavailable, get_structured_llm, invoke_structured
from app.schemas import ClaimRiskAssessment, DenialParseResult

__all__ = ["AIEngineUnavailable", "parse_denial", "assess_denial_risk"]


def _require_llm(structured_schema):
    return get_structured_llm(structured_schema)


# --- 1. Denial reason parser ---

_PARSE_SYSTEM = """\
You are an AI denial-management analyst in a healthcare Revenue Cycle \
Management system. A payer has denied a claim. Read the raw denial / \
remittance text and the claim context, then classify it.

Determine:
- category: the single best-fitting denial category
- root_cause: a concise plain-English explanation of WHY it was denied
- preventable: true if better front-end/coding work could have avoided this \
denial, false if it is a legitimate non-preventable denial
- recommendation: the specific action that would prevent this denial in future \
similar claims (this insight is fed back to the intake and coding teams)
- summary: one sentence for the denial dashboard

Be precise and base everything on the provided text.
"""

_PARSE_USER = """\
Claim context:
  CPT code: {cpt_code}
  ICD code: {icd_code}
  Care setting: {setting}
  Payer: {payer_name}
  Charge: ${charge_amount}

Raw denial text from payer:
\"\"\"
{raw_reason}
\"\"\"

Classify this denial.
"""


def parse_denial(
    *,
    cpt_code: str,
    icd_code: str | None,
    setting: str,
    payer_name: str,
    charge_amount: float,
    raw_reason: str,
) -> DenialParseResult:
    from langchain_core.prompts import ChatPromptTemplate

    structured = _require_llm(DenialParseResult)
    prompt = ChatPromptTemplate.from_messages(
        [("system", _PARSE_SYSTEM), ("user", _PARSE_USER)]
    )
    chain = prompt | structured
    return invoke_structured(
        chain,
        {
            "cpt_code": cpt_code,
            "icd_code": icd_code or "n/a",
            "setting": setting,
            "payer_name": payer_name,
            "charge_amount": charge_amount,
            "raw_reason": raw_reason,
        },
    )


# --- 2. Learning-loop risk assessor ---

_RISK_SYSTEM = """\
You are an AI denial-prevention assistant in a healthcare RCM system. Before a \
claim is submitted, you review it ALONGSIDE a history of past denials for \
similar claims, and warn the team about likely denial risks so they can fix \
issues first.

Use the historical denials as evidence. If a past denial pattern plausibly \
applies to this claim, raise a warning that references it concretely (e.g. \
"A prior CPT 27447 outpatient claim was denied for missing prior auth — \
verify authorization is on file"). Set risk_level to the highest severity \
among your warnings. If the history shows no relevant risk and the claim looks \
clean, return risk_level low with an empty or minimal warnings list and say so.

Only raise warnings grounded in the claim context or the historical denials \
provided. Do not invent denials that are not in the history.
"""

_RISK_USER = """\
Draft claim to assess:
  CPT code: {cpt_code}
  ICD code: {icd_code}
  Care setting: {setting}
  Payer: {payer_name}
  Charge: ${charge_amount}

Historical denials for similar claims ({denial_count} retrieved):
{denial_history}

Assess the denial risk of submitting this claim.
"""


def _format_denials(denials: list[dict]) -> str:
    if not denials:
        return "(no similar past denials on record)"
    lines = []
    for d in denials:
        lines.append(
            f"- [{d['category']}] CPT {d['cpt_code']} / {d['setting']} / "
            f"payer {d['payer_name']}: {d['root_cause']} "
            f"(prevention: {d['recommendation']})"
        )
    return "\n".join(lines)


def assess_denial_risk(
    *,
    cpt_code: str,
    icd_code: str | None,
    setting: str,
    payer_name: str,
    charge_amount: float,
    historical_denials: list[dict],
) -> ClaimRiskAssessment:
    from langchain_core.prompts import ChatPromptTemplate

    structured = _require_llm(ClaimRiskAssessment)
    prompt = ChatPromptTemplate.from_messages(
        [("system", _RISK_SYSTEM), ("user", _RISK_USER)]
    )
    chain = prompt | structured
    return invoke_structured(
        chain,
        {
            "cpt_code": cpt_code,
            "icd_code": icd_code or "n/a",
            "setting": setting,
            "payer_name": payer_name,
            "charge_amount": charge_amount,
            "denial_count": len(historical_denials),
            "denial_history": _format_denials(historical_denials),
        },
    )
