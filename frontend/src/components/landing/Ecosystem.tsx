/**
 * Ecosystem.tsx — updated to include OmniGest (module 7).
 * Replace frontend/src/components/landing/Ecosystem.tsx with this file.
 * Changes: "omnigest" added to CONTENT; safety guard added; heading updated.
 */
import { useNavigate } from "react-router-dom";
import { MODULE_COLOR, MODULES } from "../../lib/api";
import type { ModuleKey } from "../../lib/types";
import FeatureViz from "./FeatureViz";
import Reveal from "./Reveal";

const CONTENT: Record<ModuleKey, { para: string; bullets: string[] }> = {
  curie: {
    para: "Curie is a diagnostic cross-reference engine that reads a patient's entire lifetime at once. Instead of matching keywords inside a single chart, it traverses the knowledge graph to surface relationships between events that happened years apart — catching rare disease patterns long before they declare themselves.",
    bullets: [
      "Graph traversal, not keyword search — it follows causal and semantic links",
      "Connects symptoms separated by years into a single coherent trajectory",
      "Every finding is confidence-scored and traces a visible reasoning path",
    ],
  },
  medsync: {
    para: "Specialist care is fragmented by design — each clinic sees its own slice. MedSync stitches cardiology, neurology, labs, pharmacy and wearables into one longitudinal timeline that understands causality, not just chronology.",
    bullets: [
      "Unifies records from every specialist, lab and device into one timeline",
      "Maps causal chains — medication → poor sleep → glucose spike",
      "Detects cross-specialty feedback loops no single department can see",
    ],
  },
  rxshield: {
    para: "Polypharmacy harms hundreds of thousands of patients a year. RxShield goes beyond pairwise interaction tables — it simulates metabolic pathways, enzyme inhibition and organ function to explain exactly why a drug is risky for this specific patient.",
    bullets: [
      "Weighs current, historical and lifestyle medications together",
      "Simulates CYP enzyme inhibition and competing metabolic pathways",
      "Returns explainable, patient-specific toxicity-risk percentages",
    ],
  },
  nutrisim: {
    para: "Medicine alone rarely explains chronic disease. NutriSim correlates continuous-glucose, sleep and activity data from wearables against the medical record to find the metabolic feedback loops that are unique to each patient.",
    bullets: [
      "Fuses sleep, nutrition and exercise signals with clinical events",
      "Discovers patient-specific loops, like late dinners → low REM → AM spikes",
      "Replaces generic advice with mechanisms you can actually act on",
    ],
  },
  pathos: {
    para: "Most mental-health tools forget you the moment you close the app. Pathos retains years of emotional context — journals, mood logs, therapy notes — to recognise long-term psychological patterns instead of starting from zero every session.",
    bullets: [
      "Carries emotional context across years, not single conversations",
      "Links mood and stress to concrete physical-health events",
      "Surfaces recurring situational triggers, like pre-review anxiety",
    ],
  },
  neurograph: {
    para: "NeuroGraph watches how a patient interacts with their own history. As cognition declines, their personal knowledge graph physically thins — and that degradation is measurable months before a standard test would flag it.",
    bullets: [
      "Tracks vocabulary richness and family-relationship recall over time",
      "Measures semantic retrieval latency and pronoun substitution",
      "Quantifies cognitive change passively, without formal testing",
    ],
  },
  omnigest: {
    para: "Raw medical files — blood panels, X-rays, pathology reports — are rich with signal but locked in unstructured formats. OmniGest uses Gemini 2.5 Flash to extract structured clinical entities from any PDF or image, strips all PII, lets the clinician review and edit every finding, then commits the verified data into the shared Cognee graph so all six modules gain context instantly.",
    bullets: [
      "Gemini 2.5 Flash multimodal extraction — PDFs, X-rays, scans, pathology reports",
      "Confidence heatmapping flags low-quality regions for mandatory clinical review",
      "One commit triggers remember() → recall() risk analysis → improve() edge reweighting",
    ],
  },
  healthforecast: {
    para: "Every other module builds the graph; HealthForecast looks forward through it. It reads the accumulated density of a patient's entire Cognee history — including anything OmniGest has just committed — to project chronic-disease risk five years out, simulate hypothetical lifestyle interventions against the real graph, and rank which single change would move the needle most.",
    bullets: [
      "Lifestyle sandbox calls real improve() — simulations genuinely reweight the graph, not just the UI",
      "Cross-system Failure Sentinel traces physiological cascades, like kidney stress → cardiovascular risk",
      "Trajectory visualizer plots actual graph-risk against an optimal-aging baseline, year by year",
    ],
  },
};

export default function Ecosystem() {
  const navigate = useNavigate();
  return (
    <section id="ecosystem" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fg/40">The ecosystem</div>
        <h2 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
          Eight agents. <span className="gradient-text">One shared memory.</span>
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-fg/55">
          Each module reasons over the same Cognee graph — so an insight from one immediately becomes
          evidence for the next. They don't sit side by side; they compound.
        </p>
      </Reveal>

      <div className="mt-20 space-y-24">
        {MODULES.map((m, i) => {
          const flip = i % 2 === 1;
          const c = MODULE_COLOR[m.key];
          const content = CONTENT[m.key];
          if (!content) return null; // safety guard — unknown module keys never crash
          const { para, bullets } = content;
          return (
            <div key={m.key} className="grid items-center gap-10 md:grid-cols-2">
              <Reveal x={flip ? 44 : -44} className={flip ? "md:order-2" : ""}>
                <FeatureViz module={m.key} />
              </Reveal>
              <Reveal x={flip ? -44 : 44} delay={0.05} className={flip ? "md:order-1" : ""}>
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ color: c, background: `${c}1a`, border: `1px solid ${c}40` }}
                >
                  <span className="text-base">{m.icon}</span> {m.name} · {m.tagline}
                </div>
                <h3 className="mt-4 text-2xl font-bold text-fg md:text-3xl">{m.name}</h3>
                <p className="mt-3 leading-relaxed text-fg/65">{para}</p>
                <ul className="mt-5 space-y-2.5">
                  {bullets.map((b) => (
                    <li key={b} className="flex gap-3 text-sm text-fg/75">
                      <span className="mt-0.5 shrink-0" style={{ color: c }}>◆</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate(`/${m.key}`)}
                  className="mt-6 text-sm font-semibold transition hover:opacity-80"
                  style={{ color: c }}
                >
                  Open {m.name} →
                </button>
              </Reveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}
