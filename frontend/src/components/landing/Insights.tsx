import { useNavigate } from "react-router-dom";
import { MODULE_COLOR } from "../../lib/api";
import type { ModuleKey } from "../../lib/types";
import Reveal from "./Reveal";

const POSTS: { module: ModuleKey; tag: string; icon: string; title: string; excerpt: string }[] = [
  {
    module: "neurograph", tag: "NeuroGraph · Research", icon: "🧠",
    title: "When the knowledge graph forgets first",
    excerpt: "Family-relationship recall fell 32% in 60 days while standard screens stayed 'normal'. How measuring the decay of a personal graph flags decline before the test does.",
  },
  {
    module: "rxshield", tag: "RxShield · Case study", icon: "🛡️",
    title: "The interaction no EHR flagged",
    excerpt: "A routine antibiotic met a long-standing statin through CYP3A4 — and reduced kidney function quietly amplified the risk. A pathway-aware near-miss, caught before the dose.",
  },
  {
    module: "nutrisim", tag: "NutriSim · Field note", icon: "🥗",
    title: "The sleep–glucose loop hiding in plain sight",
    excerpt: "Late dinners shortened REM; short REM spiked morning glucose; the spikes tracked weight gain into prediabetes. One self-reinforcing loop across four years of records.",
  },
];

export default function Insights() {
  const navigate = useNavigate();
  return (
    <section id="insights" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fg/40">Medical AI insights</div>
        <h2 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
          What a memory that <span className="gradient-text">connects</span> finds
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-fg/55">
          Real patterns from the demo graph — each one traceable, each one invisible to any single chart.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {POSTS.map((p, i) => {
          const c = MODULE_COLOR[p.module];
          return (
            <Reveal key={p.title} delay={i * 0.1}>
              <button
                onClick={() => navigate(`/${p.module}`)}
                className="glass glass-hover group flex h-full flex-col overflow-hidden p-0 text-left"
              >
                <div
                  className="relative flex h-36 items-center justify-center text-5xl"
                  style={{ background: `linear-gradient(135deg, ${c}33, ${c}0d)` }}
                >
                  <span className="transition group-hover:scale-110">{p.icon}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: c }}>
                    {p.tag}
                  </span>
                  <h3 className="mt-2 text-lg font-bold leading-snug text-fg">{p.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-fg/60">{p.excerpt}</p>
                  <span className="mt-4 text-sm font-semibold transition group-hover:opacity-80" style={{ color: c }}>
                    Explore in the demo →
                  </span>
                </div>
              </button>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
