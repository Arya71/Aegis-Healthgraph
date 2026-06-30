/**
 * InsightCard.tsx — updated to show a "New from OmniGest" badge.
 * Replace frontend/src/components/InsightCard.tsx with this file.
 * Only change: checks (insight as any).sourceTag === "omnigest" and renders a badge.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { MODULE_COLOR } from "../lib/api";
import type { CrossInsight, Insight } from "../lib/types";
import { ConfidenceMeter, Pill, Typewriter } from "./ui";

type AnyInsight = (Insight | CrossInsight) & { module?: string; modules?: string[]; sourceTag?: string };

export default function InsightCard({
  insight, evidenceLabels = {}, type = false, index = 0,
}: {
  insight: AnyInsight;
  evidenceLabels?: Record<string, string>;
  type?: boolean;
  index?: number;
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const modules = insight.modules ?? (insight.module ? [insight.module] : []);
  const accent = MODULE_COLOR[(modules[0] as keyof typeof MODULE_COLOR) ?? "curie"] ?? "#8b6cff";
  const cross = modules.length > 1;
  const isNew = insight.sourceTag === "omnigest";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="glass glass-hover relative overflow-hidden p-5"
      style={{ borderColor: isNew ? "#0fe0c855" : cross ? `${accent}55` : undefined }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: isNew
          ? "linear-gradient(90deg,#0fe0c8,#37d6b3,transparent)"
          : cross
          ? "linear-gradient(90deg,#6ea8ff,#7c6cff,#ff7eb6,#37d6b3,#ffb86b)"
          : `linear-gradient(90deg, ${accent}, transparent)` }}
      />
      <div className="mb-2 flex items-center gap-2">
        {isNew && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: "#0fe0c822", color: "#0fe0c8", border: "1px solid #0fe0c855" }}
          >
            📂 New from OmniGest
          </motion.span>
        )}
        {cross && <Pill color="#ff9ecb">✦ Cross-module</Pill>}
        {modules.map((m) => (
          <Pill key={m} color={MODULE_COLOR[m as keyof typeof MODULE_COLOR]}>{m}</Pill>
        ))}
        <div className="ml-auto"><ConfidenceMeter value={insight.confidence} color={accent} /></div>
      </div>

      <h3 className="text-[15px] font-bold leading-snug text-fg">{insight.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg/70">
        {type || isNew ? <Typewriter text={insight.body} /> : insight.body}
      </p>

      {insight.evidence?.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowReasoning((s) => !s)}
            className="text-xs font-semibold text-fg/50 transition hover:text-fg/90"
          >
            {showReasoning ? "▾ Hide reasoning" : "▸ Show reasoning"}
          </button>
          <AnimatePresence>
            {showReasoning && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 rounded-xl border border-line/10 bg-field/20 p-3">
                  <div className="mb-1.5 text-[11px] uppercase tracking-wider text-fg/40">
                    Graph path traversed
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {insight.evidence.map((id, i) => (
                      <span key={id} className="flex items-center gap-1.5">
                        <span className="chip" style={{ borderColor: `${accent}55` }}>
                          {evidenceLabels[id] ?? id}
                        </span>
                        {i < insight.evidence.length - 1 && <span className="text-fg/30">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
