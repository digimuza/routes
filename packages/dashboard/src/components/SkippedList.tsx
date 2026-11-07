import { PRIORITY_COLORS, PRIORITY_LABELS, type Plan } from "@marsrutai/shared";
import type { PlanIndex } from "../format";

export function SkippedList({ plan, index }: { plan: Plan; index: PlanIndex }) {
  if (plan.skipped.length === 0) {
    return <section className="card muted small">Visi paketai paskirstyti kurjeriams.</section>;
  }
  return (
    <section className="card">
      <details className="skipped">
        <summary>
          Nepristatyti paketai <span className="count">{plan.skipped.length}</span>
        </summary>
        <ul>
          {plan.skipped.map((s) => {
            const p = index.packages.get(s.packageId);
            return (
              <li key={s.packageId}>
                <div className="skipped__head">
                  <strong>{s.packageId}</strong>
                  {p && (
                    <span className="prio" style={{ color: PRIORITY_COLORS[p.priority] }}>
                      ● {PRIORITY_LABELS[p.priority]}
                    </span>
                  )}
                </div>
                {p && (
                  <div className="small">
                    {p.recipient} · {p.address} · {p.window.start}–{p.window.end}
                  </div>
                )}
                <div className="small reason">{s.reason}</div>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
