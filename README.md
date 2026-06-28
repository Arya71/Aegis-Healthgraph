<div align="center">

# 🧠 Aegis HealthGraph

### The healthcare AI that remembers the *patient*, not the documents.

One [Cognee](https://github.com/topoteretes/cognee) knowledge graph is a patient's lifelong memory —
and six AI modules reason over it *together*.

**React · FastAPI · Cognee · MCP** — runs locally with zero config.

</div>

---

## The idea

Healthcare data is fragmented across specialists, so nobody sees the whole story. Aegis builds a
**Digital Cognitive Twin** of the patient: every symptom, medication, lab, lifestyle signal, emotion
and cognitive change becomes a connected node in *one* evolving knowledge graph. Six modules —
**Curie** (diagnosis), **MedSync** (timeline), **RxShield** (drug safety), **NutriSim** (lifestyle),
**Pathos** (mental health), **NeuroGraph** (cognitive decline) — share that memory, so an insight from
one instantly becomes evidence for another.

> *Other healthcare AI stores records. Aegis remembers the patient.*

---

## ✨ Features

- **Shared patient memory** — six modules read & write one Cognee graph, so insights compound.
- **Cross-module "aha"** — surfaces findings no single specialist could see, with a visible reasoning path.
- **Animated knowledge graph** — swimlane × timeline layout, time-travel, cross-specialty link highlighting.
- **Full Cognee lifecycle** — every module exposes `remember()`, `recall()`, `improve()` and `forget()`,
  each with a hover "ℹ️" explaining the primitive powering it.
- **Ask the memory** — text or 🎤 voice recall with confidence + evidence chips.
- **Add a patient** — seed a new Digital Cognitive Twin from the registry and explore it live.
- **MCP server** — the same memory is exposed to Claude Desktop (one memory, many agents).
- **Polish** — dark/light themes, glassmorphism, Framer Motion, 12 demo patients.

---

## 🚀 Install & run (zero config, ~2 min)

**Prerequisites:** Node 18+ and Python 3.9+.

```bash
# Terminal 1 · backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python ../scripts/generate_mock.py      # generate demo data (committed; optional)
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2 · frontend
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** (use `localhost`, not `127.0.0.1`). API docs: **http://localhost:8000/docs**.

> One-liner: `./run.sh` from the repo root does all of the above.

---

## ☁️ Live Cognee mode (optional)

The backend speaks Cognee's REST API, so it runs against **Cognee Cloud** or a **self-hosted** server.

```bash
cp .env.example .env          # fill COGNEE_API_URL + COGNEE_API_KEY, set AEGIS_MEMORY_MODE=cloud
python scripts/seed_cognee.py # ingest patients (remember + memify)
cd backend && AEGIS_MEMORY_MODE=cloud uvicorn app.main:app --reload --port 8000
```

Every call **auto-falls back to replay** if Cognee is unreachable, so the demo never breaks.

---

## 🔌 MCP / Claude Desktop

The same memory is exposed as a [Model Context Protocol](https://modelcontextprotocol.io) server.

```bash
cd mcp && uv run --with mcp python aegis_mcp.py    # stdio (Claude Desktop)
```

Tools: `list_patients` · `recall` · `remember` · `forget` · `visualize_graph`.

---

## 📁 Structure

```
data/                  generated demo data (committed → runs zero-config)
scripts/               generate_mock.py · seed_cognee.py
backend/app/           main.py (API) · memory.py (Cognee lifecycle) · modules.py · data_store.py
mcp/aegis_mcp.py       MCP server
frontend/src/          components/ · components/cognee/ · components/landing/ · pages/ · pages/modules/
```

**Tech:** React 18 · Vite · TypeScript · Tailwind · Framer Motion · React Flow · Recharts ·
FastAPI · httpx · Cognee · MCP.

---

> Built for the **WeMakeDevs × Cognee** hackathon. Uses mock data and prioritizes UX over medical
> accuracy. **Not for clinical use.**
