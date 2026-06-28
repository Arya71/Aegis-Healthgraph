import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import CogneeTooltip, { type CogneeFn } from "./CogneeTooltip";
import AsyncButton from "./AsyncButton";

export default function MemoryActionCard({
  fn, accent, title, explanation, description, buttonLabel, runningLabel, danger = false, onRun,
}: {
  fn: CogneeFn;
  accent: string;
  title: string;
  explanation: string;
  description: string;
  buttonLabel: string;
  runningLabel: string;
  danger?: boolean;
  onRun: () => Promise<{ message: string }>;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const tone = danger ? "#ff6b6b" : accent;
  return (
    <div className="glass flex h-full flex-col p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-fg">{title}</h3>
        <CogneeTooltip fn={fn} explanation={explanation} />
      </div>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-fg/50">{description}</p>
      <div className="mt-3">
        <AsyncButton
          runningLabel={runningLabel}
          className="btn-ghost text-sm"
          style={{ color: tone, borderColor: `${tone}55` }}
          onClick={async () => {
            const r = await onRun();
            setMsg(r.message);
            setTimeout(() => setMsg((m) => (m === r.message ? null : m)), 7000);
          }}
        >
          {buttonLabel}
        </AsyncButton>
      </div>
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed"
              style={{ borderColor: `${tone}40`, background: `${tone}12`, color: tone }}
            >
              ✦ {msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
