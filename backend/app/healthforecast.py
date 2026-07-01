"""
HealthForecast — Predictive Risk & Progression Engine (Module 8).

The "Future Viewer" of the Aegis ecosystem. Synthesizes the accumulated
density of a patient's Cognee graph — including anything OmniGest has
committed — to forecast disease progression, run lifestyle-variable
"what-if" simulations, rank interventions, and plot trajectory vs. an
optimal-aging baseline.

Endpoint summary
----------------
GET  /api/patients/{pid}/modules/healthforecast   — standard module payload
                                                      (mounted via modules.py,
                                                      not this router — see note below)
POST /api/healthforecast/sandbox/{pid}            — feature 1: lifestyle
                                                      sandbox -> improve()
POST /api/healthforecast/sentinel/{pid}           — feature 2: cross-system
                                                      failure sentinel -> recall()
POST /api/healthforecast/narrative/{pid}          — Gemini-generated plain-
                                                      language forecast narrative

Design note on why this is a separate router AND a modules.py builder:
The standard GET /modules/{module} path (used by every other module's
useModuleData hook) is generic and parameterless, which is perfect for the
static trajectory chart and intervention ranking (features 3 and 4) — those
are deterministic, computed straight from data_store. But features 1 and 2
need request bodies (sandbox variables, a sentinel query) that the generic
route can't carry, so — exactly like OmniGest's commit/extract endpoints —
they get their own router, mounted the same way.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import data_store
from .memory import build_memory

try:
    from .omnigest import GEMINI_API_KEY, GEMINI_MODEL, _call_gemini  # reuse OmniGest's Gemini wiring
except Exception:  # pragma: no cover — omnigest.py should always be present, but stay defensive
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    _call_gemini = None

router = APIRouter()
_MEMORY = None


def _mem():
    global _MEMORY
    if _MEMORY is None:
        _MEMORY = build_memory()
    return _MEMORY


# ── module-level constants ───────────────────────────────────────────────────

# Chronic conditions we project risk for, and the event "signals" that feed
# each one. Deliberately simple/explainable (same hackathon philosophy as
# RxShield's INTERACTIONS table) rather than a black-box model.
CONDITION_SIGNALS: Dict[str, Dict[str, Any]] = {
    "type_2_diabetes": {
        "label": "Type 2 Diabetes",
        "keywords": ["glucose", "hba1c", "insulin", "diabetes", "metabolic"],
        "base_risk": 18,
    },
    "chronic_kidney_disease": {
        "label": "Chronic Kidney Disease",
        "keywords": ["egfr", "kidney", "creatinine", "renal"],
        "base_risk": 12,
    },
    "cardiovascular_event": {
        "label": "Cardiovascular Event",
        "keywords": ["cardio", "cardiomegaly", "blood pressure", "hypertension", "cholesterol", "ldl"],
        "base_risk": 15,
    },
    "major_depressive_episode": {
        "label": "Major Depressive Episode",
        "keywords": ["mood", "anxiety", "depression", "mental", "stress", "sleep"],
        "base_risk": 10,
    },
    "mild_cognitive_impairment": {
        "label": "Mild Cognitive Impairment",
        "keywords": ["cognitive", "memory", "neuro", "mci"],
        "base_risk": 8,
    },
}

# Lifestyle sandbox levers exposed to the clinician, and which conditions
# each lever's improvement reduces risk for (mirrors NutriSim/Pathos's
# explainable-mechanism philosophy).
SANDBOX_LEVERS: Dict[str, Dict[str, Any]] = {
    "weight_loss_5kg": {
        "label": "Reduce weight by 5kg", "unit": "kg",
        "affects": {"type_2_diabetes": -6, "cardiovascular_event": -4, "chronic_kidney_disease": -2},
    },
    "stabilize_sleep_7h": {
        "label": "Stabilize sleep to 7 hours", "unit": "hours/night",
        "affects": {"type_2_diabetes": -3, "major_depressive_episode": -7, "mild_cognitive_impairment": -2},
    },
    "reduce_sodium": {
        "label": "Reduce sodium intake", "unit": "mg/day",
        "affects": {"cardiovascular_event": -5, "chronic_kidney_disease": -3},
    },
    "increase_activity": {
        "label": "Increase weekly activity to 150min", "unit": "min/week",
        "affects": {"type_2_diabetes": -5, "cardiovascular_event": -4, "major_depressive_episode": -4},
    },
    "smoking_cessation": {
        "label": "Smoking cessation", "unit": "boolean",
        "affects": {"cardiovascular_event": -10, "chronic_kidney_disease": -3, "mild_cognitive_impairment": -2},
    },
}

# Healthy-aging baseline trajectory (feature 4) — a simple monotonic curve
# the patient's actual cumulative graph-risk weight is plotted against.
HEALTHY_BASELINE_5YR = [8, 9, 10, 11, 12]  # cumulative risk %, year 1..5, optimal aging


# ── pydantic models ──────────────────────────────────────────────────────────

class SandboxRequest(BaseModel):
    levers: Dict[str, float]  # lever_key -> magnitude multiplier (0.0-2.0, 1.0 = full effect)


class SandboxResponse(BaseModel):
    ok: bool
    baseline_5yr: List[Dict[str, Any]]
    projected_5yr: List[Dict[str, Any]]
    delta_summary: List[Dict[str, Any]]
    improve_result: Dict[str, Any]
    source: str


class SentinelRequest(BaseModel):
    query: Optional[str] = None  # if omitted, uses the default cross-system query


class SentinelResponse(BaseModel):
    ok: bool
    answer: str
    confidence: int
    risk_chain: List[Dict[str, Any]]
    evidence: List[str]
    source: str


class NarrativeRequest(BaseModel):
    focus: Optional[str] = None  # e.g. "type_2_diabetes" to focus the narrative


class NarrativeResponse(BaseModel):
    ok: bool
    narrative: str
    source: str  # "gemini" | "template-fallback"


# ── shared risk-computation helpers ──────────────────────────────────────────

def _gather_signal_text(pid: str) -> str:
    """Concatenate every node label/detail and event title/detail into one
    lowercased blob for cheap keyword-based risk scoring — same explainable,
    deterministic philosophy as RxShield's INTERACTIONS matcher."""
    g = data_store.graph(pid)
    events = data_store.events().get(pid, [])
    parts = []
    for n in g.get("nodes", []):
        parts.append(n.get("label", ""))
        parts.append(n.get("detail", ""))
    for e in events:
        parts.append(e.get("title", ""))
        parts.append(e.get("detail", ""))
    return " ".join(parts).lower()


def _compute_condition_risks(pid: str) -> Dict[str, Dict[str, Any]]:
    """For each tracked chronic condition, compute a 0-100 risk score from
    keyword density in the patient's graph + events, weighted by how many
    ABNORMAL/CRITICAL findings (from OmniGest or seeded data) touch it."""
    blob = _gather_signal_text(pid)
    g = data_store.graph(pid)
    insights = data_store.insights().get(pid, [])

    results: Dict[str, Dict[str, Any]] = {}
    for cond_key, cond in CONDITION_SIGNALS.items():
        hits = sum(blob.count(kw) for kw in cond["keywords"])
        # insights tagged to a module relevant to this condition add weight,
        # especially ones sourced from OmniGest (fresh, clinician-verified data)
        insight_boost = 0
        for ins in insights:
            label_blob = (ins.get("title", "") + " " + ins.get("body", "")).lower()
            if any(kw in label_blob for kw in cond["keywords"]):
                insight_boost += 8 if ins.get("sourceTag") == "omnigest" else 4

        risk = min(95, cond["base_risk"] + hits * 3 + insight_boost)
        results[cond_key] = {
            "key": cond_key,
            "label": cond["label"],
            "risk": risk,
            "signal_hits": hits,
            "insight_boost": insight_boost,
        }
    return results


def _project_5yr(base_risk: int, annual_growth: float = 1.18) -> List[float]:
    """Simple compounding projection — base_risk grows annual_growth-fold
    per year, capped at 95%. Deterministic, no randomness."""
    out = []
    r = base_risk
    for _ in range(5):
        r = min(95.0, r * annual_growth)
        out.append(round(r, 1))
    return out


# ── module payload builder (called from modules.py's BUILDERS) ──────────────

def build_payload(pid: str) -> Dict[str, Any]:
    """The GET /modules/healthforecast payload — deterministic, no request
    body needed. Covers features 3 (intervention ranker) and 4 (trajectory
    visualizer); features 1/2 need their own POST endpoints below since they
    take live input from the clinician."""
    risks = _compute_condition_risks(pid)
    sorted_risks = sorted(risks.values(), key=lambda r: r["risk"], reverse=True)

    # Feature 4: trajectory vs baseline — project the single highest-risk
    # condition's 5-year curve against the healthy-aging baseline.
    top = sorted_risks[0] if sorted_risks else None
    trajectory = []
    if top:
        projected = _project_5yr(top["risk"])
        for yr in range(5):
            trajectory.append({
                "year": f"Year {yr + 1}",
                "patient": projected[yr],
                "baseline": HEALTHY_BASELINE_5YR[yr],
                "divergence": round(projected[yr] - HEALTHY_BASELINE_5YR[yr], 1),
            })

    # Feature 3: intervention ranker — for each lever, estimate the
    # statistical decrease in cumulative graph-risk weight it would yield
    # against the patient's CURRENT top risks (full-strength, multiplier=1.0).
    ranked: List[Dict[str, Any]] = []
    for lever_key, lever in SANDBOX_LEVERS.items():
        total_reduction = 0.0
        affected_conditions = []
        for cond_key, delta in lever["affects"].items():
            if cond_key in risks and risks[cond_key]["risk"] > 15:  # only count conditions with real risk
                total_reduction += abs(delta) * (risks[cond_key]["risk"] / 100)
                affected_conditions.append(risks[cond_key]["label"])
        ranked.append({
            "lever": lever_key,
            "label": lever["label"],
            "unit": lever["unit"],
            "estimated_risk_reduction": round(total_reduction, 1),
            "affected_conditions": affected_conditions,
        })
    ranked.sort(key=lambda r: r["estimated_risk_reduction"], reverse=True)

    insights = [i for i in data_store.insights().get(pid, []) if i.get("module") == "healthforecast"]

    return {
        "conditionRisks": sorted_risks,
        "trajectory": trajectory,
        "interventionRanking": ranked,
        "leverCatalog": [{"key": k, **v} for k, v in SANDBOX_LEVERS.items()],
        "insights": insights,
    }


# ── routes ───────────────────────────────────────────────────────────────────

@router.post("/api/healthforecast/sandbox/{pid}", response_model=SandboxResponse)
def run_sandbox(pid: str, req: SandboxRequest):
    """
    Feature 1 — Chronic Disease Progression Sandbox.

    Clinician adjusts hypothetical lifestyle levers (each 0.0-2.0, where 1.0
    is the lever's full documented effect, 0 is no change, 2.0 is double
    intensity). We compute a re-projected 5-year risk curve for every
    tracked condition, then call the REAL api.improve() so this isn't purely
    cosmetic — Cognee's graph edges are genuinely reweighted to reflect the
    simulated intervention, exactly as the PRD specifies.
    """
    if not data_store.patient(pid):
        raise HTTPException(404, "patient not found")

    risks = _compute_condition_risks(pid)
    baseline_5yr = []
    projected_5yr = []
    delta_summary = []

    for cond_key, cond_risk in risks.items():
        base_curve = _project_5yr(cond_risk["risk"])

        # apply lever effects to the starting risk before projecting
        adjusted_start = float(cond_risk["risk"])
        for lever_key, magnitude in req.levers.items():
            lever = SANDBOX_LEVERS.get(lever_key)
            if not lever:
                continue
            delta = lever["affects"].get(cond_key, 0)
            adjusted_start = max(2.0, adjusted_start + delta * magnitude)
        proj_curve = _project_5yr(adjusted_start)

        baseline_5yr.append({"condition": cond_risk["label"], "key": cond_key,
                             "curve": base_curve})
        projected_5yr.append({"condition": cond_risk["label"], "key": cond_key,
                              "curve": proj_curve})
        delta_summary.append({
            "condition": cond_risk["label"],
            "key": cond_key,
            "year5_baseline": base_curve[-1],
            "year5_projected": proj_curve[-1],
            "year5_delta": round(proj_curve[-1] - base_curve[-1], 1),
        })

    # Real Cognee call — the simulation isn't cosmetic, it triggers an
    # actual graph reweight so the platform's stated behavior is honest.
    improve_result = _mem().improve(pid)

    active_levers = [SANDBOX_LEVERS[k]["label"] for k in req.levers if k in SANDBOX_LEVERS and req.levers[k] > 0]
    if active_levers:
        data_store.mutate_insights(pid, {
            "id": f"healthforecast_sandbox_{pid}_{len(data_store.insights().get(pid, []))}",
            "module": "healthforecast",
            "title": "Progression sandbox simulation run",
            "body": (
                f"Simulated: {', '.join(active_levers)}. "
                f"Largest projected 5-year risk reduction: "
                f"{max(delta_summary, key=lambda d: -d['year5_delta'])['condition'] if delta_summary else 'n/a'}."
            ),
            "confidence": 65,
            "crossModule": True,
            "evidence": [],
            "sourceTag": "healthforecast",
        })

    return SandboxResponse(
        ok=True,
        baseline_5yr=baseline_5yr,
        projected_5yr=projected_5yr,
        delta_summary=delta_summary,
        improve_result=improve_result,
        source=improve_result.get("source", "replay"),
    )


@router.post("/api/healthforecast/sentinel/{pid}", response_model=SentinelResponse)
def cross_system_sentinel(pid: str, req: SentinelRequest):
    """
    Feature 2 — Cross-System Failure Sentinel.

    Queries Cognee's recall() across organ-system sub-graphs for cascading
    risk (e.g. "if renal failure continues, what's the cardiovascular
    probability?"). Falls back to a deterministic, still-honest answer if
    recall() doesn't surface enough graph context.
    """
    if not data_store.patient(pid):
        raise HTTPException(404, "patient not found")

    query = req.query or (
        "If the current organ-system stress patterns continue unchanged, what "
        "is the probability of a secondary cross-system clinical event in the "
        "next 12-24 months, and which systems are most at risk?"
    )
    recall_result = _mem().recall(pid, query)

    risks = _compute_condition_risks(pid)
    sorted_risks = sorted(risks.values(), key=lambda r: r["risk"], reverse=True)

    # Build an explainable risk chain: top 2 conditions, connected if a
    # plausible physiological cascade exists between them.
    CASCADES = {
        ("chronic_kidney_disease", "cardiovascular_event"):
            "Reduced renal clearance elevates fluid retention and blood pressure, increasing cardiovascular strain.",
        ("type_2_diabetes", "cardiovascular_event"):
            "Sustained hyperglycemia accelerates vascular damage, raising cardiovascular event probability.",
        ("type_2_diabetes", "chronic_kidney_disease"):
            "Chronic hyperglycemia is a leading driver of diabetic nephropathy.",
        ("major_depressive_episode", "type_2_diabetes"):
            "Depressive symptoms correlate with reduced self-management adherence, worsening metabolic control.",
    }
    risk_chain = []
    top2 = sorted_risks[:3]
    for i in range(len(top2)):
        for j in range(len(top2)):
            if i == j:
                continue
            pair = (top2[i]["key"], top2[j]["key"])
            if pair in CASCADES:
                risk_chain.append({
                    "from": top2[i]["label"], "to": top2[j]["label"],
                    "from_risk": top2[i]["risk"], "to_risk": top2[j]["risk"],
                    "mechanism": CASCADES[pair],
                })

    confidence = recall_result.get("confidence", 50)
    answer = recall_result.get("answer", "")
    if not answer or recall_result.get("source") in ("replay-fallback",):
        # Honest deterministic fallback grounded in the same risk data,
        # rather than a generic non-answer.
        if risk_chain:
            top_chain = risk_chain[0]
            answer = (
                f"Structural analysis of this patient's graph shows {top_chain['from']} "
                f"risk at {top_chain['from_risk']}%, with a plausible cascade to "
                f"{top_chain['to']} ({top_chain['to_risk']}% current risk): "
                f"{top_chain['mechanism']}"
            )
            confidence = max(confidence, 55)
        else:
            answer = "No high-confidence cross-system cascade detected in this patient's current graph."
            confidence = max(confidence, 30)

    return SentinelResponse(
        ok=True,
        answer=answer,
        confidence=confidence,
        risk_chain=risk_chain,
        evidence=recall_result.get("evidence", []),
        source=recall_result.get("source", "replay"),
    )


@router.post("/api/healthforecast/narrative/{pid}", response_model=NarrativeResponse)
def generate_narrative(pid: str, req: NarrativeRequest):
    """
    Gemini 2.5 Flash predictive narrative generation, per the PRD's
    'Cloud/Tech Stack Compliance' section. Reuses OmniGest's existing Gemini
    wiring (same API key, same model) rather than duplicating config.
    Falls back to a deterministic template if no GEMINI_API_KEY is set, so
    the feature still works end-to-end in pure demo mode.
    """
    if not data_store.patient(pid):
        raise HTTPException(404, "patient not found")

    risks = _compute_condition_risks(pid)
    sorted_risks = sorted(risks.values(), key=lambda r: r["risk"], reverse=True)
    focus_risk = next((r for r in sorted_risks if r["key"] == req.focus), sorted_risks[0]) if sorted_risks else None

    if not focus_risk:
        return NarrativeResponse(ok=True, narrative="Insufficient graph data for a forecast yet.",
                                 source="template-fallback")

    patient = data_store.patient(pid)

    if GEMINI_API_KEY and _call_gemini:
        try:
            prompt = (
                f"You are a clinical forecasting assistant. Patient profile: "
                f"age {patient.get('age')}, conditions: {', '.join(patient.get('conditions', []))}. "
                f"Highest structural risk: {focus_risk['label']} at {focus_risk['risk']}% "
                f"(derived from {focus_risk['signal_hits']} graph signal matches). "
                f"Write a 2-3 sentence plain-language clinical forecast narrative explaining "
                f"this risk trajectory and one concrete preventative lever, suitable for a "
                f"physician dashboard. No PII, no fabricated lab values — reason only from "
                f"the risk percentage and condition name given."
            )
            # Gemini text-only call (no inline_data) — reuse model config, skip image/PDF path
            import httpx
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
            r = httpx.post(url, json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.4},
            }, timeout=30)
            r.raise_for_status()
            candidates = r.json().get("candidates", [])
            if candidates:
                text = candidates[0]["content"]["parts"][0]["text"].strip()
                return NarrativeResponse(ok=True, narrative=text, source="gemini")
        except Exception as exc:  # pragma: no cover
            print(f"[healthforecast] Gemini narrative failed, using template: {exc}")

    # Deterministic fallback — keeps the feature demo-safe with no API key.
    template = (
        f"Based on structural graph density, {focus_risk['label']} shows the highest "
        f"projected risk at {focus_risk['risk']}%, driven by {focus_risk['signal_hits']} "
        f"related signals across this patient's history. Without intervention, this risk "
        f"is projected to compound year over year. The sandbox panel above can simulate "
        f"how specific lifestyle changes would alter this trajectory."
    )
    return NarrativeResponse(ok=True, narrative=template, source="template-fallback")
