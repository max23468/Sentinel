import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DashboardClient } from "./dashboard-client";
import "./globals.css";

const container = document.getElementById("root");
if (!container) throw new Error("Elemento #root mancante nella pagina.");

createRoot(container).render(
  <StrictMode>
    <DashboardClient />
  </StrictMode>
);
