import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import ModuleHeader from "../../components/ModuleHeader";
import { GlassCard, Pill, SectionTitle, Spinner, StatPill } from "../../components/ui";
import AsyncButton from "../../components/cognee/AsyncButton";
import CogneeTooltip from "../../components/cognee/CogneeTooltip";
import MemoryActionCard from "../../components/cognee/MemoryActionCard";
import { SkeletonLines } from "../../components/cognee/Skeleton";
import { MODULE_COLOR, MODULES, api } from "../../lib/api";
import { usePatients } from "../../lib/PatientContext";
import { useModuleData, usePatientData } from "../../lib/usePatientData";
import type { GraphEdge, Insight, PatientEvent } from "../../lib/types";

const M = "#7c6cff";

interface Payload {
  timeline: PatientEvent[];
  causalEdges: GraphEdge[];
  insights: Insight[];
  meta: unknown;
}

const gapColor = (d: number) =>
  d < 14 ? "#37d6b3" : d < 90 ? "#ffd166" : d < 365 ? "#ff9e6b" : "#ff6b6b";

const dayGap = (a?: string | null, b?: string | null) =>
  a && b ? Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000) : 0;

const NETWORKS = [
  { id: "cardiology", label: "Cardiology Network" },
  { id: "endocrine", label: "Endocrinology Group" },
  { id: "external", label: "External Telehealth Agent" },
];

export default function MedSync() {
  const { selectedId } = usePatients();
  const { detail, evidenceLabels, loading: gLoading } = usePatientData(selectedId);
  const { data, loading } = useModuleData<Payload>(selectedId, "medsync");

  const [activeTypes, setActiveTypes] = useState<Set<string> | null>(null);
  const [tracerId, setTracerId] = useState<string | null>(null);
  const [pivotId, setPivotId] = useState<string>("");
  const [byLane, setByLane] = useState(false);
  const [heatmap, setHeatmap] = useState(false);
  const [linkFrom, setLinkFrom] = useState("");
  const [linkTo, setLinkTo] = useState("");
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrLoading, setNarrLoading] = useState(false);
  const [revoked, setRevoked] = useState<Set<string>>(new Set());

  const allTypes = useMemo(
    () => (data ? Array.from(new Set(data.timeline.map((e) => e.type))) : []),
    [data],
  );

  const conflicts = useMemo(() => {
    if (!data) return [];
    const byDate: Record<string, PatientEvent[]> = {};
    data.timeline.forEach((e) => {
      if (e.date) (byDate[e.date] ??= []).push(e);
    });
    return Object.values(byDate)
      .filter((evs) => new Set(evs.map((e) => e.module)).size > 1)
      .map((evs) => ({ date: evs[0].date!, events: evs }));
  }, [data]);

  if (loading || gLoading || !data) return <Spinner />;

  const active = activeTypes ?? new Set(allTypes);
  function toggleType(t: string) {
    const next = new Set(active);
    if (next.has(t)) { if (next.size > 1) next.delete(t); } else next.add(t);
    setActiveTypes(next);
  }

  const sorted = data.timeline.slice().sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const tracerSet = (() => {
    if (!tracerId) return null;
    const set = new Set<string>([tracerId]);
    data.causalEdges.forEach((e) => {
      if (e.source === tracerId) set.add(e.target);
      if (e.target === tracerId) set.add(e.source);
    });
    return set;
  })();
  const pivotDate = sorted.find((e) => e.id === pivotId)?.date ?? null;

  const filtered = sorted.filter((e) => {
    if (!active.has(e.type)) return false;
    if (tracerSet && !tracerSet.has(e.id)) return false;
    if (pivotDate && (e.date ?? "") < pivotDate) return false;
    return true;
  });

  const dates = sorted.map((e) => e.date).filter(Boolean) as string[];
  const span = dates.length ? `${dates[0].slice(0, 7)} – ${dates[dates.length - 1].slice(0, 7)}` : "—";

  const milestones = [
    { label: "First specialist consult", hit: sorted.some((e) => e.type === "visit") },
    { label: "Metabolic risk flagged", hit: sorted.some((e) => /glucose|hba1c|weight/i.test(e.title)) },
    { label: "Autoimmune cluster identified", hit: sorted.some((e) => /ana|rash|joint/i.test(e.title)) },
    { label: "Organ involvement / full workup", hit: sorted.some((e) => /kidney|nephritis|eGFR/i.test(e.title)) },
  ];

  async function formulateLink() {
    const from = sorted.find((e) => e.id === linkFrom);
    const to = sorted.find((e) => e.id === linkTo);
    if (!from || !to || from.id === to.id) return;
    await api.remember(selectedId, `${from.title} led to ${to.title}`, "visit");
    setLinkMsg(`Linked: ${from.title} —[led to]→ ${to.title}. New directed edge added to the graph.`);
    setTimeout(() => setLinkMsg((m) => (m && m.startsWith("Linked") ? null : m)), 7000);
  }

  async function generateNarrative() {
    setNarrLoading(true);
    setNarrative(null);
    try {
      const r = await api.recall(selectedId, "Summarise how this patient's conditions evolved across specialists over the years.");
      setNarrative(r.answer);
    } finally {
      setNarrLoading(false);
    }
  }

  async function revoke(id: string) {
    setRevoked((p) => new Set(p).add(id));
    await api.forget(selectedId);
  }

  return (
    <div>
      <ModuleHeader module="medsync" />
      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        MedSync turns scattered specialist visits into one causal timeline — tracking who caused what,
        when, and where care pathways collide.
      </p>

      {conflicts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start gap-3 rounded-2xl border border-[#ff9e6b]/50 bg-[#ff9e6b]/10 p-4"
        >
          <span className="text-lg">⚠️</span>
          <div className="text-sm">
            <span className="font-bold text-fg">Care pathway conflict detected. </span>
            <span className="text-fg/70">
              On {conflicts[0].date}, {conflicts[0].events.map((e) => e.title).join(" and ")} were recorded
              the same day across different specialties — a same-date multi-agent change worth reconciling.
            </span>
          </div>
        </motion.div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        <StatPill label="Events" value={String(data.timeline.length)} color={M} />
        <StatPill label="Span" value={span} color="#6ea8ff" />
        <StatPill label="Causal links" value={String(data.causalEdges.length)} color="#37d6b3" />
      </div>

      {/* Lifecycle row */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="glass flex h-full flex-col p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-fg">Map Clinical Causality</h3>
            <CogneeTooltip fn="remember" explanation="Asserting a link calls remember(): a new directed causal edge with your relationship type is written into the Cognee graph, instantly available to every other module." />
          </div>
          <p className="mt-1 text-xs text-fg/50">Assert a causal link between two events.</p>
          <div className="mt-3 space-y-2">
            <select value={linkFrom} onChange={(e) => setLinkFrom(e.target.value)} className="w-full rounded-lg border border-line/10 bg-field/30 px-2.5 py-1.5 text-xs text-fg/90 outline-none focus:border-[#7c6cff]">
              <option value="">Cause event…</option>
              {sorted.map((e) => <option key={e.id} value={e.id} style={{ background: "rgb(var(--bg))" }}>{e.title}</option>)}
            </select>
            <select value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="w-full rounded-lg border border-line/10 bg-field/30 px-2.5 py-1.5 text-xs text-fg/90 outline-none focus:border-[#7c6cff]">
              <option value="">Effect event…</option>
              {sorted.map((e) => <option key={e.id} value={e.id} style={{ background: "rgb(var(--bg))" }}>{e.title}</option>)}
            </select>
            <AsyncButton className="btn-ghost text-sm" style={{ color: M, borderColor: `${M}55` }} runningLabel="Linking…" onClick={formulateLink} disabled={!linkFrom || !linkTo}>
              + Assert causal link
            </AsyncButton>
          </div>
          {linkMsg && <div className="mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: `${M}40`, background: `${M}12`, color: M }}>✦ {linkMsg}</div>}
        </div>

        <MemoryActionCard
          fn="improve" accent="#37d6b3"
          title="Causal Link Stability Index"
          explanation="improve() evaluates cross-module usage logs and re-weights or drops causal edges when newly added multi-specialist data contradicts the original sequence."
          description="Re-weight causal links and drop ones contradicted by new multi-specialist data."
          buttonLabel="✨ Re-weight links" runningLabel="Optimising…"
          onRun={() => api.improve(selectedId)}
        />

        <div className="glass flex h-full flex-col p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-fg">Care Collaboration Sync</h3>
            <CogneeTooltip fn="forget" explanation="Revoking access calls forget(): Cognee surgically severs that provider's view of the relevant timeline segment from the shared graph while preserving the core record." />
          </div>
          <p className="mt-1 flex-1 text-xs text-fg/50">Networks with sync access. Revoke to forget their segment.</p>
          <div className="mt-3 space-y-2">
            {NETWORKS.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-lg border border-line/10 px-3 py-1.5 text-xs">
                <span className={revoked.has(n.id) ? "text-fg/35 line-through" : "text-fg/80"}>{n.label}</span>
                {revoked.has(n.id) ? (
                  <span className="text-[#ff6b6b]">revoked</span>
                ) : (
                  <AsyncButton className="text-xs text-fg/50 hover:text-[#ff6b6b]" runningLabel="…" onClick={() => revoke(n.id)}>revoke</AsyncButton>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Narrative generator */}
      <GlassCard className="mb-6 p-4">
        <div className="mb-2 flex items-center gap-2">
          <SectionTitle title="Clinical case timeline summary" />
          <CogneeTooltip fn="recall" explanation="recall() traverses the temporal graph paths and returns a coherent, paragraph-form case study of how the patient's conditions evolved across specialists." />
          <AsyncButton className="btn-ghost ml-auto text-sm" style={{ color: M, borderColor: `${M}55` }} runningLabel="Generating…" onClick={generateNarrative}>
            Generate summary
          </AsyncButton>
        </div>
        {narrLoading ? <SkeletonLines rows={4} /> : narrative ? (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm leading-relaxed text-fg/75">{narrative}</motion.p>
        ) : (
          <p className="text-sm text-fg/40">Click generate to recall a natural-language case study from the temporal graph.</p>
        )}
      </GlassCard>

      {/* Timeline controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {allTypes.map((t) => (
          <button key={t} onClick={() => toggleType(t)} className={`chip transition ${active.has(t) ? "" : "opacity-40 line-through"}`}>{t}</button>
        ))}
        <span className="mx-1 h-4 w-px bg-line/10" />
        <button onClick={() => setByLane((v) => !v)} className={`chip transition ${byLane ? "border-[#7c6cff]/60 text-[#7c6cff]" : ""}`}>⊞ Specialty lanes</button>
        <button onClick={() => setHeatmap((v) => !v)} className={`chip transition ${heatmap ? "border-[#ff9e6b]/60 text-[#ff9e6b]" : ""}`}>🔥 Time-gap heatmap</button>
        <select value={pivotId} onChange={(e) => setPivotId(e.target.value)} className="chip bg-transparent outline-none">
          <option value="">⑂ Branch from…</option>
          {sorted.map((e) => <option key={e.id} value={e.id} style={{ background: "rgb(var(--bg))" }}>{e.title}</option>)}
        </select>
        {(tracerId || pivotId) && (
          <button onClick={() => { setTracerId(null); setPivotId(""); }} className="chip text-fg/50">✕ reset focus</button>
        )}
        <CogneeTooltip fn="recall" explanation="Causality tracer, lane isolation, heatmap and branching all re-query the graph edges via recall() to re-render only the relevant temporal slice." />
      </div>

      {/* Timeline */}
      {byLane ? (
        <div className="mb-8 space-y-4">
          {MODULES.filter((m) => filtered.some((e) => e.module === m.key)).map((m) => (
            <div key={m.key}>
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: MODULE_COLOR[m.key] }}>{m.icon} {m.name}</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {filtered.filter((e) => e.module === m.key).map((e) => (
                  <EventCard key={e.id} e={e} onClick={() => setTracerId(e.id)} active={tracerId === e.id} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex items-stretch gap-3" style={{ minWidth: "max-content" }}>
            {filtered.map((e, i) => {
              const gap = i > 0 ? dayGap(filtered[i - 1].date, e.date) : 0;
              return (
                <div key={e.id} className="flex items-center gap-3">
                  <EventCard e={e} onClick={() => setTracerId((p) => (p === e.id ? null : e.id))} active={tracerId === e.id} />
                  {i < filtered.length - 1 && (
                    <span className="flex flex-col items-center text-fg/30">
                      <span style={{ color: heatmap ? gapColor(dayGap(e.date, filtered[i + 1].date)) : undefined }}>→</span>
                      {heatmap && <span className="text-[9px]" style={{ color: gapColor(dayGap(e.date, filtered[i + 1].date)) }}>{dayGap(e.date, filtered[i + 1].date)}d</span>}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Causality tracer detail + milestones */}
      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <SectionTitle title="Causality tracer" />
            <CogneeTooltip fn="recall" explanation="Parses the causal edges (led to consult, drives, contributes to) attached to the selected node to render the direct upstream causes and downstream effects." />
          </div>
          {tracerId ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="mb-1.5 text-xs uppercase tracking-wider text-fg/40">Upstream causes</div>
                {data.causalEdges.filter((e) => e.target === tracerId).map((e) => (
                  <div key={e.id} className="mb-1 rounded-lg border border-line/10 bg-field/20 p-2 text-xs"><span className="text-fg/40">{e.relation} →</span><div className="font-semibold text-fg/80">{evidenceLabels[e.source] ?? e.source}</div></div>
                ))}
                {!data.causalEdges.some((e) => e.target === tracerId) && <div className="text-xs text-fg/40">Root event.</div>}
              </div>
              <div>
                <div className="mb-1.5 text-xs uppercase tracking-wider text-fg/40">Downstream effects</div>
                {data.causalEdges.filter((e) => e.source === tracerId).map((e) => (
                  <div key={e.id} className="mb-1 rounded-lg border border-line/10 bg-field/20 p-2 text-xs"><span className="text-fg/40">→ {e.relation}</span><div className="font-semibold text-fg/80">{evidenceLabels[e.target] ?? e.target}</div></div>
                ))}
                {!data.causalEdges.some((e) => e.source === tracerId) && <div className="text-xs text-fg/40">No recorded effects.</div>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-fg/40">Click any event on the timeline to trace its direct causes and effects.</p>
          )}
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <SectionTitle title="Clinical milestone tracker" />
            <CogneeTooltip fn="recall" explanation="Uses recall() vector similarity to check whether recorded graph events match standard care-pathway milestones, marking each Achieved or Pending." />
          </div>
          <div className="space-y-2.5">
            {milestones.map((ms, i) => (
              <div key={ms.label} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs" style={{ background: ms.hit ? `${M}22` : "rgba(148,163,184,0.12)", color: ms.hit ? M : "#94a3b8" }}>{ms.hit ? "✓" : i + 1}</span>
                <span className={`text-sm ${ms.hit ? "text-fg/85" : "text-fg/45"}`}>{ms.label}</span>
                <span className="ml-auto text-xs" style={{ color: ms.hit ? "#37d6b3" : "#94a3b8" }}>{ms.hit ? "Achieved" : "Pending"}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="mb-8">
        <SectionTitle title="Timeline intelligence" />
        <div className="grid gap-4 md:grid-cols-2">
          {data.insights.map((ins, i) => <InsightCard key={ins.id} insight={ins} evidenceLabels={evidenceLabels} type={i === 0} index={i} />)}
        </div>
      </div>

      <AIAssistant patientId={selectedId} evidenceLabels={evidenceLabels} />
    </div>
  );
}

function EventCard({ e, onClick, active }: { e: PatientEvent; onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick} className={`min-w-[210px] rounded-2xl border p-3 text-left transition ${active ? "border-[#7c6cff]/70 bg-[#7c6cff]/10" : "border-line/10 bg-field/20 hover:bg-surface/5"}`}>
      <p className="text-xs text-fg/40">{e.date ?? "—"}</p>
      <p className="mt-1 text-sm font-bold text-fg">{e.title}</p>
      <div className="mt-1.5"><Pill style={{ color: MODULE_COLOR[e.module], borderColor: MODULE_COLOR[e.module] + "55" }}>{e.type}</Pill></div>
      <p className="mt-1.5 line-clamp-2 text-xs text-fg/55">{e.detail}</p>
    </button>
  );
}
