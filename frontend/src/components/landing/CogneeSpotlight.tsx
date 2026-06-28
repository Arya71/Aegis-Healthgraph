import Reveal from "./Reveal";

const FNS = [
  {
    fn: "remember()", color: "#6ea8ff",
    body: "Ingests multi-modal data — notes, labs, wearable streams — and permanently grounds it into the patient's unified knowledge graph as connected entities and relationships.",
  },
  {
    fn: "recall()", color: "#7c6cff",
    body: "Auto-routes a query across fast session memory and the deep persistent graph, fetching context that is semantically and causally relevant, not just keyword-similar.",
  },
  {
    fn: "improve()", color: "#37d6b3",
    body: "Continuously re-weights edges and refines the ontology (memify) as new data arrives — so the memory becomes more accurate over the patient's lifetime, not staler.",
  },
  {
    fn: "forget()", color: "#ff7eb6",
    body: "Safely unlinks and prunes nodes from the graph and vector store, enabling granular, auditable data control and a real right-to-be-forgotten.",
  },
];

export default function CogneeSpotlight() {
  return (
    <section id="cognee" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-12">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#070b16] p-8 md:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(50% 60% at 20% 0%, rgba(124,108,255,0.25), transparent 60%), radial-gradient(50% 60% at 90% 100%, rgba(55,214,179,0.18), transparent 60%)" }}
        />
        <Reveal className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Built on Cognee · open-source AI memory
          </div>
          <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Not a wrapper. <span className="gradient-text">A native memory engine.</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            Aegis is built directly on Cognee's hybrid graph-vector memory and exercises its full
            lifecycle. The same four primitives power the dashboard, the REST API, and an MCP server
            any agent can call.
          </p>
        </Reveal>

        <div className="relative mt-12 grid gap-4 md:grid-cols-2">
          {FNS.map((f, i) => (
            <Reveal key={f.fn} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.06]">
                <code
                  className="font-mono text-lg font-bold"
                  style={{ color: f.color }}
                >
                  {f.fn}
                </code>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="relative mt-8">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 font-mono text-sm text-slate-300">
            <span className="text-slate-500"># one memory, many agents — also exposed over MCP</span>
            <br />
            <span className="text-[#7c6cff]">recall</span>
            <span className="text-slate-500">(</span>
            <span className="text-[#37d6b3]">"what's driving patient_001's kidney inflammation?"</span>
            <span className="text-slate-500">)</span>
            <span className="text-slate-500"> → 87% early-onset lupus · evidence: rash → arthralgia → ANA → nephritis</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
