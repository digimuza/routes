import { useEffect, useState } from "react";
import type { Plan } from "@marsrutai/shared";
import { fmtHours, fmtKg, fmtKm, minToHours, type PlanIndex } from "../format";
import { pdfFileName } from "../pdf";

interface Props {
  plan: Plan;
  index: PlanIndex;
  hidden: Set<string>;
  hovered: string | null;
  onToggle: (id: string) => void;
  onIsolate: (id: string) => void;
  onShowAll: () => void;
  onHover: (id: string | null) => void;
  onFocus: (id: string) => void;
}

/** Patikrina, kurie PDF failai egzistuoja `/out/` (HEAD užklausos). */
function usePdfAvailability(files: string[], token: unknown): Record<string, boolean | undefined> {
  const [avail, setAvail] = useState<Record<string, boolean | undefined>>({});
  const key = files.join("|");
  useEffect(() => {
    let cancelled = false;
    setAvail({});
    Promise.all(
      files.map(async (f) => {
        try {
          const r = await fetch(`/out/${f}`, { method: "HEAD", cache: "no-store" });
          const type = r.headers.get("content-type") ?? "";
          return [f, r.ok && !type.includes("text/html")] as const;
        } catch {
          return [f, false] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setAvail(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // `token` (plano objektas) – kad po „Perkrauti“ PDF būtų patikrinti iš naujo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, token]);
  return avail;
}

export function CourierList({ plan, index, hidden, hovered, onToggle, onIsolate, onShowAll, onHover, onFocus }: Props) {
  const couriers = plan.dataset.couriers;
  const files = couriers.map((c, i) => pdfFileName(c, i));
  const pdfs = usePdfAvailability(files, plan);
  const visibleCount = couriers.length - couriers.filter((c) => hidden.has(c.id)).length;

  return (
    <section className="card couriers">
      <div className="couriers__head">
        <h2>
          Kurjeriai <span className="count">{visibleCount}/{couriers.length}</span>
        </h2>
        <button className="btn btn--small" onClick={onShowAll} disabled={hidden.size === 0}>
          Rodyti visus
        </button>
      </div>
      <ul className="courier-list" onMouseLeave={() => onHover(null)}>
        {couriers.map((c, i) => {
          const route = index.routes.get(c.id);
          const stops = route?.stops.length ?? 0;
          const late = route?.stops.filter((s) => s.lateMinutes > 0).length ?? 0;
          const kg = route?.totalWeightKg ?? 0;
          const fill = Math.min(1, kg / c.capacityKg);
          const isHidden = hidden.has(c.id);
          const file = files[i];
          const pdfOk = pdfs[file];
          return (
            <li
              key={c.id}
              className={`courier${isHidden ? " courier--hidden" : ""}${hovered === c.id ? " courier--hover" : ""}`}
              onMouseEnter={() => onHover(c.id)}
              onClick={() => route && stops > 0 && onFocus(c.id)}
              title={stops > 0 ? "Paspauskite, kad priartintumėte maršrutą" : undefined}
            >
              <div className="courier__row">
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => onToggle(c.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Rodyti ${c.name} maršrutą`}
                />
                <span className="dot" style={{ background: c.color }} />
                <span className="courier__name">{c.name}</span>
                <span className="courier__actions">
                  <button
                    className="btn btn--tiny"
                    onClick={(e) => {
                      e.stopPropagation();
                      onIsolate(c.id);
                    }}
                    title="Rodyti tik šį kurjerį"
                  >
                    tik šis
                  </button>
                  {pdfOk === false ? (
                    <span className="pdf pdf--missing" title={`PDF dar nesugeneruotas: /out/${file}`}>
                      PDF
                    </span>
                  ) : (
                    <a
                      className="pdf"
                      href={`/out/${file}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={file}
                    >
                      PDF
                    </a>
                  )}
                </span>
              </div>
              <div className="courier__meta">
                <span>{stops} stot.</span>
                <span>{fmtKm(route?.totalKm ?? 0)}</span>
                <span>{fmtHours(minToHours(route?.totalMinutes ?? 0))}</span>
                {late > 0 && <span className="late">vėluoja {late}</span>}
              </div>
              <div className="capacity" title={`Pakrauta ${fmtKg(kg)} iš ${fmtKg(c.capacityKg)} kg`}>
                <div className="capacity__bar">
                  <div
                    className="capacity__fill"
                    style={{ width: `${fill * 100}%`, background: fill > 0.95 ? "#e53935" : c.color }}
                  />
                </div>
                <span className="capacity__label">
                  {fmtKg(kg)} / {fmtKg(c.capacityKg)} kg
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
