/**
 * OmniGest — Multimodal Ingestion Hub (Module 7)
 *
 * Features implemented:
 *  1. Multimodal drag-and-drop dropzone (PDF + Image)
 *  2. Gemini 2.5 Flash extraction sandbox (split-screen, live entity list, editable)
 *  3. Live graph integration via api.remember()
 *  4. "So What?" recall() analysis report
 *  5. Cognee tooltip integration on all primary actions
 *  6. Confidence heatmapping (green ≥80, amber 50-79, red <50)
 *  7. Context conflict resolution engine via api.improve()
 *  8. Automated metadata extractor (date, clinic, doc type)
 *  9. Cross-specialty alert emitter (module routing tags + toast)
 * 10. Batch processing queue with chronological sorting
 */

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KnowledgeGraph from "../../components/KnowledgeGraph";
import CogneeTooltip from "../../components/cognee/CogneeTooltip";
import { GlassCard, Pill, SectionTitle, Spinner, Typewriter } from "../../components/ui";
import { api, MODULE_COLOR, MODULES } from "../../lib/api";
import { usePatients } from "../../lib/PatientContext";
import { usePatientData } from "../../lib/usePatientData";
import type { Graph, GraphEdge, GraphNode, ModuleKey } from "../../lib/types";

// ─── colour tokens ────────────────────────────────────────────────────────────
const TEAL   = "#0fe0c8";
const AMBER  = "#f6a623";
const TEAL_DIM = "#0fe0c822";
const AMBER_DIM = "#f6a62322";

// ─── types ────────────────────────────────────────────────────────────────────
interface ClinicalEntity {
  label: string;
  type: string;
  value?: string;
  unit?: string;
  reference_range?: string;
  status?: "normal" | "abnormal" | "critical" | "borderline";
  confidence: number;
  module_tags: string[];
  _deleted?: boolean;
  _edited?: boolean;
}

interface DocMeta {
  document_date?: string;
  clinic_name?: string;
  document_type?: string;
  attending_physician?: string;
}

interface ConflictItem {
  existing_node_id: string;
  existing_label: string;
  new_entity_label: string;
  new_value?: string;
  reason: string;
  recommendation: string;
}

interface ExtractionResult {
  ok: boolean;
  metadata: DocMeta;
  entities: ClinicalEntity[];
  conflicts: ConflictItem[];
  module_tags: string[];
  summary_text: string;
  error?: string;
}

interface QueuedFile {
  id: string;
  file: File;
  preview: string | null;   // data-URL for images
  status: "pending" | "extracting" | "ready" | "committing" | "committed" | "error";
  result?: ExtractionResult;
  editedEntities?: ClinicalEntity[];
  error?: string;
  commitResult?: { nodes_added: number; recall_analysis?: any; source: string };
}

interface Toast {
  id: string;
  message: string;
  color: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const BASE = (import.meta as any).env?.VITE_API_BASE ?? "/api";

async function uploadExtract(pid: string, file: File): Promise<ExtractionResult> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${BASE}/omnigest/extract/${pid}`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`${r.status} extraction failed`);
  return r.json();
}

async function commitEntities(
  pid: string,
  entities: ClinicalEntity[],
  summary: string,
  meta: DocMeta,
) {
  const r = await fetch(`${BASE}/omnigest/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_id: pid,
      entities: entities.filter((e) => !e._deleted),
      summary_text: summary,
      document_date: meta.document_date,
      document_type: meta.document_type,
    }),
  });
  if (!r.ok) throw new Error(`${r.status} commit failed`);
  return r.json();
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function confidenceColor(c: number): { bg: string; text: string; border: string } {
  if (c >= 80) return { bg: "#16a34a22", text: "#4ade80", border: "#16a34a55" };
  if (c >= 50) return { bg: `${AMBER}22`, text: AMBER, border: `${AMBER}55` };
  return { bg: "#ef444422", text: "#f87171", border: "#ef444455" };
}

function statusColor(s?: string): string {
  if (!s || s === "normal") return "#4ade80";
  if (s === "borderline") return AMBER;
  if (s === "critical") return "#f87171";
  return "#f87171"; // abnormal
}

const MODULE_META: Record<string, { icon: string; name: string }> = Object.fromEntries(
  MODULES.map((m) => [m.key, { icon: m.icon, name: m.name }])
);

// ─── sub-components ───────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const c = confidenceColor(value);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
      title={`Gemini confidence: ${value}%`}
    >
      {value}%
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const color = statusColor(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
    >
      {status}
    </span>
  );
}

function ModuleTag({ tag }: { tag: string }) {
  const color = MODULE_COLOR[tag as ModuleKey] ?? TEAL;
  const meta  = MODULE_META[tag];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: `${color}1a`, color, border: `1px solid ${color}44` }}
    >
      {meta?.icon} {meta?.name ?? tag}
    </span>
  );
}

function ToastStack({ toasts, remove }: { toasts: Toast[]; remove: (id: string) => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            className="flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-xl"
            style={{ background: `${t.color}18`, borderColor: `${t.color}55`, color: t.color }}
          >
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100">✕</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── dropzone ─────────────────────────────────────────────────────────────────
function Dropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = ".pdf,.jpg,.jpeg,.png,.webp";

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/") || f.type === "application/pdf"
      );
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className="relative flex cursor-pointer flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300"
      style={{
        borderColor: over ? TEAL : `${TEAL}55`,
        background: over ? `${TEAL}0d` : TEAL_DIM,
        boxShadow: over ? `0 0 60px -12px ${TEAL}` : "none",
      }}
    >
      {/* animated rings */}
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.15, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-0 rounded-3xl border-2"
        style={{ borderColor: TEAL }}
      />

      {/* icon */}
      <motion.div
        animate={{ y: over ? -6 : 0 }}
        transition={{ duration: 0.3 }}
        className="text-6xl"
      >
        📂
      </motion.div>

      <div>
        <div className="text-xl font-extrabold" style={{ color: TEAL }}>
          Drop files here to ingest
        </div>
        <div className="mt-1 text-sm text-fg/50">
          PDFs (blood reports, panels) · Images (X-rays, scans)
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {["🧪 Blood Report PDF", "🩻 X-Ray / CT Image", "📋 Pathology Report"].map((l) => (
            <span key={l} className="chip" style={{ borderColor: `${TEAL}44`, color: TEAL }}>
              {l}
            </span>
          ))}
        </div>
      </div>

      <div className="text-xs text-fg/35">
        or{" "}
        <span className="underline" style={{ color: TEAL }}>
          browse files
        </span>{" "}
        — accepts PDF, JPG, PNG
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── entity editor row ────────────────────────────────────────────────────────
function EntityRow({
  entity,
  index,
  onChange,
  onDelete,
}: {
  entity: ClinicalEntity;
  index: number;
  onChange: (i: number, field: keyof ClinicalEntity, val: string) => void;
  onDelete: (i: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cc = confidenceColor(entity.confidence);

  if (entity._deleted) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="rounded-xl border p-3 transition-colors"
      style={{ borderColor: cc.border, background: cc.bg }}
    >
      <div className="flex items-start gap-2">
        {/* confidence dot */}
        <div
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: cc.text }}
          title={`Confidence: ${entity.confidence}%`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              value={entity.label}
              onChange={(e) => onChange(index, "label", e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line/10 bg-field/30 px-2 py-1 text-sm font-semibold text-fg outline-none focus:border-[#0fe0c8]"
            />
            <ConfidenceBadge value={entity.confidence} />
            <StatusBadge status={entity.status} />
            {entity.module_tags.map((t) => <ModuleTag key={t} tag={t} />)}
            <button
              onClick={() => setExpanded((x) => !x)}
              className="text-[10px] text-fg/40 hover:text-fg/80"
            >
              {expanded ? "▾ less" : "▸ more"}
            </button>
            <button
              onClick={() => onDelete(index)}
              title="Remove this entity"
              className="ml-auto text-[#f87171]/60 hover:text-[#f87171]"
            >
              ✕
            </button>
          </div>

          {entity.value && (
            <div className="mt-1 text-xs text-fg/60">
              <span style={{ color: cc.text }} className="font-bold">
                {entity.value} {entity.unit}
              </span>
              {entity.reference_range && (
                <span className="ml-2 text-fg/40">ref: {entity.reference_range}</span>
              )}
            </div>
          )}

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 grid grid-cols-2 gap-2 overflow-hidden"
              >
                {(["value", "unit", "reference_range"] as const).map((f) => (
                  <div key={f}>
                    <div className="text-[10px] uppercase tracking-wider text-fg/35">{f.replace("_", " ")}</div>
                    <input
                      value={(entity[f] as string) ?? ""}
                      onChange={(e) => onChange(index, f, e.target.value)}
                      placeholder={`—`}
                      className="w-full rounded-lg border border-line/10 bg-field/30 px-2 py-1 text-xs text-fg outline-none focus:border-[#0fe0c8]"
                    />
                  </div>
                ))}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-fg/35">status</div>
                  <select
                    value={entity.status ?? "normal"}
                    onChange={(e) => onChange(index, "status", e.target.value)}
                    className="w-full rounded-lg border border-line/10 bg-field/30 px-2 py-1 text-xs text-fg outline-none"
                  >
                    {["normal","borderline","abnormal","critical"].map((s) => (
                      <option key={s} value={s} style={{ background: "rgb(var(--bg))" }}>{s}</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── conflict banner ──────────────────────────────────────────────────────────
function ConflictBanner({
  conflicts,
  onResolve,
}: {
  conflicts: ConflictItem[];
  onResolve: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (!conflicts.length || dismissed) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-4"
      style={{ borderColor: `${AMBER}55`, background: `${AMBER}0d` }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        <span className="font-bold" style={{ color: AMBER }}>
          Context Conflict Detected
        </span>
        <CogneeTooltip
          fn="improve"
          explanation="Accepting a conflicting new finding triggers api.improve() — Cognee re-weights the existing graph edges so stale nodes are deprioritised without being deleted."
        />
      </div>

      <div className="space-y-2">
        {conflicts.map((c, i) => (
          <div key={i} className="rounded-xl border border-line/10 bg-field/20 p-3 text-sm">
            <div className="font-semibold text-fg">{c.reason}</div>
            <div className="mt-1 text-xs text-fg/55">
              <span className="font-medium" style={{ color: AMBER }}>Existing:</span>{" "}
              {c.existing_label}
              {" → "}
              <span className="font-medium" style={{ color: TEAL }}>New:</span>{" "}
              {c.new_entity_label}
              {c.new_value ? ` (${c.new_value})` : ""}
            </div>
            <div className="mt-1 text-[11px] text-fg/40">{c.recommendation}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onResolve}
          className="btn text-sm font-semibold"
          style={{ background: `${AMBER}22`, color: AMBER, border: `1px solid ${AMBER}55` }}
        >
          Accept new findings & run improve()
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="btn-ghost text-sm"
        >
          Keep existing
        </button>
      </div>
    </motion.div>
  );
}

// ─── document card in queue ───────────────────────────────────────────────────
function QueueCard({
  item,
  active,
  onSelect,
}: {
  item: QueuedFile;
  active: boolean;
  onSelect: () => void;
}) {
  const statusMeta: Record<QueuedFile["status"], { label: string; color: string }> = {
    pending:    { label: "Pending", color: "#9ca3af" },
    extracting: { label: "Extracting…", color: TEAL },
    ready:      { label: "Ready to commit", color: AMBER },
    committing: { label: "Committing…", color: "#7c6cff" },
    committed:  { label: "Committed ✓", color: "#4ade80" },
    error:      { label: "Error", color: "#f87171" },
  };
  const s = statusMeta[item.status];

  return (
    <button
      onClick={onSelect}
      className={`glass glass-hover w-full p-3 text-left transition-all ${active ? "ring-1" : ""}`}
      style={active ? { ringColor: TEAL } : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">
          {item.file.type === "application/pdf" ? "📄" : "🩻"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-fg">
            {item.file.name}
          </div>
          <div className="text-[10px]" style={{ color: s.color }}>{s.label}</div>
        </div>
        {item.status === "extracting" || item.status === "committing" ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" style={{ color: TEAL }} />
        ) : null}
      </div>
    </button>
  );
}

// ─── "So What?" recall panel ──────────────────────────────────────────────────
function SoWhatPanel({ result }: { result: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-5"
      style={{ borderColor: `${TEAL}44`, background: `${TEAL}0a` }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">🔍</span>
        <span className="font-bold" style={{ color: TEAL }}>
          "So What?" — Risk Profile Impact
        </span>
        <CogneeTooltip
          fn="recall"
          explanation="After committing, OmniGest fires api.recall() asking how the new document changes the patient's overall risk profile — cross-referencing all six module graphs."
        />
        {result.confidence && (
          <span className="ml-auto text-[11px] text-fg/40">
            confidence {result.confidence}%
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-fg/85">
        <Typewriter text={result.answer ?? "Analysis complete."} speed={10} />
      </p>
      {result.evidence?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.evidence.map((id: string) => (
            <span key={id} className="chip" style={{ borderColor: `${TEAL}44`, color: TEAL }}>
              {id}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function OmniGest() {
  const { selectedId } = usePatients();
  const { graph: baseGraph, loading: graphLoading } = usePatientData(selectedId);

  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [liveGraph, setLiveGraph] = useState<Graph | null>(null);
  const [flashNodes, setFlashNodes] = useState<string[]>([]);

  // Defensive merge: liveGraph should always be a superset of baseGraph
  // (it's populated by refetching the full patient graph after a commit),
  // but if it's ever smaller for any reason — stale fetch, race condition,
  // partial backend response — we never want the visible graph to silently
  // lose the originally-seeded nodes. Union by id, liveGraph wins on conflict.
  const graph = useMemo<Graph | null>(() => {
    if (!liveGraph) return baseGraph;
    if (!baseGraph) return liveGraph;
    const nodeMap = new Map(baseGraph.nodes.map((n) => [n.id, n]));
    liveGraph.nodes.forEach((n) => nodeMap.set(n.id, n));
    const edgeMap = new Map(baseGraph.edges.map((e) => [e.id, e]));
    liveGraph.edges.forEach((e) => edgeMap.set(e.id, e));
    return { nodes: Array.from(nodeMap.values()), edges: Array.from(edgeMap.values()) };
  }, [liveGraph, baseGraph]);
  const active = queue.find((q) => q.id === activeId) ?? null;

  // ── toast helpers ──────────────────────────────────────────────────────────
  function toast(message: string, color = TEAL) {
    const id = uid();
    setToasts((t) => [...t, { id, message, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }
  function removeToast(id: string) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  // ── add files to queue ─────────────────────────────────────────────────────
  function addFiles(files: File[]) {
    const items: QueuedFile[] = files.map((f) => ({
      id: uid(),
      file: f,
      preview: null,
      status: "pending",
    }));

    // generate image previews
    items.forEach((item) => {
      if (item.file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setQueue((q) =>
            q.map((x) => (x.id === item.id ? { ...x, preview: e.target?.result as string } : x))
          );
        };
        reader.readAsDataURL(item.file);
      }
    });

    setQueue((q) => [...q, ...items]);
    if (!activeId && items.length) setActiveId(items[0].id);

    // auto-extract each file
    items.forEach((item) => extractFile(item.id, item.file));
  }

  // ── extraction ─────────────────────────────────────────────────────────────
  async function extractFile(id: string, file: File) {
    setQueue((q) => q.map((x) => (x.id === id ? { ...x, status: "extracting" } : x)));
    try {
      const result = await uploadExtract(selectedId, file);
      setQueue((q) =>
        q.map((x) =>
          x.id === id
            ? { ...x, status: "ready", result, editedEntities: [...result.entities] }
            : x
        )
      );
      if (result.conflicts?.length) {
        toast(`⚠️ ${result.conflicts.length} conflict(s) detected in ${file.name}`, AMBER);
      }
      // cross-specialty alerts
      if (result.module_tags?.length) {
        const modNames = result.module_tags
          .map((t: string) => MODULE_META[t]?.name ?? t)
          .join(", ");
        toast(`${file.type === "application/pdf" ? "📋" : "🩻"} Findings routed to: ${modNames}`, TEAL);
      }
    } catch (err: any) {
      setQueue((q) =>
        q.map((x) => (x.id === id ? { ...x, status: "error", error: err.message } : x))
      );
      toast(`Extraction failed: ${err.message}`, "#f87171");
    }
  }

  // ── entity editing ─────────────────────────────────────────────────────────
  function editEntity(qid: string, index: number, field: keyof ClinicalEntity, val: string) {
    setQueue((q) =>
      q.map((x) =>
        x.id === qid
          ? {
              ...x,
              editedEntities: x.editedEntities?.map((e, i) =>
                i === index ? { ...e, [field]: val, _edited: true } : e
              ),
            }
          : x
      )
    );
  }

  function deleteEntity(qid: string, index: number) {
    setQueue((q) =>
      q.map((x) =>
        x.id === qid
          ? {
              ...x,
              editedEntities: x.editedEntities?.map((e, i) =>
                i === index ? { ...e, _deleted: true } : e
              ),
            }
          : x
      )
    );
  }

  // ── commit single doc ──────────────────────────────────────────────────────
  async function commitDoc(qid: string) {
    const item = queue.find((x) => x.id === qid);
    if (!item?.result || !item.editedEntities) return;

    setQueue((q) => q.map((x) => (x.id === qid ? { ...x, status: "committing" } : x)));
    try {
      const res = await commitEntities(
        selectedId,
        item.editedEntities,
        item.result.summary_text,
        item.result.metadata,
      );

      setQueue((q) =>
        q.map((x) => (x.id === qid ? { ...x, status: "committed", commitResult: res } : x))
      );

      // Refetch the authoritative graph from the server — this is the
      // reliable source of truth regardless of how many nodes/edges
      // remember() actually created on the backend.
      try {
        const freshGraph = await api.graph(selectedId);
        const prevIds = new Set((graph?.nodes ?? []).map((n) => n.id));
        const newNodeIds = freshGraph.nodes
          .filter((n) => !prevIds.has(n.id))
          .map((n) => n.id);

        setLiveGraph(freshGraph);
        if (newNodeIds.length) {
          setFlashNodes(newNodeIds);
          setTimeout(() => setFlashNodes([]), 3500);
        } else if (res.node) {
          // fallback: backend returned a single node directly
          setFlashNodes([res.node.id]);
          setTimeout(() => setFlashNodes([]), 3500);
        }
      } catch {
        // fall back to optimistic local merge if refetch fails
        if (res.node) {
          const newGraph: Graph = {
            nodes: [...(graph?.nodes ?? []), res.node],
            edges: [...(graph?.edges ?? []), ...(res.edges ?? [])],
          };
          setLiveGraph(newGraph);
          setFlashNodes([res.node.id]);
          setTimeout(() => setFlashNodes([]), 3500);
        }
      }

      toast(`✓ ${item.file.name} committed — ${res.nodes_added} entities added to graph`, "#4ade80");

      // cross-specialty toast
      if (item.result.module_tags?.length) {
        item.result.module_tags.forEach((tag: string) => {
          const meta = MODULE_META[tag];
          if (meta) {
            toast(`${meta.icon} ${meta.name} module graph dynamically updated`, MODULE_COLOR[tag as ModuleKey] ?? TEAL);
          }
        });
      }
    } catch (err: any) {
      setQueue((q) => q.map((x) => (x.id === qid ? { ...x, status: "error", error: err.message } : x)));
      toast(`Commit failed: ${err.message}`, "#f87171");
    }
  }

  // ── conflict resolution (improve) ─────────────────────────────────────────
  async function resolveConflicts() {
    try {
      await api.improve(selectedId);
      toast("✦ Conflicts resolved — graph edges reweighted via improve()", TEAL);
    } catch {
      toast("improve() failed", "#f87171");
    }
  }

  // ── batch commit (chronological) ──────────────────────────────────────────
  async function batchCommit() {
    const ready = queue.filter((x) => x.status === "ready" && x.result && x.editedEntities);
    if (!ready.length) { toast("No documents ready to commit", AMBER); return; }

    // sort chronologically by extracted date
    const sorted = [...ready].sort((a, b) => {
      const da = a.result?.metadata?.document_date ?? "9999";
      const db = b.result?.metadata?.document_date ?? "9999";
      return da.localeCompare(db);
    });

    toast(`⏳ Batch committing ${sorted.length} documents in chronological order…`, TEAL);
    for (const item of sorted) {
      await commitDoc(item.id);
    }
  }

  // ── remove from queue ──────────────────────────────────────────────────────
  function removeFromQueue(id: string) {
    setQueue((q) => {
      const next = q.filter((x) => x.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} remove={removeToast} />

      {/* ── header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-line/10 p-6"
        style={{ background: `linear-gradient(120deg, ${TEAL}1f, ${AMBER}0f, transparent 70%)` }}
      >
        <div className="absolute -right-10 -top-10 text-[120px] opacity-10">📂</div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl">📂</span>
              <h1 className="text-2xl font-extrabold" style={{ color: TEAL }}>OmniGest</h1>
              <CogneeTooltip
                fn="remember"
                explanation="🧠 Powered by Gemini 2.5 & Cognee remember(): OmniGest uses Gemini 2.5 Flash to structure unstructured scans, then uses Cognee's remember() API to vectorize and physically link these findings into the permanent cross-specialty knowledge graph."
              />
            </div>
            <p className="text-sm text-fg/55">
              Multimodal Ingestion Hub — Gemini 2.5 Flash extraction → Cognee graph grounding
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="chip" style={{ borderColor: `${TEAL}55`, color: TEAL }}>
              ✦ Gemini 2.5 Flash
            </span>
            <span className="chip" style={{ borderColor: `${AMBER}55`, color: AMBER }}>
              ✦ PII-stripped
            </span>
            {queue.filter((x) => x.status === "ready").length > 1 && (
              <button
                className="btn text-sm font-semibold"
                style={{ background: `${TEAL}22`, color: TEAL, border: `1px solid ${TEAL}55` }}
                onClick={batchCommit}
              >
                ⏩ Batch commit ({queue.filter((x) => x.status === "ready").length} docs)
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── dropzone ── */}
      {!queue.length && <Dropzone onFiles={addFiles} />}

      {/* ── two-panel layout: queue + sandbox ── */}
      {queue.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          {/* queue sidebar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionTitle kicker="Upload queue" title={`${queue.length} document${queue.length !== 1 ? "s" : ""}`} />
              <button
                onClick={() => {
                  const inp = document.createElement("input");
                  inp.type = "file";
                  inp.multiple = true;
                  inp.accept = ".pdf,.jpg,.jpeg,.png";
                  inp.onchange = () => {
                    const files = Array.from(inp.files || []);
                    if (files.length) addFiles(files);
                  };
                  inp.click();
                }}
                className="btn-ghost text-xs"
                style={{ color: TEAL, borderColor: `${TEAL}44` }}
              >
                + Add more
              </button>
            </div>
            {queue.map((item) => (
              <QueueCard
                key={item.id}
                item={item}
                active={item.id === activeId}
                onSelect={() => setActiveId(item.id)}
              />
            ))}
          </div>

          {/* extraction sandbox */}
          <div className="space-y-4">
            {active ? (
              <ActiveSandbox
                item={active}
                patientId={selectedId}
                onEdit={(i, f, v) => editEntity(active.id, i, f, v)}
                onDelete={(i) => deleteEntity(active.id, i)}
                onCommit={() => commitDoc(active.id)}
                onConflictResolve={resolveConflicts}
                onRemove={() => removeFromQueue(active.id)}
              />
            ) : (
              <GlassCard className="flex h-64 items-center justify-center p-8 text-center text-fg/40">
                Select a document from the queue to view the extraction sandbox
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* ── live graph section ── */}
      {queue.some((x) => x.status === "committed") && graph && (
        <GlassCard className="p-4">
          <SectionTitle
            kicker="Live graph integration"
            title="Patient knowledge graph — post-ingestion"
            right={
              <div className="flex items-center gap-2 text-xs text-fg/40">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: TEAL }} />
                  New nodes highlighted
                </span>
                <CogneeTooltip
                  fn="remember"
                  explanation="The committed entities are vectorized by Cognee's remember() and physically linked as new nodes in the shared patient graph — immediately visible to all six modules."
                />
              </div>
            }
          />
          {graphLoading ? (
            <Spinner label="Loading graph…" />
          ) : (
            <KnowledgeGraph
              key={graph.nodes.length}
              graph={graph}
              height={460}
              highlight={flashNodes}
            />
          )}
        </GlassCard>
      )}

      {/* ── "So What?" analysis from most recent commit ── */}
      {queue
        .filter((x) => x.status === "committed" && x.commitResult?.recall_analysis)
        .slice(-1)
        .map((item) => (
          <SoWhatPanel key={item.id} result={item.commitResult!.recall_analysis} />
        ))}

      {/* ── add more when queue exists ── */}
      {queue.length > 0 && (
        <GlassCard className="p-4">
          <div className="text-sm font-semibold text-fg/60 mb-3">Add more documents</div>
          <Dropzone onFiles={addFiles} />
        </GlassCard>
      )}
    </div>
  );
}

// ─── active sandbox (split view) ──────────────────────────────────────────────
function ActiveSandbox({
  item,
  patientId,
  onEdit,
  onDelete,
  onCommit,
  onConflictResolve,
  onRemove,
}: {
  item: QueuedFile;
  patientId: string;
  onEdit: (i: number, f: keyof ClinicalEntity, v: string) => void;
  onDelete: (i: number) => void;
  onCommit: () => void;
  onConflictResolve: () => void;
  onRemove: () => void;
}) {
  const entities = item.editedEntities ?? [];
  const result   = item.result;
  const meta     = result?.metadata;
  const isReady  = item.status === "ready";
  const isDone   = item.status === "committed";

  return (
    <div className="space-y-4">
      {/* metadata ribbon */}
      {meta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3"
          style={{ borderColor: `${TEAL}33`, background: `${TEAL}08` }}
        >
          {meta.document_type && (
            <span className="chip" style={{ color: TEAL, borderColor: `${TEAL}44` }}>
              📋 {meta.document_type}
            </span>
          )}
          {meta.document_date && (
            <span className="chip">
              📅 {meta.document_date}
            </span>
          )}
          {meta.clinic_name && (
            <span className="chip">🏥 {meta.clinic_name}</span>
          )}
          <span className="ml-auto text-[11px] text-fg/40">
            Metadata extracted by Gemini · physician name stripped (PII policy)
          </span>
        </motion.div>
      )}

      {/* conflict banner */}
      {result?.conflicts?.length ? (
        <ConflictBanner conflicts={result.conflicts} onResolve={onConflictResolve} />
      ) : null}

      {/* split: preview + entities */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* left — document preview */}
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-fg">Document preview</div>
            <button onClick={onRemove} className="text-xs text-fg/35 hover:text-fg/80">
              ✕ Remove
            </button>
          </div>

          {item.preview ? (
            <div className="overflow-hidden rounded-xl border border-line/10">
              <img
                src={item.preview}
                alt="Uploaded scan"
                className="w-full object-cover"
                style={{ maxHeight: 360 }}
              />
            </div>
          ) : (
            <div
              className="flex h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed"
              style={{ borderColor: `${TEAL}44`, background: TEAL_DIM }}
            >
              <span className="text-4xl">📄</span>
              <div className="text-center">
                <div className="text-sm font-semibold text-fg">{item.file.name}</div>
                <div className="text-xs text-fg/40">
                  {(item.file.size / 1024).toFixed(0)} KB PDF
                </div>
              </div>
            </div>
          )}

          {/* summary text */}
          {result?.summary_text && (
            <div className="mt-4 rounded-xl border border-line/10 bg-field/20 p-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: TEAL }}>
                Clinical summary
              </div>
              <p className="text-xs leading-relaxed text-fg/70">
                {isDone ? result.summary_text : <Typewriter text={result.summary_text} speed={8} />}
              </p>
            </div>
          )}

          {/* module routing */}
          {result?.module_tags?.length ? (
            <div className="mt-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg/40">
                Routed to modules
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.module_tags.map((t: string) => <ModuleTag key={t} tag={t} />)}
              </div>
            </div>
          ) : null}
        </GlassCard>

        {/* right — entity list */}
        <GlassCard className="flex flex-col p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="text-sm font-bold text-fg">
              Extracted clinical entities
            </div>
            <CogneeTooltip
              fn="remember"
              explanation="Each entity row maps to a node in the Cognee knowledge graph. Gemini confidence ≥80% = green (high), 50-79% = amber (review recommended), <50% = red (manual verification required)."
            />
            {item.status === "extracting" && (
              <span className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: TEAL }}>
                <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Gemini extracting…
              </span>
            )}
            {isReady && (
              <span className="ml-auto text-xs text-fg/40">
                {entities.filter((e) => !e._deleted).length} entities — click to edit
              </span>
            )}
          </div>

          {item.status === "extracting" && (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div
                  className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: `${TEAL}44`, borderTopColor: TEAL }}
                />
                <div className="text-sm text-fg/50">Gemini 2.5 Flash analysing document…</div>
              </div>
            </div>
          )}

          {item.status === "error" && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-[#f87171]/40 bg-[#f87171]/10 p-4 text-sm text-[#f87171]">
              {item.error ?? "Extraction failed"}
            </div>
          )}

          {(isReady || isDone) && (
            <div className="flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 380 }}>
              {entities.map((ent, i) => (
                <EntityRow
                  key={i}
                  entity={ent}
                  index={i}
                  onChange={(idx, f, v) => onEdit(idx, f, v)}
                  onDelete={(idx) => onDelete(idx)}
                />
              ))}
            </div>
          )}

          {/* confidence legend */}
          {isReady && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line/10 pt-3 text-[10px] text-fg/40">
              <span>Confidence:</span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[#4ade80]" /> ≥80% high
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: AMBER }} /> 50-79% review
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[#f87171]" /> &lt;50% verify
              </span>
            </div>
          )}
        </GlassCard>
      </div>

      {/* commit button */}
      {isReady && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-wrap items-center gap-3"
        >
          <button
            onClick={onCommit}
            className="btn flex-1 py-3 text-base font-extrabold transition-all"
            style={{
              background: `linear-gradient(135deg, ${TEAL}, #0bbfa8)`,
              color: "#0a1a18",
              boxShadow: `0 0 40px -8px ${TEAL}`,
            }}
          >
            ✦ Commit to Patient Graph
          </button>
          <CogneeTooltip
            fn="remember"
            explanation="Triggers api.remember() — all verified entities are vectorized and grounded into the shared Cognee knowledge graph. All six modules gain immediate access to these new findings."
          />
          <div className="text-xs text-fg/40">
            {entities.filter((e) => !e._deleted).length} entities will be committed
          </div>
        </motion.div>
      )}

      {isDone && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border px-5 py-4 text-center font-semibold"
          style={{ borderColor: "#4ade8055", background: "#4ade8011", color: "#4ade80" }}
        >
          ✓ {item.commitResult?.nodes_added ?? 0} entities committed to the knowledge graph
          <div className="mt-1 text-xs font-normal opacity-70">
            Source: {item.commitResult?.source} · Cross-module recall fired
          </div>
        </motion.div>
      )}

      {/* committed recall analysis */}
      {isDone && item.commitResult?.recall_analysis && (
        <SoWhatPanel result={item.commitResult.recall_analysis} />
      )}
    </div>
  );
}
