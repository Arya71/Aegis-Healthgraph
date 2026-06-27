import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePatients } from "../lib/PatientContext";
import { Pill, Spinner } from "../components/ui";
import ThemeToggle from "../components/ThemeToggle";

export default function PatientSelect() {
  const { patients, setSelectedId, loading } = usePatients();
  const navigate = useNavigate();

  if (loading) return <Spinner />;

  function open(id: string) {
    setSelectedId(id);
    navigate("/dashboard");
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-7 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-fg/40">Patient registry</div>
          <h1 className="text-3xl font-extrabold">Choose a Digital Cognitive Twin</h1>
        </div>
        <ThemeToggle />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {patients.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => open(p.id)}
            className="glass glass-hover group p-5 text-left"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold"
                style={{ background: `hsl(${p.hue} 70% 55% / 0.18)`, color: `hsl(${p.hue} 80% 75%)` }}
              >
                {p.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-fg">
                  {p.name} {p.hero && <span title="Demo hero patient">★</span>}
                </div>
                <div className="text-xs text-fg/45">{p.age}{p.sex} · {p.eventCount} memories</div>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-fg/55">{p.story}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.conditions.slice(0, 3).map((c) => <Pill key={c}>{c}</Pill>)}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
