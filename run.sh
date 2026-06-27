#!/usr/bin/env bash
# One command to run the whole Aegis HealthGraph stack locally (replay mode).
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Backend: setting up venv + deps"
cd "$ROOT/backend"
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt

echo "→ Regenerating mock data"
python "$ROOT/scripts/generate_mock.py"

echo "→ Starting FastAPI on :8000"
uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level warning &
BACK_PID=$!

echo "→ Frontend: installing deps (first run only)"
cd "$ROOT/frontend"
[ -d node_modules ] || npm install

echo ""
echo "  Aegis HealthGraph is starting..."
echo "  API:      http://localhost:8000/docs"
echo "  Frontend: http://localhost:5173"
echo ""
trap "kill $BACK_PID 2>/dev/null" EXIT
npm run dev
