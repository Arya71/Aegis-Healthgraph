"""Per-module payload builders: charts, interaction tables, and module insights.

Series are synthesized deterministically (no randomness) so the demo is identical
every run, while still looking like real wearable / lab data.
"""
from __future__ import annotations

import math
from typing import Dict, List

from . import data_store

MODULE_META = {
    "curie": {"name": "Curie", "tagline": "Diagnostic Cross-Reference Engine",
              "accent": "#6ea8ff"},
    "medsync": {"name": "MedSync", "tagline": "Longitudinal Care Timeline",
                "accent": "#7c6cff"},
    "rxshield": {"name": "RxShield", "tagline": "Medication Safety Engine",
                 "accent": "#ff7eb6"},
    "nutrisim": {"name": "NutriSim", "tagline": "Lifestyle Intelligence Engine",
                 "accent": "#37d6b3"},
    "pathos": {"name": "Pathos", "tagline": "Mental-Health Memory Companion",
               "accent": "#ffb86b"},
    "neurograph": {"name": "NeuroGraph", "tagline": "Cognitive Decline Monitor",
                   "accent": "#b388ff"},
}

# RxShield hardcoded interaction knowledge (hackathon-simple, explainable).
INTERACTIONS = [
    {"a": "Clarithromycin", "b": "Atorvastatin", "severity": "high", "risk": 62,
     "mechanism": "Clarithromycin inhibits CYP3A4; atorvastatin is cleared by CYP3A4.",
     "effect": "Statin concentration rises -> myopathy / rhabdomyolysis risk.",
     "modifier": "Reduced kidney function (eGFR 58) slows clearance further."},
    {"a": "Metoprolol", "b": "Verapamil", "severity": "moderate", "risk": 41,
     "mechanism": "Additive AV-node suppression.",
     "effect": "Bradycardia / hypotension risk.", "modifier": ""},
    {"a": "Warfarin", "b": "Ibuprofen", "severity": "high", "risk": 58,
     "mechanism": "NSAID displaces warfarin + irritates GI mucosa.",
     "effect": "Bleeding risk.", "modifier": ""},
]


def _curie(pid: str) -> Dict:
    ev = [e for e in data_store.events().get(pid, [])
          if e["type"] in ("symptom", "diagnosis", "lab")]
    ins = [i for i in data_store.insights().get(pid, []) if i["module"] == "curie"]
    return {"symptomTimeline": sorted(ev, key=lambda e: e["date"]), "insights": ins}


def _medsync(pid: str) -> Dict:
    ev = sorted(data_store.events().get(pid, []), key=lambda e: e["date"])
    edges = [e for e in data_store.graph(pid)["edges"]
             if e["relation"] in ("temporally precedes", "led to consult", "drives",
                                   "progresses to", "contributes to", "structurally precedes")]
    ins = [i for i in data_store.insights().get(pid, []) if i["module"] == "medsync"]
    return {"timeline": ev, "causalEdges": edges, "insights": ins}


def _rxshield(pid: str) -> Dict:
    meds = [e for e in data_store.events().get(pid, []) if e["type"] == "medication"]
    names = {m["title"].split()[0] for m in meds}
    active = [ix for ix in INTERACTIONS if ix["a"] in " ".join(names) or
              any(ix["a"].lower() in m["title"].lower() for m in meds)]
    ins = [i for i in data_store.insights().get(pid, []) if i["module"] == "rxshield"]
    risk = max([ix["risk"] for ix in active], default=0)
    return {"medications": meds, "interactions": active or INTERACTIONS[:1],
            "riskScore": risk if pid == "patient_001" else 18, "insights": ins}


def _nutrisim(pid: str) -> Dict:
    # 30 days of glucose tied to sleep: bad sleep -> morning spike (the loop).
    days, glucose, sleep, rem = [], [], [], []
    for d in range(30):
        # deterministic "poor sleep" pattern, worse on day 5,6 of each week
        weekday = d % 7
        rem_min = 70 - 30 * (1 if weekday in (5, 6) else 0) - int(10 * math.sin(d / 3.0))
        rem_min = max(20, rem_min)
        spike = 95 + (55 if rem_min < 45 else 12) + int(6 * math.sin(d / 2.0))
        days.append(f"Day {d+1}")
        rem.append(rem_min)
        sleep.append(round(4.8 + rem_min / 60.0, 1))
        glucose.append(spike)
    ins = [i for i in data_store.insights().get(pid, []) if i["module"] == "nutrisim"]
    meals = [
        {"meal": "Late dinner (10:40pm)", "carbs": 78, "note": "Followed by a poor-sleep night"},
        {"meal": "Early dinner (6:30pm)", "carbs": 52, "note": "Better REM, lower AM glucose"},
        {"meal": "High-protein breakfast", "carbs": 21, "note": "Flattest glucose curve"},
    ]
    return {"days": days, "glucose": glucose, "sleep": sleep, "rem": rem,
            "meals": meals, "insights": ins}


def _pathos(pid: str) -> Dict:
    mental = [e for e in data_store.events().get(pid, []) if e["type"] == "mental"]
    # 8 weeks of mood with Sunday-evening dips
    weeks, mood, anxiety = [], [], []
    for w in range(8):
        base = 6 + int(1.5 * math.sin(w / 1.5))
        weeks.append(f"Wk {w+1}")
        mood.append(max(2, base))
        anxiety.append(min(9, 4 + (3 if w % 4 == 3 else 1) + int(1.5 * math.cos(w / 2.0))))
    triggers = [
        {"trigger": "Work / performance review", "weight": 0.9},
        {"trigger": "Sunday evening", "weight": 0.8},
        {"trigger": "Poor sleep", "weight": 0.6},
        {"trigger": "Isolation", "weight": 0.4},
    ]
    ins = [i for i in data_store.insights().get(pid, []) if i["module"] == "pathos"]
    return {"weeks": weeks, "mood": mood, "anxiety": anxiety, "triggers": triggers,
            "entries": mental, "insights": ins}


def _neurograph(pid: str) -> Dict:
    ev = [e for e in data_store.events().get(pid, []) if e["type"] == "cognitive"]
    series = [{"month": e["date"][:7], **e.get("metrics", {})}
              for e in ev if "metrics" in e]
    nodes = data_store.graph(pid)["nodes"]
    entities = [{"label": n["label"], "strength": n["weight"]}
                for n in nodes if n["id"].startswith("ent")]
    ins = [i for i in data_store.insights().get(pid, []) if i["module"] == "neurograph"]
    return {"series": series, "entities": entities, "insights": ins}


BUILDERS = {
    "curie": _curie, "medsync": _medsync, "rxshield": _rxshield,
    "nutrisim": _nutrisim, "pathos": _pathos, "neurograph": _neurograph,
}


def module_payload(pid: str, module: str) -> Dict:
    if module not in BUILDERS:
        return {}
    payload = BUILDERS[module](pid)
    payload["meta"] = MODULE_META[module]
    return payload
