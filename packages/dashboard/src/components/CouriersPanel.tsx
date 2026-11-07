import type { Courier, Package } from "@marsrutai/shared";
import { fmtKg, fmtNum } from "../format";
import { Icon } from "./Icon";

interface Props {
  couriers: Courier[];
  packages: Package[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function CouriersPanel({ couriers, packages, selectedId, onSelect, onAdd }: Props) {
  const capacity = couriers.reduce((s, c) => s + c.capacityKg, 0);
  const demand = packages.reduce((s, p) => s + p.weightKg, 0);
  const over = demand > capacity;
  return (
    <div className="panel">
      <section className="block">
        <div className="block__head">
          <h2 className="block__title">
            Kurjeriai <span className="num count">{fmtNum(couriers.length)}</span>
          </h2>
          <button type="button" className="btn btn--secondary" onClick={onAdd}>
            <Icon name="plus" size={16} />
            Pridėti kurjerį
          </button>
        </div>
        <div className={`loadline${over ? " loadline--over" : ""}`}>
          <div className="loadline__bar" aria-hidden="true">
            <i style={{ width: `${capacity ? Math.min(100, (demand / capacity) * 100) : 100}%` }} />
          </div>
          <span className="num">
            Paketai {fmtKg(demand)} kg iš {fmtKg(capacity)} kg talpos
          </span>
          {over && <span className="loadline__warn">Dalis paketų netilps</span>}
        </div>
      </section>

      <section className="block block--list">
        {couriers.length === 0 ? (
          <div className="empty">
            <Icon name="courier" size={22} />
            <p>
              <strong>Kurjerių nėra.</strong> Be kurjerių maršrutų sudaryti negalima. Pridėkite bent vieną.
            </p>
          </div>
        ) : (
          <ul className="rows">
            {couriers.map((c) => (
              <li key={c.id}>
                <button type="button" className={`row${c.id === selectedId ? " is-selected" : ""}`} onClick={() => onSelect(c.id)}>
                  <span className="swatch" style={{ background: c.color }} />
                  <span className="row__main">
                    <span className="row__title">{c.name}</span>
                    <span className="row__sub">
                      {c.vehicle} · <span className="num">{c.id}</span>
                    </span>
                  </span>
                  <span className="row__figs num">
                    <span>
                      {c.shiftStart}–{c.shiftEnd}
                    </span>
                    <span className="row__muted">{fmtKg(c.capacityKg)} kg</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
