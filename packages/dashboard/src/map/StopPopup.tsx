import { PRIORITY_LABELS, type Courier, type Package, type Stop } from "@marsrutai/shared";
import { fmtKg, hhmm, toMinutes } from "../format";
import { PriorityMark } from "../components/PriorityMark";
import { inkOn } from "../lib/palette";

/** Vėlavimas / laukimas rodomas tik nuo 1 min. */
const significant = (m: number) => Math.round(m) >= 1;

export function StopPopup({ stop, pkg, courier, fmtTime, stale }: {
  stop: Stop;
  pkg: Package;
  courier: Courier;
  fmtTime: (iso: string) => string;
  stale: boolean;
}) {
  const arrival = fmtTime(stop.arrival);
  const wait = significant(stop.waitMinutes) ? Math.round(stop.waitMinutes) : 0;
  const late = significant(stop.lateMinutes) ? Math.round(stop.lateMinutes) : 0;
  // atvykimas = atvyksta prie durų; aptarnavimas prasideda atvykimas + laukimas
  const arrMin = toMinutes(arrival);
  const serviceStart = Number.isNaN(arrMin) ? null : hhmm(arrMin + wait);

  return (
    <div className="popup">
      <div className="popup__head">
        <span className="popup__seq" style={{ background: courier.color, color: inkOn(courier.color) }}>
          {stop.seq}
        </span>
        <span className="popup__id">{pkg.id}</span>
        <PriorityMark p={pkg.priority} size={18} label />
      </div>
      <div className="popup__recipient">{pkg.recipient}</div>
      <div className="popup__addr">{pkg.address}</div>
      <dl className="popup__grid">
        <dt>Atvyksta</dt>
        <dd>
          <strong className="popup__eta">{arrival}</strong>
          {late > 0 && <span className="tag tag--late">vėluoja {late} min</span>}
          {wait > 0 && <span className="tag tag--wait">laukia {wait} min</span>}
        </dd>
        {wait > 0 && serviceStart && (
          <>
            <dt>Aptarnavimas</dt>
            <dd>nuo {serviceStart}</dd>
          </>
        )}
        <dt>Langas</dt>
        <dd>
          {pkg.window.start}–{pkg.window.end}
        </dd>
        <dt>Prioritetas</dt>
        <dd>
          {pkg.priority} · {PRIORITY_LABELS[pkg.priority]}
        </dd>
        <dt>Svoris</dt>
        <dd>{fmtKg(pkg.weightKg)} kg</dd>
        <dt>Kurjeris</dt>
        <dd>
          <span className="swatch swatch--sm" style={{ background: courier.color }} /> {courier.name}
        </dd>
      </dl>
      {pkg.note && <div className="popup__note">{pkg.note}</div>}
      {stale && <div className="popup__stale">Planas pasenęs: scenarijus pakeistas po sudarymo.</div>}
    </div>
  );
}

export function SkippedPopup({ pkg, reason }: { pkg: Package; reason: string }) {
  return (
    <div className="popup">
      <div className="popup__head">
        <span className="popup__seq popup__seq--skipped" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="12" height="12">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
        <span className="popup__id">{pkg.id}</span>
        <PriorityMark p={pkg.priority} size={18} label />
      </div>
      <div className="popup__recipient">{pkg.recipient}</div>
      <div className="popup__addr">{pkg.address}</div>
      <dl className="popup__grid">
        <dt>Langas</dt>
        <dd>
          {pkg.window.start}–{pkg.window.end}
        </dd>
        <dt>Svoris</dt>
        <dd>{fmtKg(pkg.weightKg)} kg</dd>
      </dl>
      <div className="popup__reason">
        <strong>Nepristatomas.</strong> {reason}
      </div>
    </div>
  );
}
