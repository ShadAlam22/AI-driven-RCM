# AI-Driven RCM Platform

An AI-powered Revenue Cycle Management platform for healthcare providers,
implementing the **Three-Brick Architecture**: front-end intake, mid-cycle
clinical documentation/coding, and post-bill denial management with a learning
loop. Claude (via LangChain) provides the AI across all three bricks.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, React Router |
| Backend | FastAPI + Python 3.12 |
| Relational DB | PostgreSQL 16 (SQLAlchemy 2.0 ORM) — patients, claims, denials, alerts |
| Document DB | MongoDB 7 — unstructured clinical notes |
| AI engine | LangChain + Claude (claude-sonnet-4-6) via `langchain-anthropic`, structured output |
| Orchestration | Docker Compose |

## Quick start

```bash
# 1. Copy env file and add your Anthropic key (required for AI features)
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 2. Build and run
docker compose up --build

# 3. Open in browser
#   Frontend:  http://localhost:5173
#   API docs:  http://localhost:8000/docs
```

Both database schemas initialize automatically on first backend startup.
**The app runs without an Anthropic key** — AI endpoints return a clear
"unavailable" message (HTTP 503) instead of crashing, so you can explore the
data flow first and add the key later (`docker compose restart backend`).

## The Three Bricks

### Brick 1 — Front-end / Patient Intake & Eligibility
- Patient registration (personal + insurance)
- Insurance eligibility check (mock payer)
- Prior authorization tracking
- **AI rule engine** flags missing prior auth, inactive coverage, and
  inpatient/outpatient setting mismatches before submission
- Real-time alerts dashboard

### Brick 2 — Mid-cycle / Clinical Documentation & Coding
- Unstructured clinical note capture (stored in MongoDB)
- **AI coding assistant** extracts CPT + ICD-10 codes with confidence ratings
- Detects copy-paste / templated notes (which payers increasingly deny)
- Flags missing supporting documentation (labs, imaging, prior auth)
- Surfaces denial-risk findings back into the Brick 1 alert stream

### Brick 3 — Post-bill / Denial Management & Learning Loop
- Claim lifecycle: draft → submit → accept / deny → resubmit
- **AI denial-reason parser** classifies raw payer denials into structured
  categories + root cause + prevention recommendation
- **Learning loop**: before submitting a claim, the system retrieves similar
  past denials and Claude assesses denial risk — *"a prior CPT 27447 outpatient
  claim was denied for missing prior auth, verify authorization is on file"*
- Denial dashboard aggregates patterns by category (preventable vs. not)

## End-to-end demo walkthrough

1. **New Patient** → register with insurance (member ID ending in an even digit
   = active coverage; odd = inactive → triggers an alert).
2. **Eligibility & AI Review** → pick CPT 27447 (knee replacement) as
   *outpatient*, run the check → AI flags the setting/auth risk.
3. **Clinical Notes & Coding** → add a note (use "Load sample note") →
   **Run AI Coding Analysis** → see extracted CPT/ICD codes, missing-doc flags,
   copy-paste detection.
4. **Claims** → create a claim, **Submit**, then **Simulate Payer Denial**
   (use a sample reason) → AI parses it into a structured denial pattern.
5. Create a *second* similar claim → **Assess Denial Risk** → the learning loop
   retrieves the earlier denial and warns you before you submit.
6. **Denials Dashboard** → see denial patterns aggregated across all patients.

## What's real vs. mocked

| Component | Status | Notes |
|-----------|--------|-------|
| Patient / claim / denial persistence | Real | PostgreSQL |
| Clinical note storage | Real | MongoDB |
| AI (intake review, coding, denial parsing, risk) | Real (needs API key) | Claude + structured output |
| Insurance eligibility check | **Mocked** | `services/mock_payer.py` — deterministic by member ID. Replace with a clearinghouse (Availity, Change Healthcare; X12 270/271). |
| Payer denial responses | **Simulated** | Triggered manually via "Simulate Payer Denial". In production these arrive as X12 835 remittances. |
| Denial retrieval (learning loop) | Real (structured) | `retrieve_similar_denials()` queries by CPT/payer/ICD/setting. Upgrade path: swap for FAISS / pgvector semantic search — the AI prompt already consumes a generic list of retrieved denials. |
| FHIR / HL7 ingestion | Not yet | The transport layer for real EHR connectivity. |

## Project layout

```
backend/app/
├── main.py                  FastAPI app, router registration, table creation
├── database.py              SQLAlchemy engine/session (Postgres)
├── mongo.py                 MongoDB client (clinical notes)
├── models.py                ORM: Patient, Insurance, Eligibility, PriorAuth,
│                            Alert, Claim, Denial
├── schemas.py               Pydantic request/response + AI structured-output models
├── routers/
│   ├── patients.py          Registration + insurance
│   ├── eligibility.py       Mock payer check + Brick 1 AI analysis
│   ├── prior_auth.py        Prior authorization CRUD
│   ├── alerts.py            AI-generated alerts
│   ├── notes.py             Clinical notes (MongoDB)
│   ├── coding.py            Brick 2 AI coding analysis
│   ├── claims.py            Claim lifecycle + learning-loop risk assessment
│   └── denials.py           Denial log + pattern analytics
└── services/
    ├── mock_payer.py        Simulated eligibility responses
    ├── ai_engine.py         Brick 1 intake rule engine (Claude)
    ├── note_analyzer.py     Brick 2 note analysis (Claude)
    └── denial_engine.py     Brick 3 denial parser + risk assessor (Claude)

frontend/src/
├── App.jsx                  Layout, sidebar nav, routes
├── api/client.js            Fetch wrappers (calls /api → Vite proxy → backend)
└── pages/
    ├── PatientIntakeForm.jsx, PatientList.jsx, EligibilityCheck.jsx,
    │   AlertsDashboard.jsx              (Brick 1)
    ├── ClinicalNotes.jsx, CodingAssistant.jsx   (Brick 2)
    └── Claims.jsx, DenialsDashboard.jsx          (Brick 3)
```

## Notes

- **Reset all data:** `docker compose down -v` (wipes Postgres + Mongo volumes),
  then `docker compose up`.
- The frontend talks to the backend through the Vite dev-server proxy
  (`/api` → `backend:8000`), so there are no CORS issues and the browser only
  ever contacts `localhost:5173`.
- This is a development/demonstration build. Production would add: auth &
  RBAC, audit logging, HIPAA-compliant hosting & encryption, Alembic
  migrations, real clearinghouse + FHIR/HL7 integrations, and automated tests.
```
