/**
 * GraphExplorer.tsx — updated with defensive graph merging.
 * Replace frontend/src/pages/GraphExplorer.tsx with this file.
 * Only change: `graph` is now a safe union of `live` and `loaded` (never
 * silently drops nodes), matching the same fix applied to OmniGest.tsx.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import KnowledgeGraph from "../components/KnowledgeGraph";
import { GlassCard, Pill, SectionTitle, Spinner } from "../components/ui";
import { api, MODULE_COLOR, MODULES } from "../lib/api";
import { usePatients } from "../lib/PatientContext";
import { usePatientData } from "../lib/usePatientData";
import type { GraphNode, ModuleKey } from "../lib/types";

export default function GraphExplorer() {
  const { selectedId } = usePatients();
  const { graph: loaded, loading, refetchGraph } = usePatientData(selectedId);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState<string[]>([]);
  const [hidden, setHidden] = useState<Set<ModuleKey>>(new Set());
  const [improving, setImproving] = useState(false);
  const [lifecycleMsg, setLifecycleMsg] = useState<string | null>(null);

  // refetchGraph() updates `loaded` in place inside usePatientData, so
  // `graph` always reflects the latest server state after any mutation.
  const graph = loaded;

  function toggleModule(k: ModuleKey) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const dates = useMemo(() => {
    const ds = Array.from(new Set((graph?.nodes ?? []).filter((n) => n.date).map((n) => n.date!))).sort();
    return ds;
  }, [graph]);
  const [stepIdx, setStepIdx] = useState(-1); // -1 = show all

  const viewGraph = useMemo<Graph>(() => {
    if (!graph) return { nodes: [], edges: [] };
    if (stepIdx < 0 || stepIdx >= dates.length - 1) return graph;
    const cutoff = dates[stepIdx];
    const nodes = graph.nodes.filter((n) => n.date && n.date <= cutoff);
    const ids = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges };
  }, [graph, stepIdx, dates]);

  if (loading || !graph) return <Spinner />;

  const modOf: Record<string, ModuleKey> = {};
  graph.nodes.forEach((n) => (modOf[n.id] = n.module));
  const crossLinks = graph.edges.filter((e) => modOf[e.source] !== modOf[e.target]).length;

  async function remember() {
    if (!text.trim()) return;
    setAdding(true);
    try {
      const res = await api.remember(selectedId, text);
      await refetchGraph();
      setStepIdx(-1);
      setFlash([res.node.id, ...res.edges.map((e) => e.target)]);
      setText("");
      setTimeout(() => setFlash([]), 3200);
    } finally {
      setAdding(false);
    }
  }

  async function improve() {
    setImproving(true);
    try {
      const res = await api.improve(selectedId);
      await refetchGraph();
      setLifecycleMsg(res.message);
      setTimeout(() => setLifecycleMsg((m) => (m === res.message ? null : m)), 7000);
    } finally {
      setImproving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fg/40">Cognee memory</div>
          <h1 className="text-3xl font-extrabold">Knowledge Graph Explorer</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {MODULES.map((m) => {
            const off = hidden.has(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleModule(m.key)}
                title={off ? "Show lane" : "Hide lane"}
                className={`chip transition ${off ? "opacity-35 line-through" : "hover:brightness-110"}`}
                style={{ borderColor: `${MODULE_COLOR[m.key]}55` }}
              >
                <span style={{ color: MODULE_COLOR[m.key] }}>●</span> {m.name}
              </button>
            );
          })}
          <span className="chip" style={{ borderColor: "#ff9ecb55", color: "#ff9ecb" }}>
            ✦ {crossLinks} cross-specialty links
          </span>
        </div>
      </div>

      {/* Remember box */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-fg">Add a new memory and watch the graph grow</div>
            <div className="text-xs text-fg/40">
              Cognee links the new event into the existing graph in real time
            </div>
          </div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && remember()}
            placeholder="e.g. new malar rash and morning joint stiffness"
            className="w-full flex-1 rounded-xl border border-line/10 bg-field/30 px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-fg/30 focus:border-[#7c6cff] md:w-auto md:min-w-[320px]"
          />
          <button className="btn-primary" onClick={remember} disabled={adding}>
            {adding ? "Linking…" : "Remember"}
          </button>
          <button
            className="btn-ghost"
            onClick={improve}
            disabled={improving}
            title="Run Cognee improve()/memify — prune stale nodes & reweight edges"
          >
            {improving ? "Improving…" : "✨ Improve memory"}
          </button>
        </div>
        <AnimatePresence>
          {lifecycleMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div className="rounded-xl border border-[#37d6b3]/40 bg-[#37d6b3]/10 px-3 py-2 text-sm text-[#37d6b3]">
                ✦ {lifecycleMsg}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <GlassCard className="p-4">
          {/* Time travel */}
          <div className="mb-3 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-fg/40">Time travel</span>
            <input
              type="range" min={-1} max={Math.max(0, dates.length - 1)} value={stepIdx}
              onChange={(e) => setStepIdx(Number(e.target.value))}
              className="flex-1 accent-[#7c6cff]"
            />
            <span className="w-28 text-right text-xs text-fg/60">
              {stepIdx < 0 || stepIdx >= dates.length - 1 ? "Full history" : dates[stepIdx]?.slice(0, 7)}
            </span>
          </div>
          <KnowledgeGraph key={graph.nodes.length} graph={viewGraph} height={560} highlight={flash} onSelect={setSelectedNode} hiddenModules={hidden} />
        </GlassCard>

        {/* Node detail */}
        <GlassCard className="p-4">
          <SectionTitle title="Node inspector" />
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div key={selectedNode.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
                <Pill color={MODULE_COLOR[selectedNode.module]}>{selectedNode.module}</Pill>
                <h3 className="mt-2 text-base font-bold text-fg">{selectedNode.label}</h3>
                {selectedNode.date && <div className="text-xs text-fg/40">{selectedNode.date}</div>}
                <p className="mt-2 text-sm text-fg/65">{selectedNode.detail || "—"}</p>
                <div className="mt-4 text-[11px] uppercase tracking-wider text-fg/40">Connections</div>
                <div className="mt-1.5 space-y-1.5">
                  {graph.edges
                    .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map((e) => {
                      const otherId = e.source === selectedNode.id ? e.target : e.source;
                      const other = graph.nodes.find((n) => n.id === otherId);
                      return (
                        <div key={e.id} className="rounded-lg border border-line/10 bg-field/20 p-2 text-xs">
                          <span className="text-fg/40">{e.relation}</span>
                          <div className="font-semibold text-fg/80">{other?.label ?? otherId}</div>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            ) : (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-fg/40">
                Click any node to inspect its connections and trace how the memory links together.
              </motion.p>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>
    </div>
  );
}
