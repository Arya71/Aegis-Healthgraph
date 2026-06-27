import { motion } from "framer-motion";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import ModuleHeader from "../../components/ModuleHeader";
import { GlassCard, SectionTitle, Spinner, ConfidenceMeter, Typewriter } from "../../components/ui";
import { usePatients } from "../../lib/PatientContext";
import { usePatientData, useModuleData } from "../../lib/usePatientData";
import type { Insight, PatientEvent } from "../../lib/types";

interface Trigger {
  trigger: string;
  weight: number;
}

interface Payload {
  weeks: string[];
  mood: number[];
  anxiety: number[];
  triggers: Trigger[];
  entries: PatientEvent[];
  insights: Insight[];
  meta: unknown;
}

const grid = "rgba(148,163,184,0.22)";
const axisTick = { fill: "#94a3b8", fontSize: 11 };
const tip = {
  contentStyle: {
    background: "#0b1022",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    color: "#e8ecf8",
  },
};

export default function Pathos() {
  const { selectedId } = usePatients();
  const { evidenceLabels, loading: gLoading } = usePatientData(selectedId);
  const { data, loading } = useModuleData<Payload>(selectedId, "pathos");

  if (loading || gLoading || !data) return <Spinner />;

  const series = data.weeks.map((week, i) => ({
    week,
    mood: data.mood[i],
    anxiety: data.anxiety[i],
  }));

  const userEntries = data.entries.slice(0, 2);

  return (
    <div>
      <ModuleHeader module="pathos" />

      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        Pathos remembers years of emotional context, so it sees patterns instead of starting every
        conversation from zero.
      </p>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Memory-aware companion chat */}
        <GlassCard className="p-4">
          <SectionTitle title="Memory-aware companion" />
          <div className="flex flex-col gap-3 mt-3">
            {userEntries.map((entry) => (
              <div
                key={entry.id}
                className="self-end max-w-[80%] rounded-2xl bg-[#ffb86b]/15 border border-[#ffb86b]/30 px-3 py-2 text-sm text-fg"
              >
                {entry.detail}
              </div>
            ))}

            <div className="self-start max-w-[85%] rounded-2xl bg-surface/5 border border-line/10 px-3 py-2 text-sm text-fg/85">
              <div className="text-xs text-[#ffb86b] mb-1">🫀 Pathos</div>
              <Typewriter text={data.insights[0]?.body ?? "I remember your patterns."} />
            </div>
          </div>
        </GlassCard>

        {/* Mood & anxiety chart */}
        <GlassCard className="p-4">
          <SectionTitle kicker="8 weeks" title="Mood & anxiety" />
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={series}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="week" tick={axisTick} />
                <YAxis domain={[0, 10]} tick={axisTick} />
                <Tooltip {...tip} />
                <Line
                  dataKey="mood"
                  stroke="#37d6b3"
                  strokeWidth={2}
                  dot={false}
                  name="Mood"
                />
                <Line
                  dataKey="anxiety"
                  stroke="#ff7eb6"
                  strokeWidth={2}
                  dot={false}
                  name="Anxiety"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Triggers */}
      <GlassCard className="p-4 mt-5">
        <SectionTitle kicker="Triggers" title="What precedes the spikes" />
        <div className="space-y-2 mt-3">
          {data.triggers.map((t, i) => (
            <motion.div
              key={t.trigger}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3"
            >
              <span className="text-sm text-fg/80 w-48 shrink-0">{t.trigger}</span>
              <ConfidenceMeter value={Math.round(t.weight * 100)} color="#ffb86b" />
            </motion.div>
          ))}
        </div>
      </GlassCard>

      {/* Weekly insights */}
      <div className="mt-7">
        <SectionTitle title="Weekly insight" />
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
