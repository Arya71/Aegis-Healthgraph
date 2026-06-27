"""Loads the generated mock data and serves it to the API and memory layers."""
from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any, Dict, List

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")


def _load(name: str) -> Any:
    with open(os.path.join(DATA, name)) as f:
        return json.load(f)


@lru_cache(maxsize=1)
def patients() -> List[Dict]:
    return _load("patients.json")


@lru_cache(maxsize=1)
def events() -> Dict[str, List[Dict]]:
    return _load("events.json")


@lru_cache(maxsize=1)
def insights() -> Dict[str, List[Dict]]:
    return _load("insights.json")


@lru_cache(maxsize=1)
def recall_cache() -> Dict[str, List[Dict]]:
    return _load("recall_cache.json")


@lru_cache(maxsize=1)
def cross_insights() -> Dict[str, List[Dict]]:
    return _load("cross_insights.json")


def graph(pid: str) -> Dict[str, List[Dict]]:
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
