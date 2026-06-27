import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Patient } from "./types";

interface Ctx {
  patients: Patient[];
  selectedId: string;
  selected?: Patient;
  setSelectedId: (id: string) => void;
  memoryMode: string;
  loading: boolean;
}

const PatientCtx = createContext<Ctx | null>(null);

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string>(
    () => localStorage.getItem("aegis.patient") ?? "patient_001",
  );
  const [memoryMode, setMemoryMode] = useState("replay");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.patients(), api.health()])
      .then(([ps, h]) => {
        setPatients(ps);
        setMemoryMode(h.memoryMode);
      })
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem("aegis.patient", selectedId);
  }, [selectedId]);

  const selected = patients.find((p) => p.id === selectedId);

  return (
    <PatientCtx.Provider value={{ patients, selectedId, selected, setSelectedId, memoryMode, loading }}>
      {children}
    </PatientCtx.Provider>
  );
}

export function usePatients() {
  const ctx = useContext(PatientCtx);
  if (!ctx) throw new Error("usePatients must be used within PatientProvider");
  return ctx;
}
