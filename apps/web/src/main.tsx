import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppErrorBoundary, initializeMonitoring } from "./monitoring";
import "./styles/main.scss";

initializeMonitoring();

createRoot(document.querySelector("#root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
