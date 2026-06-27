import { motion } from "framer-motion";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import KnowledgeGraph from "../../components/KnowledgeGraph";
import ModuleHeader from "../../components/ModuleHeader";
import { GlassCard, Pill, SectionTitle, Spinner } from "../../components/ui";
import { usePatients } from "../../lib/PatientContext";
import { usePatientData, useModuleData } from "../../lib/usePatientData";
import type { Insight, PatientEvent } from "../../lib/types";

interface CuriePayload {
  symptomTimeline: PatientEvent[];
  insights: Insight[];
}

const SEV = ["#6b7280", "#9ec3ff", "#ffd166", "#ff9e6b", "#ff6b6b"];

export default function Curie() {
  const { selectedId } = usePatients();
  const { graph, evidenceLabels, loading: gLoading } = usePatientData(selectedId);
  const { data, loading } = useModuleData<CuriePayload>(selectedId, "curie");

  if (loading || gLoading || !data || !graph) return <Spinner />;

  // highlight the evidence behind the top Curie insight on the graph
  const highlight = data.insights[0]?.evidence ?? [];

  return (
    <div>
      <ModuleHeader module="curie" />

      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        Curie doesn't diagnose — it searches the patient's <em>entire lifetime</em> for hidden
        relationships between medical events that occurred years apart, then scores how strongly
        they resemble known disease progressions.
      </p>

      <div className="mb-6">
        <AIAssistant patientId={selectedId} evidenceLabels={evidenceLabels} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        {/* Symptom timeline */}
        <div>
          <SectionTitle kicker="Longitudinal" title="Symptom timeline" />
          <div className="relative space-y-3 before:absolute before:left-[7px] before:top-2 before:h-full before:w-px before:bg-surface/10">
            {data.symptomTimeline.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="relative pl-7"
              >
                <span
                  className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-bg"
                  style={{ background: SEV[e.severity ?? 1] }}
                />
                <div className="glass glass-hover p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-fg">{e.title}</span>
                    <span className="text-xs text-fg/40">{e.date}</span>
                  </div>
                  <p className="mt-1 text-xs text-fg/55">{e.detail}</p>
                  <div className="mt-1.5"><Pill>{e.type}</Pill></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Focused graph */}
        <div>
          <SectionTitle kicker="Cross-reference" title="Connected evidence"
            right={<span className="text-xs text-fg/40">highlighted = reasoning path</span>} />
          <GlassCard className="p-3">
            <KnowledgeGraph graph={graph} height={460} highlight={highlight} />
          </GlassCard>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-7">
        <SectionTitle kicker="AI reasoning" title="Diagnostic cross-references" />
        <div className="grid gap-4 md:grid-cols-2">
          {data.insights.map((ins, i) => (
            <InsightCard key={ins.id} insight={ins} evidenceLabels={evidenceLabels} type={i === 0} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
