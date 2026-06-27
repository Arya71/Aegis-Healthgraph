<div align="center">

# 🧠 Aegis HealthGraph

### The healthcare AI that remembers the *patient*, not the documents.

A cognitive healthcare platform where **one Cognee knowledge graph is a patient's lifelong memory**, and
six AI modules reason over it *together*.

**React · FastAPI · Cognee Cloud · MCP** — runs locally with zero config (replay), or live on Cognee Cloud.

</div>

---

## The idea

Healthcare data is fragmented across specialists, so nobody sees the whole story. Aegis fixes that by
building a **Digital Cognitive Twin** of the patient: every symptom, medication, lab, lifestyle signal,
emotion, and cognitive change becomes a connected node in *one* evolving knowledge graph, powered by
[Cognee](https://github.com/topoteretes/cognee).

Six modules — **Curie** (diagnosis), **MedSync** (timeline), **RxShield** (drug safety), **NutriSim**
(lifestyle), **Pathos** (mental health), **NeuroGraph** (cognitive decline) — don't sit side by side;
they **share that memory**. A drug added by RxShield instantly becomes evidence for Curie's reasoning.

> **The one-liner:** *Other healthcare AI stores records. Aegis remembers the patient.*

---

## ✨ Features

**The platform**
- **Shared patient memory** — six modules read & write one Cognee graph, so insights compound.
- **Cross-module "aha"** — surfaces findings *no single specialist could see* (e.g. glucose spikes →
  beta-blocker dose change → Sunday-night anxiety → autoimmune trajectory, all connected).
- **Explainable** — every AI insight has a "show reasoning" that highlights the exact graph path.

**The knowledge graph**
- Animated **swimlane × timeline** layout (one lane per specialty, time left→right).
- **Cross-specialty links highlighted** + a live count — the whole thesis, visualized.
- **Time-travel** slider, **filter by specialty**, click-to-inspect node connections.
- **Watch memory grow** — add a fact and a new node animates into the graph in real time.

**The AI**
- **Ask the patient's memory** by text or **🎤 voice**, with confidence + evidence chips.
- The same memory is exposed as an **MCP server** for Claude Desktop (one memory, many agents).

**The polish**
- Dark/light **theme toggle**, glassmorphism, Framer Motion micro-interactions, 12 demo patients.

---

## 🧠 How it uses Cognee (full memory lifecycle)

Aegis exercises all four of Cognee's memory operations against the **hybrid graph-vector** store:

| Cognee op | Where it lives in the product |
|-----------|-------------------------------|
| `remember()` | `scripts/seed_cognee.py` (ingests every patient) + the Graph Explorer **Remember** box |
| `recall()` | The **"Ask the patient's memory"** assistant (text or 🎤 voice) — graph + vector search |
| `improve()` / memify | The **"✨ Improve memory"** button in the Graph Explorer |
| `forget()` | `POST /api/patients/{id}/forget` and the MCP `forget` tool |

The backend speaks Cognee's REST API (`/api/v1/{remember,recall,improve,forget}`), so the **same code
runs against Cognee Cloud or a self-hosted Cognee server**. If the service is ever unreachable it
**auto-falls back to replay**, so a live demo can't break.

---

## 🏗 Architecture

```
        Mock patient data (EHR · labs · meds · journals · wearables)
                                  │  seed_cognee.py  (remember + memify)
                                  ▼
                    ┌──────────────────────────────┐
                    │        Cognee  (memory)        │   remember · recall
                    │  hybrid graph + vector store   │   improve  · forget
                    │  Cognee Cloud  /  self-hosted  │
                    └───────────────┬────────────────┘
                                    │  shared patient knowledge graph
        ┌───────────────────────────┼───────────────────────────┐
        │             FastAPI REST API  (:8000)                  │──▶ MCP server (stdio)
        │   /patients · /graph · /recall · /improve · /forget    │    → Claude Desktop
        └───────────────────────────┬───────────────────────────┘
                                    │
                     React + Vite dashboard  (:5173)
       Curie · MedSync · RxShield · NutriSim · Pathos · NeuroGraph
```

> **Replay mode (default):** the graph + recall answers are pre-built in `data/`, so the app runs with
> zero keys and is fully deterministic. Set `AEGIS_MEMORY_MODE=cloud` to switch to live Cognee.

---

## 🚀 Quickstart (zero config, ~2 min)

**Prerequisites:** Node 18+ and Python 3.9+.

Run the two services in two terminals:

```bash
# ── Terminal 1 · backend ──────────────────────────────────────────
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python ../scripts/generate_mock.py          # generate the demo data
uvicorn app.main:app --reload --port 8000
```

```bash
# ── Terminal 2 · frontend ─────────────────────────────────────────
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** (use `localhost`, not `127.0.0.1` — Vite binds IPv6).
API docs are at **http://localhost:8000/docs**.

> One-liner alternative: `./run.sh` from the project root does all of the above.

---

## ☁️ Live Cognee mode (Cloud or self-hosted)

The backend speaks Cognee's REST API, so it runs against **either** Cognee Cloud **or** a self-hosted
open-source Cognee server — pick whichever you have access to.

### Option A — Cognee Cloud

To run against real Cognee Cloud memory and the full lifecycle:

```bash
# 1. Sign in at https://platform.cognee.ai  (free Developer plan — code COGNEE-35)
#    Create an API key and copy your instance URL.

# 2. Configure
cp .env.example .env
#    set in .env:
#      AEGIS_MEMORY_MODE=cloud
#      COGNEE_API_URL=https://<your-instance>.cognee.ai
#      COGNEE_API_KEY=ck_...

# 3. Seed Cognee with the patients (remember + memify)
source backend/.venv/bin/activate
python scripts/seed_cognee.py

# 4. Run the backend in cloud mode
cd backend && AEGIS_MEMORY_MODE=cloud uvicorn app.main:app --reload --port 8000
```

### Option B — Self-hosted open-source Cognee (no Cloud account needed)

Use this if Cognee Cloud is at capacity. Cognee needs Python 3.10–3.12 and an LLM key (a free
[Google AI Studio](https://aistudio.google.com/apikey) / Gemini key works, or local Ollama):

```bash
pip install uv
uv venv --python 3.11 .venv-cognee && source .venv-cognee/bin/activate
uv pip install cognee
export LLM_API_KEY=...            # free Gemini key, or configure Ollama
# Start Cognee's REST API server on a free port (8001 — our app uses 8000):
#   see https://docs.cognee.ai/guides/deploy-rest-api-server
```

Then in `.env`: `AEGIS_MEMORY_MODE=cloud` and `COGNEE_API_URL=http://localhost:8001` (+ the server's
token as `COGNEE_API_KEY`), run `python scripts/seed_cognee.py`, and start the backend as above.

> Whichever you choose, every call **auto-falls back to replay** if the Cognee service is unreachable,
> so the demo never breaks.

---

## 🔌 MCP / Claude Desktop

The same patient memory is exposed as a [Model Context Protocol](https://modelcontextprotocol.io)
server (mirroring [`cognee-mcp`](https://github.com/topoteretes/cognee)) — so Claude Desktop can query
the **exact graph the dashboard shows**.

**Tools:** `list_patients` · `recall` · `remember` · `forget` · `visualize_graph`

```bash
# stdio (for Claude Desktop) — uv fetches its own Python, no global install
cd mcp
uv run --with mcp python aegis_mcp.py
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aegis-healthgraph": {
      "command": "uv",
      "args": ["run", "--with", "mcp", "python",
               "<absolute-path>/aegis-healthgraph/mcp/aegis_mcp.py"]
    }
  }
}
```

Restart Claude Desktop, then ask: *"Using aegis-healthgraph, what's going on with patient_001's kidney
inflammation?"* — Claude recalls the same 87% early-onset-lupus finding the UI shows.

---

## 🎬 3-minute demo script

| Time | Action | Say |
|------|--------|-----|
| 0:00 | Dashboard (Elena Voss) | "A patient's lifelong AI health memory — 20 events, 4 years, six specialists." |
| 0:30 | **Cross-module discoveries** card → **Show reasoning** | "No single doctor saw this. The shared graph did." |
| 1:00 | **Graph Explorer** → drag **Time Travel** | "Watch the memory accumulate year by year." |
| 1:25 | **Remember** box → enter a symptom | "`remember()` links it into the graph live." (node animates in) |
| 1:45 | **✨ Improve memory** | "`improve()`/memify enriches the graph — memory that gets smarter." |
| 2:05 | **Curie** → ask / 🎤 say "*similar symptoms before?*" | "`recall()` over the hybrid graph+vector store." (87% + evidence) |
| 2:35 | **Claude Desktop** → same question via MCP | "Same answer, same evidence — one memory, many agents." |
| 2:55 | Close | "Every module enriches the same Digital Cognitive Twin, on Cognee Cloud." |

---

## 📁 Project structure

```
aegis-healthgraph/
├── data/                     # generated demo data (committed → runs zero-config)
├── scripts/
│   ├── generate_mock.py      # single source of truth for the patient story
│   └── seed_cognee.py        # ingest patients into Cognee (remember + memify)
├── backend/app/
│   ├── main.py               # FastAPI endpoints
│   ├── memory.py             # ReplayMemory + CogneeRestMemory (the lifecycle)
│   ├── modules.py            # per-module payloads (charts, interactions)
│   └── data_store.py
├── mcp/aegis_mcp.py          # MCP server: remember / recall / improve / forget
└── frontend/src/
    ├── components/           # KnowledgeGraph, InsightCard, AIAssistant, …
    └── pages/                # Dashboard, GraphExplorer, modules/*
```

---

## 🛠 Tech stack

**Frontend** React 18 · Vite · TypeScript · Tailwind · Framer Motion · React Flow · Recharts
**Backend** FastAPI · httpx · SQLite
**Memory** Cognee (Cloud or self-hosted) — hybrid graph + vector
**Protocol** Model Context Protocol (MCP)

No Docker, no auth, no infra — lightweight by design.

---

> Built for the **WeMakeDevs × Cognee** hackathon. A hackathon project: it prioritizes UX, believable
> AI behavior, and a compelling demo over medical accuracy, and uses mock data. **Not for clinical use.**
