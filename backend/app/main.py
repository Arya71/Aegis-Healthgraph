"""
Aegis HealthGraph API — main.py (updated to include OmniGest router)
Replace your existing backend/app/main.py with this file.
Only change from original: two lines added — import omnigest, app.include_router(omnigest.router)
"""
from __future__ import annotations
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import data_store, modules
from .memory import build_memory
from . import omnigest  # ← NEW (module 7)
from . import healthforecast  # ← NEW (module 8)

app = FastAPI(title="Aegis HealthGraph API", version="1.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

app.include_router(omnigest.router)        # mounts /api/omnigest/*
app.include_router(healthforecast.router)  # mounts /api/healthforecast/*

MEMORY = build_memory()


class RecallRequest(BaseModel):
    query: str


class RememberRequest(BaseModel):
    text: str
    type: str = "symptom"


class NewPatientRequest(BaseModel):
    name: str
    age: int = 50
    sex: str = "F"
    conditions: List[str] = []
    story: str = ""


@app.get("/api/health")
def health():
    return {"status": "ok", "memoryMode": MEMORY.mode,
            "patients": len(data_store.patients())}


@app.get("/api/patients")
def list_patients():
    return data_store.patients()


@app.post("/api/patients")
def create_patient(req: NewPatientRequest):
    if not req.name.strip():
        raise HTTPException(400, "name is required")
    return data_store.add_patient(req.name.strip(), req.age, req.sex,
                                  [c.strip() for c in req.conditions if c.strip()], req.story.strip())


@app.get("/api/patients/{pid}")
def get_patient(pid: str):
    p = data_store.patient(pid)
    if not p:
        raise HTTPException(404, "patient not found")
    return {
        **p,
        "events": sorted(data_store.events().get(pid, []), key=lambda e: e.get("date") or ""),
        "insights": data_store.insights().get(pid, []),
        "crossInsights": data_store.cross_insights().get(pid, []),
    }


@app.get("/api/patients/{pid}/graph")
def get_graph(pid: str, until: Optional[str] = None):
    g = data_store.graph(pid)
    # Diagnostic log — shows seed+live node counts on every graph request.
    # Remove after confirming graph is correct.
    node_mods = {}
    for n in g["nodes"]:
        node_mods[n.get("module", "?")] = node_mods.get(n.get("module", "?"), 0) + 1
    print(f"[graph] {pid}: {len(g['nodes'])} nodes, {len(g['edges'])} edges | by module: {node_mods}")
    if not until:
        return g
    nodes = [n for n in g["nodes"] if not n.get("date") or n["date"] <= until]
    ids   = {n["id"] for n in nodes}
    edges = [e for e in g["edges"] if e["source"] in ids and e["target"] in ids]
    return {"nodes": nodes, "edges": edges}


@app.get("/api/patients/{pid}/timeline")
def get_timeline(pid: str):
    return sorted(data_store.events().get(pid, []), key=lambda e: e.get("date") or "")


@app.get("/api/patients/{pid}/insights")
def get_insights(pid: str):
    return {"modules": data_store.insights().get(pid, []),
            "cross": data_store.cross_insights().get(pid, [])}


@app.get("/api/patients/{pid}/modules/{module}")
def get_module(pid: str, module: str):
    payload = modules.module_payload(pid, module)
    if not payload:
        raise HTTPException(404, "unknown module")
    return payload


@app.post("/api/patients/{pid}/recall")
def recall(pid: str, req: RecallRequest):
    if not data_store.patient(pid):
        raise HTTPException(404, "patient not found")
    return MEMORY.recall(pid, req.query)


@app.post("/api/patients/{pid}/remember")
def remember(pid: str, req: RememberRequest):
    if not data_store.patient(pid):
        raise HTTPException(404, "patient not found")
    return MEMORY.remember(pid, req.text, req.type)


@app.post("/api/patients/{pid}/improve")
def improve(pid: str):
    if not data_store.patient(pid):
        raise HTTPException(404, "patient not found")
    return MEMORY.improve(pid)


@app.post("/api/patients/{pid}/forget")
def forget(pid: str, memory_only: bool = True):
    if not data_store.patient(pid):
        raise HTTPException(404, "patient not found")
    return MEMORY.forget(pid, memory_only)


@app.get("/api/debug/{pid}")
def debug_patient(pid: str):
    """Diagnostic endpoint — shows exactly what's in the runtime overlay for
    a patient: node/edge counts per module, and whether the seed graph
    loaded successfully. Hit this in the browser to debug graph issues."""
    g = data_store.graph(pid)
    by_module: dict = {}
    for n in g.get("nodes", []):
        by_module.setdefault(n.get("module", "?"), []).append(n.get("label"))
    return {
        "patient_id": pid,
        "total_nodes": len(g.get("nodes", [])),
        "total_edges": len(g.get("edges", [])),
        "nodes_by_module": {k: {"count": len(v), "labels": v} for k, v in by_module.items()},
        "in_runtime_overlay": pid in data_store._RUNTIME,
    }


@app.get("/")
def root():
    return {"name": "Aegis HealthGraph API", "docs": "/docs", "memoryMode": MEMORY.mode}
