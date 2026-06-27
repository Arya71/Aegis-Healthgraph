"""
Aegis HealthGraph MCP server.

Exposes the SAME shared patient knowledge graph the dashboard uses as a Model
Context Protocol server -- mirroring the topoteretes/cognee-mcp interface
(remember / recall / forget). Point Claude Desktop (or any MCP client) at this and
ask about a patient: the answer comes from the exact graph the UI is showing.

That is the whole pitch made literal -- one persistent memory, many agents.

Run:
    uv run --with mcp python aegis_mcp.py          # stdio (Claude Desktop)
    uv run --with mcp python aegis_mcp.py --http   # streamable HTTP

The server reuses the backend's data_store + memory layer (stdlib only), so it
stays perfectly in sync with the REST API and the React app.
"""
from __future__ import annotations

import os
import sys

# Reuse the backend's data + memory layer (pure-stdlib modules).
BACKEND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.insert(0, BACKEND)

from app import data_store  # noqa: E402
from app.memory import ReplayMemory  # noqa: E402

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:  # pragma: no cover
    sys.stderr.write(
        "The 'mcp' package is required. Run:\n"
        "  uv run --with mcp python aegis_mcp.py\n"
        "or: pip install 'mcp[cli]'\n"
    )
    raise

mcp = FastMCP("aegis-healthgraph")
MEMORY = ReplayMemory()

# Session cache: session_id -> list[str]  (fast, ephemeral working memory)
_SESSIONS: dict = {}


def _label(pid: str, node_ids):
    nodes = {n["id"]: n["label"] for n in data_store.graph(pid)["nodes"]}
    return [nodes.get(i, i) for i in node_ids]


@mcp.tool()
def list_patients() -> str:
    """List every patient in the Aegis memory graph (id, name, headline)."""
    lines = [f"- {p['id']}: {p['name']} ({p['age']}{p['sex']}) -- {p['story']}"
             for p in data_store.patients()]
    return "Patients in shared memory:\n" + "\n".join(lines)


@mcp.tool()
def recall(query: str, patient_id: str = "patient_001", session_id: str = "") -> str:
    """Search a patient's lifelong memory. Combines the persistent knowledge graph
    with any session working-memory. Returns an answer, confidence, and the graph
    evidence it traversed."""
    session_hits = ""
    if session_id and session_id in _SESSIONS:
        notes = [n for n in _SESSIONS[session_id] if query.split()[0].lower() in n.lower()]
        if notes:
            session_hits = "\n[session memory] " + "; ".join(notes)
    r = MEMORY.recall(patient_id, query)
    evidence = _label(patient_id, r.get("evidence", []))
    out = (f"{r['answer']}\n\n"
           f"Confidence: {r['confidence']}%\n"
           f"Graph evidence: {', '.join(evidence) if evidence else '(none)'}")
    return out + session_hits


@mcp.tool()
def remember(text: str, patient_id: str = "patient_001", session_id: str = "") -> str:
    """Write a new fact into a patient's memory. With session_id it goes to fast
    session working-memory; without it, it is linked into the permanent graph."""
    if session_id:
        _SESSIONS.setdefault(session_id, []).append(text)
        return f"Stored in session '{session_id}' working memory: {text!r}"
    res = MEMORY.remember(patient_id, text)
    linked = _label(patient_id, [e["target"] for e in res["edges"]])
    return (f"Remembered for {patient_id}: {text!r}\n"
            f"Linked into the graph next to: {', '.join(linked) if linked else '(no links yet)'}")


@mcp.tool()
def forget(patient_id: str = "", session_id: str = "", everything: bool = False) -> str:
    """Forget memory. With session_id, clears that session's working-memory. With
    everything=True, would clear all owned memory (no-op on the demo seed graph)."""
    if session_id and session_id in _SESSIONS:
        _SESSIONS.pop(session_id)
        return f"Cleared session '{session_id}' working memory."
    if everything:
        return "Permanent seed memory is read-only in the demo; nothing destructive done."
    return "Nothing to forget. Pass session_id or everything=True."


@mcp.tool()
def visualize_graph(patient_id: str = "patient_001") -> str:
    """Return a text summary of a patient's knowledge graph (nodes + key edges)."""
    g = data_store.graph(patient_id)
    top_edges = sorted(g["edges"], key=lambda e: e["weight"], reverse=True)[:8]
    lines = [f"{e['source']} --[{e['relation']}]--> {e['target']}  (w={e['weight']})"
             for e in top_edges]
    return (f"Graph for {patient_id}: {len(g['nodes'])} nodes, {len(g['edges'])} edges.\n"
            "Strongest relationships:\n" + "\n".join(lines))


if __name__ == "__main__":
    transport = "streamable-http" if "--http" in sys.argv else "stdio"
    mcp.run(transport=transport)
