import { useMemo } from "react";
import type { OptimizeResponse } from "@marsrutai/shared";
import { fmtEur, fmtHours, fmtKg, fmtKm, fmtNum, formatDateTime, makeMinuteOfDay, minToHours, toMinutes, type PlanIndex } from "../format";
import { inkOn } from "../lib/palette";
import { PriorityMark } from "./PriorityMark";
import { Icon } from "./Icon";

interface Props {
  result: OptimizeResponse | null;
  index: PlanIndex | null;
  stale: boolean;
  hidden: Set<string>;
  hovered: string | null;
  busy: boolean;
  canOptimize: boolean;
  onToggle: (id: string) => void;
  onIsolate: (id: string) => void;
  onShowAll: () => void;
  onHover: (id: string | null) => void;
  onFocus: (id: string) => void;
  onOptimize: () => void;
  onFocusPlan: () => void;
}

export function PlanPanel(p: Props) {
  if (!p.result || !p.index) {
    return (
      <div className="panel">
        <div className="empty empty--plan">
          <Icon name="route" size={22} />
          <p>
            <strong>Maršrutų dar nėra.</strong> Kai scenarijuje bus paketų ir kurjerių, spauskite „Sudaryti maršrutus“.
            Optimizatorius paskirstys paketus kurjeriams pagal prioritetą, laiko langus ir talpą, o kiekvienam
            kurjeriui bus paruoštas PDF maršruto lapas.
          </p>
          <button type="button" className="btn btn--primary" onClick={p.onOptimize} disabled={!p.canOptimize || p.busy}>
            <Icon name="route" size={18} />
            Sudaryti maršrutus
          </button>
        </div>
      </div>
    );
  }
  return <PlanBody {...p} result={p.result} index={p.index} />;
}

function PlanBody({ result, index, stale, hidden, hovered, busy, canOptimize, onToggle, onIsolate, onShowAll, onHover, onFocus, onOptimize, onFocusPlan }: Props & {
  result: OptimizeResponse;
  index: PlanIndex;
}) {
  const plan = result.plan;
  const m = plan.metrics;
  const tz = plan.dataset.depot.timezone;
  const total = plan.dataset.packages.length;
  const pdfs = useMemo(() => new Map(result.pdfs.map((x) => [x.courierId, x.url])), [result.pdfs]);
  const minuteOf = useMemo(() => makeMinuteOfDay(tz), [tz]);
  const couriers = plan.dataset.couriers;
  const dayStart = Math.min(toMinutes(plan.dataset.depot.open), ...couriers.map((c) => toMinutes(c.shiftStart)));
  const dayEnd = Math.max(toMinutes(plan.dataset.depot.close), ...couriers.map((c) => toMinutes(c.shiftEnd)));
  const span = Math.max(60, dayEnd - dayStart);
  const pct = (min: number) => `${((Math.min(dayEnd, Math.max(dayStart, min)) - dayStart) / span) * 100}%`;
  const hours: number[] = [];
  for (let h = Math.ceil(dayStart / 120) * 2; h * 60 <= dayEnd; h += 2) hours.push(h);
  const visibleCount = couriers.filter((c) => !hidden.has(c.id)).length;

  return (
    <div className="panel">
      {stale && (
        <div className="stale" role="status">
          <Icon name="alert" size={18} />
          <div>
            <strong>Planas pasenęs.</strong> Scenarijus pakeistas po sudarymo, todėl maršrutai rodomi blankiai.
          </div>
          <button type="button" className="btn btn--primary btn--sm" onClick={onOptimize} disabled={busy || !canOptimize}>
            Sudaryti iš naujo
          </button>
        </div>
      )}

      <section className={`block${stale ? " is-stale" : ""}`}>
        <div className="block__head">
          <h2 className="block__title">Planas</h2>
          <span className={`badge badge--${plan.mode}`}>{plan.mode === "api" ? "Google API" : "Mock"}</span>
        </div>
        <dl className="metrics">
          <div>
            <dt>Pristatoma</dt>
            <dd className="num">
              {fmtNum(m.deliveredCount)}
              <small>/{fmtNum(total)}</small>
            </dd>
          </div>
          <div className={m.skippedCount ? "is-warn" : undefined}>
            <dt>Nepristatoma</dt>
            <dd className="num">{fmtNum(m.skippedCount)}</dd>
          </div>
          <div className={m.lateCount ? "is-bad" : undefined}>
            <dt>Vėluoja</dt>
            <dd className="num">{fmtNum(m.lateCount)}</dd>
          </div>
          <div>
            <dt>Atstumas</dt>
            <dd className="num">{fmtKm(m.totalKm)}</dd>
          </div>
          <div>
            <dt>Darbo laikas</dt>
            <dd className="num">{fmtHours(m.totalHours)}</dd>
          </div>
          {m.totalCost != null && (
            <div>
              <dt>Kaina</dt>
              <dd className="num">{fmtEur(m.totalCost)}</dd>
            </div>
          )}
        </dl>
        <p className="block__foot">
          Sudaryta {formatDateTime(plan.generatedAt, tz)}
          {result.durationMs > 0 && <> · per {fmtNum(Math.max(1, Math.round(result.durationMs / 1000)))} s</>} · diena {plan.dataset.depot.date}
        </p>
        <div className="toolbar">
          <a className="btn btn--secondary" href={result.zipUrl} download={`marsrutai-${plan.dataset.depot.date}.zip`}>
            <Icon name="download" size={16} />
            Atsisiųsti visus PDF (ZIP)
          </a>
          <button type="button" className="btn btn--ghost" onClick={onFocusPlan}>
            <Icon name="focus" size={16} />
            Rodyti visą planą
          </button>
        </div>
      </section>

      <section className="block block--list">
        <div className="block__head">
          <h2 className="block__title">
            Maršrutai <span className="num count">{visibleCount}/{couriers.length}</span>
          </h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onShowAll} disabled={hidden.size === 0}>
            Rodyti visus
          </button>
        </div>
        <div className="axis" aria-hidden="true">
          {hours.map((h) => (
            <span key={h} style={{ left: pct(h * 60) }} className="num">
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>
        <ul className="routes" onMouseLeave={() => onHover(null)}>
          {couriers.map((c) => {
            const route = index.routes.get(c.id);
            const stops = route?.stops ?? [];
            const late = stops.filter((s) => Math.round(s.lateMinutes) >= 1).length;
            const kg = route?.totalWeightKg ?? 0;
            const fill = Math.min(1, kg / c.capacityKg);
            const isHidden = hidden.has(c.id);
            const pdf = pdfs.get(c.id);
            const startMin = route ? minuteOf(route.start) : NaN;
            const endMin = route ? minuteOf(route.end) : NaN;
            return (
              <li
                key={c.id}
                className={`route${isHidden ? " is-hidden" : ""}${hovered === c.id ? " is-hover" : ""}${stops.length === 0 ? " is-idle" : ""}`}
                onMouseEnter={() => onHover(c.id)}
              >
                <div className="route__head">
                  <input
                    type="checkbox"
                    className="check"
                    checked={!isHidden}
                    onChange={() => onToggle(c.id)}
                    aria-label={`Rodyti ${c.name} maršrutą žemėlapyje`}
                  />
                  <span className="swatch" style={{ background: c.color }} />
                  <button
                    type="button"
                    className="route__name"
                    onClick={() => onFocus(c.id)}
                    disabled={stops.length === 0}
                    title={stops.length ? "Priartinti maršrutą žemėlapyje" : undefined}
                  >
                    {c.name}
                  </button>
                  <span className="route__actions">
                    <button type="button" className="btn btn--ghost btn--xs" onClick={() => onIsolate(c.id)} disabled={stops.length === 0}>
                      tik šis
                    </button>
                    {pdf ? (
                      <a className="btn btn--ghost btn--xs" href={pdf} target="_blank" rel="noreferrer" title={`${c.name} maršruto lapas (PDF)`}>
                        <Icon name="file" size={14} />
                        PDF
                      </a>
                    ) : (
                      <span className="btn btn--ghost btn--xs is-disabled" title="PDF nesugeneruotas">
                        PDF
                      </span>
                    )}
                  </span>
                </div>
                {stops.length === 0 ? (
                  <div className="route__idle">Šiandien be paketų</div>
                ) : (
                  <>
                    <div className="route__figs num">
                      <span>{fmtNum(stops.length)} stot.</span>
                      <span>{fmtKm(route!.totalKm)}</span>
                      <span>{fmtHours(minToHours(route!.totalMinutes))}</span>
                      <span className={fill > 0.95 ? "is-full" : undefined}>
                        {fmtKg(kg)}/{fmtKg(c.capacityKg)} kg
                      </span>
                      {late > 0 && <span className="is-late">vėluoja {late}</span>}
                    </div>
                    <div className="strip" aria-hidden="true">
                      <span className="strip__shift" style={{ left: pct(toMinutes(c.shiftStart)), right: `calc(100% - ${pct(toMinutes(c.shiftEnd))})` }} />
                      {!Number.isNaN(startMin) && !Number.isNaN(endMin) && (
                        <span
                          className="strip__run"
                          style={{ left: pct(startMin), right: `calc(100% - ${pct(endMin)})`, background: c.color }}
                        />
                      )}
                      {stops.map((s) => {
                        const t = minuteOf(s.arrival);
                        const isLate = Math.round(s.lateMinutes) >= 1;
                        return (
                          <i
                            key={s.packageId}
                            className={isLate ? "is-late" : undefined}
                            style={{ left: pct(t), ...(isLate ? {} : { background: inkOn(c.color) === "#ffffff" ? "#ffffff" : "#1c211e" }) }}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <SkippedBlock result={result} index={index} />
    </div>
  );
}

function SkippedBlock({ result, index }: { result: OptimizeResponse; index: PlanIndex }) {
  const skipped = result.plan.skipped;
  return (
    <section className="block">
      <div className="block__head">
        <h2 className="block__title">
          Nepristatomi <span className="num count">{fmtNum(skipped.length)}</span>
        </h2>
      </div>
      {skipped.length === 0 ? (
        <p className="block__foot">Visi paketai paskirstyti kurjeriams.</p>
      ) : (
        <ul className="rows rows--static">
          {skipped.map((s) => {
            const k = index.packages.get(s.packageId);
            return (
              <li key={s.packageId} className="row row--static">
                {k ? <PriorityMark p={k.priority} size={18} /> : <span />}
                <span className="row__main">
                  <span className="row__title">
                    <span className="row__id num">{s.packageId}</span> {k?.recipient}
                  </span>
                  <span className="row__reason">{s.reason}</span>
                </span>
                {k && (
                  <span className="row__figs num">
                    <span>
                      {k.window.start}–{k.window.end}
                    </span>
                    <span className="row__muted">{fmtKg(k.weightKg)} kg</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
