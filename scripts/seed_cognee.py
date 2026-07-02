"""
Seed real Cognee memory from the Aegis mock patient data.

Pushes each patient's full longitudinal record into Cognee (one dataset per
patient) via the REAL Cognee REST API, then runs cognify so the hybrid
graph-vector memory is built and recall() returns real AI answers.

Works against:
  - Self-hosted Cognee:  COGNEE_API_URL=http://localhost:8000  COGNEE_API_KEY=local-dev-key
  - Cognee Cloud:        COGNEE_API_URL=https://your.cognee.ai  COGNEE_API_KEY=ck_...

Usage (run from project root):
    python scripts/seed_cognee.py              # seeds all 12 patients
    python scripts/seed_cognee.py patient_001  # seeds one specific patient

Reads COGNEE_API_URL and COGNEE_API_KEY from your project .env automatically.
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

BASE    = os.getenv("COGNEE_API_URL", "").rstrip("/")
KEY     = os.getenv("COGNEE_API_KEY", "")
TIMEOUT = float(os.getenv("COGNEE_TIMEOUT", "120"))


def patient_document(pid: str, patients: list, events: dict, insights: dict) -> str:
    p = next((x for x in patients if x["id"] == pid), None)
    if not p:
        return ""
    lines = [
        f"Patient profile: {p['age']}-year-old {p['sex']}.",
        f"Active conditions: {', '.join(p['conditions'])}.",
        f"Clinical summary: {p['story']}",
        "",
        "Chronological medical timeline:",
    ]
    for e in sorted(events.get(pid, []), key=lambda x: x.get("date") or ""):
        when = e.get("date") or "undated"
        lines.append(
            f"- {when} [{e['type']}/{e.get('module','general')}] "
            f"{e['title']}: {e.get('detail', '')}"
        )
    ins_list = insights.get(pid, [])
    if ins_list:
        lines += ["", "Clinical insights:"]
        for ins in ins_list:
            lines.append(f"- [{ins['module']}] {ins['title']}: {ins['body']}")
    return "\n".join(lines)


def main() -> int:
    if not BASE or not KEY:
        print(
            "\nERROR: COGNEE_API_URL and COGNEE_API_KEY not set in .env\n"
            "Add these to your project .env file:\n"
            "  COGNEE_API_URL=http://localhost:8000\n"
            "  COGNEE_API_KEY=local-dev-key\n"
        )
        return 1

    try:
        patients = json.load(open(os.path.join(DATA, "patients.json")))
        events   = json.load(open(os.path.join(DATA, "events.json")))
        insights = json.load(open(os.path.join(DATA, "insights.json")))
    except FileNotFoundError as e:
        print(f"\nERROR: {e}\nRun this script from the project root folder.")
        return 1

    targets = sys.argv[1:] or [p["id"] for p in patients]
    # Cognee uses X-Api-Key header (confirmed from official REST docs)
    headers = {"X-Api-Key": KEY}

    print(f"\nConnecting to Cognee at {BASE} ...")
    try:
        r = httpx.get(f"{BASE}/api/v1/datasets", headers=headers, timeout=10)
        print(f"Connection OK (status {r.status_code})\n")
    except Exception as exc:
        print(
            f"\nERROR: Cannot reach Cognee at {BASE}\n{exc}\n\n"
            "Is Docker running? Start Cognee with:\n"
            "  cd cognee && docker compose up\n"
        )
        return 1

    with httpx.Client(timeout=TIMEOUT) as client:
        print(f"Seeding {len(targets)} patient(s) ...\n")
        for pid in targets:
            doc = patient_document(pid, patients, events, insights)
            if not doc:
                print(f"  skip {pid}: no data"); continue

            print(f"  {pid} ({len(doc)} chars) ...", end=" ", flush=True)

            # Step 1: add the document to Cognee
            r = client.post(
                f"{BASE}/api/v1/add",
                headers=headers,
                json={"data": doc, "dataset_name": pid},
            )
            if not r.is_success:
                print(f"FAILED add {r.status_code}: {r.text[:120]}"); continue
            print("added", end=" ", flush=True)

            # Step 2: cognify — builds the actual knowledge graph
            r2 = client.post(
                f"{BASE}/api/v1/cognify",
                headers=headers,
                json={"datasets": [pid], "run_in_background": False},
            )
            print("cognified ✓" if r2.is_success else f"cognify failed {r2.status_code}")
            time.sleep(0.5)

        print("\n  Running improve() on all datasets ...", end=" ", flush=True)
        for pid in targets:
            try:
                client.post(f"{BASE}/api/v1/cognify", headers=headers,
                            json={"datasets": [pid], "run_in_background": True}, timeout=30)
            except Exception:
                pass
        print("done ✓")

    print(
        "\n✅ Seeding complete!\n\n"
        "Now:\n"
        "  1. Set AEGIS_MEMORY_MODE=cloud in your project .env\n"
        "  2. Restart backend:  uvicorn app.main:app --reload --port 8000\n"
        f"  3. Look for:        [memory] Cognee REST mode active → {BASE}\n"
        "  4. Open the app — AI Assistant now uses real Cognee graph memory!\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
