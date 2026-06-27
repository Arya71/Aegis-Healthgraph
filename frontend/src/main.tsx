import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { PatientProvider } from "./lib/PatientContext";
import { ThemeProvider } from "./lib/ThemeContext";
import "@xyflow/react/dist/style.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <PatientProvider>
          <App />
        </PatientProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
