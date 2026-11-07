import { useEffect, useMemo, useRef, useState } from "react";
import { courierNavLinks, type OptimizeResponse } from "@marsrutai/shared";
import { fmtEur, fmtHours, fmtKg, fmtKm, fmtNum, formatDateTime, makeMinuteOfDay, makeTimeFormatter, minToHours, toMinutes, type PlanIndex } from "../format";
import { inkOn } from "../lib/palette";
import { PriorityMark } from "./PriorityMark";
import { Icon } from "./Icon";
import { RecipientTag } from "./RecipientTag";
import { NavActions, NavParts } from "./NavActions";

interface Props {
  result: OptimizeResponse | null;
  index: PlanIndex | null;
  stale: boolean;
  hidden: Set<string>;
  hovered: string | null;
  busy: boolean;
  canOptimize: boolean;
  /** Pasirinktas kurjeris: rodomas tik jo maršrutas ir stotelių lentelė. */
  selected: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onShowAll: () => void;
  onHover: (id: string | null) => void;
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

function PlanBody({ result, index, stale, hidden, hovered, busy, canOptimize, selected, onSelect, onToggle, onShowAll, onHover, onOptimize, onFocusPlan }: Props & {
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
  const fmtTime = useMemo(() => makeTimeFormatter(tz), [tz]);
  const listRef = useRef<HTMLUListElement>(null);
  const navLinks = useMemo(() => new Map(couriers.map((c) => [c.id, courierNavLinks(plan, c.id)])), [plan, couriers]);
  const [navOpen, setNavOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!selected) return;
    listRef.current?.querySelector(`[data-id="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

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
          <button type="button" className="btn btn--ghost" onClick={onFocusPlan}>
            <Icon name="focus" size={16} />
            Rodyti visą planą
          </button>
          <a className="textlink" href={result.zipUrl} download={`marsrutai-${plan.dataset.depot.date}.zip`}>
            Visi PDF vienu ZIP
          </a>
        </div>
      </section>

      <section className="block block--list">
        <div className="block__head">
          <h2 className="block__title">
            Maršrutai <span className="num count">{visibleCount}/{couriers.length}</span>
          </h2>
          <button type="button" className={`btn btn--sm ${selected ? "btn--secondary" : "btn--ghost"}`} onClick={onShowAll} disabled={hidden.size === 0 && !selected}>
            Rodyti visus
          </button>
        </div>
        <p className="routes__hint">Spustelėkite kurjerį, kad matytumėte tik jo maršrutą ir stoteles.</p>
        <div className="axis" aria-hidden="true">
          {hours.map((h) => (
            <span key={h} style={{ left: pct(h * 60) }} className="num">
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>
        <ul className="routes" ref={listRef} onMouseLeave={() => onHover(null)}>
          {couriers.map((c) => {
            const route = index.routes.get(c.id);
            const stops = route?.stops ?? [];
            const late = stops.filter((s) => Math.round(s.lateMinutes) >= 1).length;
            const kg = route?.totalWeightKg ?? 0;
            const fill = Math.min(1, kg / c.capacityKg);
            const isHidden = hidden.has(c.id);
            const isSel = selected === c.id;
            const dimmed = selected != null && !isSel;
            const pdf = pdfs.get(c.id);
            const startMin = route ? minuteOf(route.start) : NaN;
            const endMin = route ? minuteOf(route.end) : NaN;
            const idle = stops.length === 0;
            return (
              <li
                key={c.id}
                data-id={c.id}
                className={`route${isHidden ? " is-hidden" : ""}${hovered === c.id ? " is-hover" : ""}${idle ? " is-idle" : ""}${isSel ? " is-selected" : ""}${dimmed ? " is-dimmed" : ""}`}
                onMouseEnter={idle ? undefined : () => onHover(c.id)}
              >
                <input
                  type="checkbox"
                  className="check route__check"
                  checked={!isHidden}
                  onChange={() => onToggle(c.id)}
                  aria-label={`Rodyti ${c.name} maršrutą žemėlapyje`}
                />
                <button
                  type="button"
                  className="route__select"
                  onClick={() => onSelect(c.id)}
                  disabled={idle}
                  aria-pressed={isSel}
                  aria-label={idle ? `${c.name}: šiandien be paketų` : `${c.name}: ${isSel ? "rodyti visus maršrutus" : "rodyti tik šį maršrutą"}`}
                >
                  <span className="route__head">
                    <span className="swatch" style={{ background: c.color }} />
                    <span className="route__name">{c.name}</span>
                  </span>
                  {idle ? (
                    <span className="route__idle">Šiandien be paketų</span>
                  ) : (
                    <>
                      <span className="route__figs num">
                        <span>{fmtNum(stops.length)} stot.</span>
                        <span>{fmtKm(route!.totalKm)}</span>
                        <span>{fmtHours(minToHours(route!.totalMinutes))}</span>
                        <span className={fill > 0.95 ? "is-full" : undefined}>
                          {fmtKg(kg)}/{fmtKg(c.capacityKg)} kg
                        </span>
                        {late > 0 && <span className="is-late">vėluoja {late}</span>}
                      </span>
                      <span className="strip" aria-hidden="true">
                        <span className="strip__shift" style={{ left: pct(toMinutes(c.shiftStart)), right: `calc(100% - ${pct(toMinutes(c.shiftEnd))})` }} />
                        {!Number.isNaN(startMin) && !Number.isNaN(endMin) && (
                          <span className="strip__run" style={{ left: pct(startMin), right: `calc(100% - ${pct(endMin)})`, background: c.color }} />
                        )}
                        {stops.map((s) => {
                          const isLate = Math.round(s.lateMinutes) >= 1;
                          return (
                            <i
                              key={s.packageId}
                              className={isLate ? "is-late" : undefined}
                              style={{ left: pct(minuteOf(s.arrival)), ...(isLate ? {} : { background: inkOn(c.color) }) }}
                            />
                          );
                        })}
                      </span>
                    </>
                  )}
                </button>
                <span className="route__actions">
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
                  <NavActions
                    courier={c}
                    links={navLinks.get(c.id) ?? []}
                    open={navOpen === c.id}
                    onToggle={() => setNavOpen((o) => (o === c.id ? null : c.id))}
                  />
                </span>
                {navOpen === c.id && (navLinks.get(c.id)?.length ?? 0) > 1 && <NavParts links={navLinks.get(c.id)!} />}
                {isSel && route && (
                  <table className="stops">
                    <caption className="sr-only">{c.name}: stotelės eilės tvarka</caption>
                    <thead>
                      <tr>
                        <th scope="col">Nr.</th>
                        <th scope="col">Atvyksta</th>
                        <th scope="col">Paketas</th>
                        <th scope="col">Langas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stops.map((s) => {
                        const k = index.packages.get(s.packageId);
                        const lateM = Math.round(s.lateMinutes);
                        const waitM = Math.round(s.waitMinutes);
                        return (
                          <tr key={s.packageId}>
                            <td>
                              <span className="stops__seq" style={{ background: c.color, color: inkOn(c.color) }}>
                                {s.seq}
                              </span>
                            </td>
                            <td className="num stops__eta">{fmtTime(s.arrival)}</td>
                            <td className="stops__pkg">
                              <span className="stops__id">
                                {k && <PriorityMark p={k.priority} size={14} />}
                                <span className="num">{s.packageId}</span>
                              </span>
                              <span className="stops__who">
                                {k && <RecipientTag pkg={k} compact />} {k?.recipient}
                              </span>
                              {lateM >= 1 && <span className="tag tag--late">vėluoja {lateM} min</span>}
                              {waitM >= 1 && <span className="tag tag--wait">laukia {waitM} min</span>}
                            </td>
                            <td className="num stops__win">{k ? `${k.window.start}–${k.window.end}` : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
