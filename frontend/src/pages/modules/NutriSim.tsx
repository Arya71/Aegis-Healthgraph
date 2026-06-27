import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import ModuleHeader from "../../components/ModuleHeader";
import InsightCard from "../../components/InsightCard";
import AIAssistant from "../../components/AIAssistant";
import { GlassCard, SectionTitle, Spinner, Pill, StatPill } from "../../components/ui";
import { usePatients } from "../../lib/PatientContext";
import { useModuleData, usePatientData } from "../../lib/usePatientData";
import type { Insight } from "../../lib/types";

interface Meal {
  meal: string;
  carbs: number;
  note: string;
}

interface Payload {
  days: string[];
  glucose: number[];
  sleep: number[];
  rem: number[];
  meals: Meal[];
  insights: Insight[];
  meta: any;
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

export default function NutriSim() {
  const { selectedId } = usePatients();
  const { data, loading } = useModuleData<Payload>(selectedId, "nutrisim");
  const { evidenceLabels, loading: gLoading } = usePatientData(selectedId);

  if (loading || gLoading || !data) return <Spinner />;

  const series = data.days.map((day, i) => ({
    day,
    glucose: data.glucose[i],
    sleep: data.sleep[i],
    rem: data.rem[i],
  }));

  const avgGlucose = Math.round(
    data.glucose.reduce((a, b) => a + b, 0) / data.glucose.length
  );
  const avgSleep = +(
    data.sleep.reduce((a, b) => a + b, 0) / data.sleep.length
  ).toFixed(1);
  const worstSpike = Math.max(...data.glucose);
  const avgRem = Math.round(
    data.rem.reduce((a, b) => a + b, 0) / data.rem.length
  );

  return (
    <div>
      <ModuleHeader module="nutrisim" />

      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        NutriSim finds the feedback loops between sleep, food and glucose that no single reading reveals.
      </p>

      {/* Stat row */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatPill label="Avg Glucose" value={`${avgGlucose} mg/dL`} color="#37d6b3" />
        <StatPill label="Avg Sleep" value={`${avgSleep} h`} color="#6ea8ff" />
        <StatPill label="Worst Spike" value={`${worstSpike} mg/dL`} color="#ff9ecb" />
        <StatPill label="Avg REM" value={`${avgRem} min`} color="#b388ff" />
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        {/* CGM chart */}
        <GlassCard className="p-4">
          <SectionTitle kicker="CGM" title="Morning glucose (30 days)" />
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="glu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#37d6b3" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#37d6b3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="day" interval={4} tick={axisTick} />
              <YAxis tick={axisTick} />
              <Tooltip {...tip} />
              <ReferenceLine y={140} stroke="#ff6b6b" strokeDasharray="4 4" />
              <Area
                dataKey="glucose"
                stroke="#37d6b3"
                fill="url(#glu)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Sleep vs REM chart */}
        <GlassCard className="p-4">
          <SectionTitle kicker="Wearable" title="Sleep vs REM" />
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={series}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="day" interval={4} tick={axisTick} />
              <YAxis tick={axisTick} />
              <YAxis yAxisId="right" orientation="right" tick={axisTick} />
              <Tooltip {...tip} />
              <Bar
                dataKey="sleep"
                name="Sleep (h)"
                fill="#6ea8ff"
                radius={[6, 6, 0, 0]}
                barSize={10}
              />
              <Line
                dataKey="rem"
                name="REM (min)"
                stroke="#b388ff"
                dot={false}
                strokeWidth={2}
                yAxisId="right"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Meals */}
      <div className="mb-6">
        <SectionTitle kicker="Meals" title="What moves the curve" />
        <div className="grid gap-4 md:grid-cols-3">
          {data.meals.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <GlassCard className="p-4">
                <p className="mb-2 text-sm font-bold text-fg">{m.meal}</p>
                <Pill>{m.carbs}g carbs</Pill>
                <p className="mt-2 text-xs text-fg/55">{m.note}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="mb-6">
        <SectionTitle title="Metabolic insight" />
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
