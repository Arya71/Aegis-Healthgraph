"""
data_store.py — UPDATED to support runtime memory mutations.

Replace your existing backend/app/data_store.py with this file.

WHAT CHANGED AND WHY
---------------------
Previously, graph(pid) read data/graph/{pid}.json fresh off disk on every
single call for seeded patients (patient_001, etc.) — meaning any node/edge
returned by ReplayMemory.remember() was computed and handed back to the
caller, but never actually persisted anywhere. The frontend would "commit",
get a success response, even re-fetch the graph afterward — and see the
exact same static seed file every time, because nothing ever wrote the new
node back into the store.

This file adds a SEEDED RUNTIME OVERLAY: a dict that starts as a deep copy
of each seeded patient's graph/events/insights the first time they're
touched, and from then on all reads AND writes for that patient go through
the overlay. Newly-added demo patients (add_patient) already worked this way
via _RUNTIME — this generalizes the same pattern to seeded patients too, so
remember()/forget() actually mutate state that persists for the rest of the
server process (resets on restart, which is fine for a demo).

New public functions:
  - mutate_graph(pid, node=None, edges=None)   — append a node + edges
  - mutate_events(pid, event)                  — append a timeline event
  - mutate_insights(pid, insight)              — append a module insight
  - reweight_edges(pid, factor=0.85)           — used by improve() to decay
                                                  edge weights (visible proof
                                                  that improve() did something)
"""
from __future__ import annotations

import copy
import json
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")

# ── runtime overlay ──────────────────────────────────────────────────────────
# Keyed by patient id. Once a patient is "touched" (loaded into the overlay),
# every read for that patient goes through here instead of the static files.
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


def _seed_graph_file(pid: str) -> Dict[str, List[Dict]]:
    path = os.path.join(DATA, "graph", f"{pid}.json")
    if not os.path.exists(path):
        return {"nodes": [], "edges": []}
    with open(path) as f:
        return json.load(f)


def _ensure_runtime(pid: str) -> Dict:
    """Lazily materialise the overlay for a patient from its seed data the
    first time it's touched. After this call, _RUNTIME[pid] always exists
    and is safe to read/mutate directly."""
    if pid in _RUNTIME:
        return _RUNTIME[pid]

    seed_patient = next((p for p in _patients_file() if p["id"] == pid), None)
    if seed_patient is None:
        # Unknown patient — caller will 404 elsewhere; give back an empty shell
        # rather than raising here, to keep this function total.
        seed_patient = {"id": pid}

    seed_graph = _seed_graph_file(pid)
    # Defensive logging: if the seed graph came back empty for a patient we
    # expected to have data, that's almost always a wrong DATA path or a
    # missing/misnamed data/graph/{pid}.json file — surface it loudly instead
    # of silently starting the overlay from zero nodes.
    if not seed_graph.get("nodes"):
        print(
            f"[data_store] WARNING: seed graph for '{pid}' loaded with "
            f"0 nodes. Expected path: {os.path.join(DATA, 'graph', pid + '.json')} "
            f"(exists={os.path.exists(os.path.join(DATA, 'graph', pid + '.json'))}). "
            "If this is a seeded patient, the overlay will start empty and "
            "only newly-remembered nodes will ever appear in the graph."
        )

    _RUNTIME[pid] = {
        "patient": copy.deepcopy(seed_patient),
        "events": copy.deepcopy(_events_file().get(pid, [])),
        "graph": copy.deepcopy(seed_graph),
        "insights": copy.deepcopy(_insights_file().get(pid, [])),
        "cross": copy.deepcopy(_cross_file().get(pid, [])),
        "recall": copy.deepcopy(_recall_file().get(pid, [])),
    }
    return _RUNTIME[pid]


# ── public reads (now overlay-aware for ALL patients, not just new ones) ────

def patients() -> List[Dict]:
    seed_ids = {p["id"] for p in _patients_file()}
    overlay_patients = [r["patient"] for pid, r in _RUNTIME.items() if pid not in seed_ids or True]
    # de-dupe: prefer overlay version (may have updated eventCount, etc.) over seed
    by_id = {p["id"]: p for p in _patients_file()}
    for pid, r in _RUNTIME.items():
        by_id[pid] = r["patient"]
    return list(by_id.values())


def events() -> Dict[str, List[Dict]]:
    out = dict(_events_file())
    for pid, r in _RUNTIME.items():
        out[pid] = r["events"]
    return out


def insights() -> Dict[str, List[Dict]]:
    out = dict(_insights_file())
    for pid, r in _RUNTIME.items():
        out[pid] = r["insights"]
    return out


def recall_cache() -> Dict[str, List[Dict]]:
    out = dict(_recall_file())
    for pid, r in _RUNTIME.items():
        out[pid] = r["recall"]
    return out


def cross_insights() -> Dict[str, List[Dict]]:
    out = dict(_cross_file())
    for pid, r in _RUNTIME.items():
        out[pid] = r["cross"]
    return out


def graph(pid: str) -> Dict[str, List[Dict]]:
    """Return a copy of the patient's graph overlay so callers get current
    state on every call but cannot accidentally corrupt the stored overlay
    by mutating the returned dict. Mutations must go through mutate_graph()."""
    r = _ensure_runtime(pid)
    # Shallow copy of the top-level dict + new list objects for nodes/edges
    # so append() on the returned value doesn't touch the overlay.
    # Individual node/edge dicts are still shared references (fine — callers
    # read them, they don't mutate individual dicts in practice).
    return {
        "nodes": list(r["graph"]["nodes"]),
        "edges": list(r["graph"]["edges"]),
    }


def patient(pid: str) -> Dict:
    """Always ensures the runtime overlay exists for seeded patients so that
    any subsequent mutation (remember, mutate_graph) has a fully-seeded
    overlay to append to, rather than starting from an empty shell."""
    r = _ensure_runtime(pid)
    return r["patient"] if r else {}


# ── public mutations (NEW) ───────────────────────────────────────────────────

def mutate_graph(
    pid: str,
    node: Optional[Dict] = None,
    edges: Optional[List[Dict]] = None,
) -> Dict[str, List[Dict]]:
    """Append a node and/or edges to a patient's graph overlay. Returns the
    updated graph. This is what actually makes remember() persist."""
    r = _ensure_runtime(pid)
    if node:
        # avoid duplicate ids
        if not any(n["id"] == node["id"] for n in r["graph"]["nodes"]):
            r["graph"]["nodes"].append(node)
    if edges:
        existing_ids = {e["id"] for e in r["graph"]["edges"]}
        for e in edges:
            if e["id"] not in existing_ids:
                r["graph"]["edges"].append(e)
    return r["graph"]


def mutate_events(pid: str, event: Dict) -> List[Dict]:
    """Append a timeline event so module pages (Curie's timeline, RxShield's
    med list, etc.) pick up newly-ingested data."""
    r = _ensure_runtime(pid)
    if not any(e["id"] == event["id"] for e in r["events"]):
        r["events"].append(event)
    # keep patient.eventCount in sync so PatientSelect/Dashboard stay honest
    r["patient"]["eventCount"] = len(r["events"])
    return r["events"]


def mutate_insights(pid: str, insight: Dict) -> List[Dict]:
    """Prepend a module insight (e.g. a cross-module finding surfaced by
    OmniGest's recall() after ingestion). Inserted at the FRONT of the list
    — module pages like Curie treat insights[0] as the "top insight" that
    drives the confidence radar and differential-diagnosis match, so a
    freshly-ingested finding needs to be first to actually influence the UI,
    not buried after the seeded insights."""
    r = _ensure_runtime(pid)
    if not any(i["id"] == insight["id"] for i in r["insights"]):
        r["insights"].insert(0, insight)
    return r["insights"]


def mutate_cross_insight(pid: str, cross: Dict) -> List[Dict]:
    r = _ensure_runtime(pid)
    if not any(c["id"] == cross["id"] for c in r["cross"]):
        r["cross"].append(cross)
    return r["cross"]


def reweight_edges(pid: str, factor: float = 0.85) -> Dict[str, List[Dict]]:
    """Used by improve(): decays all existing edge weights by `factor` and
    boosts weights of edges touching the most recently added node, so the
    'graph reorganised itself' claim is visibly true rather than cosmetic."""
    r = _ensure_runtime(pid)
    g = r["graph"]
    if not g["nodes"]:
        return g
    newest_id = g["nodes"][-1]["id"]
    for e in g["edges"]:
        if e["source"] == newest_id or e["target"] == newest_id:
            e["weight"] = round(min(1.0, e["weight"] * 1.15), 2)
        else:
            e["weight"] = round(e["weight"] * factor, 2)
    return g


def add_patient(name: str, age: int, sex: str, conditions: List[str], story: str) -> Dict:
    """Create a navigable patient in the in-memory store (demo flow)."""
    n = len(_patients_file()) + len([p for p in _RUNTIME if p not in {pp["id"] for pp in _patients_file()}]) + 1
    pid = f"patient_{n:03d}"
    cstr = ", ".join(conditions) if conditions else "general wellness"
    events_list = [
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
                  date=e["date"], detail=e["detail"], weight=0.9) for e in events_list]
    edges = [
        dict(id=f"{pid}_e1->{pid}_e2", source=f"{pid}_e1", target=f"{pid}_e2",
             relation="ordered", weight=0.6, rationale="Visit prompted routine labs."),
        dict(id=f"{pid}_e2->{pid}_e3", source=f"{pid}_e2", target=f"{pid}_e3",
             relation="informed", weight=0.6, rationale="Labs informed the maintenance plan."),
    ]
    insights_list = [dict(id=f"{pid}_i1", module="curie", confidence=54, crossModule=False,
                          title="No urgent cross-references yet",
                          body=f"History is consistent with {cstr}. Memory is seeded — insights will compound as more events are added.",
                          evidence=[f"{pid}_e2"])]
    recall_list = [dict(q="Any hidden patterns?",
                        a=f"Nothing high-confidence yet. Known: {cstr}. Add more events and the graph will start connecting them.",
                        confidence=54, evidence=[f"{pid}_e2"])]
    summary = dict(id=pid, name=name, age=age, sex=sex,
                   conditions=conditions or ["General wellness"],
                   story=story or f"New patient — baseline record for {cstr}.",
                   hero=False, eventCount=len(events_list), hue=abs(hash(pid)) % 360)
    _RUNTIME[pid] = {"patient": summary, "events": events_list,
                     "graph": {"nodes": nodes, "edges": edges},
                     "insights": insights_list, "cross": [], "recall": recall_list}
    return summary
