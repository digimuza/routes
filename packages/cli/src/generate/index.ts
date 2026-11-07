// Sintetinių duomenų generavimas: demo rinkiniai (scripts/gen-data.ts), atsitiktiniai paketai
// serveriui (POST /api/generate), numatytieji kurjeriai ir tuščias scenarijus (SPEC 5b).
import { randomInt } from "node:crypto";
import { COURIER_PALETTE, type CityId, type Courier, type Dataset, type Depot, type GenerateRequest, type Package, type Priority } from "@marsrutai/shared";
import { CITY_DEFS, type CityDef } from "./cities.js";
import {
  COURIER_PEOPLE,
  FEMALE_FIRST,
  LATE_START,
  MALE_FIRST,
  NOTES_AUTOSERVICE,
  NOTES_PERSON,
  SURNAMES,
} from "./people.js";
import { Rng, subSeed } from "./rng.js";

export { Rng, mulberry32, subSeed } from "./rng.js";
export { CITIES, CITY_DEFS, cityById, inCityBounds } from "./cities.js";
export type { Addr } from "./types.js";

// ---------------------------------------------------------------- Helpers

const round = (x: number, d: number) => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const phone = (rng: Rng) => `+3706${String(rng.int(0, 9_999_999)).padStart(7, "0")}`;

/** Jitter a point uniformly within a disc of `maxMeters`. */
export function jitter(rng: Rng, lat: number, lng: number, maxMeters: number) {
  const r = maxMeters * Math.sqrt(rng.float());
  const theta = rng.float() * 2 * Math.PI;
  const dLat = (r * Math.cos(theta)) / 111_320;
  const dLng = (r * Math.sin(theta)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: round(lat + dLat, 6), lng: round(lng + dLng, 6) };
}

/** Didžiausia paketo taško paklaida nuo kuruoto adreso, metrais. */
export const JITTER_METERS = 40;

function personName(rng: Rng): string {
  const sn = rng.pick(SURNAMES);
  if (rng.chance(0.5)) return `${rng.pick(MALE_FIRST)} ${sn[0]}`;
  return `${rng.pick(FEMALE_FIRST)} ${rng.chance(0.6) ? sn[1] : sn[2]}`;
}

/** Autoservisai dirba 08:00–17:00; skubūs (p1) – rytą, kol automobilis ant keltuvo. */
function makeAutoserviceWindow(rng: Rng, priority: Priority): { start: string; end: string } {
  const H = 60;
  if (priority === 1) {
    const [s, e] = rng.weighted<readonly [number, number]>([
      [[8 * H, 10 * H], 4],
      [[8 * H + 30, 10 * H + 30], 3],
      [[9 * H, 11 * H], 3],
    ]);
    return { start: hhmm(s), end: hhmm(e) };
  }
  if (priority === 2) {
    const [s, e] = rng.weighted<readonly [number, number]>([
      [[8 * H, 12 * H], 3],
      [[10 * H, 13 * H], 2],
      [[12 * H, 16 * H], 2],
    ]);
    return { start: hhmm(s), end: hhmm(e) };
  }
  return { start: hhmm(8 * H), end: hhmm(17 * H) };
}

function makeWindow(rng: Rng, priority: Priority): { start: string; end: string } {
  const H = 60;
  if (priority === 1) {
    const [s, e] = rng.weighted<readonly [number, number]>([
      [[9 * H, 11 * H], 4],
      [[10 * H, 12 * H], 4],
      [[8 * H + 30, 10 * H + 30], 2],
      [[9 * H + 30, 11 * H + 30], 2],
      [[13 * H, 15 * H], 1],
    ]);
    return { start: hhmm(s), end: hhmm(e) };
  }
  if (priority === 2) {
    const len = rng.pick([2, 3, 3, 4]) * H;
    const latestStart = 18 * H - len;
    const slots = (latestStart - 8 * H) / 30;
    const s = 8 * H + rng.int(0, slots) * 30;
    return { start: hhmm(s), end: hhmm(s + len) };
  }
  const [s, e] = rng.weighted<readonly [number, number]>([
    [[12 * H, 18 * H], 4],
    [[8 * H, 18 * H], 3],
    [[10 * H, 18 * H], 2],
    [[14 * H, 18 * H], 1],
  ]);
  return { start: hhmm(s), end: hhmm(e) };
}

// ---------------------------------------------------------------- IDs

const PKG_ID = /^PKG-(\d+)$/;

/** `count` naujų `PKG-###` ID, nesikertančių su `existing` (užpildomos ir tarpinės skylės). */
export function nextPackageIds(count: number, existing: Iterable<string> = []): string[] {
  const used = new Set<string>(existing);
  const ids: string[] = [];
  for (let n = 1; ids.length < count; n++) {
    const id = `PKG-${String(n).padStart(3, "0")}`;
    if (!used.has(id)) ids.push(id);
  }
  return ids;
}

// ---------------------------------------------------------------- Packages

export interface PriorityMix {
  p1: number;
  p2: number;
  p3: number;
}

export const DEFAULT_MIX: PriorityMix = { p1: 20, p2: 45, p3: 35 };

interface PackageOptions {
  def: CityDef;
  count: number;
  /** Weight = 0.5 + 29.5 * u^skew; higher skew → lighter packages. */
  weightSkew: number;
  mix: PriorityMix;
  /** Autoservisų dalis 0–100 %, likusieji – fiziniai asmenys. */
  autoservicePct: number;
  ids: string[];
}

/**
 * Adresai imami iš sumaišyto kuruoto sąrašo be pasikartojimų; jei paketų daugiau nei adresų,
 * sąrašas sumaišomas iš naujo (tas pats pastatas, kitas taškas per jitter).
 */
function pickAddresses(rng: Rng, def: CityDef, count: number) {
  const out = [];
  while (out.length < count) out.push(...rng.shuffle(def.addresses));
  return out.slice(0, count);
}

function makePackages(rng: Rng, o: PackageOptions): Package[] {
  const { def, mix } = o;
  if (!(mix.p1 + mix.p2 + mix.p3 > 0)) throw new Error("Prioritetų pasiskirstymo suma turi būti didesnė už 0");
  const city = def.city.name;
  const autoShare = Math.min(100, Math.max(0, o.autoservicePct)) / 100;
  return pickAddresses(rng, def, o.count).map(([street, lat, lng], i) => {
    const priority = rng.weighted<Priority>([[1, mix.p1], [2, mix.p2], [3, mix.p3]]);
    const isAuto = rng.chance(autoShare);
    const recipient = isAuto ? rng.pick(def.autoservices) : personName(rng);
    const address = !isAuto && rng.chance(0.45) ? `${street}-${rng.int(1, 80)}, ${city}` : `${street}, ${city}`;
    // Autodalys sunkesnės (2–30 kg: diskai, padangos, akumuliatoriai); asmenims – daugiausia smulkūs siuntiniai.
    const weightKg = isAuto
      ? round(2 + 28 * rng.float() ** 1.4, 1)
      : Math.max(0.5, round(0.5 + 14.5 * rng.float() ** o.weightSkew, 1));
    const serviceMinutes = isAuto
      ? rng.weighted<number>([[5, 3], [6, 3], [8, 2], [10, 2]])
      : rng.weighted<number>([[3, 4], [4, 4], [5, 3], [6, 1]]);
    const pkg: Package = {
      id: o.ids[i]!,
      recipient,
      recipientType: isAuto ? "autoservice" : "person",
      ...(rng.chance(isAuto ? 0.95 : 0.85) ? { phone: phone(rng) } : {}),
      address,
      location: jitter(rng, lat, lng, JITTER_METERS),
      priority,
      window: isAuto ? makeAutoserviceWindow(rng, priority) : makeWindow(rng, priority),
      weightKg,
      serviceMinutes,
    };
    if (rng.chance(isAuto ? 0.35 : 0.15)) pkg.note = rng.pick(isAuto ? NOTES_AUTOSERVICE : NOTES_PERSON);
    return pkg;
  });
}

/** Numatyta autoservisų dalis, %. */
export const DEFAULT_AUTOSERVICE_PCT = 35;

/** POST /api/generate: atsitiktiniai miesto paketai. Be `seed` – atsitiktinis seed. */
export function generatePackages(req: GenerateRequest): Package[] {
  const def = CITY_DEFS[req.city];
  const seed = req.seed ?? randomInt(0, 2 ** 31);
  return makePackages(new Rng(seed), {
    def,
    count: req.count,
    weightSkew: 3,
    mix: req.mix,
    autoservicePct: req.autoservicePct ?? DEFAULT_AUTOSERVICE_PCT,
    ids: nextPackageIds(req.count, req.existingIds),
  });
}

// ---------------------------------------------------------------- Couriers

function makeCouriers(rng: Rng, count: number): Courier[] {
  const out: Courier[] = [];
  for (let i = 0; i < count; i++) {
    const preset = COURIER_PEOPLE[i];
    // Papildomi kurjeriai (> 10): sugeneruotas vardas, furgonas 150 kg.
    const [name, vehicle, capacityKg] = preset ?? [personName(rng), "Furgonas VW Caddy", 150];
    out.push({
      id: `C${String(i + 1).padStart(2, "0")}`,
      name,
      phone: phone(rng),
      vehicle,
      capacityKg,
      shiftStart: LATE_START.has(i) ? "09:00" : "08:00",
      shiftEnd: "18:00",
      costPerHour: round(11.5 + rng.float(), 1),
      costPerKm: round(0.25 + rng.float() * 0.1, 2),
      color: courierColor(i),
    });
  }
  return out;
}

/** Kurjerio spalva pagal indeksą: 10 pagrindinių, paskui papildoma paletė ratu. */
/** Kurjerio spalva iš bendros paletės (be prioritetų ir veiksmo spalvų). */
export function courierColor(index: number): string {
  return COURIER_PALETTE[index % COURIER_PALETTE.length]!;
}

/** Numatytieji miesto kurjeriai (deterministiniai). */
export function defaultCouriers(city: CityId, count = 10): Courier[] {
  // Vilniaus kurjeriai sutampa su data/normal.json (seed 42).
  return makeCouriers(new Rng(subSeed(42, city === "vilnius" ? "couriers" : `couriers-${city}`)), count);
}

// ---------------------------------------------------------------- Scenario

export function cityDepot(city: CityId, date: string): Depot {
  const d = CITY_DEFS[city];
  return {
    id: d.depotId,
    name: d.city.depot.name,
    address: d.city.depot.address,
    location: { ...d.city.depot.location },
    date,
    timezone: "Europe/Vilnius",
    open: "08:00",
    close: "18:00",
  };
}

/** Kita darbo diena po šiandienos (Europe/Vilnius), "YYYY-MM-DD". */
export function nextWeekday(now: Date = new Date(), timeZone = "Europe/Vilnius"): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  do t.setUTCDate(t.getUTCDate() + 1);
  while (t.getUTCDay() === 0 || t.getUTCDay() === 6);
  return t.toISOString().slice(0, 10);
}

/** Naujas miesto scenarijus: sandėlis, kita darbo diena, 10 kurjerių, 0 paketų. */
export function emptyScenario(city: CityId, now: Date = new Date()): Dataset {
  return { depot: cityDepot(city, nextWeekday(now)), couriers: defaultCouriers(city), packages: [] };
}

// ---------------------------------------------------------------- Demo datasets (gen-data)

export interface DemoProfile {
  count: number;
  /** Weight = 0.5 + 29.5 * u^skew; higher skew → lighter packages. */
  weightSkew: number;
}

export const DEMO_DATE = "2026-11-10";

export const DEMO_PROFILES: readonly (readonly [label: string, profile: DemoProfile])[] = [
  ["normal", { count: 70, weightSkew: 3 }],
  ["overload", { count: 140, weightSkew: 0.8 }],
];

/** data/<label>.json rinkinys (Vilnius). Tas pats seed → baitas į baitą tas pats rezultatas. */
export function makeDemoDataset(seed: number, label: string, profile: DemoProfile): Dataset {
  const def = CITY_DEFS.vilnius;
  if (profile.count > def.addresses.length) throw new Error("Per mažai adresų unikaliems paketams");
  const couriers = makeCouriers(new Rng(subSeed(seed, "couriers")), 10);
  const packages = makePackages(new Rng(subSeed(seed, label)), {
    def,
    count: profile.count,
    weightSkew: profile.weightSkew,
    mix: DEFAULT_MIX,
    autoservicePct: DEFAULT_AUTOSERVICE_PCT,
    ids: nextPackageIds(profile.count),
  });
  return { depot: cityDepot("vilnius", DEMO_DATE), couriers, packages };
}
