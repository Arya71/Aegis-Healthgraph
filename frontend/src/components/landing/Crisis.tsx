import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Reveal from "./Reveal";

const STATS = [
  {
    value: 12, decimals: 0, suffix: "M", color: "#ff9e6b",
    label: "U.S. adults hit by a diagnostic error every year — roughly one in twenty.",
    source: "BMJ Quality & Safety, 2014",
    answer: "Curie cross-references a lifetime of events to catch the pattern years sooner.",
  },
  {
    value: 1.3, decimals: 1, suffix: "M", color: "#ff6b6b",
    label: "Emergency-department visits a year for adverse drug events in the U.S. alone.",
    source: "U.S. Centers for Disease Control",
    answer: "RxShield simulates the metabolic pathway and flags the risk before the script is filled.",
  },
  {
    value: 7, decimals: 0, suffix: "", color: "#37d6b3",
    label: "Different physicians the average Medicare patient sees a year — across 4+ practices.",
    source: "Annals of Internal Medicine (Pham et al.)",
    answer: "MedSync gives all of them one shared, causal timeline instead of seven blind spots.",
  },
];

function useCountUp(target: number, run: boolean, ms = 1400) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      setN(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return n;
}

function Stat({ stat, index }: { stat: (typeof STATS)[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const n = useCountUp(stat.value, inView);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 26 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="glass p-8 text-center"
    >
      <div className="text-6xl font-extrabold tabular-nums tracking-tight" style={{ color: stat.color }}>
        {n.toFixed(stat.decimals)}{stat.suffix}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-fg/70">{stat.label}</p>
      <p className="mt-3 border-t border-line/10 pt-3 text-sm text-fg/85">{stat.answer}</p>
      <p className="mt-3 text-[11px] uppercase tracking-wider text-fg/30">{stat.source}</p>
    </motion.div>
  );
}

export default function Crisis() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fg/40">The crisis</div>
        <h2 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
          Fragmented data is <span className="gradient-text">expensive and dangerous</span>
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-fg/55">
          The cost of care that forgets isn't abstract. It shows up in missed diagnoses, preventable
          drug harm, and patients repeating their story to one clinician after another.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {STATS.map((s, i) => (
          <Stat key={s.label} stat={s} index={i} />
        ))}
      </div>
    </section>
  );
}
