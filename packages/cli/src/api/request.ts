// Dataset → OptimizeToursRequest (REST JSON). Gryna funkcija, be I/O.
// Modeliavimas pagal SPEC 3.3: prioritetas → penaltyCost, langas → timeWindows su minkšta pabaiga.
import type { Dataset, Priority } from "@marsrutai/shared";
import { durationStr, localToRfc3339 } from "./time.js";

/**
 * Derinami kaštų parametrai. Kurjerio kaštai ~12 €/h ir ~0.3 €/km, todėl vienas papildomas
 * pristatymas paprastai kainuoja kelis eurus. Baudos parinktos taip, kad:
 *  - 1 prioritetas praktiškai privalomas (bauda daug didesnė už bet kokį maršruto kaštą),
 *  - 2 prioritetas praleidžiamas tik jei kitaip neįmanoma pristatyti 1 prioriteto,
 *  - 3 prioritetas praleidžiamas pirmas, kai trūksta talpos / laiko.
 * Vėlavimo kaina per valandą mažesnė už baudą, todėl geriau pavėluoti nei nepristatyti,
 * bet 1 prioritetui vėluoti brangiausia.
 */
const hhmmToMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const COST_TUNING = {
  /** Bauda, jei paketas nepristatomas. */
  penaltyCost: { 1: 100_000, 2: 1_000, 3: 100 } satisfies Record<Priority, number>,
  /** Kaina už valandą po lango pabaigos (softEndTime). */
  lateCostPerHour: { 1: 500, 2: 100, 3: 20 } satisfies Record<Priority, number>,
  /** Krovinio dimensijos pavadinimas loadDemands / loadLimits. */
  loadType: "weight_kg",
  searchMode: "RETURN_FAST",
  considerRoadTraffic: false,
  populatePolylines: true,
  /**
   * Darbo krūvio balansavimas: kaina už kiekvieną maršruto trukmės valandą kvadratu
   * (routeDurationLimit.costPerSquareHourAfterQuadraticSoftMax nuo 0 h). Be jo API
   * sukrauna viską ant kelių kurjerių, nes taip pigiausia. 0 išjungia balansavimą.
   */
  balanceCostPerSquareHour: 8,
} as const;

// ---- Minimalūs REST tipai (tik naudojami laukai) ----
export interface LatLngJson {
  latitude: number;
  longitude: number;
}
export interface TimeWindowJson {
  startTime?: string;
  endTime?: string;
  softEndTime?: string;
  costPerHourAfterSoftEndTime?: number;
}
export interface ShipmentJson {
  label: string;
  deliveries: {
    arrivalLocation: LatLngJson;
    duration: string;
    timeWindows: TimeWindowJson[];
  }[];
  loadDemands: Record<string, { amount: string }>;
  penaltyCost: number;
}
export interface VehicleJson {
  label: string;
  travelMode: "DRIVING";
  startLocation: LatLngJson;
  endLocation: LatLngJson;
  startTimeWindows: TimeWindowJson[];
  endTimeWindows: TimeWindowJson[];
  loadLimits: Record<string, { maxLoad: string }>;
  costPerHour: number;
  costPerKilometer: number;
  routeDurationLimit?: {
    maxDuration: string;
    quadraticSoftMaxDuration: string;
    costPerSquareHourAfterQuadraticSoftMax: number;
  };
}
export interface OptimizeToursRequest {
  model: {
    globalStartTime: string;
    globalEndTime: string;
    shipments: ShipmentJson[];
    vehicles: VehicleJson[];
  };
  searchMode: string;
  considerRoadTraffic: boolean;
  populatePolylines: boolean;
  label?: string;
}

const ll = (p: { lat: number; lng: number }): LatLngJson => ({ latitude: p.lat, longitude: p.lng });

export function buildRequest(dataset: Dataset): OptimizeToursRequest {
  const { depot } = dataset;
  const tz = depot.timezone ?? "Europe/Vilnius";
  const t = (hhmm: string) => localToRfc3339(depot.date, hhmm, tz);
  const dayStart = t(depot.open);
  const dayEnd = t(depot.close);
  const load = COST_TUNING.loadType;

  const shipments: ShipmentJson[] = dataset.packages.map((p) => {
    // Lango pradžia negali būti ankstesnė už sandėlio atidarymą, pabaiga – vėlesnė už uždarymą.
    const start = p.window.start < depot.open ? depot.open : p.window.start;
    let softEnd = p.window.end > depot.close ? depot.close : p.window.end;
    if (softEnd < start) softEnd = start;
    return {
      label: p.id,
      deliveries: [
        {
          arrivalLocation: ll(p.location),
          duration: durationStr((p.serviceMinutes ?? 5) * 60),
          timeWindows: [
            {
              startTime: t(start),
              softEndTime: t(softEnd),
              costPerHourAfterSoftEndTime: COST_TUNING.lateCostPerHour[p.priority],
              endTime: dayEnd,
            },
          ],
        },
      ],
      loadDemands: { [load]: { amount: String(Math.ceil(p.weightKg)) } },
      penaltyCost: COST_TUNING.penaltyCost[p.priority],
    };
  });

  const vehicles: VehicleJson[] = dataset.couriers.map((c) => ({
    label: c.id,
    travelMode: "DRIVING",
    startLocation: ll(depot.location),
    endLocation: ll(depot.location),
    startTimeWindows: [{ startTime: t(c.shiftStart) }],
    endTimeWindows: [{ endTime: t(c.shiftEnd) }],
    loadLimits: { [load]: { maxLoad: String(Math.floor(c.capacityKg)) } },
    costPerHour: c.costPerHour,
    costPerKilometer: c.costPerKm,
    ...(COST_TUNING.balanceCostPerSquareHour > 0
      ? {
          routeDurationLimit: {
            maxDuration: durationStr(Math.max(0, hhmmToMin(c.shiftEnd) - hhmmToMin(c.shiftStart)) * 60),
            quadraticSoftMaxDuration: "0s",
            costPerSquareHourAfterQuadraticSoftMax: COST_TUNING.balanceCostPerSquareHour,
          },
        }
      : {}),
  }));

  return {
    model: { globalStartTime: dayStart, globalEndTime: dayEnd, shipments, vehicles },
    searchMode: COST_TUNING.searchMode,
    considerRoadTraffic: COST_TUNING.considerRoadTraffic,
    populatePolylines: COST_TUNING.populatePolylines,
  };
}
