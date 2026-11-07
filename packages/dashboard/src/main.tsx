import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-semi-condensed/500.css";
import "@fontsource/barlow-semi-condensed/600.css";
import "./styles.css";
import { App } from "./App";

async function boot() {
  // Dev-only mock serveris: `?mockApi=1`. Produkciniame build'e šis blokas pašalinamas.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("mockApi")) {
    const { installMockApi } = await import("./dev/mockApi");
    installMockApi();
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
