import { useState } from "react";
import { motion } from "framer-motion";
import AIAssistant from "../../components/AIAssistant";
import InsightCard from "../../components/InsightCard";
import ModuleHeader from "../../components/ModuleHeader";
import { GlassCard, Pill, SectionTitle, Spinner, StatPill } from "../../components/ui";
import { usePatients } from "../../lib/PatientContext";
import { usePatientData, useModuleData } from "../../lib/usePatientData";
import { MODULE_COLOR } from "../../lib/api";
import type { Insight, PatientEvent, GraphEdge } from "../../lib/types";

interface Payload {
  timeline: PatientEvent[];
  causalEdges: GraphEdge[];
  insights: Insight[];
  meta: any;
}

export default function MedSync() {
  const { selectedId } = usePatients();
  const { evidenceLabels, loading: gLoading } = usePatientData(selectedId);
  const { data, loading } = useModuleData<Payload>(selectedId, "medsync");

  const [activeTypes, setActiveTypes] = useState<Set<string> | null>(null);

  if (loading || gLoading || !data) return <Spinner />;

  // Derive unique event types from timeline
  const allTypes = Array.from(new Set(data.timeline.map((e) => e.type)));

  // Default active = all types (initialise lazily via null sentinel)
  const active = activeTypes ?? new Set(allTypes);

  function toggleType(type: string) {
    const next = new Set(active);
    if (next.has(type)) {
      if (next.size > 1) next.delete(type); // keep at least one active
    } else {
      next.add(type);
    }
    setActiveTypes(next);
  }

  const filteredEvents = data.timeline
    .filter((e) => active.has(e.type))
    .slice()
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });

  // Summary stats
  const totalEvents = data.timeline.length;
  const dates = data.timeline.map((e) => e.date).filter(Boolean) as string[];
  const minDate = dates.length ? dates.slice().sort()[0] : null;
  const maxDate = dates.length ? dates.slice().sort().reverse()[0] : null;
  const span =
    minDate && maxDate && minDate !== maxDate
      ? `${minDate.slice(0, 7)} – ${maxDate.slice(0, 7)}`
      : minDate ?? "—";

  return (
    <div>
      <ModuleHeader module="medsync" />

      <p className="mb-6 max-w-3xl text-sm text-fg/55">
        MedSync turns scattered specialist visits into one causal timeline.
      </p>

      {/* Summary pills */}
      <div className="mb-5 flex flex-wrap gap-2">
        <StatPill label="Events" value={String(totalEvents)} />
        <StatPill label="Span" value={span} />
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {allTypes.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`chip rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              active.has(type)
                ? "border-line/30 bg-surface/15 text-fg"
                : "border-line/10 bg-transparent text-fg/40 opacity-50"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Horizontal scrollable timeline */}
      <div className="mb-8 overflow-x-auto pb-2">
        <div className="flex gap-3" style={{ minWidth: "max-content" }}>
          {filteredEvents.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3">
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard className="min-w-[220px] p-3">
                  <p className="text-xs text-fg/40">{e.date ?? "—"}</p>
                  <p className="mt-1 text-sm font-bold text-fg">{e.title}</p>
                  <div className="mt-1.5">
                    <Pill
                      style={{
                        color: MODULE_COLOR[e.module],
                        borderColor: MODULE_COLOR[e.module] + "55",
                      }}
                    >
                      {e.type}
                    </Pill>
                  </div>
                  <p className="mt-1.5 text-xs text-fg/55">{e.detail}</p>
                </GlassCard>
              </motion.div>
              {i < filteredEvents.length - 1 && (
                <span className="select-none self-center text-fg/30">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Causal edges */}
      <SectionTitle kicker="Causality" title="What caused what" />
      <div className="mb-8 space-y-3">
        {data.causalEdges.map((edge, i) => {
          const sourceLabel = evidenceLabels[edge.source] ?? edge.source;
          const targetLabel = evidenceLabels[edge.target] ?? edge.target;
          return (
            <motion.div
              key={edge.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlassCard className="p-3">
                <p className="text-sm text-fg/80">
                  <span className="font-medium text-fg">{sourceLabel}</span>
                  {"  "}
                  <span style={{ color: "#7c6cff" }}>—[{edge.relation}]→</span>
                  {"  "}
                  <span className="font-medium text-fg">{targetLabel}</span>
                </p>
                {edge.rationale && (
                  <p className="mt-1 text-xs text-fg/40">{edge.rationale}</p>
                )}
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* Insights */}
      <div className="mb-8">
        <SectionTitle title="Timeline intelligence" />
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

      {/* AI Assistant */}
      <div className="mt-6">
        <AIAssistant patientId={selectedId} evidenceLabels={evidenceLabels} />
      </div>
    </div>
  );
}
