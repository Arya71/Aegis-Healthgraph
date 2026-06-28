"""Loads the generated mock data and serves it to the API and memory layers.

File-backed demo data is read once and cached. Patients added at runtime (via the
"Add patient" demo flow) live in an in-memory store and are merged on top, so they
are navigable for the session without mutating the committed JSON.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any, Dict, List

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")

_RUNTIME: Dict[str, Dict] = {}


def _load(name: str) -> Any:
    with open(os.path.join(DATA, name)) as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _patients_file() -> List[Dict]:
    return _load("patients.json")


@lru_cache(maxsize=1)
def _events_file() -> Dict[str, List[Dict]]:
    return _load("events.json")


@lru_cache(maxsize=1)
def _insights_file() -> Dict[str, List[Dict]]:
    return _load("insights.json")


@lru_cache(maxsize=1)
def _recall_file() -> Dict[str, List[Dict]]:
    return _load("recall_cache.json")


@lru_cache(maxsize=1)
def _cross_file() -> Dict[str, List[Dict]]:
    return _load("cross_insights.json")


def patients() -> List[Dict]:
    return _patients_file() + [r["patient"] for r in _RUNTIME.values()]


def events() -> Dict[str, List[Dict]]:
    return {**_events_file(), **{pid: r["events"] for pid, r in _RUNTIME.items()}}


def insights() -> Dict[str, List[Dict]]:
    return {**_insights_file(), **{pid: r["insights"] for pid, r in _RUNTIME.items()}}


def recall_cache() -> Dict[str, List[Dict]]:
    return {**_recall_file(), **{pid: r["recall"] for pid, r in _RUNTIME.items()}}


def cross_insights() -> Dict[str, List[Dict]]:
    return {**_cross_file(), **{pid: r["cross"] for pid, r in _RUNTIME.items()}}


def graph(pid: str) -> Dict[str, List[Dict]]:
    if pid in _RUNTIME:
        return _RUNTIME[pid]["graph"]
    path = os.path.join(DATA, "graph", f"{pid}.json")
    if not os.path.exists(path):
        return {"nodes": [], "edges": []}
    with open(path) as f:
        return json.load(f)


def patient(pid: str) -> Dict:
    for p in patients():
        if p["id"] == pid:
            return p
    return {}


def add_patient(name: str, age: int, sex: str, conditions: List[str], story: str) -> Dict:
    """Create a navigable patient in the in-memory store (demo flow)."""
    n = len(_patients_file()) + len(_RUNTIME) + 1
    pid = f"patient_{n:03d}"
    cstr = ", ".join(conditions) if conditions else "general wellness"
    events = [
        dict(id=f"{pid}_e1", date="2024-03-12", type="visit", title="Primary care visit",
             detail=f"Baseline review of {cstr}.", module="medsync"),
        dict(id=f"{pid}_e2", date="2024-08-04", type="lab", title="Routine labs",
             detail="Mostly within range; one borderline marker flagged for follow-up.", module="curie"),
        dict(id=f"{pid}_e3", date="2025-01-20", type="medication", title="Maintenance medication",
             detail="Ongoing therapy started.", module="rxshield"),
        dict(id=f"{pid}_e4", date="2025-07-09", type="lifestyle", title="Lifestyle log",
             detail="Sleep and activity tracked via wearable.", module="nutrisim"),
    ]
    nodes = [dict(id=e["id"], label=e["title"], type=e["type"], module=e["module"],
                  date=e["date"], detail=e["detail"], weight=0.9) for e in events]
    edges = [
        dict(id=f"{pid}_e1->{pid}_e2", source=f"{pid}_e1", target=f"{pid}_e2",
             relation="ordered", weight=0.6, rationale="Visit prompted routine labs."),
        dict(id=f"{pid}_e2->{pid}_e3", source=f"{pid}_e2", target=f"{pid}_e3",
             relation="informed", weight=0.6, rationale="Labs informed the maintenance plan."),
    ]
    insights = [dict(id=f"{pid}_i1", module="curie", confidence=54, crossModule=False,
                     title="No urgent cross-references yet",
                     body=f"History is consistent with {cstr}. Memory is seeded — insights will compound as more events are added.",
                     evidence=[f"{pid}_e2"])]
    recall = [dict(q="Any hidden patterns?",
                   a=f"Nothing high-confidence yet. Known: {cstr}. Add more events and the graph will start connecting them.",
                   confidence=54, evidence=[f"{pid}_e2"])]
    summary = dict(id=pid, name=name, age=age, sex=sex,
                   conditions=conditions or ["General wellness"],
                   story=story or f"New patient — baseline record for {cstr}.",
                   hero=False, eventCount=len(events), hue=abs(hash(pid)) % 360)
    _RUNTIME[pid] = {"patient": summary, "events": events, "graph": {"nodes": nodes, "edges": edges},
                     "insights": insights, "cross": [], "recall": recall}
    return summary
