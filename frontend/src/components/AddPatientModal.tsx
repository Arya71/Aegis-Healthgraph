import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import AsyncButton from "./cognee/AsyncButton";
import CogneeTooltip from "./cognee/CogneeTooltip";

export default function AddPatientModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState(50);
  const [sex, setSex] = useState("F");
  const [conditions, setConditions] = useState("");
  const [story, setStory] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) {
      setError("Patient name is required.");
      return;
    }
    setError("");
    const p = await api.createPatient({
      name: name.trim(), age: Number(age) || 50, sex,
      conditions: conditions.split(",").map((c) => c.trim()).filter(Boolean),
      story: story.trim(),
    });
    onCreated(p.id);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-md p-6"
          >
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-xl font-bold text-fg">New Digital Cognitive Twin</h2>
              <CogneeTooltip fn="remember" explanation="Creating a patient seeds a fresh Cognee dataset via remember(): a baseline knowledge graph the six modules immediately begin reasoning over." />
            </div>
            <p className="mb-5 text-sm text-fg/50">Seed a new patient memory. Insights compound as more events are added.</p>

            <div className="space-y-3">
              <Field label="Full name">
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Jordan Avery" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Age">
                  <input type="number" min={0} max={120} value={age} onChange={(e) => setAge(Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Sex">
                  <select value={sex} onChange={(e) => setSex(e.target.value)} className={inputCls}>
                    <option value="F" style={optStyle}>F</option>
                    <option value="M" style={optStyle}>M</option>
                    <option value="X" style={optStyle}>X</option>
                  </select>
                </Field>
              </div>
              <Field label="Conditions (comma-separated)">
                <input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. Hypertension, Anxiety" className={inputCls} />
              </Field>
              <Field label="Story (optional)">
                <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={2} placeholder="One-line summary of this patient" className={`${inputCls} resize-none`} />
              </Field>
            </div>

            {error && <p className="mt-3 text-sm text-[#ff6b6b]">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={onClose} className="btn-ghost">Cancel</button>
              <AsyncButton className="btn-primary" runningLabel="Creating…" onClick={submit}>Create patient</AsyncButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const inputCls =
  "w-full rounded-xl border border-line/10 bg-field/30 px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-fg/30 focus:border-[#7c6cff]";
const optStyle = { background: "rgb(var(--bg))", color: "rgb(var(--fg))" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-fg/40">{label}</span>
      {children}
    </label>
  );
}
