/**
 * types.ts — updated to add "omnigest" to ModuleKey union.
 * Replace your existing frontend/src/lib/types.ts with this file.
 * Only change: "omnigest" added to ModuleKey.
 */
export type ModuleKey =
  | "curie" | "medsync" | "rxshield" | "nutrisim" | "pathos" | "neurograph"
  | "omnigest"
  | "healthforecast"; // ← NEW (module 8)

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: string;
  conditions: string[];
  story: string;
  hero: boolean;
  eventCount: number;
  hue: number;
}

export interface PatientEvent {
  id: string;
  date: string | null;
  type: string;
  title: string;
  detail: string;
  module: ModuleKey;
  severity?: number;
  metrics?: Record<string, number>;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  module: ModuleKey;
  date: string | null;
  detail: string;
  weight: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight: number;
  rationale: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Insight {
  id: string;
  module: ModuleKey;
  title: string;
  body: string;
  confidence: number;
  crossModule: boolean;
  evidence: string[];
  sourceTag?: string; // "omnigest" when sourced from a committed upload — drives a UI badge
}

export interface CrossInsight {
  id: string;
  confidence: number;
  modules: ModuleKey[];
  title: string;
  body: string;
  evidence: string[];
}

export interface RecallResult {
  answer: string;
  confidence: number;
  evidence: string[];
  source: string;
  matched: string | null;
}

export interface RememberResult {
  node: GraphNode;
  edges: GraphEdge[];
  source: string;
}

export interface PatientDetail extends Patient {
  events: PatientEvent[];
  insights: Insight[];
  crossInsights: CrossInsight[];
}

export interface ModuleMeta {
  name: string;
  tagline: string;
  accent: string;
}

// ── HealthForecast (module 8) ────────────────────────────────────────────────

export interface ConditionRisk {
  key: string;
  label: string;
  risk: number;
  signal_hits: number;
  insight_boost: number;
}

export interface TrajectoryPoint {
  year: string;
  patient: number;
  baseline: number;
  divergence: number;
}

export interface InterventionRank {
  lever: string;
  label: string;
  unit: string;
  estimated_risk_reduction: number;
  affected_conditions: string[];
}

export interface SandboxLever {
  key: string;
  label: string;
  unit: string;
  affects: Record<string, number>;
}

export interface HealthForecastPayload {
  conditionRisks: ConditionRisk[];
  trajectory: TrajectoryPoint[];
  interventionRanking: InterventionRank[];
  leverCatalog: SandboxLever[];
  insights: Insight[];
  meta: ModuleMeta;
}

export interface SandboxCurve {
  condition: string;
  key: string;
  curve: number[];
}

export interface SandboxDelta {
  condition: string;
  key: string;
  year5_baseline: number;
  year5_projected: number;
  year5_delta: number;
}

export interface SandboxResult {
  ok: boolean;
  baseline_5yr: SandboxCurve[];
  projected_5yr: SandboxCurve[];
  delta_summary: SandboxDelta[];
  improve_result: { ok: boolean; source: string; message: string };
  source: string;
}

export interface RiskChainLink {
  from: string;
  to: string;
  from_risk: number;
  to_risk: number;
  mechanism: string;
}

export interface SentinelResult {
  ok: boolean;
  answer: string;
  confidence: number;
  risk_chain: RiskChainLink[];
  evidence: string[];
  source: string;
}

export interface NarrativeResult {
  ok: boolean;
  narrative: string;
  source: string;
}
