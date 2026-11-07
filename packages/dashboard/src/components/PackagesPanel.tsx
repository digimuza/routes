import { useEffect, useRef, useState } from "react";
import { PRIORITY_COLORS, PRIORITY_LABELS, type Package, type Priority } from "@marsrutai/shared";
import { fmtKg, fmtNum } from "../format";
import { PriorityMark } from "./PriorityMark";
import { RecipientTag } from "./RecipientTag";
import { Icon } from "./Icon";
import { Segmented } from "./Segmented";

export interface GenerateOptions {
  count: number;
  mix: { p1: number; p2: number; p3: number };
  /** Autoservisų dalis procentais (likusieji – fiziniai asmenys). */
  autoservicePct: number;
  replace: boolean;
}

interface Props {
  packages: Package[];
  cityName: string;
  generating: boolean;
  generateError: string | null;
  onGenerate: (o: GenerateOptions) => Promise<boolean>;
  onClear: () => void;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  assigned: Map<string, { color: string; seq: number; name: string }> | null;
  /** Ėjimas iki kliento ir atgal, min (scenarijaus nustatymas). */
  walkMinutes: number;
  onWalkMinutes: (m: number) => void;
}

function WalkSetting({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const n = Number(text);
  const ok = text.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 60;
  return (
    <div className="walk">
      <label className="walk__label" htmlFor="walk-min">
        <Icon name="person" size={15} />
        Ėjimas iki kliento ir atgal
      </label>
      <span className="walk__input">
        <input
          id="walk-min"
          type="number"
          min={0}
          max={60}
          step={1}
          value={text}
          aria-invalid={!ok}
          aria-describedby="walk-help"
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isInteger(v) && v >= 0 && v <= 60 && v !== value) onChange(v);
          }}
          onBlur={() => !ok && setText(String(value))}
        />
        min
      </span>
      <span id="walk-help" className={`walk__help${ok ? "" : " is-error"}`}>
        {ok ? "Pridedama prie kiekvieno pristatymo laiko." : "Sveikas skaičius nuo 0 iki 60."}
      </span>
    </div>
  );
}

const PRIOS: Priority[] = [1, 2, 3];

function GenerateForm({ onGenerate, generating, error, hasPackages, onDone }: {
  onGenerate: Props["onGenerate"];
  generating: boolean;
  error: string | null;
  hasPackages: boolean;
  onDone: () => void;
}) {
  const [count, setCount] = useState(30);
  const [mix, setMix] = useState({ p1: 20, p2: 45, p3: 35 });
  const [replace, setReplace] = useState(false);
  const [autoPct, setAutoPct] = useState(35);
  const sum = mix.p1 + mix.p2 + mix.p3;
  const countOk = Number.isInteger(count) && count >= 1 && count <= 300;
  const autoOk = Number.isFinite(autoPct) && autoPct >= 0 && autoPct <= 100;
  const valid = countOk && sum === 100 && autoOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    if (await onGenerate({ count, mix, autoservicePct: autoPct, replace })) onDone();
  };

  return (
    <form className="genform" onSubmit={submit}>
      <div className="genform__row">
        <label className="field field--count">
          <span className="field__label">Kiekis</span>
          <input
            type="number"
            min={1}
            max={300}
            value={Number.isNaN(count) ? "" : count}
            onChange={(e) => setCount(e.target.valueAsNumber)}
            aria-invalid={!countOk}
          />
        </label>
        <div className="field">
          <span className="field__label">Prioritetų dalys, %</span>
          <div className="mixinputs">
            {PRIOS.map((p) => {
              const k = `p${p}` as const;
              return (
                <label key={p} className="mixinput">
                  <PriorityMark p={p} size={16} />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Number.isNaN(mix[k]) ? "" : mix[k]}
                    aria-label={`${p} prioriteto dalis procentais`}
                    onChange={(e) => setMix({ ...mix, [k]: e.target.valueAsNumber || 0 })}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mixbar" aria-hidden="true">
        {PRIOS.map((p) => (
          <i key={p} style={{ flexGrow: Math.max(0, mix[`p${p}` as const]), background: PRIORITY_COLORS[p] }} />
        ))}
      </div>
      <label className="field field--inline">
        <span className="field__label">
          <Icon name="wrench" size={14} /> Autoservisų dalis, %
        </span>
        <input
          type="number"
          min={0}
          max={100}
          value={Number.isNaN(autoPct) ? "" : autoPct}
          onChange={(e) => setAutoPct(e.target.valueAsNumber)}
          aria-invalid={!autoOk}
        />
        <span className="field__aside">likusieji – fiziniai asmenys</span>
      </label>
      {!autoOk && <p className="field__error">Autoservisų dalis nuo 0 iki 100 %.</p>}
      {sum !== 100 && <p className="field__error">Dalių suma turi būti 100 % (dabar {fmtNum(sum)} %).</p>}
      {!countOk && <p className="field__error">Kiekis nuo 1 iki 300.</p>}
      <div className="genform__row genform__row--end">
        <Segmented
          label="Kaip pridėti"
          size="sm"
          value={replace ? "replace" : "add"}
          onChange={(v) => setReplace(v === "replace")}
          options={[
            { value: "add", label: "Pridėti" },
            { value: "replace", label: "Pakeisti visus", title: hasPackages ? "Esami paketai bus pašalinti" : undefined },
          ]}
        />
        <button type="submit" className="btn btn--secondary" disabled={!valid || generating}>
          {generating ? <span className="spinner spinner--sm" aria-hidden="true" /> : <Icon name="shuffle" size={16} />}
          Generuoti {countOk ? fmtNum(count) : ""}
        </button>
      </div>
      {error && <p className="field__error" role="alert">{error}</p>}
    </form>
  );
}

export function PackagesPanel(p: Props) {
  const [genOpen, setGenOpen] = useState(p.packages.length === 0);
  const [confirmClear, setConfirmClear] = useState(false);
  const counts = PRIOS.map((x) => p.packages.filter((k) => k.priority === x).length);
  const totalKg = p.packages.reduce((s, k) => s + k.weightKg, 0);
  const autoCount = p.packages.filter((k) => k.recipientType === "autoservice").length;
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!confirmClear) return;
    const t = window.setTimeout(() => setConfirmClear(false), 5000);
    return () => window.clearTimeout(t);
  }, [confirmClear]);

  // pasirinktas paketas (pvz. paspaustas žemėlapyje) – matomas sąraše
  useEffect(() => {
    if (!p.selectedId) return;
    listRef.current?.querySelector(`[data-id="${CSS.escape(p.selectedId)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [p.selectedId]);

  return (
    <div className="panel">
      <section className="block">
        <div className="block__head">
          <h2 className="block__title">
            Paketai <span className="num count">{fmtNum(p.packages.length)} · {fmtKg(totalKg)} kg</span>
          </h2>
          {confirmClear ? (
            <span className="confirm" role="group" aria-label="Patvirtinti išvalymą">
              <span className="confirm__q">Ištrinti {fmtNum(p.packages.length)}?</span>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => {
                  p.onClear();
                  setConfirmClear(false);
                }}
              >
                Taip
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmClear(false)}>
                Atšaukti
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" disabled={p.packages.length === 0} onClick={() => setConfirmClear(true)}>
              <Icon name="trash" size={16} />
              Išvalyti paketus
            </button>
          )}
        </div>

        <ul className="legend" aria-label="Paketai pagal prioritetą">
          {PRIOS.map((x, i) => (
            <li key={x} className="legend__row">
              <PriorityMark p={x} size={18} />
              <span className="legend__label">{PRIORITY_LABELS[x]}</span>
              <span className="legend__bar" aria-hidden="true">
                <i style={{ width: `${p.packages.length ? (counts[i] / p.packages.length) * 100 : 0}%`, background: PRIORITY_COLORS[x] }} />
              </span>
              <span className="legend__count num">{fmtNum(counts[i])}</span>
            </li>
          ))}
        </ul>
        <p className="typecounts num" aria-label="Paketai pagal gavėjo tipą">
          <span>
            <Icon name="person" size={15} /> Fiziniai asmenys <strong>{fmtNum(p.packages.length - autoCount)}</strong>
          </span>
          <span>
            <Icon name="wrench" size={15} /> Autoservisai <strong>{fmtNum(autoCount)}</strong>
          </span>
        </p>

        <WalkSetting value={p.walkMinutes} onChange={p.onWalkMinutes} />

        <div className="toolbar">
          <button type="button" className={`btn btn--secondary${genOpen ? " is-active" : ""}`} aria-expanded={genOpen} onClick={() => setGenOpen((o) => !o)}>
            <Icon name="shuffle" size={16} />
            Generuoti atsitiktinius
          </button>
        </div>

        {genOpen && (
          <GenerateForm
            onGenerate={p.onGenerate}
            generating={p.generating}
            error={p.generateError}
            hasPackages={p.packages.length > 0}
            onDone={() => setGenOpen(false)}
          />
        )}
      </section>

      <section className="block block--list">
        {p.packages.length === 0 ? (
          <div className="empty">
            <Icon name="pin" size={22} />
            <p>
              <strong>Paketų dar nėra.</strong> Spustelėkite žemėlapį, kad pridėtumėte paketą tame taške, arba sugeneruokite
              atsitiktinius {p.cityName === "Kaunas" ? "Kauno" : p.cityName === "Vilnius" ? "Vilniaus" : p.cityName} adresus.
            </p>
          </div>
        ) : (
          <ul className="rows" ref={listRef} onMouseLeave={() => p.onHover(null)}>
            {p.packages.map((k) => {
              const a = p.assigned?.get(k.id);
              return (
                <li key={k.id} data-id={k.id}>
                  <button
                    type="button"
                    className={`row${k.id === p.selectedId ? " is-selected" : ""}${k.id === p.hoveredId ? " is-hover" : ""}`}
                    onClick={() => p.onSelect(k.id)}
                    onMouseEnter={() => p.onHover(k.id)}
                    onFocus={() => p.onHover(k.id)}
                  >
                    <PriorityMark p={k.priority} size={18} />
                    <span className="row__main">
                      <span className="row__title">
                        <span className="row__id num">{k.id}</span> {k.recipient}
                      </span>
                      <span className="row__sub">
                        <RecipientTag pkg={k} compact /> {k.address}
                      </span>
                    </span>
                    <span className="row__figs num">
                      <span>
                        {k.window.start}–{k.window.end}
                      </span>
                      <span className="row__muted">{fmtKg(k.weightKg)} kg</span>
                    </span>
                    {a && (
                      <span className="row__assign" title={`${a.name}, stotelė ${a.seq}`}>
                        <span className="swatch swatch--sm" style={{ background: a.color }} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
