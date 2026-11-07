import { PRIORITY_COLORS, PRIORITY_LABELS, type Courier, type Package, type Stop } from "@marsrutai/shared";
import { fmtKg } from "../format";

function Priority({ pkg }: { pkg: Package }) {
  return (
    <span className="prio-pill" style={{ background: PRIORITY_COLORS[pkg.priority] }}>
      {pkg.priority} · {PRIORITY_LABELS[pkg.priority]}
    </span>
  );
}

export function StopPopup({ stop, pkg, courier, fmtTime }: {
  stop: Stop;
  pkg: Package;
  courier: Courier;
  fmtTime: (iso: string) => string;
}) {
  return (
    <div className="popup">
      <div className="popup__title">
        <span className="popup__seq" style={{ background: courier.color }}>{stop.seq}</span>
        {pkg.id}
        <Priority pkg={pkg} />
      </div>
      <div className="popup__recipient">{pkg.recipient}</div>
      <div className="muted">{pkg.address}</div>
      <table className="popup__table">
        <tbody>
          <tr>
            <th>Atvykimas</th>
            <td>
              <strong>{fmtTime(stop.arrival)}</strong>
              {stop.lateMinutes > 0 && <span className="tag tag--late">Vėluoja {Math.round(stop.lateMinutes)} min</span>}
              {stop.waitMinutes > 0 && <span className="tag tag--wait">Laukia {Math.round(stop.waitMinutes)} min</span>}
            </td>
          </tr>
          <tr>
            <th>Langas</th>
            <td>
              {pkg.window.start}–{pkg.window.end}
            </td>
          </tr>
          <tr>
            <th>Svoris</th>
            <td>{fmtKg(pkg.weightKg)} kg</td>
          </tr>
          <tr>
            <th>Kurjeris</th>
            <td>
              <span className="dot dot--sm" style={{ background: courier.color }} /> {courier.name}
            </td>
          </tr>
        </tbody>
      </table>
      {pkg.note && <div className="popup__note">{pkg.note}</div>}
    </div>
  );
}

export function SkippedPopup({ pkg, reason }: { pkg: Package; reason: string }) {
  return (
    <div className="popup">
      <div className="popup__title">
        <span className="popup__seq popup__seq--skipped">×</span>
        {pkg.id}
        <Priority pkg={pkg} />
      </div>
      <div className="popup__recipient">{pkg.recipient}</div>
      <div className="muted">{pkg.address}</div>
      <table className="popup__table">
        <tbody>
          <tr>
            <th>Langas</th>
            <td>
              {pkg.window.start}–{pkg.window.end}
            </td>
          </tr>
          <tr>
            <th>Svoris</th>
            <td>{fmtKg(pkg.weightKg)} kg</td>
          </tr>
        </tbody>
      </table>
      <div className="tag tag--late tag--block">Nepristatomas: {reason}</div>
    </div>
  );
}
