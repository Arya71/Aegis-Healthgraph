import { motion } from "framer-motion";
import type { ModuleKey } from "../lib/types";
import { MODULE_COLOR, MODULES } from "../lib/api";

export default function ModuleHeader({ module }: { module: ModuleKey }) {
  const m = MODULES.find((x) => x.key === module)!;
  const color = MODULE_COLOR[module];
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      className="relative mb-6 overflow-hidden rounded-2xl border border-line/10 p-6"
      style={{ background: `linear-gradient(120deg, ${color}1f, transparent 70%)` }}
    >
      <div className="absolute -right-10 -top-10 text-[120px] opacity-10">{m.icon}</div>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{m.icon}</span>
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color }}>{m.name}</h1>
          <p className="text-sm text-fg/55">{m.tagline}</p>
        </div>
      </div>
    </motion.div>
  );
}
