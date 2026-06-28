import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MODULES } from "../../lib/api";
import ThemeToggle from "../ThemeToggle";

export default function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 pb-20 pt-28 text-center">
      <div className="absolute right-5 top-5 z-30">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="inline-flex items-center gap-2 rounded-full border border-line/10 bg-surface/5 px-4 py-1.5 text-xs font-medium text-fg/60"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Powered by Cognee · persistent knowledge-graph memory
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
        className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl"
      >
        The lifelong
        <br />
        <span className="gradient-text">cognitive healthcare</span> ecosystem
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
        className="mt-6 max-w-2xl text-lg leading-relaxed text-fg/60"
      >
        Aegis HealthGraph doesn't just store records — it builds a
        <span className="text-fg/90"> Digital Cognitive Twin</span> of every patient from
        persistent AI memory, then lets six specialist agents reason over it together. One graph.
        One patient. A lifetime of context that never resets.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
        className="relative mt-9 flex flex-wrap items-center justify-center gap-3"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 mx-auto h-16 max-w-md animate-pulse rounded-full bg-[#7c6cff]/30 blur-3xl" />
        <button className="btn-primary px-7 py-3.5 text-base" onClick={() => navigate("/dashboard")}>
          Enter Patient Graph →
        </button>
        <button className="btn-ghost px-6 py-3.5 text-base" onClick={() => navigate("/patients")}>
          Browse patients
        </button>
      </motion.div>

      <div className="mt-16 w-full">
        <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-fg/35">
          Six agents · one shared memory
        </div>
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3">
          {MODULES.map((m, i) => (
            <motion.button
              key={m.key}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.07 }}
              onClick={() => navigate(`/${m.key}`)}
              className="glass glass-hover cursor-pointer p-4 text-left"
            >
              <div className="text-2xl">{m.icon}</div>
              <div className="mt-2 font-bold text-fg">{m.name}</div>
              <div className="text-xs text-fg/45">{m.tagline}</div>
            </motion.button>
          ))}
        </div>
      </div>

      <a href="#ecosystem" className="mt-14 text-xs text-fg/30 transition hover:text-fg/60">
        Scroll to explore ↓
      </a>
    </section>
  );
}
