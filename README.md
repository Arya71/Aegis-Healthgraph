<div align="center">

# 🧠 Aegis HealthGraph

### The healthcare AI that remembers the _patient_, not the documents.

One [Cognee](https://github.com/topoteretes/cognee) knowledge graph is a patient's lifelong memory —
and eight AI modules reason over it _together_.

**React · FastAPI · Cognee · Gemini 2.5 Flash · MCP** — runs locally with zero config.

</div>

---

## The idea

Healthcare data is fragmented across specialists, so nobody sees the whole story. Aegis builds a
**Digital Cognitive Twin** of the patient: every symptom, medication, lab result, lifestyle signal,
uploaded scan, and cognitive change becomes a connected node in _one_ evolving knowledge graph.
Eight modules share that memory, so an insight from one instantly becomes evidence for another.

> _Other healthcare AI stores records. Aegis remembers the patient._

---

## ✨ Features

- **Shared patient memory** — all eight modules read & write one Cognee graph, insights compound.
- **Cross-module discovery** — surfaces findings no single specialist could see, with a visible reasoning path.
- **Animated knowledge graph** — swimlane × timeline layout, time-travel, cross-specialty link highlighting.
- **Full Cognee lifecycle** — every module exposes `remember()`, `recall()`, `improve()` and `forget()`,
  each with a hover "ℹ️" explaining the Cognee primitive powering it.
- **OmniGest** — upload real medical PDFs or X-ray/MRI/CT images; Gemini 2.5 Flash extracts
  clinical findings and commits them into the shared patient graph via `remember()`.
- **HealthForecast** — reads accumulated graph density to project 5-year disease risk,
  simulate lifestyle interventions via `improve()`, and rank preventative levers.
- **Ask the memory** — text or 🎤 voice recall with confidence + evidence chips.
- **MCP server** — the same Cognee memory is exposed to Claude Desktop (one memory, many agents).
- **12 demo patients** — dark/light themes, glassmorphism, Framer Motion.

---

## 🧩 The eight modules

| Module                | What it does                             | Key Cognee primitive       |
| --------------------- | ---------------------------------------- | -------------------------- |
| 🔬 **Curie**          | Diagnostic cross-reference               | `recall()`                 |
| 🧭 **MedSync**        | Longitudinal care timeline               | `remember()`               |
| 🛡️ **RxShield**       | Medication safety & interactions         | `recall()`                 |
| 🥗 **NutriSim**       | Lifestyle & metabolic intelligence       | `remember()`               |
| 🫀 **Pathos**         | Mental-health memory                     | `remember()` + `recall()`  |
| 🧠 **NeuroGraph**     | Cognitive decline monitoring             | `recall()`                 |
| 📂 **OmniGest**       | Multimodal ingestion (PDF/image → graph) | `remember()` + `improve()` |
| 📈 **HealthForecast** | Predictive risk & progression engine     | `recall()` + `improve()`   |

---

## 🚀 Quick start (zero config, ~2 min)

**Prerequisites:** Node 18+ · Python 3.10–3.12 · Git

```bash
# Clone the project
git clone <repo-url>
cd Aegis-Healthgraph

# Copy the env template
cp .env.example .env

# One-liner — starts both backend and frontend
./run.sh
```

Or manually:

```bash
# Terminal 1 · backend
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2 · frontend
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — the app runs fully in replay mode with 12 pre-built patients,
no API keys required.

---

## 🔑 Enable live features (optional but recommended)

### Gemini API — for OmniGest document extraction

1. Get a free key at https://aistudio.google.com/app/apikey
2. Add to `.env`: `GEMINI_API_KEY=your_key_here`
3. Restart backend — OmniGest will now use real Gemini 2.5 Flash extraction

### Cognee AI — for real graph-vector memory

See **AEGIS_SETUP_GUIDE.md** for the full step-by-step guide. Short version:

```bash
# 1. Clone and start Cognee (separate folder, needs Docker)
git clone https://github.com/topoteretes/cognee.git ../cognee
cd ../cognee
cp .env.template .env
# Add LLM_PROVIDER=gemini + LLM_API_KEY=your_gemini_key to cognee/.env
docker compose up

# 2. Seed patient data into Cognee (back in Aegis project root)
cd ../Aegis-Healthgraph
python scripts/seed_cognee.py

# 3. Switch to cloud mode in your .env
# Change: AEGIS_MEMORY_MODE=replay
# To:     AEGIS_MEMORY_MODE=cloud

# 4. Restart backend — look for:
# [memory] Cognee REST mode active → http://localhost:8000
uvicorn app.main:app --reload --port 8000
```

---

## 🔌 MCP / Claude Desktop

The same Cognee memory is exposed as a [Model Context Protocol](https://modelcontextprotocol.io) server,
letting Claude Desktop query any patient directly.

```bash
cd mcp
uv run --with mcp python aegis_mcp.py    # stdio transport for Claude Desktop
```

Tools: `list_patients` · `recall` · `remember` · `forget` · `visualize_graph`

Add to Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aegis": {
      "command": "uv",
      "args": ["run", "--with", "mcp", "python", "/path/to/mcp/aegis_mcp.py"]
    }
  }
}
```

---

## 📁 Structure

```
.env.example           copy to .env, fill in API keys
run.sh                 one-command startup (loads .env automatically)
AEGIS_SETUP_GUIDE.md   full step-by-step setup for new contributors
data/                  12 pre-built patients, events, insights, graphs
scripts/
  seed_cognee.py       pushes patient data into real Cognee memory
  generate_mock.py     regenerates the data/ folder (already committed)
backend/app/
  main.py              FastAPI routes
  memory.py            Cognee REST client (real) + replay fallback
  omnigest.py          OmniGest extraction + commit (Gemini + Cognee)
  healthforecast.py    HealthForecast prediction engine
  data_store.py        runtime graph overlay (persists new memories in-session)
  modules.py           per-module payload builders
mcp/aegis_mcp.py       MCP server for Claude Desktop
frontend/src/
  pages/modules/       all 8 module pages
  components/          KnowledgeGraph, AIAssistant, InsightCard, etc.
  lib/                 api.ts, types.ts, usePatientData.ts
```

---

## Tech stack

**Frontend:** React 18 · Vite · TypeScript · Tailwind CSS · Framer Motion · React Flow · Recharts

**Backend:** FastAPI · Python 3.10+ · httpx · Pydantic

**AI / Memory:** Cognee (hybrid graph-vector) · Gemini 2.5 Flash (extraction + narrative)

**Protocol:** Model Context Protocol (MCP) for Claude Desktop integration

---

> Built for the **WeMakeDevs × Cognee** hackathon.
