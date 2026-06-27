"""
Seed real Cognee memory from the mock patient data.

Pushes each patient's longitudinal record into Cognee (one dataset per patient)
via the REST API, then runs improve()/memify so recall has a real hybrid
graph-vector memory to search. Works against Cognee Cloud or a self-hosted
Cognee server.

Usage:
    export COGNEE_API_URL="https://<your-instance>.cognee.ai"   # or http://localhost:8000
    export COGNEE_API_KEY="ck_..."                              # from platform.cognee.ai
    python scripts/seed_cognee.py                               # all patients
    python scripts/seed_cognee.py patient_001 patient_002       # specific ones

Needs httpx (already in backend/requirements.txt):
    pip install httpx
"""
from __future__ import annotations

import json
import os
import sys
import time

import httpx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")


def _load_dotenv() -> None:
    """Load project-root .env into the environment (no dependency)."""
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


_load_dotenv()

BASE = os.getenv("COGNEE_API_URL", "").rstrip("/")
KEY = os.getenv("COGNEE_API_KEY", "")
TIMEOUT = float(os.getenv("COGNEE_TIMEOUT", "120"))


def patient_document(pid: str, patients: list, events: dict) -> str:
    """Build one rich text document describing the whole patient timeline."""
    p = next((x for x in patients if x["id"] == pid), None)
    if not p:
        return ""
    lines = [
        f"Patient: {p['name']} ({p['age']}{p['sex']}). Conditions: {', '.join(p['conditions'])}.",
        f"Summary: {p['story']}",
        "",
        "Longitudinal medical memory (chronological):",
    ]
    for e in sorted(events.get(pid, []), key=lambda x: x.get("date") or ""):
        when = e.get("date") or "undated"
        lines.append(f"- {when} [{e['type']}/{e['module']}] {e['title']}: {e.get('detail','')}")
    return "\n".join(lines)


def main() -> int:
    if not BASE or not KEY:
        print("ERROR: set COGNEE_API_URL and COGNEE_API_KEY first (see script header).")
        return 1

    patients = json.load(open(os.path.join(DATA, "patients.json")))
    events = json.load(open(os.path.join(DATA, "events.json")))
    targets = sys.argv[1:] or [p["id"] for p in patients]
    headers = {"Authorization": f"Bearer {KEY}"}

    with httpx.Client(timeout=TIMEOUT) as client:
        for pid in targets:
            doc = patient_document(pid, patients, events)
            if not doc:
                print(f"  skip {pid}: no data")
                continue
            print(f"→ remember {pid} ({len(doc)} chars)…", end=" ", flush=True)
            r = client.post(
                f"{BASE}/api/v1/remember",
                headers=headers,
                data={"datasetName": pid, "run_in_background": "false"},
                files={"data": (f"{pid}.txt", doc.encode("utf-8"), "text/plain")},
            )
            print("ok" if r.is_success else f"FAILED {r.status_code} {r.text[:160]}")
            time.sleep(0.3)

        print("→ improve()/memify across seeded datasets…", end=" ", flush=True)
        for pid in targets:
            try:
                client.post(f"{BASE}/api/v1/improve", headers=headers,
                            json={"dataset_name": pid, "run_in_background": True})
            except Exception as exc:
                print(f"(improve {pid} skipped: {exc})", end=" ")
        print("done")

    print("\nSeeded. Now run the backend with AEGIS_MEMORY_MODE=cloud to recall against real Cognee.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
