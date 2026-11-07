import type { Plan } from "@marsrutai/shared";
import { fmtEur, fmtHours, fmtKm, formatDateTime } from "../format";

export function Summary({ plan }: { plan: Plan }) {
  const m = plan.metrics;
  const tz = plan.dataset.depot.timezone;
  const total = plan.dataset.packages.length;
  return (
    <section className="card summary">
      <div className="summary__top">
        <span className={`badge badge--${plan.mode}`}>{plan.mode === "api" ? "Google API" : "MOCK"}</span>
        <span className="muted">Diena: {plan.dataset.depot.date}</span>
      </div>
      <div className="stats">
        <Stat label="Pristatyta" value={`${m.deliveredCount}/${total}`} tone="ok" />
        <Stat label="Nepristatyta" value={m.skippedCount} tone={m.skippedCount ? "warn" : undefined} />
        <Stat label="Vėluoja" value={m.lateCount} tone={m.lateCount ? "bad" : undefined} />
        <Stat label="Atstumas" value={fmtKm(m.totalKm)} />
        <Stat label="Laikas" value={fmtHours(m.totalHours)} />
        {m.totalCost != null && <Stat label="Kaina" value={fmtEur(m.totalCost)} />}
      </div>
      <div className="muted small">Sugeneruota: {formatDateTime(plan.generatedAt, tz)}</div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ""}`}>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}
