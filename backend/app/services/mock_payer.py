"""Stand-in for a real payer/clearinghouse eligibility API (e.g. Availity,
Change Healthcare). Those require signed agreements and credentials we don't
have, so this returns deterministic, rule-based responses derived from the
member ID — enough to drive the rest of the pipeline realistically.

Convention used here (purely for demo determinism):
  - member IDs ending in an even digit  -> active coverage
  - member IDs ending in an odd digit   -> inactive coverage
  - member IDs ending in '0'            -> active but coverage expiring soon
"""
import datetime

from app.models import EligibilityStatus, InsuranceInfo


def check_eligibility(insurance: InsuranceInfo) -> tuple[EligibilityStatus, dict]:
    last_char = insurance.member_id.strip()[-1:] or "0"
    is_even = last_char.isdigit() and int(last_char) % 2 == 0

    today = datetime.date.today()

    if last_char == "0":
        status = EligibilityStatus.ACTIVE
        coverage_end = today + datetime.timedelta(days=14)
        note = "Coverage active but expires within 14 days — confirm renewal before service."
    elif is_even:
        status = EligibilityStatus.ACTIVE
        coverage_end = today + datetime.timedelta(days=180)
        note = "Coverage active and in good standing."
    else:
        status = EligibilityStatus.INACTIVE
        coverage_end = today - datetime.timedelta(days=30)
        note = "Coverage lapsed — patient may be self-pay or have a new plan on file."

    response = {
        "payer_name": insurance.payer_name,
        "member_id": insurance.member_id,
        "plan_type": insurance.plan_type.value,
        "status": status.value,
        "coverage_start": (today - datetime.timedelta(days=365)).isoformat(),
        "coverage_end": coverage_end.isoformat(),
        "copay_usd": 25 if insurance.plan_type.value in ("HMO", "EPO") else 40,
        "note": note,
        "_source": "mock_payer (simulated — replace with real clearinghouse integration)",
    }
    return status, response
