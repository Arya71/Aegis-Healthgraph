#!/usr/bin/env bash
# One command to run the whole Aegis HealthGraph stack locally.
# Usage:  ./run.sh
# Reads API keys from .env in the project root automatically.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env so GEMINI_API_KEY, COGNEE_API_KEY, AEGIS_MEMORY_MODE etc.
# are available to the backend process
if [ -f "$ROOT/.env" ]; then
    echo "→ Loading .env"
    set -a
    source "$ROOT/.env"
    set +a
else
    echo "⚠  No .env found — using defaults (replay mode, no Gemini)"
    echo "   Copy .env.example to .env and fill in your API keys to enable live features."
fi

echo "→ Backend: setting up venv + deps"
cd "$ROOT/backend"
[ -d .venv ] || python3 -m venv .venv

# Activate venv (works on Windows Git Bash + Mac/Linux)
if [ -f .venv/Scripts/activate ]; then
    source .venv/Scripts/activate   # Windows
else
    source .venv/bin/activate       # Mac/Linux
fi

pip install -q -r requirements.txt

echo "→ Starting FastAPI on :8000  (mode: ${AEGIS_MEMORY_MODE:-replay})"
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
echo "  Memory mode: ${AEGIS_MEMORY_MODE:-replay}"
if [ "${AEGIS_MEMORY_MODE}" = "cloud" ]; then
    echo "  Cognee:   ${COGNEE_API_URL:-http://localhost:8000}"
fi
echo ""

trap "kill $BACK_PID 2>/dev/null" EXIT
npm run dev
