import Reveal from "./Reveal";

const STEPS = [
  {
    icon: "📥", title: "Ingest", color: "#6ea8ff",
    body: "Connect EHRs, wearables, labs and free-text notes in any format — structured or not. Nothing has to be cleaned or normalised first.",
  },
  {
    icon: "🧩", title: "Cognify", color: "#7c6cff",
    body: "Cognee extracts entities, relationships and time, weaving everything into one temporal knowledge graph backed by a hybrid graph-vector store.",
  },
  {
    icon: "🔎", title: "Reason", color: "#ff7eb6",
    body: "The six agents traverse that graph together, following causal and semantic links to surface hidden connections no single record reveals.",
  },
  {
    icon: "⚡", title: "Act", color: "#37d6b3",
    body: "Confidence-scored, explainable insights land on the dashboard — each one tracing the exact graph path it reasoned over.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fg/40">How Aegis works</div>
        <h2 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
          From raw data to <span className="gradient-text">a reasoning twin</span>
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-fg/55">
          Four steps turn scattered medical exhaust into a memory that gets smarter every time it's used.
        </p>
      </Reveal>

      <div className="relative mt-16 grid gap-8 md:grid-cols-4">
        <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-[#6ea8ff] via-[#ff7eb6] to-[#37d6b3] opacity-40 md:block" />
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.1} className="relative text-center">
            <div
              className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
              style={{ background: `${s.color}22`, border: `1px solid ${s.color}66`, boxShadow: `0 0 28px -10px ${s.color}` }}
            >
              {s.icon}
              <span
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: s.color }}
              >
                {i + 1}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-bold text-fg">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg/60">{s.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
