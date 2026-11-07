// (Dataset, OptimizeToursResponse) → Plan. Gryna funkcija, be I/O.
import { PlanSchema, type Dataset, type Plan, type Route, type Skipped, type Stop } from "@marsrutai/shared";
import { localToUtcMs, parseDurationSec, toLocalIso } from "./time.js";
import { decodePolyline } from "./polyline.js";

// ---- Minimalūs REST atsakymo tipai (proto3 JSON: nulinės reikšmės praleidžiamos, int64 – eilutės) ----
export interface VisitJson {
  shipmentIndex?: number;
  shipmentLabel?: string;
  isPickup?: boolean;
  startTime: string;
  detour?: string;
}
export interface TransitionJson {
  travelDuration?: string;
  travelDistanceMeters?: number;
  waitDuration?: string;
  totalDuration?: string;
  startTime?: string;
}
export interface ShipmentRouteJson {
  vehicleIndex?: number;
  vehicleLabel?: string;
  vehicleStartTime?: string;
  vehicleEndTime?: string;
  visits?: VisitJson[];
  transitions?: TransitionJson[];
  routePolyline?: { points?: string };
  metrics?: {
    performedShipmentCount?: number;
    travelDuration?: string;
    waitDuration?: string;
    totalDuration?: string;
    travelDistanceMeters?: number;
  };
  routeTotalCost?: number;
}
export interface SkippedShipmentJson {
  index?: number;
  label?: string;
  reasons?: { code?: string; exampleVehicleIndex?: number; exampleExceededCapacityType?: string }[];
}
export interface OptimizeToursResponse {
  routes?: ShipmentRouteJson[];
  skippedShipments?: SkippedShipmentJson[];
  metrics?: { totalCost?: number; usedVehicleCount?: number; costs?: Record<string, number> };
}

/** API priežasčių kodai → lietuviškas paaiškinimas. */
export const SKIP_REASONS_LT: Record<string, string> = {
  DEMAND_EXCEEDS_VEHICLE_CAPACITY: "Paketas per sunkus – viršija kurjerio talpą",
  CANNOT_BE_PERFORMED_WITHIN_VEHICLE_TIME_WINDOWS: "Neįmanoma pristatyti per kurjerių darbo laiką ir lango ribas",
  CANNOT_BE_PERFORMED_WITHIN_VEHICLE_DURATION_LIMIT: "Viršijama kurjerio darbo trukmė",
  CANNOT_BE_PERFORMED_WITHIN_VEHICLE_TRAVEL_DURATION_LIMIT: "Viršijama kurjerio kelionės trukmė",
  CANNOT_BE_PERFORMED_WITHIN_VEHICLE_DISTANCE_LIMIT: "Viršijamas kurjerio atstumo limitas",
  NO_VEHICLE: "Nėra kurjerių",
  VEHICLE_NOT_ALLOWED: "Nė vienas kurjeris negali vežti šio paketo",
  CODE_UNSPECIFIED: "Nenurodyta priežastis",
};

function skipReason(s: SkippedShipmentJson, priority: number, dataset: Dataset): string {
  const reasons = s.reasons ?? [];
  if (reasons.length === 0) {
    // API nepateikia priežasties, kai paketas praleidžiamas dėl kaštų (bauda pigesnė už pristatymą).
    return `Neužtenka kurjerių talpos ar darbo laiko – optimizatorius praleido (prioritetas ${priority})`;
  }
  const texts = reasons.map((r) => {
    const base = SKIP_REASONS_LT[r.code ?? "CODE_UNSPECIFIED"] ?? `Priežastis: ${r.code}`;
    const courier = r.exampleVehicleIndex !== undefined ? dataset.couriers[r.exampleVehicleIndex]?.id : undefined;
    return courier ? `${base} (pvz. ${courier})` : base;
  });
  return [...new Set(texts)].join("; ");
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
const ms = (iso: string) => Date.parse(iso);

export function buildPlan(dataset: Dataset, response: OptimizeToursResponse, generatedAt = new Date()): Plan {
  const { depot } = dataset;
  const tz = depot.timezone ?? "Europe/Vilnius";
  const pkgById = new Map(dataset.packages.map((p) => [p.id, p]));
  const pkgOf = (index: number | undefined, label: string | undefined) => {
    const byLabel = label !== undefined ? pkgById.get(label) : undefined;
    const p = byLabel ?? dataset.packages[index ?? 0];
    if (!p) throw new Error(`API atsakyme nežinomas paketas: index=${index} label=${label}`);
    return p;
  };

  const apiRoutes = response.routes ?? [];
  const routeFor = (courierIdx: number, courierId: string) =>
    apiRoutes.find((r) => r.vehicleLabel === courierId) ?? apiRoutes.find((r) => (r.vehicleIndex ?? 0) === courierIdx && !r.vehicleLabel);

  const delivered = new Set<string>();
  let rawMinutes = 0; // neapvalintos, kad suma nekauptų apvalinimo paklaidų
  const dayOpenMs = localToUtcMs(depot.date, depot.open, tz);

  const routes: Route[] = dataset.couriers.map((c, ci) => {
    const r = routeFor(ci, c.id);
    const visits = r?.visits ?? [];
    if (!r || visits.length === 0) {
      const t = toLocalIso(localToUtcMs(depot.date, c.shiftStart, tz), tz);
      return { courierId: c.id, start: t, end: t, stops: [], totalKm: 0, totalMinutes: 0, totalWeightKg: 0 };
    }
    const transitions = r.transitions ?? [];
    let weight = 0;
    const stops: Stop[] = visits.map((v, i) => {
      const p = pkgOf(v.shipmentIndex, v.shipmentLabel);
      delivered.add(p.id);
      weight += p.weightKg;
      const startMs = ms(v.startTime);
      const endMs = startMs + (p.serviceMinutes ?? 5) * 60_000;
      const windowEndMs = localToUtcMs(depot.date, p.window.end, tz);
      const tr = transitions[i];
      return {
        seq: i + 1,
        packageId: p.id,
        arrival: toLocalIso(startMs, tz),
        departure: toLocalIso(endMs, tz),
        lateMinutes: round(Math.max(0, (startMs - windowEndMs) / 60_000), 1),
        waitMinutes: round(parseDurationSec(tr?.waitDuration) / 60, 1),
        distanceFromPrevKm: round((tr?.travelDistanceMeters ?? 0) / 1000, 2),
      };
    });
    const startMs = r.vehicleStartTime ? ms(r.vehicleStartTime) : dayOpenMs;
    const endMs = r.vehicleEndTime ? ms(r.vehicleEndTime) : startMs;
    const meters =
      r.metrics?.travelDistanceMeters ?? transitions.reduce((s, t) => s + (t.travelDistanceMeters ?? 0), 0);
    rawMinutes += (endMs - startMs) / 60_000;
    const route: Route = {
      courierId: c.id,
      start: toLocalIso(startMs, tz),
      end: toLocalIso(endMs, tz),
      stops,
      totalKm: round(meters / 1000, 2),
      totalMinutes: round((endMs - startMs) / 60_000, 1),
      totalWeightKg: round(weight, 2),
    };
    if (r.routePolyline?.points) route.path = decodePolyline(r.routePolyline.points);
    return route;
  });

  const skipped: Skipped[] = (response.skippedShipments ?? []).map((s) => {
    const p = pkgOf(s.index, s.label);
    return { packageId: p.id, reason: skipReason(s, p.priority, dataset) };
  });
  // Saugiklis: paketas, kurio nėra nei maršrutuose, nei skipped sąraše.
  const skippedIds = new Set(skipped.map((s) => s.packageId));
  for (const p of dataset.packages) {
    if (!delivered.has(p.id) && !skippedIds.has(p.id)) {
      skipped.push({ packageId: p.id, reason: "Paketo nėra API atsakyme" });
    }
  }

  const totalKm = round(routes.reduce((s, r) => s + r.totalKm, 0), 2);
  const allStops = routes.flatMap((r) => r.stops);
  const plan: Plan = {
    generatedAt: generatedAt.toISOString(),
    mode: "api",
    dataset,
    routes,
    skipped,
    metrics: {
      totalKm,
      totalHours: round(rawMinutes / 60, 2),
      deliveredCount: allStops.length,
      skippedCount: skipped.length,
      lateCount: allStops.filter((s) => s.lateMinutes > 0).length,
      ...(response.metrics?.totalCost !== undefined ? { totalCost: round(response.metrics.totalCost, 2) } : {}),
    },
  };
  return PlanSchema.parse(plan);
}
