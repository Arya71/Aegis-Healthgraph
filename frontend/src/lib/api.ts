import type {
  CrossInsight, Graph, Insight, ModuleKey, Patient, PatientDetail,
  RecallResult, RememberResult,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

export const api = {
  health: () => get<{ status: string; memoryMode: string; patients: number }>("/health"),
  patients: () => get<Patient[]>("/patients"),
  patient: (id: string) => get<PatientDetail>(`/patients/${id}`),
  graph: (id: string, until?: string) =>
    get<Graph>(`/patients/${id}/graph${until ? `?until=${until}` : ""}`),
  timeline: (id: string) => get<import("./types").PatientEvent[]>(`/patients/${id}/timeline`),
  insights: (id: string) =>
    get<{ modules: Insight[]; cross: CrossInsight[] }>(`/patients/${id}/insights`),
  module: <T = any>(id: string, mod: ModuleKey) => get<T>(`/patients/${id}/modules/${mod}`),
  recall: (id: string, query: string) =>
    post<RecallResult>(`/patients/${id}/recall`, { query }),
  remember: (id: string, text: string, type = "symptom") =>
    post<RememberResult>(`/patients/${id}/remember`, { text, type }),
  improve: (id: string) =>
    post<{ ok: boolean; source: string; message: string }>(`/patients/${id}/improve`, {}),
  forget: (id: string) =>
    post<{ ok: boolean; source: string; message: string }>(`/patients/${id}/forget`, {}),
};

export const MODULES: { key: ModuleKey; name: string; tagline: string; icon: string }[] = [
  { key: "curie", name: "Curie", tagline: "Diagnostic Cross-Reference", icon: "🔬" },
  { key: "medsync", name: "MedSync", tagline: "Longitudinal Timeline", icon: "🧭" },
  { key: "rxshield", name: "RxShield", tagline: "Medication Safety", icon: "🛡️" },
  { key: "nutrisim", name: "NutriSim", tagline: "Lifestyle Intelligence", icon: "🥗" },
  { key: "pathos", name: "Pathos", tagline: "Mental-Health Memory", icon: "🫀" },
  { key: "neurograph", name: "NeuroGraph", tagline: "Cognitive Decline", icon: "🧠" },
];

export const MODULE_COLOR: Record<ModuleKey, string> = {
  curie: "#6ea8ff", medsync: "#7c6cff", rxshield: "#ff7eb6",
  nutrisim: "#37d6b3", pathos: "#ffb86b", neurograph: "#b388ff",
};
