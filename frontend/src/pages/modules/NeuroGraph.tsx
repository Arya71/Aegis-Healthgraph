import { motion } from "framer-motion";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import ModuleHeader from "../../components/ModuleHeader";
import {
  ConfidenceMeter,
  GlassCard,
  SectionTitle,
  Spinner,
  StatPill,
} from "../../components/ui";
import { usePatients } from "../../lib/PatientContext";
import type { Insight } from "../../lib/types";
import { useModuleData, usePatientData } from "../../lib/usePatientData";

interface Point {
  month: string;
  vocab: number;
  recall: number;
  language: number;
}

interface Entity {
  label: string;
  strength: number;
}

interface Payload {
  series: Point[];
  entities: Entity[];
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

export default function NeuroGraph() {
  const { selectedId } = usePatients();
  const { data, loading } = useModuleData<Payload>(selectedId, "neurograph");
  const { evidenceLabels, loading: gLoading } = usePatientData(selectedId);

  if (loading || gLoading || !data) return <Spinner />;

  if (!data.series || data.series.length === 0) {
    return (
      <>
        <ModuleHeader module="neurograph" />
        <GlassCard className="p-8 text-center">
          <p className="text-fg/60">No cognitive tracking for this patient yet.</p>
          <p className="mt-2 text-sm text-fg/40">
            Switch to Arthur Reyes (★) from the patient selector to see NeuroGraph in action.
          </p>
        </GlassCard>
      </>
    );
  }

  const last = data.series[data.series.length - 1];
  const firstInsight = data.insights[0] ?? null;

  return (
    <div>
      <ModuleHeader module="neurograph" />

      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        NeuroGraph measures the degradation of the patient's own knowledge graph — not just test
        scores.
      </p>

      {/* Stat row */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatPill label="Vocabulary" value={`${last.vocab}%`} color="#b388ff" />
        <StatPill label="Recall" value={`${last.recall}%`} color="#6ea8ff" />
        <StatPill label="Language" value={`${last.language}%`} color="#ff9ecb" />
      </div>

      {/* Cognitive trend chart */}
      <GlassCard className="mb-6 p-4">
        <SectionTitle kicker="6 months" title="Cognitive trend" />
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.series}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="month" tick={axisTick} />
            <YAxis domain={[0, 100]} tick={axisTick} />
            <Tooltip {...tip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              dataKey="vocab"
              stroke="#b388ff"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="recall"
              stroke="#6ea8ff"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="language"
              stroke="#ff9ecb"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Entity recall strength */}
      <GlassCard className="mb-6 p-4">
        <SectionTitle kicker="Personal memory" title="Entity recall strength" />
        <p className="mb-4 text-xs text-fg/40">
          How reliably the patient recalls each personal entity — weakening over time.
        </p>
        <div className="space-y-2">
          {data.entities.map((e, i) => (
            <motion.div
              key={e.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3"
            >
              <span className="w-44 shrink-0 text-sm text-fg/80">{e.label}</span>
              <ConfidenceMeter
                value={Math.min(100, Math.round((e.strength / 1.4) * 100))}
                color="#b388ff"
              />
            </motion.div>
          ))}
        </div>
      </GlassCard>

      {/* Caregiver alert */}
      {firstInsight && (
        <GlassCard className="mb-6 border-l-4 p-4" style={{ borderLeftColor: "#ff6b6b" }}>
          <p className="text-xs font-bold text-[#ff6b6b]">⚠ Caregiver alert</p>
          <p className="mt-1 text-sm text-fg/75">{firstInsight.body}</p>
        </GlassCard>
      )}

      {/* Insights */}
      <div className="mb-6">
        <SectionTitle title="Cognitive insight" />
        <div className="grid gap-4">
          {data.insights.map((ins, i) => (
            <InsightCard
              key={ins.id}
              insight={ins}
              type={i === 0}
              index={i}
              evidenceLabels={evidenceLabels}
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
