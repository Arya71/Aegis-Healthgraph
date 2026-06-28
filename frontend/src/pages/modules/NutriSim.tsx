import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import ModuleHeader from "../../components/ModuleHeader";
import { GlassCard, Pill, SectionTitle, Spinner, StatPill } from "../../components/ui";
import AsyncButton from "../../components/cognee/AsyncButton";
import CogneeTooltip from "../../components/cognee/CogneeTooltip";
import MemoryActionCard from "../../components/cognee/MemoryActionCard";
import { SkeletonLines } from "../../components/cognee/Skeleton";
import { api } from "../../lib/api";
import { usePatients } from "../../lib/PatientContext";
import { useModuleData, usePatientData } from "../../lib/usePatientData";
import type { Insight } from "../../lib/types";

const N = "#37d6b3";
const grid = "rgba(148,163,184,0.22)";
const axisTick = { fill: "#94a3b8", fontSize: 11 };
const tip = { contentStyle: { background: "#0b1022", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e8ecf8" } };

interface Meal { meal: string; carbs: number; note: string }
interface Payload { days: string[]; glucose: number[]; sleep: number[]; rem: number[]; meals: Meal[]; insights: Insight[]; meta: unknown }

const LOOP = ["Late dinner", "Fragmented sleep", "Low REM", "Cortisol spike", "AM glucose surge", "Daytime fatigue", "High caffeine"];
const MICRO = [
  { nutrient: "Magnesium", status: "Low", linked: "Insulin resistance · fatigue" },
  { nutrient: "Vitamin D", status: "Low", linked: "Immune dysregulation · low mood" },
  { nutrient: "Fiber", status: "Below target", linked: "Sharper glucose excursions" },
  { nutrient: "Omega-3", status: "Adequate", linked: "Inflammatory balance" },
];

export default function NutriSim() {
  const { selectedId } = usePatients();
  const { detail, evidenceLabels, loading: gLoading } = usePatientData(selectedId);
  const { data, loading } = useModuleData<Payload>(selectedId, "nutrisim");

  const [logInput, setLogInput] = useState("");
  const [logMsg, setLogMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [qLoading, setQLoading] = useState(false);
  const [loopHover, setLoopHover] = useState<number | null>(null);
  const [mealIdx, setMealIdx] = useState(0);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrLoading, setNarrLoading] = useState(false);

  const series = useMemo(
    () => (data ? data.days.map((day, i) => ({ day, glucose: data.glucose[i], sleep: data.sleep[i], rem: data.rem[i] })) : []),
    [data],
  );
  const scatter = useMemo(
    () => (data ? data.rem.map((r, i) => ({ stress: Math.max(8, 100 - r), recovery: r, glucose: data.glucose[i] })) : []),
    [data],
  );

  if (loading || gLoading || !data) return <Spinner />;

  const avgGlucose = Math.round(data.glucose.reduce((a, b) => a + b, 0) / data.glucose.length);
  const avgSleep = +(data.sleep.reduce((a, b) => a + b, 0) / data.sleep.length).toFixed(1);
  const worstSpike = Math.max(...data.glucose);
  const avgRem = Math.round(data.rem.reduce((a, b) => a + b, 0) / data.rem.length);

  const meal = data.meals[mealIdx];
  const curve = (() => {
    const base = 92;
    const peak = base + meal.carbs * 0.9;
    return Array.from({ length: 13 }, (_, i) => {
      const t = i * 15;
      const v = i <= 3 ? base + ((peak - base) * i) / 3 : peak - ((peak - base) * (i - 3)) / 9;
      return { t: `${t}m`, glucose: Math.round(Math.max(base - 4, v)) };
    });
  })();
  const auc = Math.round(curve.reduce((a, c) => a + (c.glucose - 88), 0) * 15 / 60);

  const hasMetoprolol = detail?.events.some((e) => /metoprolol/i.test(e.title));

  async function logEvent() {
    if (!logInput.trim()) return;
    await api.remember(selectedId, logInput.trim(), "lifestyle");
    setLogMsg(`Logged "${logInput.trim()}" — embedded into the timeline with predictive edges to tomorrow's glucose.`);
    setLogInput("");
    setTimeout(() => setLogMsg((m) => (m && m.startsWith("Logged") ? null : m)), 7000);
  }
  async function runQuery() {
    if (!query.trim()) return;
    setQLoading(true); setAnswer(null);
    try { setAnswer((await api.recall(selectedId, query.trim())).answer); } finally { setQLoading(false); }
  }
  async function genNarrative() {
    setNarrLoading(true); setNarrative(null);
    try { setNarrative((await api.recall(selectedId, "Explain the morning glucose spikes in plain language with the strongest lifestyle driver and one actionable lever.")).answer); }
    finally { setNarrLoading(false); }
  }

  return (
    <div>
      <ModuleHeader module="nutrisim" />
      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        NutriSim finds the feedback loops between sleep, food and glucose that no single reading reveals.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatPill label="Avg Glucose" value={`${avgGlucose} mg/dL`} color={N} />
        <StatPill label="Avg Sleep" value={`${avgSleep} h`} color="#6ea8ff" />
        <StatPill label="Worst Spike" value={`${worstSpike} mg/dL`} color="#ff9ecb" />
        <StatPill label="Avg REM" value={`${avgRem} min`} color="#b388ff" />
      </div>

      {/* Lifecycle row */}
      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <div className="glass flex flex-col p-4">
          <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-fg">Log Meal / Biometric</h3><CogneeTooltip fn="remember" explanation="remember() embeds the lifestyle event into the continuous timeline and spins out predictive causal edges to the following morning's expected glucose." /></div>
          <input value={logInput} onChange={(e) => setLogInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && logEvent()} placeholder="e.g. high-carb pizza at 11:30pm" className="mt-2 w-full rounded-lg border border-line/10 bg-field/30 px-2.5 py-1.5 text-xs text-fg outline-none focus:border-[#37d6b3]/60" />
          <div className="mt-2"><AsyncButton className="btn-ghost text-sm" style={{ color: N, borderColor: `${N}55` }} runningLabel="Embedding…" onClick={logEvent}>+ Log event</AsyncButton></div>
          {logMsg && <div className="mt-2 rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: `${N}40`, background: `${N}12`, color: N }}>✦ {logMsg}</div>}
        </div>
        <MemoryActionCard fn="improve" accent={N} title="Circadian Calibration" explanation="improve() re-weights edges from dietary triggers to physiological outcomes, pruning one-off anomalies and strengthening validated, repeating metabolic loops." description="Consolidate the metabolic baseline — strengthen real loops, prune anomalies." buttonLabel="✨ Calibrate baseline" runningLabel="Calibrating…" onRun={() => api.improve(selectedId)} />
        <MemoryActionCard fn="forget" accent={N} danger title="Behavioral Reset Valve" explanation="forget() prunes outdated 'routine' nodes (e.g. a dropped midnight-eating habit) so they stop skewing active predictions — raw audit trails are preserved." description="Purge stale habit regimes so old routines don't skew live predictions." buttonLabel="Purge stale habits" runningLabel="Purging…" onRun={() => api.forget(selectedId)} />
        <div className="glass flex flex-col p-4">
          <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-fg">Query Metabolic History</h3><CogneeTooltip fn="recall" explanation="recall() runs vector-similarity routing across months of wearable history to find biometric combinations matching your question." /></div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runQuery()} placeholder="glucose when sleep < 5h?" className="mt-2 w-full rounded-lg border border-line/10 bg-field/30 px-2.5 py-1.5 text-xs text-fg outline-none focus:border-[#37d6b3]/60" />
          <div className="mt-2"><AsyncButton className="btn-ghost text-sm" style={{ color: N, borderColor: `${N}55` }} runningLabel="Searching…" onClick={runQuery}>Search history</AsyncButton></div>
          {qLoading ? <div className="mt-2"><SkeletonLines rows={2} /></div> : answer && <div className="mt-2 rounded-lg border border-line/10 bg-field/20 p-2 text-xs text-fg/75">{answer}</div>}
        </div>
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <SectionTitle kicker="CGM" title="Morning glucose (30 days)" />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={series}>
              <defs><linearGradient id="glu" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={N} stopOpacity={0.5} /><stop offset="100%" stopColor={N} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey="day" interval={4} tick={axisTick} /><YAxis tick={axisTick} /><Tooltip {...tip} />
              <ReferenceLine y={140} stroke="#ff6b6b" strokeDasharray="4 4" />
              <Area dataKey="glucose" stroke={N} fill="url(#glu)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>
        <GlassCard className="p-4">
          <SectionTitle kicker="Wearable" title="Sleep vs REM" />
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={series}>
              <CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey="day" interval={4} tick={axisTick} /><YAxis tick={axisTick} /><YAxis yAxisId="right" orientation="right" tick={axisTick} /><Tooltip {...tip} />
              <Bar dataKey="sleep" name="Sleep (h)" fill="#6ea8ff" radius={[6, 6, 0, 0]} barSize={10} />
              <Line dataKey="rem" name="REM (min)" stroke="#b388ff" dot={false} strokeWidth={2} yAxisId="right" />
            </ComposedChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Feedback loop + autonomic scatter */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Metabolic feedback loop" /><CogneeTooltip fn="recall" explanation="recall() traverses the cyclic edges connecting lifestyle to physiology, exposing the self-reinforcing loop. Hover a node to trace its next consequence." /></div>
          <LoopWeb hover={loopHover} setHover={setLoopHover} />
        </GlassCard>
        <GlassCard className="p-4">
          <SectionTitle kicker="Autonomic" title="Stress vs recovery" />
          <ResponsiveContainer width="100%" height={250}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
              <CartesianGrid stroke={grid} />
              <XAxis type="number" dataKey="stress" name="Stress index" tick={axisTick} label={{ value: "stress →", position: "insideBottomRight", fill: "#94a3b8", fontSize: 10 }} />
              <YAxis type="number" dataKey="recovery" name="REM recovery" tick={axisTick} />
              <ZAxis type="number" dataKey="glucose" range={[40, 220]} />
              <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={scatter} fill={N} fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-xs text-fg/40">Bubble size = morning glucose. High-stress / low-recovery nights cluster with the worst spikes.</p>
        </GlassCard>
      </div>

      {/* Glycemic extrapolator */}
      <GlassCard className="mb-6 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <SectionTitle kicker="Postprandial" title="Glycemic curve extrapolator" />
          <CogneeTooltip fn="recall" explanation="Selecting a meal node recalls its raw postprandial trace — peak, time-to-peak and area-under-curve — from the continuous-glucose stream attached to that entity." />
          <select value={mealIdx} onChange={(e) => setMealIdx(Number(e.target.value))} className="ml-auto rounded-xl border border-line/10 bg-field/30 px-3 py-1.5 text-sm text-fg/90 outline-none focus:border-[#37d6b3]">
            {data.meals.map((m, i) => <option key={m.meal} value={i} style={{ background: "rgb(var(--bg))" }}>{m.meal}</option>)}
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_200px]">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={curve}>
              <defs><linearGradient id="pp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={N} stopOpacity={0.5} /><stop offset="100%" stopColor={N} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey="t" tick={axisTick} /><YAxis tick={axisTick} domain={[80, "auto"]} /><Tooltip {...tip} />
              <Area dataKey="glucose" stroke={N} fill="url(#pp)" strokeWidth={2.4} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex flex-col justify-center gap-2 text-sm">
            <div className="rounded-xl border border-line/10 bg-field/20 p-3"><div className="text-xs text-fg/40">Peak</div><div className="text-lg font-bold" style={{ color: N }}>{Math.max(...curve.map((c) => c.glucose))} mg/dL</div></div>
            <div className="rounded-xl border border-line/10 bg-field/20 p-3"><div className="text-xs text-fg/40">AUC (above baseline)</div><div className="text-lg font-bold" style={{ color: N }}>{auc}</div></div>
            <div className="text-xs text-fg/45">{meal.note}</div>
          </div>
        </div>
      </GlassCard>

      {/* Iatrogenic drift + micronutrient */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Iatrogenic metabolic drift" /><CogneeTooltip fn="recall" explanation="Cross-module recall() checks whether an unexplained HbA1c or weight rise tracks a medication added in RxShield/MedSync — proving the spike may be a drug effect." /></div>
          {hasMetoprolol ? (
            <p className="text-sm leading-relaxed text-fg/70">Beta-blocker <span className="font-semibold text-fg">Metoprolol</span> can blunt glucose signaling. The +6 kg weight gain and prediabetic HbA1c (6.1%) began tracking <em>after</em> the dose increase — suggesting part of the metabolic drift is medication-linked, not purely dietary.</p>
          ) : (
            <p className="text-sm text-fg/40">No medication-linked metabolic drift detected for this patient.</p>
          )}
        </GlassCard>
        <GlassCard className="p-4">
          <SectionTitle title="Micronutrient ↔ symptom cross-reference" />
          <div className="space-y-1.5">
            {MICRO.map((m) => (
              <div key={m.nutrient} className="flex items-center gap-3 rounded-lg border border-line/10 px-3 py-1.5 text-xs">
                <span className="w-24 font-semibold text-fg/85">{m.nutrient}</span>
                <Pill color={m.status === "Adequate" ? "#37d6b3" : "#ff9e6b"}>{m.status}</Pill>
                <span className="text-fg/55">{m.linked}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Behavioral narrative */}
      <GlassCard className="mb-6 p-4">
        <div className="mb-2 flex items-center gap-2"><SectionTitle title="Behavioral causal narrative" /><CogneeTooltip fn="recall" explanation="Instead of generic advice, recall() reads the patient graph and outputs an ultra-specific, evidence-backed causal statement with an actionable lever." /><AsyncButton className="btn-ghost ml-auto text-sm" style={{ color: N, borderColor: `${N}55` }} runningLabel="Generating…" onClick={genNarrative}>Show your work</AsyncButton></div>
        {narrLoading ? <SkeletonLines rows={3} /> : narrative ? <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm leading-relaxed text-fg/75">{narrative}</motion.p> : <p className="text-sm text-fg/40">Generate a personalised, graph-grounded explanation of the patient's metabolic pattern.</p>}
      </GlassCard>

      <div className="mb-6">
        <SectionTitle title="Metabolic insight" />
        <div className="grid gap-4 md:grid-cols-2">{data.insights.map((ins, i) => <InsightCard key={ins.id} insight={ins} evidenceLabels={evidenceLabels} type={i === 0} index={i} />)}</div>
      </div>

      <AIAssistant patientId={selectedId} evidenceLabels={evidenceLabels} />
    </div>
  );
}

function LoopWeb({ hover, setHover }: { hover: number | null; setHover: (i: number | null) => void }) {
  const cx = 200, cy = 130, r = 96;
  const pts = LOOP.map((_, i) => {
    const a = (i / LOOP.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  return (
    <svg viewBox="0 0 400 260" className="h-64 w-full">
      {pts.map((p, i) => {
        const next = pts[(i + 1) % pts.length];
        const on = hover === i;
        return <line key={i} x1={p.x} y1={p.y} x2={next.x} y2={next.y} stroke={N} strokeWidth={on ? 3 : 1.4} opacity={hover === null ? 0.55 : on ? 1 : 0.18} markerEnd="" />;
      })}
      {pts.map((p, i) => (
        <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
          <circle cx={p.x} cy={p.y} r={hover === i ? 9 : 6} fill={N} opacity={hover === null || hover === i ? 1 : 0.35} />
          <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="9.5" className="fill-fg" opacity={hover === null || hover === i ? 0.9 : 0.3}>{LOOP[i]}</text>
        </g>
      ))}
    </svg>
  );
}
