import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { api } from "../lib/api";
import type { RecallResult } from "../lib/types";
import { ConfidenceMeter, Pill, Typewriter } from "./ui";

// Web Speech API (Chrome/Edge/Safari). Feature-detected; absent elsewhere.
const SpeechRec: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;

const SUGGESTIONS = [
  "Has this patient had similar symptoms before?",
  "Are there any dangerous drug interactions right now?",
  "What explains the morning glucose spikes?",
];

export default function AIAssistant({
  patientId, evidenceLabels = {}, compact = false,
}: {
  patientId: string;
  evidenceLabels?: Record<string, string>;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<RecallResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);

  function startVoice() {
    if (!SpeechRec) return;
    const r = new SpeechRec();
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setQ(transcript);
      ask(transcript);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  }

  function stopVoice() {
    recogRef.current?.stop();
    setListening(false);
  }

  async function ask(query: string) {
    if (!query.trim()) return;
    setQ(query);
    setLoading(true);
    setResult(null);
    try {
      const r = await api.recall(patientId, query);
      // brief "thinking" delay for demo feel
      setTimeout(() => { setResult(r); setLoading(false); }, 450);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="glass p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">🧠</span>
        <div>
          <div className="text-sm font-bold text-fg">Ask the patient's memory</div>
          <div className="text-xs text-fg/40">Cognee recall over the lifelong graph</div>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(q)}
          placeholder="e.g. has this patient had similar symptoms before?"
          className="flex-1 rounded-xl border border-line/10 bg-field/30 px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-fg/30 focus:border-[#7c6cff]"
        />
        {SpeechRec && (
          <button
            onClick={() => (listening ? stopVoice() : startVoice())}
            title="Dictate your question"
            aria-label="Voice input"
            className={`btn-ghost !px-3 ${listening ? "!border-[#ff7eb6]/60 text-[#ff7eb6]" : ""}`}
          >
            <span className={listening ? "animate-pulse" : ""}>{listening ? "● Listening" : "🎤"}</span>
          </button>
        )}
        <button className="btn-primary" onClick={() => ask(q)}>Recall</button>
      </div>

      {!compact && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => ask(s)} className="chip transition hover:bg-surface/10">
              {s}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 text-sm text-fg/50"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#7c6cff]" />
            Traversing knowledge graph…
          </motion.div>
        )}
        {result && !loading && (
          <motion.div
            key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl border border-line/10 bg-field/20 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <Pill color="#9ec3ff">{result.source}</Pill>
              <ConfidenceMeter value={result.confidence} />
            </div>
            <p className="text-sm leading-relaxed text-fg/85">
              <Typewriter text={result.answer} />
            </p>
            {result.evidence.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.evidence.map((id) => (
                  <span key={id} className="chip" style={{ borderColor: "#6ea8ff55" }}>
                    {evidenceLabels[id] ?? id}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
