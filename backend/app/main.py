from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import (
    alerts,
    claims,
    coding,
    denials,
    eligibility,
    notes,
    patients,
    prior_auth,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="RCM Platform — Brick 1: Patient Intake & Eligibility",
    description=(
        "AI-Driven Revenue Cycle Management — front-end intake layer.\n\n"
        "Covers patient registration, insurance eligibility checks (mock payer), "
        "prior authorization tracking, and AI-generated denial-risk alerts powered "
        "by Claude."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(eligibility.router)
app.include_router(prior_auth.router)
app.include_router(alerts.router)
app.include_router(notes.router)
app.include_router(coding.router)
app.include_router(claims.router)
app.include_router(denials.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
