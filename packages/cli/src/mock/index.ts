// Mock optimizatorius (SPEC 4.5): veikia be GCP, deterministinis, paprastas.
//
// Algoritmas:
//  1. Paketai rikiuojami: prioritetas, lango pradžia, id.
//  2. Kiekvienas paketas įterpiamas ten, kur pigiausia (cheapest insertion per visus
//     kurjerius ir visas pozicijas), jei tenkinama: talpa, grįžimas iki darbo pabaigos,
//     joks 1 prioriteto paketas nevėluoja. 2/3 prioritetas gali vėluoti su bauda.
//  3. Jei niekur netelpa – paketas į `skipped` su priežastimi lietuviškai.
// Atstumas – Haversine × 1.3, greitis 25 km/h, važiavimo laikas apvalinamas į viršų iki minutės.

import {
  DatasetSchema,
  PlanSchema,
  type Courier,
  type Dataset,
  type LatLng,
  type Optimizer,
  type Package,
  type Plan,
  type Priority,
  type Route,
  type Skipped,
  type Stop,
  stopMinutesOf,
} from "@marsrutai/shared";
import { roadKm, travelMinutes } from "./geo.js";
import { roadGeometryEnabled, withRoadGeometry } from "./roads.js";
import { epochMinToZonedIso, toZonedIso, zonedTimeToEpochMin } from "./time.js";

/** Vėlavimo bauda €/min pagal prioritetą (1 – vėluoti draudžiama). */
const LATE_PENALTY_PER_MIN: Record<Priority, number> = { 1: Infinity, 2: 3, 3: 1 };
/**
 * Krūvio balansavimas: + BALANCE × (maršruto valandos)². Be jo pigiausia būtų
 * sugrūsti viską į kelis kurjerius; demo norime matyti tolygiai paskirstytą darbą.
 * Įtakoja tik pasirinkimą, į metrics.totalCost neįeina.
 */
const BALANCE_PER_HOUR_SQ = 4;

export const SKIP_REASONS = {
  tooHeavy: "Per sunkus: viršija bet kurio kurjerio talpą",
  capacity: "Viršyta kurjerių talpa",
  window: "Neįmanoma pristatyti per laiko langą",
  shift: "Netelpa į darbo laiką",
} as const;

/** Paketas su langu, paverstu į epoch minutes. */
interface Job {
  pkg: Package;
  winStart: number;
  winEnd: number;
  /** Ėjimas iki kliento ir atgal + perdavimas, minutėmis. */
  stopMinutes: number;
}

interface Vehicle {
  courier: Courier;
  /** Anksčiausias išvykimas (pamainos ir sandėlio darbo laiko sankirta), epoch min. */
  earliestStart: number;
  /** Vėliausias grįžimas, epoch min. */
  latestEnd: number;
  jobs: Job[];
  loadKg: number;
}

interface SimStop {
  job: Job;
  legKm: number;
  arrival: number;
  departure: number;
  wait: number;
  late: number;
}

interface Schedule {
  start: number;
  end: number;
  km: number;
  stops: SimStop[];
  feasible: boolean;
  /** Kurjerio kaina + vėlavimo baudos; naudojama tik įterpimo palyginimui. */
  cost: number;
}

/** Suskaičiuoja kurjerio dienos grafiką duotai stotelių sekai. */
function simulate(v: Vehicle, jobs: Job[], depot: LatLng): Schedule {
  if (jobs.length === 0) {
    return { start: v.earliestStart, end: v.earliestStart, km: 0, stops: [], feasible: true, cost: 0 };
  }

  // Išvykstama pamainos pradžioje arba vėliau, jei taip išvengiama laukimo prie pirmos stotelės.
  const firstLegKm = roadKm(depot, jobs[0]!.pkg.location);
  const start = Math.max(v.earliestStart, jobs[0]!.winStart - travelMinutes(firstLegKm));

  let t = start;
  let km = 0;
  let prev = depot;
  let feasible = true;
  let latePenalty = 0;
  const stops: SimStop[] = [];

  for (const job of jobs) {
    const legKm = roadKm(prev, job.pkg.location);
    const arrival = t + travelMinutes(legKm);
    const serviceStart = Math.max(arrival, job.winStart);
    const late = Math.max(0, serviceStart - job.winEnd);
    const departure = serviceStart + job.stopMinutes;
    if (late > 0) {
      if (job.pkg.priority === 1) feasible = false;
      else latePenalty += late * LATE_PENALTY_PER_MIN[job.pkg.priority];
    }
    stops.push({ job, legKm, arrival, departure, wait: serviceStart - arrival, late });
    km += legKm;
    t = departure;
    prev = job.pkg.location;
  }

  const returnKm = roadKm(prev, depot);
  km += returnKm;
  const end = t + travelMinutes(returnKm);
  if (end > v.latestEnd) feasible = false;

  const c = v.courier;
  const hours = (end - start) / 60;
  const cost = c.costPerHour * hours + c.costPerKm * km + latePenalty + BALANCE_PER_HOUR_SQ * hours ** 2;
  return { start, end, km, stops, feasible, cost };
}

function prepareJob(pkg: Package, date: string, tz: string, stopMinutes: number): Job {
  return {
    pkg,
    stopMinutes,
    winStart: zonedTimeToEpochMin(date, pkg.window.start, tz),
    winEnd: zonedTimeToEpochMin(date, pkg.window.end, tz),
  };
}

function byPriorityThenWindow(a: Job, b: Job): number {
  return (
    a.pkg.priority - b.pkg.priority ||
    a.winStart - b.winStart ||
    a.winEnd - b.winEnd ||
    (a.pkg.id < b.pkg.id ? -1 : a.pkg.id > b.pkg.id ? 1 : 0)
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pagrindinė funkcija: Dataset -> Plan. Gryna, išskyrus `now`. */
export function planMock(input: Dataset, now: Date = new Date()): Plan {
  const dataset = DatasetSchema.parse(input);
  const { depot } = dataset;
  const tz = depot.timezone;
  const at = (hhmm: string) => zonedTimeToEpochMin(depot.date, hhmm, tz);
  const depotOpen = at(depot.open);
  const depotClose = at(depot.close);

  const vehicles: Vehicle[] = dataset.couriers.map((courier) => ({
    courier,
    earliestStart: Math.max(at(courier.shiftStart), depotOpen),
    latestEnd: Math.min(at(courier.shiftEnd), depotClose),
    jobs: [],
    loadKg: 0,
  }));
  const schedules = new Map<Vehicle, Schedule>(vehicles.map((v) => [v, simulate(v, [], depot.location)]));
  const maxCapacity = Math.max(0, ...dataset.couriers.map((c) => c.capacityKg));

  const jobs = dataset.packages.map((p) => prepareJob(p, depot.date, tz, stopMinutesOf(dataset, p))).sort(byPriorityThenWindow);
  const skipped: Skipped[] = [];

  for (const job of jobs) {
    let best: { v: Vehicle; jobs: Job[]; sched: Schedule; delta: number } | null = null;
    let anyCapacity = false;

    for (const v of vehicles) {
      if (v.loadKg + job.pkg.weightKg > v.courier.capacityKg) continue;
      anyCapacity = true;
      const current = schedules.get(v)!;
      for (let pos = 0; pos <= v.jobs.length; pos++) {
        const candidate = [...v.jobs.slice(0, pos), job, ...v.jobs.slice(pos)];
        const sched = simulate(v, candidate, depot.location);
        if (!sched.feasible) continue;
        const delta = sched.cost - current.cost;
        if (!best || delta < best.delta) best = { v, jobs: candidate, sched, delta };
      }
    }

    if (best) {
      best.v.jobs = best.jobs;
      best.v.loadKg += job.pkg.weightKg;
      schedules.set(best.v, best.sched);
      continue;
    }

    let reason: string;
    if (job.pkg.weightKg > maxCapacity) reason = SKIP_REASONS.tooHeavy;
    else if (!anyCapacity) reason = SKIP_REASONS.capacity;
    else {
      // Ar paketas apskritai pasiekiamas laiku tuščiu maršrutu? Jei ne – kaltas langas, ne užimtumas.
      const reachable = vehicles.some(
        (v) =>
          v.courier.capacityKg >= job.pkg.weightKg &&
          simulate({ ...v, jobs: [], loadKg: 0 }, [job], depot.location).feasible,
      );
      reason = reachable ? SKIP_REASONS.shift : SKIP_REASONS.window;
    }
    skipped.push({ packageId: job.pkg.id, reason });
  }

  const iso = (min: number) => epochMinToZonedIso(min, tz);
  const depotPoint: [number, number] = [depot.location.lat, depot.location.lng];

  const routes: Route[] = vehicles.map((v) => {
    const s = schedules.get(v)!;
    const stops: Stop[] = s.stops.map((st, i) => ({
      seq: i + 1,
      packageId: st.job.pkg.id,
      arrival: iso(st.arrival),
      departure: iso(st.departure),
      lateMinutes: st.late,
      waitMinutes: st.wait,
      distanceFromPrevKm: round2(st.legKm),
    }));
    return {
      courierId: v.courier.id,
      start: iso(s.start),
      end: iso(s.end),
      stops,
      totalKm: round2(s.km),
      totalMinutes: s.end - s.start,
      totalWeightKg: round2(v.loadKg),
      path: [
        depotPoint,
        ...s.stops.map((st): [number, number] => [st.job.pkg.location.lat, st.job.pkg.location.lng]),
        depotPoint,
      ],
    };
  });

  const deliveredCount = routes.reduce((n, r) => n + r.stops.length, 0);
  const lateCount = routes.reduce((n, r) => n + r.stops.filter((s) => s.lateMinutes > 0).length, 0);
  const totalKm = vehicles.reduce((n, v) => n + schedules.get(v)!.km, 0);
  const totalMinutes = routes.reduce((n, r) => n + r.totalMinutes, 0);
  const totalCost = vehicles.reduce((n, v) => {
    const s = schedules.get(v)!;
    return n + (v.courier.costPerHour * (s.end - s.start)) / 60 + v.courier.costPerKm * s.km;
  }, 0);

  return PlanSchema.parse({
    generatedAt: toZonedIso(Math.floor(now.getTime() / 1000) * 1000, tz),
    mode: "mock",
    dataset,
    routes,
    skipped,
    metrics: {
      totalKm: round2(totalKm),
      totalHours: round2(totalMinutes / 60),
      deliveredCount,
      skippedCount: skipped.length,
      lateCount,
      totalCost: round2(totalCost),
    },
  });
}

/**
 * `now` leidžia testams įšaldyti `generatedAt`. `roads` įjungia tikrą kelių geometriją per OSRM
 * (numatyta: tik `mockOptimizer`, išjungiama MARSRUTAI_ROAD_GEOMETRY=off).
 */
export function createMockOptimizer(opts: { now?: () => Date; roads?: boolean } = {}): Optimizer {
  const now = opts.now ?? (() => new Date());
  return {
    name: "mock",
    optimize: async (dataset: Dataset) => {
      const plan = planMock(dataset, now());
      if (opts.roads && roadGeometryEnabled()) await withRoadGeometry(plan);
      return plan;
    },
  };
}

export const mockOptimizer: Optimizer = createMockOptimizer({ roads: true });
export { roadPath, withRoadGeometry } from "./roads.js";
