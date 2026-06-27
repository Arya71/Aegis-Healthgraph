export type ModuleKey =
  | "curie" | "medsync" | "rxshield" | "nutrisim" | "pathos" | "neurograph";

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
