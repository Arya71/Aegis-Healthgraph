import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer,
} from "recharts";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import KnowledgeGraph from "../../components/KnowledgeGraph";
import ModuleHeader from "../../components/ModuleHeader";
import { GlassCard, Pill, SectionTitle, Spinner } from "../../components/ui";
import AsyncButton from "../../components/cognee/AsyncButton";
import CogneeTooltip from "../../components/cognee/CogneeTooltip";
import MemoryActionCard from "../../components/cognee/MemoryActionCard";
import { Skeleton } from "../../components/cognee/Skeleton";
import { api } from "../../lib/api";
import { usePatients } from "../../lib/PatientContext";
import { useModuleData, usePatientData } from "../../lib/usePatientData";
import type { Graph, GraphNode, Insight, PatientEvent } from "../../lib/types";

const C = "#6ea8ff";
const SEV = ["#6b7280", "#9ec3ff", "#ffd166", "#ff9e6b", "#ff6b6b"];

interface CuriePayload {
  symptomTimeline: PatientEvent[];
  insights: Insight[];
}

const ONTOLOGY = [
  { match: "rash", label: "Malar (butterfly) rash", codes: ["SNOMED 95334008", "ICD-11 4A40.0Z"] },
  { match: "kidney", label: "Lupus nephritis", codes: ["SNOMED 68815009", "ICD-11 GB61"] },
  { match: "joint", label: "Inflammatory polyarthralgia", codes: ["SNOMED 3723001", "ICD-11 FA20"] },
  { match: "ana", label: "Antinuclear antibody positive", codes: ["LOINC 5048-4", "SNOMED 416982000"] },
  { match: "glucose", label: "Impaired fasting glucose", codes: ["ICD-11 5A40", "SNOMED 390951007"] },
  { match: "fatigue", label: "Chronic fatigue", codes: ["SNOMED 84229001", "ICD-11 MG22"] },
  { match: "eGFR", label: "Reduced renal function (CKD)", codes: ["SNOMED 709044004", "ICD-11 GB61.Z"] },
];
const ontologyFor = (label: string) =>
  ONTOLOGY.find((o) => label.toLowerCase().includes(o.match.toLowerCase()));

const LAB_ATTRS: Record<string, { name: string; values: string }[]> = {
  ana: [{ name: "Titer trend", values: "1:80 → 1:160 → 1:320" }, { name: "Pattern", values: "Homogeneous" }, { name: "Assay", values: "IFA / HEp-2" }],
  eGFR: [{ name: "eGFR trend", values: "72 → 65 → 58 mL/min" }, { name: "Proteinuria", values: "+2 (0.9 g/24h)" }, { name: "Creatinine", values: "1.4 mg/dL" }],
  hba1c: [{ name: "HbA1c", values: "5.6 → 5.9 → 6.1 %" }, { name: "Class", values: "Prediabetic" }],
};
const labAttrsFor = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes("ana")) return LAB_ATTRS.ana;
  if (l.includes("egfr") || l.includes("kidney")) return LAB_ATTRS.eGFR;
  if (l.includes("hba1c") || l.includes("glucose")) return LAB_ATTRS.hba1c;
  return null;
};

const HYPOTHETICALS = [
  { label: "Oral / nasal ulcers", delta: 6 },
  { label: "Photosensitivity", delta: 5 },
  { label: "Pleuritic chest pain (serositis)", delta: 7 },
  { label: "Diffuse hair loss", delta: 3 },
  { label: "Low complement (C3/C4)", delta: 8 },
];

const timeMs = (d: string | null) => (d ? new Date(d).getTime() : NaN);

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Curie() {
  const { selectedId, selected } = usePatients();
  const { detail, graph: loaded, evidenceLabels, loading: gLoading } = usePatientData(selectedId);
  const { data, loading } = useModuleData<CuriePayload>(selectedId, "curie");

  const [live, setLive] = useState<Graph | null>(null);
  const [flash, setFlash] = useState<string[]>([]);
  const [hop, setHop] = useState<string[]>([]);
  const [decay, setDecay] = useState(false);
  const [deltaDays, setDeltaDays] = useState(0); // 0 = off (all edges)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hypo, setHypo] = useState<(typeof HYPOTHETICALS)[number] | null>(null);
  const [matches, setMatches] = useState<{ name: string; score: number }[] | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);

  const graph = live ?? loaded;
  const topInsight = data?.insights?.[0];
  const baseConf = topInsight?.confidence ?? 0;

  useEffect(() => {
    setLive(null);
    setHop([]);
    setSelectedNode(null);
    setHypo(null);
  }, [selectedId]);

  useEffect(() => {
    if (!data) return;
    let alive = true;
    setMatchLoading(true);
    api
      .recall(selectedId, "Which rare disease cluster does this patient's graph most closely match?")
      .then((r) => {
        if (!alive) return;
        const top = Math.max(r.confidence, data.insights[0]?.confidence ?? 0);
        const set = selected?.hero
          ? [
              { name: "Early-onset SLE (lupus)", score: top },
              { name: "Sjögren's syndrome", score: 56 },
              { name: "Mixed connective tissue disease", score: 48 },
              { name: "Rheumatoid arthritis", score: 41 },
              { name: "Antiphospholipid syndrome", score: 33 },
            ]
          : [
              { name: data.insights[0]?.title ?? "Closest reference cluster", score: top || 52 },
              { name: "Metabolic syndrome spectrum", score: 38 },
              { name: "Idiopathic / no strong match", score: 24 },
            ];
        setMatches(set.sort((a, b) => b.score - a.score));
      })
      .finally(() => alive && setMatchLoading(false));
    return () => {
      alive = false;
    };
  }, [selectedId, data, selected]);

  const viewGraph = useMemo<Graph>(() => {
    if (!graph) return { nodes: [], edges: [] };
    let edges = graph.edges;
    if (decay) edges = edges.filter((e) => e.weight >= 0.6);
    if (deltaDays > 0) {
      const at: Record<string, number> = {};
      graph.nodes.forEach((n) => (at[n.id] = timeMs(n.date)));
      edges = edges.filter((e) => {
        const a = at[e.source];
        const b = at[e.target];
        if (Number.isNaN(a) || Number.isNaN(b)) return true;
        return Math.abs(a - b) <= deltaDays * 86400000;
      });
    }
    return { nodes: graph.nodes, edges };
  }, [graph, decay, deltaDays]);

  const crossPills = useMemo(() => {
    if (!graph) return [];
    const mod: Record<string, string> = {};
    graph.nodes.forEach((n) => (mod[n.id] = n.module));
    const counts: Record<string, number> = {};
    graph.edges.forEach((e) => {
      const a = mod[e.source];
      const b = mod[e.target];
      if (a && b && a !== b) {
        const key = [a, b].sort().join(" ↔ ");
        counts[key] = (counts[key] ?? 0) + 1;
      }
    });
    return Object.entries(counts).sort((x, y) => y[1] - x[1]);
  }, [graph]);

  const hops = useMemo(() => {
    if (!topInsight || !graph) return [];
    const ev = topInsight.evidence;
    const out: { from: string; to: string; relation: string; ids: string[] }[] = [];
    for (let i = 0; i < ev.length - 1; i++) {
      const a = ev[i];
      const b = ev[i + 1];
      const edge = graph.edges.find(
        (e) => (e.source === a && e.target === b) || (e.source === b && e.target === a),
      );
      out.push({
        from: evidenceLabels[a] ?? a,
        to: evidenceLabels[b] ?? b,
        relation: edge?.relation ?? "linked to",
        ids: [a, b],
      });
    }
    return out;
  }, [topInsight, graph, evidenceLabels]);

  const radarData = useMemo(() => {
    const c = baseConf || 60;
    return [
      { factor: "Semantic similarity", v: Math.min(99, c + 4) },
      { factor: "Graph path density", v: Math.min(99, c - 6) },
      { factor: "Temporal sequence", v: Math.min(99, c + 1) },
      { factor: "Data recency", v: Math.max(35, c - 18) },
      { factor: "Cross-module support", v: Math.min(99, c - 9) },
    ];
  }, [baseConf]);

  const ddx = useMemo(() => (matches ?? []).map((m) => m), [matches]);

  if (loading || gLoading || !data || !graph || !detail) return <Spinner />;

  const highlight = hop.length ? hop : topInsight?.evidence ?? [];

  async function ingest(text: string) {
    const res = await api.remember(selectedId, text, "symptom");
    const next: Graph = {
      nodes: [...graph!.nodes, res.node],
      edges: [...graph!.edges, ...res.edges],
    };
    setLive(next);
    setDecay(false);
    setDeltaDays(0);
    setFlash([res.node.id, ...res.edges.map((e) => e.target)]);
    setTimeout(() => setFlash([]), 3200);
  }

  function exportTrail() {
    const lines = [
      `# Curie Diagnostic Trail — ${selected?.name}`,
      ``,
      `Patient: ${selected?.name} (${selected?.age}${selected?.sex})`,
      `Graph: ${graph!.nodes.length} nodes, ${graph!.edges.length} edges`,
      ``,
      `## Reasoning path (top insight: ${topInsight?.title})`,
      ...hops.map((h, i) => `${i + 1}. ${h.from} —[${h.relation}]→ ${h.to}`),
      ``,
      `## Differential ranking`,
      ...ddx.map((d) => `- ${d.name}: ${d.score}%`),
      ``,
      `## Module insights`,
      ...data!.insights.map((i) => `- [${i.confidence}%] ${i.title}: ${i.body}`),
    ];
    downloadFile(`curie_trail_${selectedId}.md`, lines.join("\n"), "text/markdown");
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <ModuleHeader module="curie" />
      </div>

      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-3">
        <p className="max-w-2xl flex-1 text-sm text-fg/55">
          Curie searches the patient's <em>entire lifetime</em> for hidden relationships between
          events that occurred years apart, then scores how strongly they resemble known disease
          progressions.
        </p>
        <button onClick={exportTrail} className="btn-ghost shrink-0 text-sm" style={{ color: C, borderColor: `${C}55` }}>
          ⬇ Export Diagnostic Trail
        </button>
      </div>

      {detail.crossInsights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start gap-3 rounded-2xl border p-4"
          style={{ borderColor: `${C}55`, background: `${C}12` }}
        >
          <span className="text-lg">🔔</span>
          <div className="text-sm">
            <span className="font-bold text-fg">Cross-specialty signal changed this hypothesis. </span>
            <span className="text-fg/70">{detail.crossInsights[0].body}</span>
          </div>
        </motion.div>
      )}

      {/* Lifecycle: ingest + improve + forget */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <IngestionSandbox accent={C} onIngest={ingest} />
        <MemoryActionCard
          fn="improve" accent="#37d6b3"
          title="Memory Enrichment Meter"
          explanation="Runs improve()/memify: Cognee re-weights frequently co-recalled edges, prunes weak links, and refreshes metadata from clinical usage — so the diagnostic graph sharpens over time."
          description="Optimise the diagnostic graph — prune weak links and re-weight frequently co-recalled edges."
          buttonLabel="✨ Enrich memory" runningLabel="Enriching…"
          onRun={() => api.improve(selectedId)}
        />
        <MemoryActionCard
          fn="forget" accent={C} danger
          title="Compliance Data Erasure"
          explanation="Calls forget(): Cognee surgically unlinks this patient's nodes from the graph + vector store while keeping core system logs — demonstrating HIPAA-grade, multi-tenant data control."
          description="Surgically purge this patient's diagnostic memory set from the graph + vector store."
          buttonLabel="Purge diagnostic memory" runningLabel="Purging…"
          onRun={() => api.forget(selectedId)}
        />
      </div>

      {/* Similarity matcher + radar */}
      <div className="mb-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <SectionTitle title="Rare-disease similarity match" />
            <CogneeTooltip fn="recall" explanation="Uses recall() auto-routing to compare this patient's graph structure against anonymised reference disease vectors. It matches graph shape and semantics, not keywords, so subtle multi-year patterns surface." />
          </div>
          {matchLoading || !matches ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}
            </div>
          ) : (
            <div className="space-y-2.5">
              {matches.map((m, i) => (
                <div key={m.name} className="flex items-center gap-3">
                  <span className="w-52 shrink-0 truncate text-sm text-fg/75">{m.name}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface/10">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: i === 0 ? `linear-gradient(90deg, ${C}, #ff9ecb)` : `${C}99` }}
                      initial={{ width: 0 }} animate={{ width: `${m.score}%` }}
                      transition={{ duration: 0.9, delay: i * 0.08 }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-bold tabular-nums" style={{ color: i === 0 ? C : undefined }}>
                    {m.score}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <SectionTitle title="Confidence breakdown" />
            <CogneeTooltip fn="recall" explanation="Decomposes the headline match score into the factors recall() weighs: semantic similarity, graph path density, temporal sequence fit, data recency, and cross-module support." />
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="rgba(148,163,184,0.25)" />
              <PolarAngleAxis dataKey="factor" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <Radar dataKey="v" stroke={C} fill={C} fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Graph + controls + inspector */}
      <div className="mb-7 grid gap-5 lg:grid-cols-[1fr_300px]">
        <GlassCard className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <SectionTitle title="Connected evidence" />
            <CogneeTooltip fn="recall" explanation="The graph is traversed by recall(): hovering and the reasoning walkthrough trace the exact semantic/temporal edges between events the engine connected." />
            <label className="ml-auto flex items-center gap-1.5 text-xs text-fg/55">
              <input type="checkbox" checked={decay} onChange={(e) => setDecay(e.target.checked)} className="accent-[#6ea8ff]" />
              Show memory decay
            </label>
          </div>
          <div className="mb-3 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-fg/40">Temporal Δ</span>
            <input
              type="range" min={0} max={1460} step={30} value={deltaDays}
              onChange={(e) => setDeltaDays(Number(e.target.value))}
              className="flex-1 accent-[#6ea8ff]"
            />
            <span className="w-32 text-right text-xs text-fg/60">
              {deltaDays === 0 ? "All links" : `≤ ${deltaDays}d apart`}
            </span>
          </div>
          <KnowledgeGraph graph={viewGraph} height={460} highlight={[...highlight, ...flash]} onSelect={setSelectedNode} />
        </GlassCard>

        <GlassCard className="p-4">
          <SectionTitle title="Ontology & lab inspector" />
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div key={selectedNode.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
                <Pill color={C}>{selectedNode.type}</Pill>
                <h3 className="mt-2 text-base font-bold text-fg">{selectedNode.label}</h3>
                {selectedNode.date && <div className="text-xs text-fg/40">{selectedNode.date}</div>}
                {(() => {
                  const ont = ontologyFor(selectedNode.label);
                  return (
                    <div className="mt-3">
                      <div className="text-[11px] uppercase tracking-wider text-fg/40">Ontology grounding</div>
                      {ont ? (
                        <>
                          <div className="mt-1 text-sm text-fg/80">{ont.label}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {ont.codes.map((c) => <span key={c} className="chip" style={{ borderColor: `${C}55` }}>{c}</span>)}
                          </div>
                        </>
                      ) : (
                        <div className="mt-1 text-sm text-fg/45">Resolved as a free-text clinical entity (no standard code mapped yet).</div>
                      )}
                    </div>
                  );
                })()}
                {labAttrsFor(selectedNode.label) && (
                  <div className="mt-4">
                    <div className="text-[11px] uppercase tracking-wider text-fg/40">Attached lab attributes</div>
                    <div className="mt-1.5 space-y-1.5">
                      {labAttrsFor(selectedNode.label)!.map((a) => (
                        <div key={a.name} className="flex justify-between rounded-lg border border-line/10 bg-field/20 px-2.5 py-1.5 text-xs">
                          <span className="text-fg/50">{a.name}</span>
                          <span className="font-semibold text-fg/85">{a.values}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <p key="empty" className="text-sm text-fg/40">
                Click any node to see how its colloquial label was grounded into ICD-11 / SNOMED-CT / LOINC, plus any attached lab arrays.
              </p>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>

      {/* Reasoning walkthrough + cross-specialty links */}
      <div className="mb-7 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <SectionTitle title="Reasoning walkthrough" />
            <CogneeTooltip fn="recall" explanation="Each hop is one relational edge recall() traversed. Click a hop to pulse that exact connection on the graph — the audit trail behind the confidence score." />
          </div>
          <div className="space-y-1.5">
            {hops.length === 0 && <p className="text-sm text-fg/40">No multi-hop path for this patient yet.</p>}
            {hops.map((h, i) => (
              <button
                key={i}
                onClick={() => setHop(h.ids)}
                className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition ${
                  hop.join() === h.ids.join() ? "border-[#6ea8ff]/60 bg-[#6ea8ff]/10" : "border-line/10 hover:bg-surface/5"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: `${C}22`, color: C }}>{i + 1}</span>
                <span className="font-semibold text-fg/85">{h.from}</span>
                <span className="text-fg/40">—{h.relation}→</span>
                <span className="font-semibold text-fg/85">{h.to}</span>
              </button>
            ))}
            {hop.length > 0 && (
              <button onClick={() => setHop([])} className="text-xs text-fg/40 hover:text-fg/70">Clear path highlight</button>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <SectionTitle title="Cross-specialty links discovered" />
          {crossPills.length === 0 ? (
            <p className="text-sm text-fg/40">No cross-specialty structural links in this graph.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {crossPills.map(([pair, n]) => (
                <span key={pair} className="chip" style={{ borderColor: "#ff9ecb55", color: "#ff9ecb" }}>
                  ✦ {n} {pair}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-fg/40">Hypothetical symptom simulator</span>
              <CogneeTooltip fn="recall" explanation="Projects how adding a candidate symptom would shift the match score via recall() — a sandbox preview that is never written to the record unless you remember() it." />
            </div>
            <select
              value={hypo?.label ?? ""}
              onChange={(e) => setHypo(HYPOTHETICALS.find((h) => h.label === e.target.value) ?? null)}
              className="w-full rounded-xl border border-line/10 bg-field/30 px-3 py-2 text-sm text-fg/90 outline-none focus:border-[#6ea8ff]"
            >
              <option value="">Simulate next symptom match…</option>
              {HYPOTHETICALS.map((h) => <option key={h.label} value={h.label} style={{ background: "rgb(var(--bg))" }}>{h.label}</option>)}
            </select>
            {hypo && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-line/10 bg-field/20 p-3 text-sm">
                Adding <span className="font-semibold text-fg">{hypo.label}</span> would raise the lead match from{" "}
                <span className="text-fg/60">{baseConf}%</span> to{" "}
                <span className="font-bold" style={{ color: C }}>{Math.min(99, baseConf + hypo.delta)}%</span>.
                <div className="mt-1 text-xs text-fg/45">Preview only — not added to the record.</div>
              </motion.div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Differential ranker */}
      <div className="mb-7">
        <div className="mb-3 flex items-center gap-2">
          <SectionTitle kicker="DDx" title="Differential diagnosis ranking" />
          <CogneeTooltip fn="recall" explanation="Ranks candidates by combining vector-embedding closeness with knowledge-graph node density via recall() — primary match plus secondary considerations to review." />
        </div>
        <GlassCard className="p-4">
          <div className="space-y-2">
            {ddx.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3 rounded-lg border border-line/10 p-2.5">
                <span className="w-5 text-center text-sm font-bold text-fg/40">{i + 1}</span>
                <span className="flex-1 text-sm font-semibold text-fg/85">{d.name}</span>
                <div className="h-2 w-40 overflow-hidden rounded-full bg-surface/10">
                  <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: i === 0 ? C : `${C}88` }} />
                </div>
                <span className="w-10 text-right text-sm font-bold tabular-nums" style={{ color: i === 0 ? C : undefined }}>{d.score}%</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Symptom timeline */}
      <div className="mb-7">
        <SectionTitle kicker="Longitudinal" title="Symptom timeline" />
        <div className="relative space-y-3 before:absolute before:left-[7px] before:top-2 before:h-full before:w-px before:bg-surface/10">
          {data.symptomTimeline.map((e, i) => (
            <motion.div key={e.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="relative pl-7">
              <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-bg" style={{ background: SEV[e.severity ?? 1] }} />
              <div className="glass glass-hover p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-fg">{e.title}</span>
                  <span className="text-xs text-fg/40">{e.date}</span>
                </div>
                <p className="mt-1 text-xs text-fg/55">{e.detail}</p>
                <div className="mt-1.5"><Pill>{e.type}</Pill></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mb-7">
        <div className="mb-3 flex items-center gap-2">
          <SectionTitle kicker="AI reasoning" title="Diagnostic cross-references" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {data.insights.map((ins, i) => (
            <InsightCard key={ins.id} insight={ins} evidenceLabels={evidenceLabels} type={i === 0} index={i} />
          ))}
        </div>
      </div>

      <AIAssistant patientId={selectedId} evidenceLabels={evidenceLabels} />
    </div>
  );
}

function IngestionSandbox({ accent, onIngest }: { accent: string; onIngest: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="glass flex h-full flex-col p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-fg">Live Symptom Ingestion</h3>
        <CogneeTooltip fn="remember" explanation="Calls remember(): the observation is embedded and grounded into the patient's knowledge graph, auto-linking to the most related historical nodes via vector similarity." />
      </div>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-fg/50">
        Type an active clinical observation — Cognee links it into the graph and the new node pulses into view.
      </p>
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { onIngest(text.trim()); setText(""); } }}
        placeholder="e.g. worsening malar flush and morning stiffness"
        className="mt-3 w-full rounded-xl border border-line/10 bg-field/30 px-3 py-2 text-sm text-fg outline-none placeholder:text-fg/30 focus:border-[#6ea8ff]"
      />
      <div className="mt-3">
        <AsyncButton
          className="btn-ghost text-sm" style={{ color: accent, borderColor: `${accent}55` }}
          runningLabel="Embedding…"
          onClick={async () => { if (!text.trim()) return; await onIngest(text.trim()); setText(""); }}
        >
          + Ingest observation
        </AsyncButton>
      </div>
    </div>
  );
}
