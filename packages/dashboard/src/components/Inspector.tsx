import { useEffect, useId, useRef, useState } from "react";
import { PRIORITY_LABELS, RECIPIENT_TYPE_LABELS, type Courier, type Package, type Priority, type RecipientType } from "@marsrutai/shared";
import { fmtLatLng, randomAutoservice, randomPersonRecipient, VEHICLES } from "../lib/names";
import { COURIER_PALETTE } from "../lib/palette";
import { toMinutes } from "../format";
import { PriorityMark } from "./PriorityMark";
import { Segmented } from "./Segmented";
import { Icon } from "./Icon";

function Shell({ title, sub, onClose, children }: { title: string; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside className="inspector" aria-labelledby={id} ref={ref}>
      <header className="inspector__head">
        <div>
          <h2 id={id} className="inspector__title">
            {title}
          </h2>
          {sub && <div className="inspector__sub">{sub}</div>}
        </div>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Uždaryti">
          <Icon name="close" size={18} />
        </button>
      </header>
      {children}
    </aside>
  );
}

function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return armed ? (
    <button type="button" className="btn btn--danger" onClick={onDelete}>
      <Icon name="trash" size={16} />
      Patvirtinti
    </button>
  ) : (
    <button type="button" className="btn btn--ghost btn--danger-text" onClick={() => setArmed(true)}>
      <Icon name="trash" size={16} />
      {label}
    </button>
  );
}

// ---------------- paketas ----------------

export function PackageInspector({ pkg, isNew, onSave, onDelete, onClose }: {
  pkg: Package;
  isNew: boolean;
  onSave: (p: Package) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(pkg);
  const [tried, setTried] = useState(false);
  /** Ar langas keistas ranka – jei ne, tipo pasirinkimas jį užpildo. */
  const [windowTouched, setWindowTouched] = useState(!isNew);
  const prevLoc = useRef(pkg.location);
  const nameSeed = useRef(pkg.recipient);
  const first = useRef<HTMLInputElement>(null);

  // naujas paketas / kitas paketas – forma iš naujo
  useEffect(() => {
    setF(pkg);
    setTried(false);
    setWindowTouched(!isNew);
    nameSeed.current = pkg.recipient;
    prevLoc.current = pkg.location;
    first.current?.focus({ preventScroll: true });
  }, [pkg.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // taškas perkeltas žemėlapyje: atnaujinti koordinates ir automatinį adresą
  useEffect(() => {
    const old = prevLoc.current;
    if (old.lat === pkg.location.lat && old.lng === pkg.location.lng) return;
    setF((cur) => ({
      ...cur,
      location: pkg.location,
      address: cur.address === fmtLatLng(old.lat, old.lng) ? fmtLatLng(pkg.location.lat, pkg.location.lng) : cur.address,
    }));
    prevLoc.current = pkg.location;
  }, [pkg.location]);

  const windowOk = /^\d{2}:\d{2}$/.test(f.window.start) && /^\d{2}:\d{2}$/.test(f.window.end) && toMinutes(f.window.end) > toMinutes(f.window.start);
  const weightOk = Number.isFinite(f.weightKg) && f.weightKg > 0;
  const recipientOk = f.recipient.trim().length > 0;
  const addressOk = f.address.trim().length > 0;
  const valid = windowOk && weightOk && recipientOk && addressOk;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    onSave({ ...f, recipient: f.recipient.trim(), address: f.address.trim(), note: f.note?.trim() || undefined });
  };

  return (
    <Shell
      title={isNew ? "Naujas paketas" : f.id}
      sub={
        <span className="num">
          {isNew ? `${f.id} · ` : ""}
          {fmtLatLng(f.location.lat, f.location.lng)}
        </span>
      }
      onClose={onClose}
    >
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <span className="field__label">Gavėjas yra</span>
          <Segmented<RecipientType>
            label="Gavėjo tipas"
            value={f.recipientType ?? "person"}
            onChange={(v) => {
              // naujo paketo nekeistas gavėjas pakeičiamas tipui tinkamu pavyzdžiu
              let recipient = f.recipient;
              if (isNew && f.recipient === nameSeed.current) {
                recipient = v === "autoservice" ? randomAutoservice() : randomPersonRecipient();
                nameSeed.current = recipient;
              }
              setF({
                ...f,
                recipientType: v,
                recipient,
                // nekeistas langas prisitaiko prie tipo: autoservisai dirba 08–17
                window: windowTouched ? f.window : v === "autoservice" ? { start: "08:00", end: "17:00" } : pkg.window,
              });
            }}
            options={(["person", "autoservice"] as RecipientType[]).map((t) => ({
              value: t,
              label: (
                <span className="seg__prio">
                  <Icon name={t === "autoservice" ? "wrench" : "person"} size={15} />
                  {RECIPIENT_TYPE_LABELS[t]}
                </span>
              ),
            }))}
          />
        </div>

        <div className="field">
          <span className="field__label">Prioritetas</span>
          <Segmented<Priority>
            label="Prioritetas"
            value={f.priority}
            onChange={(v) => setF({ ...f, priority: v })}
            options={([1, 2, 3] as Priority[]).map((p) => ({
              value: p,
              label: (
                <span className="seg__prio">
                  <PriorityMark p={p} size={16} />
                  {PRIORITY_LABELS[p]}
                </span>
              ),
            }))}
          />
        </div>

        <div className="form__row">
          <label className="field">
            <span className="field__label">Langas nuo</span>
            <input
              ref={first}
              type="time"
              step={300}
              value={f.window.start}
              onChange={(e) => {
                setWindowTouched(true);
                setF({ ...f, window: { ...f.window, start: e.target.value } });
              }}
              aria-invalid={tried && !windowOk}
            />
          </label>
          <label className="field">
            <span className="field__label">iki</span>
            <input
              type="time"
              step={300}
              value={f.window.end}
              onChange={(e) => {
                setWindowTouched(true);
                setF({ ...f, window: { ...f.window, end: e.target.value } });
              }}
              aria-invalid={tried && !windowOk}
            />
          </label>
          <label className="field field--narrow">
            <span className="field__label">Svoris, kg</span>
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={Number.isNaN(f.weightKg) ? "" : f.weightKg}
              onChange={(e) => setF({ ...f, weightKg: e.target.valueAsNumber })}
              aria-invalid={tried && !weightOk}
            />
          </label>
        </div>
        {tried && !windowOk && <p className="field__error">Lango pabaiga turi būti vėliau nei pradžia.</p>}
        {tried && !weightOk && <p className="field__error">Svoris turi būti didesnis nei 0.</p>}

        <label className="field">
          <span className="field__label">{f.recipientType === "autoservice" ? "Autoservisas" : "Gavėjas"}</span>
          <input
            value={f.recipient}
            onChange={(e) => setF({ ...f, recipient: e.target.value })}
            aria-invalid={tried && !recipientOk}
            placeholder={f.recipientType === "autoservice" ? "Pvz. Autoservisas „Ratų centras“" : "Vardas Pavardė"}
          />
        </label>
        {tried && !recipientOk && <p className="field__error">Įrašykite gavėją.</p>}

        <label className="field">
          <span className="field__label">Adresas</span>
          <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} aria-invalid={tried && !addressOk} />
        </label>

        <label className="field">
          <span className="field__label">Pastaba</span>
          <textarea rows={2} value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Pvz. skambinti prieš atvykstant" />
        </label>

        <p className="form__hint">
          {isNew ? "Spustelėkite kitur žemėlapyje arba tempkite kryželį, kad patikslintumėte vietą." : "Žymeklį galima tempti žemėlapyje."}
        </p>

        <div className="form__actions">
          {!isNew && <DeleteButton label="Ištrinti" onDelete={onDelete} />}
          <span className="form__spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Atšaukti
          </button>
          <button type="submit" className="btn btn--primary">
            {isNew ? "Pridėti paketą" : "Išsaugoti"}
          </button>
        </div>
      </form>
    </Shell>
  );
}

// ---------------- kurjeris ----------------

export function CourierInspector({ courier, isNew, onSave, onDelete, onClose }: {
  courier: Courier;
  isNew: boolean;
  onSave: (c: Courier) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(courier);
  const [tried, setTried] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setF(courier);
    setTried(false);
    first.current?.focus({ preventScroll: true });
  }, [courier.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameOk = f.name.trim().length > 0;
  const capOk = Number.isFinite(f.capacityKg) && f.capacityKg > 0;
  const shiftOk = toMinutes(f.shiftEnd) > toMinutes(f.shiftStart);
  const valid = nameOk && capOk && shiftOk;
  const vehicles = VEHICLES.includes(f.vehicle) ? VEHICLES : [f.vehicle, ...VEHICLES];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (valid) onSave({ ...f, name: f.name.trim() });
  };

  return (
    <Shell title={isNew ? "Naujas kurjeris" : f.name || "Kurjeris"} sub={<span className="num">{f.id}</span>} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field__label">Vardas ir pavardė</span>
          <input ref={first} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-invalid={tried && !nameOk} />
        </label>
        {tried && !nameOk && <p className="field__error">Įrašykite vardą.</p>}

        <div className="form__row">
          <label className="field">
            <span className="field__label">Pamaina nuo</span>
            <input type="time" step={300} value={f.shiftStart} onChange={(e) => setF({ ...f, shiftStart: e.target.value })} aria-invalid={tried && !shiftOk} />
          </label>
          <label className="field">
            <span className="field__label">iki</span>
            <input type="time" step={300} value={f.shiftEnd} onChange={(e) => setF({ ...f, shiftEnd: e.target.value })} aria-invalid={tried && !shiftOk} />
          </label>
          <label className="field field--narrow">
            <span className="field__label">Talpa, kg</span>
            <input
              type="number"
              min={1}
              step={10}
              value={Number.isNaN(f.capacityKg) ? "" : f.capacityKg}
              onChange={(e) => setF({ ...f, capacityKg: e.target.valueAsNumber })}
              aria-invalid={tried && !capOk}
            />
          </label>
        </div>
        {tried && !shiftOk && <p className="field__error">Pamainos pabaiga turi būti vėliau nei pradžia.</p>}
        {tried && !capOk && <p className="field__error">Talpa turi būti didesnė nei 0.</p>}

        <div className="form__row">
          <label className="field">
            <span className="field__label">Transportas</span>
            <select value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })}>
              {vehicles.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Telefonas</span>
            <input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </label>
        </div>

        <div className="field">
          <span className="field__label">Spalva žemėlapyje</span>
          <div className="swatches" role="radiogroup" aria-label="Spalva žemėlapyje">
            {COURIER_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={f.color.toLowerCase() === c}
                aria-label={c}
                className={`swatchbtn${f.color.toLowerCase() === c ? " is-on" : ""}`}
                style={{ background: c }}
                onClick={() => setF({ ...f, color: c })}
              />
            ))}
          </div>
        </div>

        <div className="form__actions">
          {!isNew && <DeleteButton label="Ištrinti kurjerį" onDelete={onDelete} />}
          <span className="form__spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Atšaukti
          </button>
          <button type="submit" className="btn btn--primary">
            {isNew ? "Pridėti kurjerį" : "Išsaugoti"}
          </button>
        </div>
      </form>
    </Shell>
  );
}
