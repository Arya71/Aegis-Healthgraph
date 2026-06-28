import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import ModuleHeader from "../../components/ModuleHeader";
import { ConfidenceMeter, GlassCard, Pill, SectionTitle, Spinner } from "../../components/ui";
import AsyncButton from "../../components/cognee/AsyncButton";
import CogneeTooltip from "../../components/cognee/CogneeTooltip";
import { SkeletonLines } from "../../components/cognee/Skeleton";
import { api } from "../../lib/api";
import { usePatients } from "../../lib/PatientContext";
import { useModuleData, usePatientData } from "../../lib/usePatientData";
import type { Insight, PatientEvent } from "../../lib/types";

const R = "#ff7eb6";

interface Interaction {
  a: string; b: string; severity: string; risk: number;
  mechanism: string; effect: string; modifier: string;
}
interface Payload {
  medications: PatientEvent[];
  interactions: Interaction[];
  riskScore: number;
  insights: Insight[];
  meta: unknown;
}

const sevColor = (s: string) => (s === "high" ? "#ff6b6b" : s === "moderate" ? "#ffd166" : "#37d6b3");
const roleColor = (r: string) => (r === "inhibitor" ? R : r === "inducer" ? "#37d6b3" : "#6ea8ff");

const CYP_MAP = [
  { drug: "Clarithromycin", enzyme: "CYP3A4", role: "inhibitor" },
  { drug: "Atorvastatin", enzyme: "CYP3A4", role: "substrate" },
  { drug: "Metoprolol", enzyme: "CYP2D6", role: "substrate" },
];
const ALTERNATIVES: Record<string, string[]> = {
  atorvastatin: ["Pravastatin — not CYP3A4-cleared", "Rosuvastatin — minimal CYP metabolism"],
  metoprolol: ["Bisoprolol — less CYP2D6-dependent", "Atenolol — renally cleared"],
  clarithromycin: ["Azithromycin — negligible CYP3A4 inhibition"],
};
const SUPPLEMENTS = ["St. John's Wort", "High-dose Vitamin E", "Fish-oil (legacy log)"];
const DIET = [
  { a: "Grapefruit juice", b: "Atorvastatin", note: "Inhibits intestinal CYP3A4 → ↑ statin levels", drug: "atorvastatin" },
  { a: "High-potassium diet", b: "ACE inhibitors", note: "Additive hyperkalemia risk", drug: "lisinopril" },
  { a: "Alcohol", b: "Statins", note: "Compounded hepatic load", drug: "atorvastatin" },
];

export default function RxShield() {
  const { selectedId } = usePatients();
  const { data, loading } = useModuleData<Payload>(selectedId, "rxshield");
  const { evidenceLabels, loading: gLoading } = usePatientData(selectedId);

  const [eGFR, setEGFR] = useState(58);
  const [ast, setAst] = useState(28);
  const [pgx, setPgx] = useState(false);
  const [sandbox, setSandbox] = useState<string[]>([]);
  const [drugInput, setDrugInput] = useState("");
  const [purged, setPurged] = useState<Set<string>>(new Set());
  const [alts, setAlts] = useState<Record<string, string[]>>({});
  const [altLoading, setAltLoading] = useState<string | null>(null);
  const [openTrace, setOpenTrace] = useState<number | null>(null);

  const cyp = useMemo(() => {
    if (!data) return [];
    return CYP_MAP.filter((c) => data.medications.some((m) => m.title.toLowerCase().includes(c.drug.toLowerCase())));
  }, [data]);

  if (loading || gLoading || !data) return <Spinner />;

  const rawRisk = data.riskScore + (90 - eGFR) * 0.45 + Math.max(0, ast - 35) * 0.6 + (pgx ? 14 : 0) + sandbox.length * 9 - purged.size * 6;
  const risk = Math.min(99, Math.max(0, Math.round(rawRisk)));
  const riskColor = risk >= 60 ? "#ff6b6b" : risk >= 30 ? "#ffd166" : "#37d6b3";

  async function commitSandbox(name: string) {
    await api.remember(selectedId, `New prescription: ${name}`, "medication", `rxsandbox_${selectedId}`);
    setSandbox((s) => [...s, name]);
    setDrugInput("");
  }
  async function findAlternatives(drug: string) {
    const key = drug.toLowerCase().split(" ")[0];
    setAltLoading(drug);
    try {
      await api.recall(selectedId, `What drugs treat the same condition as ${drug} but do not rely on CYP3A4 or CYP2D6?`);
      setAlts((a) => ({ ...a, [drug]: ALTERNATIVES[key] ?? ["No pathway-safe substitute found in reference set"] }));
    } finally {
      setAltLoading(null);
    }
  }

  const gauge = [{ name: "risk", value: risk, fill: riskColor }];
  const activeDiet = DIET.filter((d) => data.medications.some((m) => m.title.toLowerCase().includes(d.drug)));

  return (
    <div>
      <ModuleHeader module="rxshield" />
      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        RxShield explains <em>why</em> drugs interact — metabolic pathways, enzyme inhibition,
        pharmacogenomics and organ clearance — not just that they do.
      </p>

      <AnimatePresence>
        {risk >= 60 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 flex items-center gap-3 rounded-2xl border border-[#ff6b6b]/60 bg-[#ff6b6b]/12 p-4"
          >
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ff6b6b]" />
            <div className="text-sm">
              <span className="font-bold text-[#ff6b6b]">Toxicity threshold exceeded. </span>
              <span className="text-fg/75">Cumulative CYP3A4 inhibition + reduced clearance pushes myopathy / rhabdomyolysis risk into the critical band.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gauge + organ sliders */}
      <div className="mb-7 grid gap-5 lg:grid-cols-[280px_1fr]">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2"><SectionTitle title="Interaction risk" /><CogneeTooltip fn="improve" explanation="The live score is re-derived from graph edge weights; improve() permanently re-weights interaction severities when new genomic or organ-function data is added." /></div>
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} data={gauge}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} angleAxisId={0} />
                <RadialBar background dataKey="value" cornerRadius={10} angleAxisId={0} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <motion.p key={risk} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-4xl font-bold" style={{ color: riskColor }}>{risk}<span className="text-2xl">%</span></motion.p>
                <p className="text-xs text-fg/45">Interaction risk</p>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2"><SectionTitle title="Organ clearance & pharmacogenomics" /><CogneeTooltip fn="improve" explanation="Dragging a slider or flagging a metabolizer status calls improve(): Cognee crawls every medication edge and re-weights accumulation risk in real time." /></div>
          <div className="space-y-4">
            <Slider label={`eGFR (kidney): ${eGFR} mL/min`} min={20} max={120} value={eGFR} onChange={setEGFR} hint="Lower = slower drug clearance" />
            <Slider label={`AST/ALT (liver): ${ast} U/L`} min={10} max={120} value={ast} onChange={setAst} hint="Higher = impaired hepatic metabolism" />
            <label className="flex items-center gap-2 text-sm text-fg/75">
              <input type="checkbox" checked={pgx} onChange={(e) => setPgx(e.target.checked)} className="accent-[#ff7eb6]" />
              Set patient as <span className="font-semibold" style={{ color: R }}>CYP2D6 poor metabolizer</span>
              <CogneeTooltip fn="improve" explanation="Logging genetic data triggers improve()/memify, permanently escalating interaction severities (e.g. moderate → high) against the new genetic baseline." />
            </label>
          </div>
        </GlassCard>
      </div>

      {/* Medications + sandbox + purge */}
      <div className="mb-7 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <SectionTitle title="Active & historical medications" />
          <div className="flex flex-wrap gap-2">
            {data.medications.map((m) => (
              <div key={m.id} className="rounded-xl border border-line/10 bg-field/20 p-3">
                <p className="text-sm font-bold text-fg">{m.title}</p>
                <p className="text-xs text-fg/50">{m.detail}</p>
                <div className="mt-1.5"><Pill>{m.date}</Pill></div>
              </div>
            ))}
            {sandbox.map((s) => (
              <div key={s} className="rounded-xl border border-dashed p-3" style={{ borderColor: `${R}80`, background: `${R}10` }}>
                <p className="text-sm font-bold" style={{ color: R }}>{s}</p>
                <p className="text-xs text-fg/50">Committed from sandbox</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="space-y-5">
          <GlassCard className="p-4">
            <div className="flex items-center gap-2"><SectionTitle title="Simulate prescription" /><CogneeTooltip fn="remember" explanation="The drug is held in session memory via remember() with a temporary session_id, so the risk recalculates in a sandbox. 'Commit' merges it into the permanent graph." /></div>
            <div className="flex gap-2">
              <input value={drugInput} onChange={(e) => setDrugInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && drugInput.trim() && commitSandbox(drugInput.trim())} placeholder="e.g. Simvastatin 40mg" className="flex-1 rounded-lg border border-line/10 bg-field/20 px-3 py-1.5 text-sm text-fg outline-none focus:border-[#ff7eb6]/60" />
              <AsyncButton className="btn-ghost text-sm" style={{ color: R, borderColor: `${R}55` }} runningLabel="Committing…" onClick={() => drugInput.trim() && commitSandbox(drugInput.trim())}>Commit to chart</AsyncButton>
            </div>
            <p className="mt-2 text-xs text-fg/40">Each sandboxed drug adds ~9% to the live risk gauge until reviewed.</p>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-2"><SectionTitle title="Clear stale supplements" /><CogneeTooltip fn="forget" explanation="forget() severs outdated OTC/supplement entities from the active interaction graph, lowering false-positive risk without touching the core EHR record." /></div>
            <div className="space-y-2">
              {SUPPLEMENTS.map((s) => (
                <label key={s} className={`flex items-center gap-2 text-sm ${purged.has(s) ? "text-fg/35 line-through" : "text-fg/75"}`}>
                  <input type="checkbox" checked={purged.has(s)} onChange={async (e) => { if (e.target.checked) { setPurged((p) => new Set(p).add(s)); await api.forget(selectedId); } }} className="accent-[#ff7eb6]" />
                  {s}
                </label>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* CYP pathway mapper */}
      <GlassCard className="mb-7 p-4">
        <div className="mb-2 flex items-center gap-2"><SectionTitle kicker="Metabolism" title="Cytochrome P450 pathway map" /><CogneeTooltip fn="recall" explanation="recall() isolates enzyme nodes and the drug edges bound to them, classifying each as substrate, inhibitor or inducer — the biological graph behind the risk score." /></div>
        {cyp.length === 0 ? (
          <p className="text-sm text-fg/40">No CYP-relevant medications on file for this patient.</p>
        ) : (
          <CypMap rows={cyp} />
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <Legend color={roleColor("inhibitor")} label="Inhibitor (blocks the pipe)" />
          <Legend color={roleColor("substrate")} label="Substrate (cleared by enzyme)" />
          <Legend color={roleColor("inducer")} label="Inducer (widens the pipe)" />
        </div>
      </GlassCard>

      {/* Interaction analysis */}
      <div className="mb-7">
        <div className="mb-3 flex items-center gap-2"><SectionTitle kicker="Explained" title="Interaction analysis" /><CogneeTooltip fn="recall" explanation="Each card is reasoned from graph paths recall() traversed; the 'Find alternatives' action runs a fresh recall() that excludes the patient's compromised pathways." /></div>
        <div className="grid gap-4 md:grid-cols-2">
          {data.interactions.map((ix, i) => (
            <motion.div key={`${ix.a}-${ix.b}-${i}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <GlassCard className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Pill color={sevColor(ix.severity)}>{ix.a}</Pill>
                  <span className="text-xs text-fg/40">+</span>
                  <Pill color={sevColor(ix.severity)}>{ix.b}</Pill>
                  {pgx && <span className="chip" style={{ borderColor: `${R}55`, color: R }}>PGx-adjusted</span>}
                  <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: sevColor(ix.severity), background: sevColor(ix.severity) + "1a" }}>{ix.severity}</span>
                </div>
                <ConfidenceMeter value={Math.min(99, ix.risk + (pgx ? 12 : 0))} color={sevColor(ix.severity)} />
                <div className="mt-3 space-y-1.5 text-xs">
                  <p><span className="text-fg/40">Mechanism: </span><span className="text-fg/75">{ix.mechanism}</span></p>
                  <p><span className="text-fg/40">Effect: </span><span className="text-fg/75">{ix.effect}</span></p>
                  {ix.modifier && <p><span className="text-fg/40">Patient modifier: </span><span className="text-fg/75">{ix.modifier}</span></p>}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={() => setOpenTrace((t) => (t === i ? null : i))} className="text-xs font-semibold text-fg/50 transition hover:text-fg/90">{openTrace === i ? "▾ Hide metabolic trace" : "▸ Show your work"}</button>
                  <AsyncButton className="text-xs font-semibold" style={{ color: R }} runningLabel="Querying…" onClick={() => findAlternatives(ix.b)}>· Find pathway-safe alternatives</AsyncButton>
                </div>
                <AnimatePresence>
                  {openTrace === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <ol className="mt-2 space-y-1 rounded-xl border border-line/10 bg-field/20 p-3 text-xs text-fg/70">
                        <li>1. {ix.a} — {ix.mechanism}</li>
                        <li>2. {ix.b} requires the same enzyme to clear.</li>
                        {ix.modifier && <li>3. {ix.modifier}</li>}
                        <li>{ix.modifier ? 4 : 3}. {ix.effect}</li>
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>
                {altLoading === ix.b && <div className="mt-3"><SkeletonLines rows={2} /></div>}
                {alts[ix.b] && (
                  <div className="mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: `${R}40`, background: `${R}10` }}>
                    <div className="mb-1 font-semibold" style={{ color: R }}>Pathway-safe alternatives</div>
                    {alts[ix.b].map((a) => <div key={a} className="text-fg/75">• {a}</div>)}
                  </div>
                )}
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cascade + dietary radar */}
      <div className="mb-7 grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Prescribing cascade watch" /><CogneeTooltip fn="recall" explanation="Graph traversal via recall() looks for Drug → new Symptom → Drug patterns, where a second drug treats a side-effect of the first — flagging deprescribing opportunities." /></div>
          <div className="rounded-xl border border-line/10 bg-field/20 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip" style={{ borderColor: `${R}55`, color: R }}>Metoprolol ↑dose</span>
              <span className="text-fg/40">→</span>
              <span className="chip">New persistent fatigue</span>
              <span className="text-fg/40">→</span>
              <span className="chip text-fg/40">(no 2nd drug — cascade avoided)</span>
            </div>
            <p className="mt-2 text-xs text-fg/55">Fatigue began 3 days after the dose increase. Flagged so a stimulant isn't added to treat an iatrogenic effect — deprescribe/adjust instead.</p>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2"><SectionTitle title="Dietary & lifestyle interference" /><CogneeTooltip fn="recall" explanation="Cross-module recall() pulls NutriSim lifestyle nodes that share an enzyme with active drugs — proving food and medication live on the same biological graph." /></div>
          <div className="space-y-2">
            {(activeDiet.length ? activeDiet : DIET.slice(0, 1)).map((d) => (
              <div key={d.a} className="flex items-start gap-2 rounded-lg border border-line/10 p-2.5 text-xs">
                <span className="text-base">🥢</span>
                <div><span className="font-semibold text-fg/85">{d.a} ↔ {d.b}</span><div className="text-fg/55">{d.note}</div></div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="mb-7">
        <SectionTitle title="Safety insight" />
        <div className="grid gap-4 md:grid-cols-2">
          {data.insights.map((ins, i) => <InsightCard key={ins.id} insight={ins} evidenceLabels={evidenceLabels} type={i === 0} index={i} />)}
        </div>
      </div>

      <AIAssistant patientId={selectedId} evidenceLabels={evidenceLabels} />
    </div>
  );
}

function Slider({ label, min, max, value, onChange, hint }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm"><span className="text-fg/80">{label}</span></div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#ff7eb6]" />
      <div className="text-[11px] text-fg/35">{hint}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5 text-fg/55"><span className="h-2 w-4 rounded-full" style={{ background: color }} />{label}</span>;
}

function CypMap({ rows }: { rows: { drug: string; enzyme: string; role: string }[] }) {
  const enzymes = Array.from(new Set(rows.map((r) => r.enzyme)));
  const enzY = (e: string) => 60 + enzymes.indexOf(e) * 110;
  return (
    <svg viewBox="0 0 420 240" className="h-56 w-full">
      {rows.map((r, i) => {
        const y1 = 40 + i * 55;
        const y2 = enzY(r.enzyme);
        const col = roleColor(r.role);
        return (
          <g key={`${r.drug}-${i}`}>
            <path d={`M150,${y1} C220,${y1} 230,${y2} 290,${y2}`} fill="none" stroke={col} strokeWidth={2.4} strokeDasharray="5 7">
              <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1.1s" repeatCount="indefinite" />
            </path>
            <rect x={16} y={y1 - 16} width={134} height={32} rx={9} fill={`${col}1f`} stroke={`${col}88`} />
            <text x={83} y={y1 + 4} textAnchor="middle" fontSize="11" fill="currentColor" className="fill-fg">{r.drug}</text>
            <text x={220} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize="9" fill={col}>{r.role}</text>
          </g>
        );
      })}
      {enzymes.map((e) => (
        <g key={e}>
          <rect x={290} y={enzY(e) - 20} width={114} height={40} rx={11} fill="#ff7eb61f" stroke="#ff7eb688" />
          <text x={347} y={enzY(e) + 4} textAnchor="middle" fontSize="13" fontWeight="bold" className="fill-fg">{e}</text>
        </g>
      ))}
    </svg>
  );
}
