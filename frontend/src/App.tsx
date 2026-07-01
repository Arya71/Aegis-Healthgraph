/**
 * App.tsx — updated to add OmniGest route.
 * Replace your existing frontend/src/App.tsx with this file.
 * Only change: import OmniGest + one new <Route> line.
 */
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import PatientSelect from "./pages/PatientSelect";
import Dashboard from "./pages/Dashboard";
import GraphExplorer from "./pages/GraphExplorer";
import Curie from "./pages/modules/Curie";
import MedSync from "./pages/modules/MedSync";
import RxShield from "./pages/modules/RxShield";
import NutriSim from "./pages/modules/NutriSim";
import Pathos from "./pages/modules/Pathos";
import NeuroGraph from "./pages/modules/NeuroGraph";
import OmniGest from "./pages/modules/OmniGest";
import HealthForecast from "./pages/modules/HealthForecast"; // ← NEW (module 8)

export default function App() {
  return (
    <>
      <div className="app-bg" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/patients" element={<PatientSelect />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/graph" element={<GraphExplorer />} />
          <Route path="/curie" element={<Curie />} />
          <Route path="/medsync" element={<MedSync />} />
          <Route path="/rxshield" element={<RxShield />} />
          <Route path="/nutrisim" element={<NutriSim />} />
          <Route path="/pathos" element={<Pathos />} />
          <Route path="/neurograph" element={<NeuroGraph />} />
          <Route path="/omnigest" element={<OmniGest />} />
          <Route path="/healthforecast" element={<HealthForecast />} /> {/* ← NEW */}
        </Route>
      </Routes>
    </>
  );
}
