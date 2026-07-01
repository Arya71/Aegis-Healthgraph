/**
 * usePatientData.ts — UPDATED.
 * Replace frontend/src/lib/usePatientData.ts with this file.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * The original hook fetched graph+patient once on mount and never again,
 * which meant baseGraph was permanently stale for any component that
 * mounted before the backend had populated the seed overlay. OmniGest's
 * "defensive merge" (liveGraph ?? baseGraph) was supposed to protect
 * against this, but if baseGraph itself was empty at mount time, the merge
 * produced only the newly-committed nodes, making the full seeded graph
 * appear to vanish.
 *
 * Fix: expose a `refetchGraph()` function from usePatientData so callers
 * (OmniGest, GraphExplorer) can explicitly re-pull the authoritative graph
 * after a commit and update baseGraph in place.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Graph, PatientDetail } from "./types";

export function usePatientData(patientId: string) {
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.patient(patientId), api.graph(patientId)])
      .then(([d, g]) => {
        if (!alive) return;
        setDetail(d);
        setGraph(g);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [patientId]);

  // Exposed so OmniGest and GraphExplorer can force-refresh baseGraph after
  // a commit, instead of leaving it permanently stale from initial mount.
  const refetchGraph = useCallback(async () => {
    const fresh = await api.graph(patientId);
    setGraph(fresh);
    return fresh;
  }, [patientId]);

  const evidenceLabels = useMemo(() => {
    const m: Record<string, string> = {};
    graph?.nodes.forEach((n) => (m[n.id] = n.label));
    return m;
  }, [graph]);

  return { detail, graph, evidenceLabels, loading, refetchGraph };
}

/** Generic module data loader — unchanged from original. */
export function useModuleData<T = any>(patientId: string, module: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.module<T>(patientId, module as any)
      .then((d) => alive && setData(d))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [patientId, module]);
  return { data, loading };
}
