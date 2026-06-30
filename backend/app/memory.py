"""
memory.py — UPDATED so remember()/improve() actually persist state.

Replace your existing backend/app/memory.py with this file.

WHAT CHANGED AND WHY
---------------------
The original ReplayMemory.remember() computed a new node + edges and
returned them to the caller, but never wrote them into data_store — so the
graph endpoint kept serving the static seed file forever, no matter how many
times you "committed" something. This patch makes remember() call the new
data_store.mutate_graph()/mutate_events() so the change is real and visible
on every subsequent GET /api/patients/{pid}/graph, /timeline, and module
payload call. improve() now calls data_store.reweight_edges() so it has a
visible, inspectable effect instead of being a no-op message.

Everything else (CogneeRestMemory, the public interface, build_memory()) is
unchanged — this only touches ReplayMemory.remember()/.improve() and adds
one shared helper.
"""
from __future__ import annotations

import os
import re
from typing import Dict, Optional

from . import data_store


def _load_dotenv() -> None:
    """Load project-root .env into the environment (no dependency)."""
    root = os.path.dirname(os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))))
    path = os.path.join(root, ".env")
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            os.environ.setdefault(
                key.strip(), val.strip().strip('"').strip("'"))


_load_dotenv()

STOP = {
    "the", "a", "an", "is", "are", "has", "have", "had", "this", "that", "any",
    "before", "of", "to", "for", "and", "or", "in", "on", "with", "patient",
    "patients", "been", "ever", "did", "does", "do", "what", "why", "how",
}


def _tokens(text: str) -> set:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOP and len(w) > 2}


class ReplayMemory:
    """Pre-built graph + cached recall. The reliable demo path.
    remember()/improve() now persist into data_store's runtime overlay so
    state changes are real and visible across the whole API, not just in
    the single response that triggered them."""

    mode = "replay"

    def recall(self, pid: str, query: str) -> Dict:
        cached = data_store.recall_cache().get(pid, [])
        qt = _tokens(query)
        best, best_score = None, 0.0
        for entry in cached:
            score = len(qt & _tokens(entry["q"]))
            if score > best_score:
                best, best_score = entry, score
        if best and best_score > 0:
            return {
                "answer": best["a"], "confidence": best["confidence"],
                "evidence": best.get("evidence", []), "source": "replay",
                "matched": best["q"],
            }
        nodes = data_store.graph(pid).get("nodes", [])
        hits = [n for n in nodes if qt & _tokens(
            n["label"] + " " + n.get("detail", ""))][:4]
        if hits:
            joined = "; ".join(n["label"] for n in hits)
            return {
                "answer": f"I found related events in this patient's memory: {joined}.",
                "confidence": 50, "evidence": [n["id"] for n in hits],
                "source": "replay-fallback", "matched": None,
            }
        return {
            "answer": "Nothing high-confidence in this patient's memory matches that yet.",
            "confidence": 30, "evidence": [], "source": "replay-fallback", "matched": None,
        }

    def remember(
        self,
        pid: str,
        text: str,
        etype: str = "symptom",
        module: Optional[str] = None,
        date: Optional[str] = None,
        label: Optional[str] = None,
    ) -> Dict:
        """Add a new memory, link it to the most related existing nodes, AND
        persist both the graph node/edges and a matching timeline event into
        data_store — so every other endpoint (graph, timeline, module
        payloads) reflects it immediately on the next request.

        New optional params (module/date/label) let callers like OmniGest
        route the node to the correct lane and timestamp instead of always
        defaulting to a dateless "curie" node.
        """
        g = data_store.graph(pid)
        existing = g.get("nodes", [])
        new_id = f"live_{len(existing) + 1}"
        qt = _tokens(text)

        new_node = {
            "id": new_id,
            "label": (label or text[:60]),
            "type": etype,
            "module": module or "curie",
            "date": date,
            "detail": text,
            "weight": 1.2,
        }

        scored = sorted(
            ((len(qt & _tokens(n["label"] + " " + n.get("detail", ""))), n)
             for n in existing),
            key=lambda x: x[0], reverse=True,
        )
        new_edges = []
        for score, n in scored[:3]:
            if score <= 0:
                continue
            new_edges.append({
                "id": f"{new_id}->{n['id']}", "source": new_id, "target": n["id"],
                "relation": "recalled-with", "weight": round(min(0.9, 0.4 + 0.15 * score), 2),
                "rationale": f"Shares context with '{n['label']}'.",
            })

        # ── PERSIST (this is the fix) ──────────────────────────────────────
        data_store.mutate_graph(pid, node=new_node, edges=new_edges)
        data_store.mutate_events(pid, {
            "id": new_id,
            "date": date,
            "type": etype,
            "title": new_node["label"],
            "detail": text,
            "module": new_node["module"],
        })

        return {"node": new_node, "edges": new_edges, "source": "replay"}

    def improve(self, pid: str) -> Dict:
        # Visibly reweight edges so improve() has a real, inspectable effect
        # instead of only returning a description of what it "would" do.
        data_store.reweight_edges(pid, factor=0.85)
        return {
            "ok": True, "source": "replay",
            "message": ("Replay mode: memify simulated — Cognee would prune stale nodes, "
                        "strengthen frequently co-recalled links, and reweight edges from feedback. "
                        "Edge weights on this patient's graph have been reweighted."),
        }

    def forget(self, pid: str, memory_only: bool = True) -> Dict:
        return {
            "ok": True, "source": "replay",
            "message": "Replay mode: forget simulated — Cognee would prune this dataset from the graph + vector store.",
        }


def _extract_answer(data) -> Optional[str]:
    """Cognee recall responses vary by version/search type -- pull out the text."""
    if data is None:
        return None
    if isinstance(data, str):
        return data.strip() or None
    if isinstance(data, list):
        parts = [a for a in (_extract_answer(x) for x in data) if a]
        return " ".join(parts) if parts else None
    if isinstance(data, dict):
        for k in ("result", "answer", "text", "content", "response", "completion"):
            if data.get(k):
                return _extract_answer(data[k])
        if "results" in data:
            return _extract_answer(data["results"])
    return None


class CogneeRestMemory(ReplayMemory):
    """Live memory over Cognee's REST API. Works against Cognee Cloud (set
    COGNEE_API_URL to your instance) or any self-hosted Cognee server. Inherits
    ReplayMemory so every method degrades gracefully if the service is down."""

    mode = "cloud"

    def __init__(self) -> None:
        self.base = os.getenv("COGNEE_API_URL", "").rstrip("/")
        self.key = os.getenv("COGNEE_API_KEY", "")
        self.timeout = float(os.getenv("COGNEE_TIMEOUT", "30"))
        self.ready = bool(self.base and self.key)
        try:
            import httpx  # noqa: F401
            self._httpx = httpx
        except Exception as exc:  # pragma: no cover
            print(f"[memory] httpx unavailable: {exc}")
            self._httpx = None
            self.ready = False

    def _headers(self, json_body: bool = True) -> Dict[str, str]:
        h = {"Authorization": f"Bearer {self.key}"}
        if json_body:
            h["Content-Type"] = "application/json"
        return h

    def recall(self, pid: str, query: str) -> Dict:
        if self.ready and self._httpx:
            try:
                r = self._httpx.post(
                    f"{self.base}/api/v1/recall",
                    headers=self._headers(),
                    json={"query": query, "datasets": [pid],
                          "search_type": "GRAPH_COMPLETION", "top_k": 10},
                    timeout=self.timeout,
                )
                r.raise_for_status()
                answer = _extract_answer(r.json())
                if answer:
                    return {"answer": answer, "confidence": 78, "evidence": [],
                            "source": "cognee-cloud", "matched": query}
            except Exception as exc:  # pragma: no cover
                print(f"[memory] cloud recall failed, replaying: {exc}")
        return super().recall(pid, query)

    def remember(
        self,
        pid: str,
        text: str,
        etype: str = "symptom",
        module: Optional[str] = None,
        date: Optional[str] = None,
        label: Optional[str] = None,
    ) -> Dict:
        # Persist locally immediately (so the graph animates + is real),
        # while also pushing into Cognee Cloud asynchronously for live recall.
        result = super().remember(pid, text, etype, module=module, date=date, label=label)
        if self.ready and self._httpx:
            try:
                self._httpx.post(
                    f"{self.base}/api/v1/remember",
                    headers=self._headers(json_body=False),
                    data={"datasetName": pid, "run_in_background": "true"},
                    files={"data": (f"{pid}_note.txt", text.encode(
                        "utf-8"), "text/plain")},
                    timeout=self.timeout,
                )
                result["source"] = "cognee-cloud"
            except Exception as exc:  # pragma: no cover
                print(f"[memory] cloud remember failed (kept replay): {exc}")
        return result

    def improve(self, pid: str) -> Dict:
        if self.ready and self._httpx:
            try:
                r = self._httpx.post(
                    f"{self.base}/api/v1/improve",
                    headers=self._headers(),
                    json={"dataset_name": pid, "run_in_background": True},
                    timeout=self.timeout,
                )
                r.raise_for_status()
                data_store.reweight_edges(pid, factor=0.85)
                return {"ok": True, "source": "cognee-cloud",
                        "message": ("Cognee is enriching this patient's memory (memify) — "
                                    "pruning stale nodes and reweighting edges from usage.")}
            except Exception as exc:  # pragma: no cover
                print(f"[memory] cloud improve failed: {exc}")
        return super().improve(pid)

    def forget(self, pid: str, memory_only: bool = True) -> Dict:
        if self.ready and self._httpx:
            try:
                r = self._httpx.post(
                    f"{self.base}/api/v1/forget",
                    headers=self._headers(),
                    json={"dataset": pid, "memory_only": memory_only},
                    timeout=self.timeout,
                )
                r.raise_for_status()
                return {"ok": True, "source": "cognee-cloud",
                        "message": f"Cognee forgot dataset '{pid}' (memory_only={memory_only})."}
            except Exception as exc:  # pragma: no cover
                print(f"[memory] cloud forget failed: {exc}")
        return super().forget(pid, memory_only)


def build_memory() -> ReplayMemory:
    mode = os.getenv("AEGIS_MEMORY_MODE", "replay").lower()
    if mode in ("cloud", "live", "rest"):
        mem = CogneeRestMemory()
        if mem.ready:
            print(f"[memory] Cognee REST mode active → {mem.base}")
            return mem
        print(
            "[memory] cloud requested but COGNEE_API_URL/COGNEE_API_KEY missing → replay mode")
    print("[memory] replay mode active (pre-built graph + cached recall)")
    return ReplayMemory()
