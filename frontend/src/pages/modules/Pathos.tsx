import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bar, BarChart, CartesianGrid, LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import ModuleHeader from "../../components/ModuleHeader";
import { ConfidenceMeter, GlassCard, SectionTitle, Spinner, Typewriter } from "../../components/ui";
import AsyncButton from "../../components/cognee/AsyncButton";
import CogneeTooltip from "../../components/cognee/CogneeTooltip";
import MemoryActionCard from "../../components/cognee/MemoryActionCard";
import { SkeletonLines } from "../../components/cognee/Skeleton";
import { api } from "../../lib/api";
import { usePatients } from "../../lib/PatientContext";
import { useModuleData, usePatientData } from "../../lib/usePatientData";
import type { Insight, PatientEvent } from "../../lib/types";

const P = "#ffb86b";
const grid = "rgba(148,163,184,0.22)";
const axisTick = { fill: "#94a3b8", fontSize: 11 };
const tip = { contentStyle: { background: "#0b1022", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e8ecf8" } };

interface Trigger { trigger: string; weight: number }
interface Payload { weeks: string[]; mood: number[]; anxiety: number[]; triggers: Trigger[]; entries: PatientEvent[]; insights: Insight[]; meta: unknown }

const DISTORTIONS = [
  { name: "Catastrophizing", count: 9 },
  { name: "All-or-nothing", count: 6 },
  { name: "Emotional reasoning", count: 5 },
  { name: "Mind reading", count: 3 },
  { name: "Overgeneralizing", count: 2 },
];
const CBT = [
  { task: "Daily thought records", done: true },
  { task: "Sunday-evening wind-down routine", done: true },
  { task: "Exposure: present at team review", done: false },
  { task: "Sleep-hygiene log", done: true },
];
const HOURS = Array.from({ length: 24 }, (_, h) => {
  const evening = h >= 18 && h <= 22 ? 0.7 : 0;
  const morning = h >= 6 && h <= 9 ? 0.25 : 0;
  return Math.min(1, 0.12 + evening + morning + 0.08 * Math.sin(h / 2));
});

export default function Pathos() {
  const { selectedId } = usePatients();
  const { evidenceLabels, loading: gLoading } = usePatientData(selectedId);
  const { data, loading } = useModuleData<Payload>(selectedId, "pathos");

  const [journal, setJournal] = useState("");
  const [journalMsg, setJournalMsg] = useState<string | null>(null);
  const [schema, setSchema] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [clockHour, setClockHour] = useState<number | null>(null);

  if (loading || gLoading || !data) return <Spinner />;

  const series = data.weeks.map((week, i) => ({ week, mood: data.mood[i], anxiety: data.anxiety[i] }));
  const userEntries = data.entries.slice(0, 2);
  const rationale = data.insights[0]?.body ?? "I track your patterns across sessions.";

  async function logJournal() {
    if (!journal.trim()) return;
    await api.remember(selectedId, journal.trim(), "mental");
    setJournalMsg("Entry embedded — new mental node linked to your historical anxiety themes.");
    setJournal("");
    setTimeout(() => setJournalMsg((m) => (m && m.startsWith("Entry") ? null : m)), 7000);
  }
  async function findSchema() {
    setSchemaLoading(true); setSchema(null);
    try { setSchema((await api.recall(selectedId, "What are this patient's long-term recurring stress themes?")).answer); }
    finally { setSchemaLoading(false); }
  }

  return (
    <div>
      <ModuleHeader module="pathos" />
      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        Pathos remembers years of emotional context, so it sees patterns instead of starting every
        conversation from zero.
      </p>

      {/* Companion + mood chart */}
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Memory-aware companion" /><CogneeTooltip fn="recall" explanation="Every reply is grounded by recall() over the journal graph, so the companion references real prior sessions instead of producing generic chatbot text." /></div>
          <div className="mt-1 flex flex-col gap-3">
            {userEntries.map((e) => (
              <div key={e.id} className="max-w-[80%] self-end rounded-2xl border border-[#ffb86b]/30 bg-[#ffb86b]/15 px-3 py-2 text-sm text-fg">{e.detail}</div>
            ))}
            <div className="max-w-[88%] self-start rounded-2xl border border-line/10 bg-surface/5 px-3 py-2 text-sm text-fg/85">
              <div className="mb-1 text-xs text-[#ffb86b]">🫀 Pathos · graph-aware</div>
              <Typewriter text={rationale} />
            </div>
            <div className="self-start rounded-xl border border-[#ffb86b]/30 bg-[#ffb86b]/8 px-3 py-2 text-xs text-fg/70">
              <span className="font-semibold" style={{ color: P }}>Show your work: </span>
              This is the third Sunday evening this month where anxiety followed work-related thoughts — the same cluster seen before quarterly reviews.
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <SectionTitle kicker="8 weeks" title="Mood & anxiety" />
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={series}>
              <CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey="week" tick={axisTick} /><YAxis domain={[0, 10]} tick={axisTick} /><Tooltip {...tip} />
              <Line dataKey="mood" stroke="#37d6b3" strokeWidth={2} dot={false} name="Mood" />
              <Line dataKey="anxiety" stroke="#ff7eb6" strokeWidth={2} dot={false} name="Anxiety" />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Lifecycle row */}
      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <div className="glass flex flex-col p-4">
          <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-fg">Log Session Journal</h3><CogneeTooltip fn="remember" explanation="remember() nests the new journal/transcript node into the timeline and auto-links it to historical anxiety themes by semantic similarity." /></div>
          <textarea value={journal} onChange={(e) => setJournal(e.target.value)} rows={2} placeholder="e.g. extreme panic about the upcoming review" className="mt-2 w-full resize-none rounded-lg border border-line/10 bg-field/30 px-2.5 py-1.5 text-xs text-fg outline-none focus:border-[#ffb86b]/60" />
          <div className="mt-2"><AsyncButton className="btn-ghost text-sm" style={{ color: P, borderColor: `${P}55` }} runningLabel="Embedding…" onClick={logJournal}>+ Log entry</AsyncButton></div>
          {journalMsg && <div className="mt-2 rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: `${P}40`, background: `${P}12`, color: P }}>✦ {journalMsg}</div>}
        </div>
        <MemoryActionCard fn="improve" accent={P} title="Optimize Behavioral Models" explanation="improve() re-weights trigger nodes (Sunday evening, work feedback), pruning transient spikes and cementing structural, recurring psychological patterns." description="Re-weight triggers — prune transient spikes, cement recurring patterns." buttonLabel="✨ Optimize triggers" runningLabel="Optimizing…" onRun={() => api.improve(selectedId)} />
        <MemoryActionCard fn="forget" accent={P} danger title="Desensitize Memory Node" explanation="forget() disconnects a raw trauma trigger from active prediction algorithms — modelling CBT trauma resolution — without deleting the underlying clinical record." description="Shift a processed trauma out of acute-trigger status (CBT desensitisation)." buttonLabel="Archive trigger node" runningLabel="Archiving…" onRun={() => api.forget(selectedId)} />
        <div className="glass flex flex-col p-4">
          <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-fg">Cross-Session Recall</h3><CogneeTooltip fn="recall" explanation="recall() bypasses surface vocabulary using vector-similarity graph routing to retrieve recurring emotional loops over years of journals." /></div>
          <p className="mt-1 flex-1 text-xs text-fg/50">Surface long-term recurring stress themes.</p>
          <div className="mt-2"><AsyncButton className="btn-ghost text-sm" style={{ color: P, borderColor: `${P}55` }} runningLabel="Recalling…" onClick={findSchema}>Find recurring schemas</AsyncButton></div>
          {schemaLoading ? <div className="mt-2"><SkeletonLines rows={2} /></div> : schema && <div className="mt-2 rounded-lg border border-line/10 bg-field/20 p-2 text-xs text-fg/75">{schema}</div>}
        </div>
      </div>

      {/* Circadian clock + distortion matrix */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Circadian mood variance clock" /><CogneeTooltip fn="recall" explanation="recall() maps timestamps from journals, mood sliders and wearables onto a 24-hour dial, revealing when the patient is most vulnerable to acute stress." /></div>
          <MoodClock hour={clockHour} setHour={setClockHour} />
          <p className="text-center text-xs text-fg/45">{clockHour === null ? "Hover the dial — intensity peaks in the Sunday-evening window (18:00–22:00)." : `${String(clockHour).padStart(2, "0")}:00 — intensity ${Math.round(HOURS[clockHour] * 100)}%`}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Cognitive distortion matrix" /><CogneeTooltip fn="recall" explanation="Entity tags extracted from journal entries are classified into CBT distortion categories, so clinicians can target the dominant thought biases." /></div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={DISTORTIONS} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid stroke={grid} horizontal={false} /><XAxis type="number" tick={axisTick} /><YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} width={110} /><Tooltip {...tip} />
              <Bar dataKey="count" fill={P} radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Mind-body heatmap + iatrogenic + CBT */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Mind-body synergy" /><CogneeTooltip fn="recall" explanation="Cross-module recall() intersects Pathos nodes with NutriSim and Curie, drawing the chain from emotional spikes to physical consequences." /></div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="chip" style={{ borderColor: `${P}55`, color: P }}>Sunday anxiety</span>
            <span className="text-fg/40">→</span>
            <span className="chip" style={{ borderColor: "#6ea8ff55", color: "#6ea8ff" }}>Sleep fragmentation</span>
            <span className="text-fg/40">→</span>
            <span className="chip" style={{ borderColor: "#37d6b355", color: "#37d6b3" }}>Monday glucose spike</span>
          </div>
          <p className="mt-3 text-xs text-fg/55">Emotional load doesn't stay emotional — the same Sunday-evening cluster precedes worse REM and a measurable Monday-morning glucose rise.</p>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Iatrogenic psychological shift" /><CogneeTooltip fn="recall" explanation="Cross-references the timeline with RxShield/MedSync to test whether a mood dip aligns with a new physical-health medication (e.g. beta-blockers and low mood)." /></div>
          <div className="rounded-xl border border-[#ff9e6b]/40 bg-[#ff9e6b]/10 p-3 text-sm text-fg/75">
            ⚠ Baseline mood dipped in the weeks following the <span className="font-semibold text-fg">Metoprolol</span> increase. Beta-blockers can contribute to secondary low mood — worth distinguishing from situational anxiety before escalating psychiatric treatment.
          </div>
        </GlassCard>
      </div>

      <GlassCard className="mb-6 p-4">
        <div className="mb-2 flex items-center gap-2"><SectionTitle title="CBT progress & homework compliance" /><CogneeTooltip fn="recall" explanation="recall() checks whether assigned behavioural tasks reappear as semantic topics in later journal entries — an objective measure of therapeutic engagement." /></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {CBT.map((c) => (
            <div key={c.task} className="flex items-center gap-2.5 rounded-lg border border-line/10 px-3 py-2 text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs" style={{ background: c.done ? `${P}22` : "rgba(148,163,184,0.12)", color: c.done ? P : "#94a3b8" }}>{c.done ? "✓" : "—"}</span>
              <span className={c.done ? "text-fg/85" : "text-fg/45"}>{c.task}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Triggers */}
      <GlassCard className="mb-6 p-4">
        <SectionTitle kicker="Triggers" title="What precedes the spikes" />
        <div className="mt-3 space-y-2">
          {data.triggers.map((t, i) => (
            <motion.div key={t.trigger} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center gap-3">
              <span className="w-48 shrink-0 text-sm text-fg/80">{t.trigger}</span>
              <ConfidenceMeter value={Math.round(t.weight * 100)} color={P} />
            </motion.div>
          ))}
        </div>
      </GlassCard>

      <div className="mb-6">
        <SectionTitle title="Weekly insight" />
        <div className="grid gap-4 md:grid-cols-2">{data.insights.map((ins, i) => <InsightCard key={ins.id} insight={ins} evidenceLabels={evidenceLabels} type={i === 0} index={i} />)}</div>
      </div>

      <AIAssistant patientId={selectedId} evidenceLabels={evidenceLabels} />
    </div>
  );
}

function MoodClock({ hour, setHour }: { hour: number | null; setHour: (h: number | null) => void }) {
  const cx = 150, cy = 140, r = 96;
  return (
    <svg viewBox="0 0 300 260" className="mx-auto h-60">
      <circle cx={cx} cy={cy} r={r + 16} fill="none" stroke="rgba(148,163,184,0.15)" />
      {HOURS.map((intensity, h) => {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        const on = hour === h;
        return (
          <g key={h} onMouseEnter={() => setHour(h)} onMouseLeave={() => setHour(null)} style={{ cursor: "pointer" }}>
            <circle cx={x} cy={y} r={on ? 12 : 6 + intensity * 6} fill={P} opacity={0.25 + intensity * 0.75} />
            {h % 6 === 0 && <text x={cx + (r + 24) * Math.cos(a)} y={cy + (r + 24) * Math.sin(a) + 3} textAnchor="middle" fontSize="10" className="fill-fg" opacity={0.5}>{String(h).padStart(2, "0")}</text>}
          </g>
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" className="fill-fg" opacity={0.5}>24-hour</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" className="fill-fg" opacity={0.5}>mood variance</text>
    </svg>
  );
}
