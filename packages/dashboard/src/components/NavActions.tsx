import { useEffect, useState } from "react";
import type { Courier, NavLink } from "@marsrutai/shared";
import { copyText } from "../lib/downloads";
import { Icon } from "./Icon";

export const partLabel = (l: NavLink) => `${l.part} dalis (${l.fromSeq}–${l.toSeq})`;

/** Tekstas SMS / Viber žinutei kurjeriui. */
export function navMessage(courier: Courier, links: NavLink[]): string {
  if (links.length === 1) return `${courier.name} – maršrutas Google Maps (stotelės ${links[0].fromSeq}–${links[0].toSeq}):\n${links[0].url}`;
  return [
    `${courier.name} – maršrutas Google Maps, ${links.length} dalys (atidarykite paeiliui):`,
    ...links.map((l) => `${partLabel(l)}${l.returnsToDepot ? ", grįžimas į sandėlį" : ""}: ${l.url}`),
  ].join("\n");
}

/** Google Maps nuoroda(-os) ir kopijavimas – ramūs antriniai veiksmai kurjerio eilutėje. */
export function NavActions({ courier, links, open, onToggle }: {
  courier: Courier;
  links: NavLink[];
  /** Kelių dalių sąrašas išskleistas po eilute. */
  open: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  if (links.length === 0) return null;

  const copy = async () => setCopied((await copyText(navMessage(courier, links))) ? "ok" : "fail");

  return (
    <>
      {links.length === 1 ? (
        <a
          className="btn btn--ghost btn--xs"
          href={links[0].url}
          target="_blank"
          rel="noreferrer"
          title={`${courier.name}: maršrutas Google Maps (stotelės ${links[0].fromSeq}–${links[0].toSeq})`}
        >
          <Icon name="nav" size={14} />
          Maps
        </a>
      ) : (
        <button
          type="button"
          className={`btn btn--ghost btn--xs${open ? " is-active" : ""}`}
          aria-expanded={open}
          onClick={onToggle}
          title={`Maršrutas per ilgas vienai nuorodai: ${links.length} dalys`}
        >
          <Icon name="nav" size={14} />
          Maps ×{links.length}
        </button>
      )}
      <button type="button" className="btn btn--ghost btn--xs" onClick={() => void copy()} aria-live="polite" title="Kopijuoti Google Maps nuorodą kurjeriui (SMS, Viber)">
        {copied === "ok" ? (
          <>
            <Icon name="check" size={14} />
            Nukopijuota
          </>
        ) : copied === "fail" ? (
          "Nepavyko"
        ) : (
          <>
            <Icon name="copy" size={14} />
            Kopijuoti nuorodą
          </>
        )}
      </button>
    </>
  );
}

export function NavParts({ links }: { links: NavLink[] }) {
  return (
    <ol className="navparts" aria-label="Google Maps nuorodos dalimis">
      {links.map((l) => (
        <li key={l.part}>
          <a href={l.url} target="_blank" rel="noreferrer">
            <Icon name="nav" size={14} />
            {partLabel(l)}
          </a>
          {l.returnsToDepot && <span className="navparts__end">grįžimas į sandėlį</span>}
        </li>
      ))}
    </ol>
  );
}
