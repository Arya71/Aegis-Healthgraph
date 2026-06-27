import { useEffect, useMemo, useState } from "react";
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

  const evidenceLabels = useMemo(() => {
    const m: Record<string, string> = {};
    graph?.nodes.forEach((n) => (m[n.id] = n.label));
    return m;
  }, [graph]);

  return { detail, graph, evidenceLabels, loading };
}

/** Generic module data loader. */
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
