import Reveal from "./Reveal";

const ROWS = [
  ["Data storage", "Siloed across clinics, portals and PDFs", "One unified, living patient knowledge graph"],
  ["AI reasoning", "Keyword and string matching", "Deep graph traversal + temporal reasoning"],
  ["Timeline", "Flat, chronological record lists", "Causal relationship mapping — what caused what"],
  ["Context retention", "Resets at every new visit", "Lifelong persistent memory that compounds"],
  ["Drug safety", "Static, pairwise interaction lookups", "Pathway- and patient-aware simulation"],
  ["Explainability", "Opaque, black-box outputs", "Every insight traces a visible graph path"],
];

export default function Paradigm() {
  return (
    <section id="paradigm" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fg/40">The paradigm shift</div>
        <h2 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
          Records are static. <span className="gradient-text">Memory is alive.</span>
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-fg/55">
          The difference isn't a better interface on top of the same data — it's a fundamentally
          different substrate underneath.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-12">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="w-[22%] px-4 py-4 text-xs font-semibold uppercase tracking-wider text-fg/40"> </th>
              <th className="w-[39%] px-4 py-4 text-sm font-bold text-fg/55">Current healthcare system</th>
              <th className="w-[39%] rounded-t-2xl bg-surface/[0.06] px-4 py-4 text-sm font-bold text-fg">
                <span className="gradient-text">Aegis HealthGraph</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([dim, current, aegis], i) => (
              <tr key={dim}>
                <td className="border-t border-line/10 px-4 py-4 text-sm font-semibold text-fg/80">{dim}</td>
                <td className="border-t border-line/10 px-4 py-4 text-sm text-fg/55">
                  <span className="mr-2 text-[#ff6b6b]">✕</span>{current}
                </td>
                <td
                  className={`border-t border-line/10 bg-surface/[0.06] px-4 py-4 text-sm text-fg/85 ${
                    i === ROWS.length - 1 ? "rounded-b-2xl" : ""
                  }`}
                >
                  <span className="mr-2 text-[#37d6b3]">✓</span>{aegis}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </section>
  );
}
