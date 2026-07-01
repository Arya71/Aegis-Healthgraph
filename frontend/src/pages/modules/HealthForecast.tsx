/**
 * HealthForecast — Predictive Risk & Progression Engine (Module 8)
 *
 * Features implemented (per 09_HealthForecast.md):
 *  1. Chronic Disease Progression Sandbox — lifestyle-lever simulation, calls
 *     the REAL api improve() endpoint (via backend's healthforecast.py
 *     sandbox route) so the simulation genuinely reweights the Cognee graph.
 *  2. Cross-System Failure Sentinel — recall()-powered cascade risk query
 *     across organ-system sub-graphs, with an explainable risk-chain diagram.
 *  3. Preventative Intervention Ranker — scored/ranked table of lifestyle,
 *     diagnostic, or medication levers by projected graph-risk reduction.
 *  4. Lifelong Baseline Trajectory Visualizer — patient trend vs. optimal
 *     healthy-aging baseline, 5-year projection, divergence highlighted.
 *
 * Plus: Gemini 2.5 Flash predictive narrative generation (reuses OmniGest's
 * Gemini wiring server-side), Cognee tooltips on every recall()/improve()
 * powered feature, and full integration with the standard module data flow
 * (useModuleData, AIAssistant, InsightCard) so it feels like a natural
 * evolution of the platform rather than a bolted-on page.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import ModuleHeader from "../../components/ModuleHeader";
import { GlassCard, Pill, SectionTitle, Spinner, StatPill, Typewriter } from "../../components/ui";
import AsyncButton from "../../components/cognee/AsyncButton";
import CogneeTooltip from "../../components/cognee/CogneeTooltip";
import { SkeletonLines } from "../../components/cognee/Skeleton";
import { api } from "../../lib/api";
import { usePatients } from "../../lib/PatientContext";
import { useModuleData, usePatientData } from "../../lib/usePatientData";
import type {
  HealthForecastPayload, SandboxResult, SentinelResult,
} from "../../lib/types";

// ─── colour tokens (per PRD: vibrant orange + electric green) ───────────────
const ORANGE = "#ffb86b";
const GREEN = "#37d6b3";
const grid = "rgba(148,163,184,0.22)";
const axisTick = { fill: "#94a3b8", fontSize: 11 };
const tip = {
  contentStyle: { background: "#0b1022", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e8ecf8" },
};

function riskColor(risk: number): string {
  if (risk >= 60) return "#f87171";
  if (risk >= 35) return ORANGE;
  return GREEN;
}

// ─── Feature 1: Chronic Disease Progression Sandbox ──────────────────────────
function ProgressionSandbox({
  patientId, leverCatalog, onResult,
}: {
  patientId: string;
  leverCatalog: HealthForecastPayload["leverCatalog"];
  onResult: (r: SandboxResult) => void;
}) {
  const [magnitudes, setMagnitudes] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function setLever(key: string, value: number) {
    setMagnitudes((m) => ({ ...m, [key]: value }));
  }

  async function runSimulation() {
    const active = Object.fromEntries(Object.entries(magnitudes).filter(([, v]) => v > 0));
    if (Object.keys(active).length === 0) {
      setMsg("Adjust at least one lever above zero to run a simulation.");
      setTimeout(() => setMsg(null), 4000);
      return;
    }
    setRunning(true);
    try {
      const result = await api.forecastSandbox(patientId, active);
      onResult(result);
      setMsg(result.improve_result.message);
      setTimeout(() => setMsg((m) => (m === result.improve_result.message ? null : m)), 8000);
    } finally {
      setRunning(false);
    }
  }

  return (
    <GlassCard className="p-4">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-bold text-fg">Chronic Disease Progression Sandbox</h3>
        <CogneeTooltip
          fn="improve"
          explanation="🧠 Powered by Cognee improve(): Executes graph-weighting simulations to project future health outcomes, allowing clinicians to test how changing lifestyle variables impact long-term disease risk."
        />
      </div>
      <p className="mb-3 text-xs text-fg/50">
        Adjust hypothetical lifestyle variables, then run the simulation — this calls the real
        improve() endpoint and genuinely re-weights this patient's Cognee graph edges.
      </p>

      <div className="space-y-3">
        {leverCatalog.map((lever) => {
          const v = magnitudes[lever.key] ?? 0;
          return (
            <div key={lever.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-fg/80">{lever.label}</span>
                <span className="tabular-nums text-fg/40">
                  {v === 0 ? "no change" : `${(v * 100).toFixed(0)}% intensity`}
                </span>
              </div>
              <input
                type="range" min={0} max={2} step={0.1} value={v}
                onChange={(e) => setLever(lever.key, Number(e.target.value))}
                className="mt-1 w-full"
                style={{ accentColor: ORANGE }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <AsyncButton
          runningLabel="Simulating…"
          className="btn-ghost text-sm"
          style={{ color: ORANGE, borderColor: `${ORANGE}55` }}
          onClick={runSimulation}
        >
          ✨ Run progression simulation
        </AsyncButton>
      </div>

      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed"
              style={{ borderColor: `${ORANGE}40`, background: `${ORANGE}12`, color: ORANGE }}>
              ✦ {msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

function SandboxResultsPanel({ result }: { result: SandboxResult }) {
  const chartData = useMemo(() => {
    const years = ["Y1", "Y2", "Y3", "Y4", "Y5"];
    return years.map((year, i) => {
      const row: Record<string, number | string> = { year };
      result.baseline_5yr.forEach((b) => { row[`${b.key}_base`] = b.curve[i]; });
      result.projected_5yr.forEach((p) => { row[`${p.key}_proj`] = p.curve[i]; });
      return row;
    });
  }, [result]);

  const topImprovement = useMemo(
    () => [...result.delta_summary].sort((a, b) => a.year5_delta - b.year5_delta)[0],
    [result],
  );

  return (
    <GlassCard className="p-4">
      <SectionTitle kicker="Simulation result" title="5-year projected risk, baseline vs. simulated" />
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="year" tick={axisTick} />
          <YAxis tick={axisTick} domain={[0, 100]} />
          <Tooltip {...tip} />
          {result.baseline_5yr.map((b, i) => (
            <Line key={`${b.key}_base`} dataKey={`${b.key}_base`} name={`${b.condition} (no change)`}
              stroke="#6b7280" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
          ))}
          {result.projected_5yr.map((p) => (
            <Line key={`${p.key}_proj`} dataKey={`${p.key}_proj`} name={`${p.condition} (simulated)`}
              stroke={ORANGE} strokeWidth={2.4} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {topImprovement && (
        <div className="mt-3 rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: `${GREEN}40`, background: `${GREEN}12`, color: GREEN }}>
          Largest projected improvement: <span className="font-bold">{topImprovement.condition}</span> —
          5-year risk reduced from {topImprovement.year5_baseline}% to {topImprovement.year5_projected}%
          ({topImprovement.year5_delta}pp)
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {result.delta_summary.map((d) => (
          <div key={d.key} className="flex items-center justify-between rounded-lg border border-line/10 px-3 py-2 text-xs">
            <span className="font-medium text-fg/80">{d.condition}</span>
            <span className="tabular-nums" style={{ color: d.year5_delta < 0 ? GREEN : "#f87171" }}>
              {d.year5_baseline}% → {d.year5_projected}% ({d.year5_delta > 0 ? "+" : ""}{d.year5_delta}pp)
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ─── Feature 2: Cross-System Failure Sentinel ────────────────────────────────
function RiskChainDiagram({ chain }: { chain: SentinelResult["risk_chain"] }) {
  if (!chain.length) {
    return <p className="text-sm text-fg/40">No plausible cross-system cascade detected currently.</p>;
  }
  return (
    <div className="space-y-3">
      {chain.map((link, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-line/10 bg-field/20 p-3">
          <div className="flex flex-col items-center gap-1">
            <span className="rounded-full px-2 py-1 text-xs font-bold"
              style={{ background: `${riskColor(link.from_risk)}22`, color: riskColor(link.from_risk) }}>
              {link.from}
            </span>
            <span className="text-[10px] text-fg/40">{link.from_risk}% risk</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-lg" style={{ color: ORANGE }}>→</span>
            <span className="text-center text-[11px] leading-snug text-fg/50">{link.mechanism}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="rounded-full px-2 py-1 text-xs font-bold"
              style={{ background: `${riskColor(link.to_risk)}22`, color: riskColor(link.to_risk) }}>
              {link.to}
            </span>
            <span className="text-[10px] text-fg/40">{link.to_risk}% risk</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FailureSentinel({ patientId }: { patientId: string }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SentinelResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runSentinel() {
    setLoading(true);
    try {
      const r = await api.forecastSentinel(patientId, query.trim() || undefined);
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassCard className="p-4">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-bold text-fg">Cross-System Failure Sentinel</h3>
        <CogneeTooltip
          fn="recall"
          explanation="🧠 Powered by Cognee recall(): Traverses multi-system graph edges to detect hidden physiological failure cascades — predicting clinical outcomes based on structural history, not just current symptoms."
        />
      </div>
      <p className="mb-3 text-xs text-fg/50">
        Ask a cross-system question, or run the default sentinel sweep across every organ-system
        sub-graph for concurrent stress patterns.
      </p>

      <div className="flex gap-2">
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSentinel()}
          placeholder="e.g. If renal stress continues, what's the cardiovascular probability?"
          className="flex-1 rounded-lg border border-line/10 bg-field/30 px-2.5 py-1.5 text-xs text-fg outline-none focus:border-[#ffb86b]/60"
        />
        <AsyncButton runningLabel="Scanning…" className="btn-ghost text-sm shrink-0"
          style={{ color: ORANGE, borderColor: `${ORANGE}55` }} onClick={runSentinel}>
          Run sentinel
        </AsyncButton>
      </div>

      {loading ? (
        <div className="mt-4"><SkeletonLines rows={3} /></div>
      ) : result ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4">
          <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm leading-relaxed"
            style={{ borderColor: `${ORANGE}30`, background: `${ORANGE}0a` }}>
            <span className="mt-0.5 shrink-0" style={{ color: ORANGE }}>⚠</span>
            <span className="text-fg/85"><Typewriter text={result.answer} speed={10} /></span>
          </div>
          <div className="flex items-center gap-2 text-xs text-fg/40">
            confidence {result.confidence}% · source: {result.source}
          </div>
          <RiskChainDiagram chain={result.risk_chain} />
        </motion.div>
      ) : (
        <p className="mt-4 text-sm text-fg/40">Run the sentinel to surface cross-system risk cascades.</p>
      )}
    </GlassCard>
  );
}

// ─── Feature 3: Preventative Intervention Ranker ─────────────────────────────
function InterventionRanker({ ranking }: { ranking: HealthForecastPayload["interventionRanking"] }) {
  const max = Math.max(...ranking.map((r) => r.estimated_risk_reduction), 1);
  return (
    <GlassCard className="p-4">
      <div className="mb-1 flex items-center gap-2">
        <SectionTitle title="Preventative Intervention Ranker" />
        <CogneeTooltip
          fn="recall"
          explanation="Each lever's projected impact is computed from the current weighted risk of every condition it affects in this patient's graph — not a generic population average."
        />
      </div>
      <div className="space-y-2.5">
        {ranking.map((r, i) => (
          <div key={r.lever} className="rounded-xl border border-line/10 bg-field/20 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: i === 0 ? `${GREEN}22` : "rgba(148,163,184,0.12)", color: i === 0 ? GREEN : "#94a3b8" }}>
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-fg">{r.label}</span>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: GREEN }}>
                −{r.estimated_risk_reduction.toFixed(1)} pts
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface/10">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${(r.estimated_risk_reduction / max) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.05 }}
                className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${GREEN}, ${ORANGE})` }}
              />
            </div>
            {r.affected_conditions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.affected_conditions.map((c) => <Pill key={c} color={ORANGE}>{c}</Pill>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ─── Feature 4: Lifelong Baseline Trajectory Visualizer ──────────────────────
function TrajectoryVisualizer({ trajectory }: { trajectory: HealthForecastPayload["trajectory"] }) {
  if (!trajectory.length) {
    return (
      <GlassCard className="p-4">
        <SectionTitle title="Lifelong Baseline Trajectory" />
        <p className="text-sm text-fg/40">Insufficient graph data to project a trajectory yet.</p>
      </GlassCard>
    );
  }
  const finalDivergence = trajectory[trajectory.length - 1].divergence;
  return (
    <GlassCard className="p-4">
      <div className="mb-1 flex items-center gap-2">
        <SectionTitle kicker="Trend vs. Target" title="Lifelong Baseline Trajectory" />
        <Pill color={finalDivergence > 15 ? "#f87171" : finalDivergence > 5 ? ORANGE : GREEN}>
          {finalDivergence > 0 ? "+" : ""}{finalDivergence}pp divergence by Year 5
        </Pill>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={trajectory}>
          <defs>
            <linearGradient id="patientArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ORANGE} stopOpacity={0.45} />
              <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="year" tick={axisTick} />
          <YAxis tick={axisTick} domain={[0, 100]} />
          <Tooltip {...tip} />
          <Area dataKey="baseline" name="Optimal healthy-aging baseline" stroke={GREEN} strokeDasharray="5 5"
            fill="none" strokeWidth={2} dot={false} />
          <Area dataKey="patient" name="Patient's actual trajectory" stroke={ORANGE}
            fill="url(#patientArea)" strokeWidth={2.6} dot={{ r: 3, fill: ORANGE }} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-fg/40">
        Dashed green = optimal healthy-aging baseline. Solid orange = this patient's projected graph-risk
        trajectory based on current structural signal density.
      </p>
    </GlassCard>
  );
}

// ─── Gemini predictive narrative ─────────────────────────────────────────────
function PredictiveNarrative({ patientId, topCondition }: { patientId: string; topCondition?: string }) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const r = await api.forecastNarrative(patientId, topCondition);
      setNarrative(r.narrative);
      setSource(r.source);
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassCard className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <SectionTitle title="Predictive narrative" />
        <span className="chip" style={{ borderColor: `${ORANGE}55`, color: ORANGE }}>✦ Gemini 2.5 Flash</span>
        <AsyncButton className="btn-ghost ml-auto text-sm" style={{ color: ORANGE, borderColor: `${ORANGE}55` }}
          runningLabel="Generating…" onClick={generate}>
          Generate forecast
        </AsyncButton>
      </div>
      {loading ? (
        <SkeletonLines rows={3} />
      ) : narrative ? (
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm leading-relaxed text-fg/75">
            {narrative}
          </motion.p>
          {source === "template-fallback" && (
            <p className="mt-2 text-[11px] text-fg/30">
              (Deterministic fallback — set GEMINI_API_KEY for live narrative generation)
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-fg/40">
          Generate a plain-language clinical forecast narrative for this patient's highest structural risk.
        </p>
      )}
    </GlassCard>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function HealthForecast() {
  const { selectedId } = usePatients();
  const { evidenceLabels, loading: gLoading } = usePatientData(selectedId);
  const { data, loading } = useModuleData<HealthForecastPayload>(selectedId, "healthforecast");
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null);

  if (loading || gLoading || !data) return <Spinner label="Synthesizing predictive graph density…" />;

  const topRisk = data.conditionRisks[0];

  return (
    <div>
      <ModuleHeader module="healthforecast" />
      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        HealthForecast is the Future Viewer of the Aegis ecosystem — it doesn't add new clinical
        data, it reads the accumulated density of everything the other modules (including OmniGest)
        have already committed, and projects where this patient's health is structurally heading.
      </p>

      {/* top-line risk stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {data.conditionRisks.slice(0, 5).map((r) => (
          <StatPill key={r.key} label={r.label} value={`${r.risk}%`} color={riskColor(r.risk)} />
        ))}
      </div>

      {/* Feature 4: trajectory visualizer — headline chart */}
      <div className="mb-6">
        <TrajectoryVisualizer trajectory={data.trajectory} />
      </div>

      {/* Feature 1 + sandbox results */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <ProgressionSandbox
          patientId={selectedId}
          leverCatalog={data.leverCatalog}
          onResult={setSandboxResult}
        />
        {sandboxResult ? (
          <SandboxResultsPanel result={sandboxResult} />
        ) : (
          <GlassCard className="flex items-center justify-center p-4 text-center text-sm text-fg/35">
            Run a simulation to see the 5-year projected impact here.
          </GlassCard>
        )}
      </div>

      {/* Feature 2: cross-system sentinel */}
      <div className="mb-6">
        <FailureSentinel patientId={selectedId} />
      </div>

      {/* Feature 3: intervention ranker */}
      <div className="mb-6">
        <InterventionRanker ranking={data.interventionRanking} />
      </div>

      {/* Gemini narrative */}
      <div className="mb-6">
        <PredictiveNarrative patientId={selectedId} topCondition={topRisk?.key} />
      </div>

      {data.insights.length > 0 && (
        <div className="mb-6">
          <SectionTitle title="Forecast insight" />
          <div className="grid gap-4 md:grid-cols-2">
            {data.insights.map((ins, i) => (
              <InsightCard key={ins.id} insight={ins} evidenceLabels={evidenceLabels} type={i === 0} index={i} />
            ))}
          </div>
        </div>
      )}

      <AIAssistant patientId={selectedId} evidenceLabels={evidenceLabels} />
    </div>
  );
}
