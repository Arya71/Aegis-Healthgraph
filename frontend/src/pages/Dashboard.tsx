import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import AIAssistant from "../components/AIAssistant";
import InsightCard from "../components/InsightCard";
import KnowledgeGraph from "../components/KnowledgeGraph";
import { GlassCard, SectionTitle, Spinner, StatPill } from "../components/ui";
import { MODULES } from "../lib/api";
import { usePatients } from "../lib/PatientContext";
import { usePatientData } from "../lib/usePatientData";

export default function Dashboard() {
  const { selectedId, selected } = usePatients();
  const { detail, graph, evidenceLabels, loading } = usePatientData(selectedId);
  const navigate = useNavigate();

  if (loading || !detail || !graph) return <Spinner />;

  const dated = detail.events.filter((e) => e.date);
  const years = dated.length
    ? new Date(dated[dated.length - 1].date!).getFullYear() - new Date(dated[0].date!).getFullYear()
    : 0;
  const topConf = Math.max(0, ...detail.insights.map((i) => i.confidence),
    ...detail.crossInsights.map((i) => i.confidence));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fg/40">Digital Cognitive Twin</div>
          <h1 className="text-3xl font-extrabold">{selected?.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-fg/50">{detail.story}</p>
        </div>
        <button className="btn-ghost" onClick={() => navigate("/graph")}>Open graph explorer ✦</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatPill label="Memories" value={`${detail.events.length}`} color="#6ea8ff" />
        <StatPill label="Graph nodes" value={`${graph.nodes.length}`} color="#7c6cff" />
        <StatPill label="Years tracked" value={`${years || 1}`} color="#37d6b3" />
        <StatPill label="Top confidence" value={`${topConf}%`} color="#ff9ecb" />
      </div>

      {/* Cross-module aha — the money shot */}
      {detail.crossInsights.length > 0 && (
        <div>
          <SectionTitle kicker="Why a shared memory matters" title="Cross-module discoveries" />
          <div className="grid gap-4 lg:grid-cols-2">
            {detail.crossInsights.map((ci, i) => (
              <InsightCard key={ci.id} insight={ci} evidenceLabels={evidenceLabels} type={i === 0} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Graph + assistant */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <GlassCard className="p-4">
          <SectionTitle kicker="Cognee" title="Patient knowledge graph"
            right={<span className="text-xs text-fg/40">hover a node to trace connections</span>} />
          <KnowledgeGraph graph={graph} height={420} onSelect={() => navigate("/graph")} />
        </GlassCard>
        <AIAssistant patientId={selectedId} evidenceLabels={evidenceLabels} />
      </div>

      {/* Module insights */}
      <div>
        <SectionTitle kicker="Six agents, one memory" title="Module insights" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {detail.insights.map((ins, i) => (
            <InsightCard key={ins.id} insight={ins} evidenceLabels={evidenceLabels} index={i} />
          ))}
        </div>
      </div>

      {/* Module launcher */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {MODULES.map((m, i) => (
          <motion.button
            key={m.key}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            onClick={() => navigate(`/${m.key}`)}
            className="glass glass-hover p-4 text-center"
          >
            <div className="text-2xl">{m.icon}</div>
            <div className="mt-1.5 text-sm font-bold text-fg">{m.name}</div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
