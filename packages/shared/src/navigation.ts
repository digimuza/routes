import type { Plan } from "./types.js";

/**
 * Google Maps navigacijos nuorodos kurjeriui (Maps URLs, `api=1`).
 * Viena nuoroda leidžia iki 9 tarpinių taškų (Google Maps programėlėje ir kompiuteryje),
 * todėl ilgas maršrutas skaidomas į dalis po ≤ 10 stotelių: kiekviena dalis prasideda
 * ten, kur baigėsi ankstesnė, paskutinė grįžta į sandėlį.
 */
export const MAX_WAYPOINTS_PER_LINK = 9;

export interface NavLink {
  /** 1-based dalies numeris. */
  part: number;
  parts: number;
  /** Stotelių eilės numeriai, kurias aplanko ši dalis (be pradžios taško). */
  fromSeq: number;
  toSeq: number;
  /** Ar dalis baigiasi sandėlyje. */
  returnsToDepot: boolean;
  url: string;
  /** Žmogui suprantamas pavadinimas, pvz. „Stotelės 1–10". */
  label: string;
}

type Pt = { lat: number; lng: number };
const fmt = (p: Pt) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

export function googleMapsDirUrl(origin: Pt, destination: Pt, waypoints: Pt[]): string {
  const q = new URLSearchParams({ api: "1", origin: fmt(origin), destination: fmt(destination), travelmode: "driving" });
  if (waypoints.length) q.set("waypoints", waypoints.map(fmt).join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

/** Navigacijos nuorodos vieno kurjerio maršrutui (tuščias masyvas, jei stotelių nėra). */
export function courierNavLinks(plan: Plan, courierId: string): NavLink[] {
  const route = plan.routes.find((r) => r.courierId === courierId);
  if (!route || route.stops.length === 0) return [];
  const pkgs = new Map(plan.dataset.packages.map((p) => [p.id, p]));
  const depot = plan.dataset.depot.location;
  const stops = route.stops.map((s) => ({ seq: s.seq, loc: pkgs.get(s.packageId)?.location })).filter(
    (s): s is { seq: number; loc: Pt } => !!s.loc,
  );
  // Taškų seka: sandėlis → stotelės → sandėlis. Dalis = origin + ≤9 waypoints + destination.
  const seq: { seq: number | null; loc: Pt }[] = [{ seq: null, loc: depot }, ...stops, { seq: null, loc: depot }];
  const step = MAX_WAYPOINTS_PER_LINK + 1;
  const links: Omit<NavLink, "parts">[] = [];
  for (let i = 0; i < seq.length - 1; i += step) {
    const end = Math.min(i + step, seq.length - 1);
    const origin = seq[i]!;
    const dest = seq[end]!;
    const visited = seq.slice(i + 1, end + 1).filter((p) => p.seq !== null);
    const returnsToDepot = end === seq.length - 1;
    const fromSeq = visited[0]?.seq ?? stops[stops.length - 1]!.seq;
    const toSeq = visited[visited.length - 1]?.seq ?? fromSeq;
    links.push({
      part: links.length + 1,
      fromSeq,
      toSeq,
      returnsToDepot,
      url: googleMapsDirUrl(origin.loc, dest.loc, seq.slice(i + 1, end).map((p) => p.loc)),
      label: `Stotelės ${fromSeq}–${toSeq}${returnsToDepot ? " ir grįžimas" : ""}`,
    });
  }
  // Dalis vien grįžimui į sandėlį nereikalinga – kurjeris kelią į sandėlį žino.
  if (links.length > 1 && links[links.length - 1]!.fromSeq === links[links.length - 2]!.toSeq) links.pop();
  return links.map((l) => ({ ...l, parts: links.length }));
}
