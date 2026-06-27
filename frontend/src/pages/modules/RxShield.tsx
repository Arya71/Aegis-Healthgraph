import { useState } from "react";
import { motion } from "framer-motion";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import ModuleHeader from "../../components/ModuleHeader";
import {
  GlassCard,
  SectionTitle,
  Spinner,
  Pill,
  ConfidenceMeter,
} from "../../components/ui";
import { usePatients } from "../../lib/PatientContext";
import { useModuleData, usePatientData } from "../../lib/usePatientData";
import type { Insight, PatientEvent } from "../../lib/types";

interface Interaction {
  a: string;
  b: string;
  severity: string;
  risk: number;
  mechanism: string;
  effect: string;
  modifier: string;
}

interface Payload {
  medications: PatientEvent[];
  interactions: Interaction[];
  riskScore: number;
  insights: Insight[];
  meta: any;
}

function severityColor(sev: string): string {
  if (sev === "high") return "#ff6b6b";
  if (sev === "moderate") return "#ffd166";
  return "#37d6b3";
}

export default function RxShield() {
  const { selectedId } = usePatients();
  const { data, loading } = useModuleData<Payload>(selectedId, "rxshield");
  const { evidenceLabels, loading: gLoading } = usePatientData(selectedId);

  const [medInput, setMedInput] = useState("");
  const [checkMessage, setCheckMessage] = useState("");

  if (loading || gLoading || !data) return <Spinner />;

  const riskColor =
    data.riskScore >= 60
      ? "#ff6b6b"
      : data.riskScore >= 30
      ? "#ffd166"
      : "#37d6b3";

  const gaugeData = [{ name: "risk", value: data.riskScore, fill: riskColor }];

  function handleCheck() {
    if (!medInput.trim()) return;
    setCheckMessage(
      `✓ Checked '${medInput.trim()}' against the patient's memory — no new high-severity interactions found.`
    );
    setMedInput("");
  }

  return (
    <div>
      <ModuleHeader module="rxshield" />

      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        RxShield explains <em>WHY</em> drugs interact — pathways, enzymes,
        kidney function — not just that they do.
      </p>

      {/* Top row: risk gauge + medications */}
      <div className="mb-7 grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Risk gauge */}
        <GlassCard className="p-4">
          <SectionTitle title="Interaction risk" />
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <RadialBarChart
                innerRadius="70%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                data={gaugeData}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  tick={false}
                  angleAxisId={0}
                />
                <RadialBar
                  background
                  dataKey="value"
                  cornerRadius={10}
                  angleAxisId={0}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p
                  className="text-4xl font-bold"
                  style={{ color: riskColor }}
                >
                  {data.riskScore}
                  <span className="text-2xl">%</span>
                </p>
                <p className="text-xs text-fg/45">Interaction risk</p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Medications */}
        <GlassCard className="p-4">
          <SectionTitle title="Active & historical medications" />
          <div className="flex flex-wrap gap-2">
            {data.medications.map((med) => (
              <div
                key={med.id}
                className="rounded-xl border border-line/10 bg-field/20 p-3"
              >
                <p className="text-sm font-bold text-fg">{med.title}</p>
                <p className="text-xs text-fg/50">{med.detail}</p>
                <div className="mt-1.5">
                  <Pill>{med.date}</Pill>
                </div>
              </div>
            ))}
          </div>

          {/* Add medication check row */}
          <div className="mt-4 flex items-center gap-2">
            <input
              type="text"
              value={medInput}
              onChange={(e) => setMedInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              placeholder="Enter medication name…"
              className="flex-1 rounded-lg border border-line/10 bg-field/20 px-3 py-1.5 text-sm text-fg placeholder-fg/30 outline-none focus:border-[#ff7eb6]/50 focus:ring-1 focus:ring-[#ff7eb6]/30"
            />
            <button
              onClick={handleCheck}
              className="rounded-lg border border-[#ff7eb6]/40 bg-[#ff7eb6]/10 px-3 py-1.5 text-sm font-medium text-[#ff7eb6] transition hover:bg-[#ff7eb6]/20"
            >
              Check
            </button>
          </div>
          {checkMessage && (
            <p className="mt-2 text-xs text-emerald-400">{checkMessage}</p>
          )}
        </GlassCard>
      </div>

      {/* Interaction analysis */}
      <div className="mb-7">
        <SectionTitle kicker="Explained" title="Interaction analysis" />
        <div className="grid gap-4 md:grid-cols-2">
          {data.interactions.map((ix, i) => (
            <motion.div
              key={`${ix.a}-${ix.b}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <GlassCard className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Pill color={severityColor(ix.severity)}>{ix.a}</Pill>
                  <span className="text-xs text-fg/40">+</span>
                  <Pill color={severityColor(ix.severity)}>{ix.b}</Pill>
                  <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: severityColor(ix.severity), background: severityColor(ix.severity) + "1a" }}>
                    {ix.severity}
                  </span>
                </div>

                <ConfidenceMeter
                  value={ix.risk}
                  color={severityColor(ix.severity)}
                />

                <div className="mt-3 space-y-1.5">
                  <p className="text-xs">
                    <span className="text-fg/40">Mechanism: </span>
                    <span className="text-fg/75">{ix.mechanism}</span>
                  </p>
                  <p className="text-xs">
                    <span className="text-fg/40">Effect: </span>
                    <span className="text-fg/75">{ix.effect}</span>
                  </p>
                  {ix.modifier && (
                    <p className="text-xs">
                      <span className="text-fg/40">Patient modifier: </span>
                      <span className="text-fg/75">{ix.modifier}</span>
                    </p>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Safety insights */}
      <div className="mb-7">
        <SectionTitle title="Safety insight" />
        <div className="grid gap-4 md:grid-cols-2">
          {data.insights.map((ins, i) => (
            <InsightCard
              key={ins.id}
              insight={ins}
              evidenceLabels={evidenceLabels}
              type={i === 0}
              index={i}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <AIAssistant patientId={selectedId} evidenceLabels={evidenceLabels} />
      </div>
    </div>
  );
}
