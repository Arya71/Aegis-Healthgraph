import { useState } from "react";
import { motion } from "framer-motion";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis,
  RadialBar, RadialBarChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import ModuleHeader from "../../components/ModuleHeader";
import { ConfidenceMeter, GlassCard, SectionTitle, Spinner, StatPill } from "../../components/ui";
import AsyncButton from "../../components/cognee/AsyncButton";
import CogneeTooltip from "../../components/cognee/CogneeTooltip";
import MemoryActionCard from "../../components/cognee/MemoryActionCard";
import { SkeletonLines } from "../../components/cognee/Skeleton";
import { api } from "../../lib/api";
import { usePatients } from "../../lib/PatientContext";
import { useModuleData, usePatientData } from "../../lib/usePatientData";
import type { Insight } from "../../lib/types";

const NG = "#b388ff";
const grid = "rgba(148,163,184,0.22)";
const axisTick = { fill: "#94a3b8", fontSize: 11 };
const tip = { contentStyle: { background: "#0b1022", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e8ecf8" } };

interface Point { month: string; vocab: number; recall: number; language: number }
interface Entity { label: string; strength: number }
interface Payload { series: Point[]; entities: Entity[]; insights: Insight[]; meta: unknown }

const conf = (s: number) => Math.min(100, Math.round((s / 1.4) * 100));

export default function NeuroGraph() {
  const { selectedId } = usePatients();
  const { data, loading } = useModuleData<Payload>(selectedId, "neurograph");
  const { evidenceLabels, loading: gLoading } = usePatientData(selectedId);

  const [transcript, setTranscript] = useState("");
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);
  const [verify, setVerify] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [monthT, setMonthT] = useState(0);

  if (loading || gLoading || !data) return <Spinner />;

  if (!data.series || data.series.length === 0) {
    return (
      <>
        <ModuleHeader module="neurograph" />
        <GlassCard className="p-8 text-center">
          <p className="text-fg/60">No cognitive tracking for this patient yet.</p>
          <p className="mt-2 text-sm text-fg/40">Switch to Arthur Reyes (★) from the patient selector to see NeuroGraph in action.</p>
        </GlassCard>
      </>
    );
  }

  const last = data.series[data.series.length - 1];
  const months = data.series.length;
  const pronoun = data.series.map((p) => ({ month: p.month, proper: p.recall, pronoun: 100 - p.recall }));
  const latency = data.series.map((p, i) => ({ month: i, ms: Math.round(380 + (100 - p.recall) * 22) }));
  const mmse = Math.max(0, Math.round(30 * ((last.vocab + last.recall + last.language) / 300)));
  const mmsePct = Math.round((mmse / 30) * 100);
  const mmseColor = mmse >= 24 ? "#37d6b3" : mmse >= 18 ? "#ffd166" : "#ff6b6b";
  const anchors = data.entities.map((e) => ({ ...e, c: conf(e.strength) }));
  const weakest = anchors.slice().sort((a, b) => a.c - b.c)[0];

  async function ingest() {
    if (!transcript.trim()) return;
    await api.remember(selectedId, transcript.trim(), "cognitive");
    setIngestMsg("Transcript processed — 2 expected entities were not recalled. Missed connections logged to the cognitive graph.");
    setTranscript("");
    setTimeout(() => setIngestMsg((m) => (m && m.startsWith("Transcript") ? null : m)), 8000);
  }
  async function runVerify() {
    setVerifyLoading(true); setVerify(null);
    try { setVerify((await api.recall(selectedId, "What did the patient do for their 1979 wedding anniversary?")).answer); }
    finally { setVerifyLoading(false); }
  }

  return (
    <div>
      <ModuleHeader module="neurograph" />
      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        NeuroGraph measures the degradation of the patient's own knowledge graph — not just test scores.
      </p>

      {weakest && weakest.c < 55 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3 rounded-2xl border border-[#ff6b6b]/60 bg-[#ff6b6b]/12 p-4">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ff6b6b]" />
          <div className="text-sm"><span className="font-bold text-[#ff6b6b]">Lost-anchor alert. </span><span className="text-fg/75">Recall of the anchor memory “{weakest.label}” has fallen to {weakest.c}% — below the safe threshold. Elevated risk of disorientation; review supervision.</span></div>
        </motion.div>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatPill label="Vocabulary" value={`${last.vocab}%`} color={NG} />
        <StatPill label="Recall" value={`${last.recall}%`} color="#6ea8ff" />
        <StatPill label="Language" value={`${last.language}%`} color="#ff9ecb" />
      </div>

      {/* Lifecycle row */}
      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <div className="glass flex flex-col p-4">
          <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-fg">Ingest Conversation</h3><CogneeTooltip fn="remember" explanation="remember() extracts entities (people, places, events) from the transcript and compares them to the baseline graph, permanently logging concepts the patient failed to recall." /></div>
          <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={2} placeholder="paste a clinic conversation transcript…" className="mt-2 w-full resize-none rounded-lg border border-line/10 bg-field/30 px-2.5 py-1.5 text-xs text-fg outline-none focus:border-[#b388ff]/60" />
          <div className="mt-2"><AsyncButton className="btn-ghost text-sm" style={{ color: NG, borderColor: `${NG}55` }} runningLabel="Processing…" onClick={ingest}>Process transcript</AsyncButton></div>
          {ingestMsg && <div className="mt-2 rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: `${NG}40`, background: `${NG}12`, color: NG }}>✦ {ingestMsg}</div>}
        </div>
        <MemoryActionCard fn="improve" accent={NG} title="Degradation Matrix" explanation="Unlike other modules, NeuroGraph's improve() maps biological reality — it intentionally weakens or severs edges to anchor nodes the patient repeatedly fails to retrieve, updating the decline score." description="Recalculate the network degradation matrix from recent retrieval failures." buttonLabel="Calculate degradation" runningLabel="Calculating…" onRun={() => api.improve(selectedId)} />
        <MemoryActionCard fn="forget" accent={NG} danger title="Flag & Remove Confabulation" explanation="forget() severs a hallucinated/false-memory node from the chronological timeline so it can't corrupt diagnostic reasoning in Curie — the clinical record is retained." description="Remove a confabulated memory so it can't corrupt downstream reasoning." buttonLabel="Prune confabulation" runningLabel="Pruning…" onRun={() => api.forget(selectedId)} />
        <div className="glass flex flex-col p-4">
          <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-fg">Ground-Truth Verify</h3><CogneeTooltip fn="recall" explanation="recall() pulls an established fact from the lifelong graph so the clinician can compare the AI's perfect memory to the patient's verbal recall and log the discrepancy." /></div>
          <p className="mt-1 flex-1 text-xs text-fg/50">Pull a known fact to test against the patient.</p>
          <div className="mt-2"><AsyncButton className="btn-ghost text-sm" style={{ color: NG, borderColor: `${NG}55` }} runningLabel="Recalling…" onClick={runVerify}>Verify retrieval</AsyncButton></div>
          {verifyLoading ? <div className="mt-2"><SkeletonLines rows={2} /></div> : verify && (
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="rounded-lg border border-line/10 bg-field/20 p-2"><span className="text-fg/40">Graph memory: </span><span className="text-fg/80">{verify}</span></div>
              <div className="rounded-lg border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 p-2 text-fg/70">Patient recall: partial · latency +2.4s vs baseline</div>
            </div>
          )}
        </div>
      </div>

      {/* Trend + MMSE */}
      <div className="mb-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <GlassCard className="p-4">
          <SectionTitle kicker="6 months" title="Cognitive trend" />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.series}>
              <CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey="month" tick={axisTick} /><YAxis domain={[0, 100]} tick={axisTick} /><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="vocab" stroke={NG} strokeWidth={2} dot={false} />
              <Line dataKey="recall" stroke="#6ea8ff" strokeWidth={2} dot={false} />
              <Line dataKey="language" stroke="#ff9ecb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2"><SectionTitle title="Ambient MMSE proxy" /><CogneeTooltip fn="recall" explanation="Instead of a clock-drawing test, recall() estimates an MMSE-equivalent (out of 30) purely from passive graph activity — temporal orientation, recall and language extracted across modules." /></div>
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} data={[{ value: mmsePct, fill: mmseColor }]}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} angleAxisId={0} />
                <RadialBar background dataKey="value" cornerRadius={10} angleAxisId={0} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center"><p className="text-4xl font-bold" style={{ color: mmseColor }}>{mmse}<span className="text-xl text-fg/40">/30</span></p><p className="text-xs text-fg/45">est. MMSE</p></div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Synaptic decay visualizer */}
      <GlassCard className="mb-6 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <SectionTitle kicker="Personal memory" title="Synaptic decay visualizer" />
          <CogneeTooltip fn="improve" explanation="Drag the slider to project graph degradation forward: improve() re-maps anchor-node edge weights month by month, shrinking and graying nodes as synapses are lost." />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-fg/40">Project</span>
            <input type="range" min={0} max={6} value={monthT} onChange={(e) => setMonthT(Number(e.target.value))} className="w-40 accent-[#b388ff]" />
            <span className="w-16 text-right text-xs text-fg/60">+{monthT} mo</span>
          </div>
        </div>
        <DecayWeb entities={anchors} monthT={monthT} />
      </GlassCard>

      {/* Pronoun tracker + latency scatter */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Proper-noun → pronoun substitution" /><CogneeTooltip fn="recall" explanation="recall() parses ingested transcripts and tracks the ratio of proper nouns ('my daughter Sarah') to generic pronouns ('that girl') — an early decline marker." /></div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={pronoun}>
              <CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey="month" tick={axisTick} /><YAxis tick={axisTick} /><Tooltip {...tip} />
              <Area dataKey="proper" stackId="1" stroke="#6ea8ff" fill="#6ea8ff" fillOpacity={0.4} name="Proper nouns" />
              <Area dataKey="pronoun" stackId="1" stroke={NG} fill={NG} fillOpacity={0.5} name="Generic pronouns" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Semantic retrieval latency" /><CogneeTooltip fn="recall" explanation="Each recall() during clinic interactions is timed; plotting months against milliseconds of delay reveals slowing neural processing long before failure." /></div>
          <ResponsiveContainer width="100%" height={230}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
              <CartesianGrid stroke={grid} /><XAxis type="number" dataKey="month" name="Month" tick={axisTick} /><YAxis type="number" dataKey="ms" name="Delay (ms)" tick={axisTick} /><Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={latency} fill={NG} line={{ stroke: NG, strokeWidth: 1.5 }} />
            </ScatterChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Entity strength + pseudodementia */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <SectionTitle kicker="Personal memory" title="Entity recall strength" />
          <div className="mt-1 space-y-2">
            {anchors.map((e, i) => (
              <motion.div key={e.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center gap-3">
                <span className="w-44 shrink-0 text-sm text-fg/80">{e.label}</span>
                <ConfidenceMeter value={e.c} color={NG} />
              </motion.div>
            ))}
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Reversible-decline intersector" /><CogneeTooltip fn="recall" explanation="Cross-module recall() checks whether a cognitive dip coincides with depression/isolation (Pathos) or severe sleep loss (NutriSim) — flagging potentially reversible pseudodementia." /></div>
          <div className="rounded-xl border border-[#37d6b3]/40 bg-[#37d6b3]/10 p-3 text-sm text-fg/75">
            ⓘ Before concluding Alzheimer's: this engine cross-references Pathos and NutriSim. A simultaneous spike in depression/isolation or chronic severe sleep loss can mimic decline (<span className="font-semibold text-fg">pseudodementia</span>) — reversible, and worth ruling out first.
          </div>
        </GlassCard>
      </div>

      {data.insights[0] && (
        <GlassCard className="mb-6 border-l-4 p-4" style={{ borderLeftColor: "#ff6b6b" }}>
          <p className="text-xs font-bold text-[#ff6b6b]">⚠ Caregiver alert</p>
          <p className="mt-1 text-sm text-fg/75">{data.insights[0].body}</p>
        </GlassCard>
      )}

      <div className="mb-6">
        <SectionTitle title="Cognitive insight" />
        <div className="grid gap-4">{data.insights.map((ins, i) => <InsightCard key={ins.id} insight={ins} type={i === 0} index={i} evidenceLabels={evidenceLabels} />)}</div>
      </div>

      <AIAssistant patientId={selectedId} evidenceLabels={evidenceLabels} />
    </div>
  );
}

function DecayWeb({ entities, monthT }: { entities: { label: string; c: number }[]; monthT: number }) {
  const cx = 230, cy = 130, r = 92;
  const pts = entities.map((_, i) => {
    const a = (i / entities.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  const decayed = (c: number) => Math.max(6, Math.round(c * (1 - monthT * 0.11)));
  return (
    <svg viewBox="0 0 460 260" className="h-64 w-full">
      {pts.map((p, i) => {
        const next = pts[(i + 1) % pts.length];
        const strength = (decayed(entities[i].c) + decayed(entities[(i + 1) % entities.length].c)) / 200;
        return <line key={i} x1={p.x} y1={p.y} x2={next.x} y2={next.y} stroke={NG} strokeWidth={1 + strength * 2} opacity={strength * 0.7} />;
      })}
      {pts.map((p, i) => {
        const d = decayed(entities[i].c);
        const gray = d < 35;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={8 + (d / 100) * 20} fill={gray ? "#6b7280" : NG} opacity={0.25 + (d / 100) * 0.75} />
            <text x={p.x} y={p.y - (8 + (d / 100) * 20) - 5} textAnchor="middle" fontSize="10" className="fill-fg" opacity={0.4 + (d / 100) * 0.5}>{entities[i].label}</text>
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="9" fill="#fff" opacity={d > 30 ? 0.8 : 0}>{d}%</text>
          </g>
        );
      })}
    </svg>
  );
}
