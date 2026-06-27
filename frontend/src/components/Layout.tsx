import { motion } from "framer-motion";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { MODULES } from "../lib/api";
import { usePatients } from "../lib/PatientContext";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: "▦" },
  { to: "/graph", label: "Graph Explorer", icon: "✦" },
];

export default function Layout() {
  const { selected, patients, selectedId, setSelectedId, memoryMode } = usePatients();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line/10 bg-surface/[0.02] p-4 backdrop-blur-xl lg:flex">
        <button onClick={() => navigate("/")} className="mb-6 flex items-center gap-2.5 px-2">
          <span className="text-2xl">🧠</span>
          <div className="text-left">
            <div className="text-[15px] font-extrabold leading-none gradient-text">Aegis</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-fg/40">HealthGraph</div>
          </div>
        </button>

        <nav className="space-y-1">
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>

        <div className="mt-5 mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg/30">
          Modules
        </div>
        <nav className="space-y-1">
          {MODULES.map((m) => (
            <NavItem key={m.key} to={`/${m.key}`} label={m.name} icon={m.icon} sub={m.tagline} />
          ))}
        </nav>

        <div className="mt-auto space-y-2 pt-4">
          <div className="glass flex items-center gap-2 px-3 py-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${memoryMode === "live" ? "bg-emerald-400" : "bg-[#7c6cff]"} animate-pulse`} />
            <span className="text-fg/60">Cognee:</span>
            <span className="font-semibold text-fg/90">{memoryMode}</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line/10 bg-bg/70 px-5 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-fg/40">Active patient</div>
            <div className="truncate text-sm font-bold text-fg">
              {selected ? `${selected.name} · ${selected.age}${selected.sex}` : "—"}
            </div>
          </div>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="ml-auto max-w-[220px] rounded-xl border border-line/10 bg-field/40 px-3 py-2 text-sm text-fg/90 outline-none focus:border-[#7c6cff]"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id} style={{ background: "rgb(var(--bg))", color: "rgb(var(--fg))" }}>
                {p.name} {p.hero ? "★" : ""}
              </option>
            ))}
          </select>
          <ThemeToggle />
          <button onClick={() => navigate("/patients")} className="btn-ghost">All patients</button>
        </header>

        <motion.main
          key={selectedId}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
          className="mx-auto w-full max-w-[1280px] flex-1 p-5 lg:p-7"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}

function NavItem({ to, label, icon, sub }: { to: string; label: string; icon: string; sub?: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all ${
          isActive ? "bg-surface/10 text-fg shadow-glow" : "text-fg/55 hover:bg-surface/5 hover:text-fg/90"
        }`
      }
    >
      <span className="text-base">{icon}</span>
      <span className="min-w-0">
        <span className="block font-semibold leading-tight">{label}</span>
        {sub && <span className="block truncate text-[10px] text-fg/35">{sub}</span>}
      </span>
    </NavLink>
  );
}
