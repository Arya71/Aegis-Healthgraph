import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type CogneeFn = "remember" | "recall" | "improve" | "forget";

const META: Record<CogneeFn, { color: string; verb: string }> = {
  remember: { color: "#6ea8ff", verb: "remember()" },
  recall: { color: "#7c6cff", verb: "recall()" },
  improve: { color: "#37d6b3", verb: "improve()" },
  forget: { color: "#ff7eb6", verb: "forget()" },
};

export default function CogneeTooltip({ fn, explanation }: { fn: CogneeFn; explanation: string }) {
  const [open, setOpen] = useState(false);
  const m = META[fn];
  return (
    <span
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`How Cognee ${m.verb} powers this feature`}
        className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold italic leading-none"
        style={{ color: m.color, borderColor: `${m.color}66`, background: `${m.color}1a` }}
      >
        i
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-line/10 bg-bg/95 p-3 text-left shadow-xl backdrop-blur-xl"
          >
            <span className="mb-1 block text-xs font-bold" style={{ color: m.color }}>
              🧠 Powered by Cognee {m.verb}
            </span>
            <span className="block text-xs leading-relaxed text-fg/70">{explanation}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
