import { useEffect, useState } from "react";
import type { City, CityId } from "@marsrutai/shared";
import type { OptimizeMode, OptimizeRun, SaveStatus } from "../state/useWorkspace";
import { Segmented } from "./Segmented";
import { Icon } from "./Icon";

interface Props {
  cities: City[];
  cityId: CityId | null;
  onCity: (id: CityId) => void;
  save: { status: SaveStatus; error?: string };
  onRetrySave: () => void;
  mode: OptimizeMode;
  onMode: (m: OptimizeMode) => void;
  run: OptimizeRun | null;
  canOptimize: boolean;
  disabledReason: string | null;
  onOptimize: () => void;
  depotDate: string | null;
}

function SaveIndicator({ save, onRetry }: { save: Props["save"]; onRetry: () => void }) {
  if (save.status === "error")
    return (
      <span className="savestate savestate--error" role="status">
        <Icon name="alert" size={16} />
        <span>Neišsaugota</span>
        <button type="button" className="linkbtn" onClick={onRetry} title={save.error}>
          Bandyti dar kartą
        </button>
      </span>
    );
  const label =
    save.status === "saving" || save.status === "pending" ? "Saugoma…" : save.status === "saved" ? "Išsaugota" : "Scenarijus išsaugotas";
  return (
    <span className={`savestate savestate--${save.status}`} role="status" aria-live="polite">
      {save.status === "saving" || save.status === "pending" ? <span className="spinner spinner--sm" aria-hidden="true" /> : <Icon name="check" size={16} />}
      <span>{label}</span>
    </span>
  );
}

function Elapsed({ since }: { since: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, []);
  return <span className="num">{Math.floor((Date.now() - since) / 1000)} s</span>;
}

export function TopBar(p: Props) {
  const busy = p.run != null;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 28 28" width="28" height="28">
            <rect x="1" y="1" width="26" height="26" rx="3" fill="#1c211e" />
            <path d="M7 20.5c3-1 3.5-6 7-6.5s4.5-4 7-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.1 4" />
            <circle cx="7" cy="20.5" r="2.2" fill="#fff" />
            <path d="M21 4.8 23.6 8 21 11.2 18.4 8Z" fill="#fff" />
          </svg>
        </span>
        <div className="brand__text">
          <span className="brand__name">Maršrutai</span>
          <span className="brand__sub">Kurjerių maršrutų planavimas{p.depotDate ? ` · ${p.depotDate}` : ""}</span>
        </div>
      </div>

      <Segmented
        label="Miestas"
        options={p.cities.map((c) => ({ value: c.id, label: c.name }))}
        value={p.cityId ?? p.cities[0]?.id}
        onChange={p.onCity}
        disabled={busy}
      />

      <div className="topbar__spacer" />

      <SaveIndicator save={p.save} onRetry={p.onRetrySave} />

      <div className="optimize">
        <Segmented
          label="Optimizatorius"
          size="sm"
          options={[
            { value: "api", label: "Google API", title: "Google Route Optimization API" },
            { value: "mock", label: "Mock", title: "Lokalus godus algoritmas, be GCP" },
          ]}
          value={p.mode}
          onChange={p.onMode}
          disabled={busy}
        />
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={p.onOptimize}
          disabled={busy || !p.canOptimize}
          title={p.disabledReason ?? undefined}
          aria-busy={busy}
        >
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Skaičiuojama… <Elapsed since={p.run!.startedAt} />
            </>
          ) : (
            <>
              <Icon name="route" size={18} />
              Sudaryti maršrutus
            </>
          )}
        </button>
      </div>
    </header>
  );
}
