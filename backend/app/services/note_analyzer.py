"""Brick 2 AI service: analyze an unstructured clinical note.

Extracts CPT/ICD codes, detects copy-paste/templated content (which insurance
AI flags for denial), identifies missing supporting documentation, and surfaces
denial-risk flags — the "AI/LLM Analysis of Notes → Suggested Additions or
Fixes → Coding Assistant" flow from the architecture diagram.
"""
import os

from app.services.ai_engine import AIEngineUnavailable
from app.schemas import NoteAnalysis

_SYSTEM_PROMPT = """\
You are an AI coding assistant embedded in a healthcare Revenue Cycle \
Management (RCM) system. Your job is to analyze a physician's clinical note \
and produce a structured audit that helps the RCM coding team.

For each note you must:
1. Extract all CPT procedure codes supported by the note content, with a \
confidence rating (high/medium/low) based on how explicitly the procedure is \
documented.
2. Extract all ICD-10 diagnosis codes supported by the note, with confidence.
3. Identify missing supporting documentation that would be required to justify \
the codes (e.g., lab results, imaging, prior authorization, relevant history).
4. Detect if the note appears to be copy-pasted or templated from a prior \
visit (look for generic/unchanged boilerplate language, dates that seem stale, \
identical phrasing to standard templates). Insurance payers now use AI to flag \
these, and claims with templated notes are increasingly denied.
5. Flag any denial risks you see (missing prior auth, medical necessity gaps, \
setting mismatches, insufficient documentation of complexity).
6. Write a short 2-3 sentence summary for the coding team.

Be specific and grounded in the note text — do not invent codes or issues that \
are not supported by what is written. If the note is genuinely clean and \
complete, say so.
"""

_USER_TEMPLATE = """\
Patient ID: {patient_id}
Note type: {note_type}
Author role: {author_role}

--- CLINICAL NOTE ---
{content}
--- END NOTE ---

Analyze this note and return your structured findings.
"""


def analyze_note(
    patient_id: int,
    note_type: str,
    author_role: str,
    content: str,
) -> NoteAnalysis:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise AIEngineUnavailable(
            "ANTHROPIC_API_KEY is not configured — AI note analysis is unavailable."
        )

    from langchain_anthropic import ChatAnthropic
    from langchain_core.prompts import ChatPromptTemplate

    llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0, api_key=api_key)
    structured_llm = llm.with_structured_output(NoteAnalysis)

    prompt = ChatPromptTemplate.from_messages(
        [("system", _SYSTEM_PROMPT), ("user", _USER_TEMPLATE)]
    )
    chain = prompt | structured_llm

    return chain.invoke(
        {
            "patient_id": patient_id,
            "note_type": note_type,
            "author_role": author_role,
            "content": content,
        }
    )
