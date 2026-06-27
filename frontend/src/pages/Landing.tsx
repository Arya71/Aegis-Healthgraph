import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MODULES } from "../lib/api";
import ThemeToggle from "../components/ThemeToggle";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
      <div className="fixed right-5 top-5 z-30">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="mb-5 inline-flex items-center gap-2 rounded-full border border-line/10 bg-surface/5 px-4 py-1.5 text-xs font-medium text-fg/60"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Powered by Cognee · persistent knowledge-graph memory
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
        className="text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl"
      >
        The healthcare AI that
        <br />
        <span className="gradient-text">remembers the patient</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
        className="mt-6 max-w-2xl text-lg leading-relaxed text-fg/60"
      >
        Aegis HealthGraph connects every symptom, medication, lab, lifestyle signal,
        emotion and cognitive change into one evolving patient knowledge graph — a
        <span className="text-fg/90"> Digital Cognitive Twin</span> that six AI
        modules reason over together.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
        className="mt-9 flex flex-wrap items-center justify-center gap-3"
      >
        <button className="btn-primary px-6 py-3 text-base" onClick={() => navigate("/dashboard")}>
          Enter the platform →
        </button>
        <button className="btn-ghost px-6 py-3 text-base" onClick={() => navigate("/patients")}>
          Browse patients
        </button>
      </motion.div>

      <div className="mt-16 grid w-full grid-cols-2 gap-3 md:grid-cols-3">
        {MODULES.map((m, i) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.07 }}
            onClick={() => navigate(`/${m.key}`)}
            className="glass glass-hover cursor-pointer p-4 text-left"
          >
            <div className="text-2xl">{m.icon}</div>
            <div className="mt-2 font-bold text-fg">{m.name}</div>
            <div className="text-xs text-fg/45">{m.tagline}</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 text-xs text-fg/30">
        One persistent memory · Six collaborating agents · Also exposed as an MCP server
      </div>
    </div>
  );
}
