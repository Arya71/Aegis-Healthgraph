import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Reveal from "./Reveal";

const FAQS = [
  {
    q: "Is Aegis HIPAA-compliant, and how is patient data protected?",
    a: "Aegis is designed around granular data control. Memory is encrypted at rest and in transit, every access is auditable, and PHI is never used to train foundation models. The forget() primitive unlinks and prunes a patient's nodes across both the graph and the vector store, so a real right-to-be-forgotten is built into the memory layer itself.",
  },
  {
    q: "Does it integrate with Epic, Cerner and our existing EHR?",
    a: "Yes. Aegis ingests through standard FHIR and HL7 interfaces and accepts unstructured notes, lab feeds and wearable streams in any format. It runs read-only alongside your system of record — it enriches the record with connected memory rather than replacing it.",
  },
  {
    q: "How is graph memory different from a vector database or plain RAG?",
    a: "RAG retrieves passages that look similar to a query. Aegis stores entities, the relationships between them, and when each occurred — then reasons by traversing those links. That's what lets it connect a rash in 2023 to nephritis in 2025 as one trajectory, instead of returning two unrelated snippets.",
  },
  {
    q: "Who owns the data, and can a single patient be removed?",
    a: "The provider and patient own the data; Aegis is the memory layer over it. Because every fact is a node with explicit edges, removal is surgical — forget() can drop one patient (or one dataset) without disturbing the rest of the graph, and the change is logged.",
  },
  {
    q: "How do you keep the AI from hallucinating medical claims?",
    a: "Every insight is grounded in the graph and ships with the exact path it traversed plus a confidence score, so a clinician can verify the reasoning in one click. Aegis is decision support with a human in the loop — it surfaces connections for review, it does not make autonomous clinical decisions.",
  },
];

function Item({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal delay={index * 0.05}>
      <div className="glass overflow-hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-4 px-5 py-4 text-left"
        >
          <span className="flex-1 font-semibold text-fg">{q}</span>
          <motion.span animate={{ rotate: open ? 45 : 0 }} className="text-xl text-fg/40">+</motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <p className="px-5 pb-5 text-sm leading-relaxed text-fg/65">{a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

export default function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-6 py-24">
      <Reveal className="text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fg/40">FAQ</div>
        <h2 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
          Questions, <span className="gradient-text">answered</span>
        </h2>
      </Reveal>
      <div className="mt-12 space-y-3">
        {FAQS.map((f, i) => (
          <Item key={f.q} q={f.q} a={f.a} index={i} />
        ))}
      </div>
    </section>
  );
}
