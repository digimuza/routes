import type { Dataset, LatLng, Package, Plan, Route, Skipped, Stop } from "@marsrutai/shared";

/** Mock optimizatorius (SPEC 4.5): godus paskirstymas + nearest-neighbour, Haversine × 1.3, 25 km/h. */

const SPEED_KMH = 25;
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const roadKm = (a: LatLng, b: LatLng) => haversineKm(a, b) * 1.3;
const travelMin = (km: number) => (km / SPEED_KMH) * 60;

function iso(date: string, minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${date}T${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+02:00`;
}

const angle = (depot: LatLng, p: LatLng) => Math.atan2(p.lat - depot.lat, (p.lng - depot.lng) * Math.cos((depot.lat * Math.PI) / 180));

export function mockOptimize(ds: Dataset): Plan {
  const depot = ds.depot.location;
  const couriers = ds.couriers;
  const skipped: Skipped[] = [];
  const assigned = new Map<string, Package[]>(couriers.map((c) => [c.id, []]));
  const load = new Map<string, number>(couriers.map((c) => [c.id, 0]));

  // 1) jei bendra talpa per maža – atsisakoma žemiausio prioriteto paketų
  const capacity = couriers.reduce((x, c) => x + c.capacityKg, 0);
  let keep = [...ds.packages].sort(
    (a, b) => a.priority - b.priority || toMin(a.window.start) - toMin(b.window.start),
  );
  let demand = keep.reduce((x, p) => x + p.weightKg, 0);
  while (keep.length && demand > capacity) {
    const p = keep.pop()!;
    demand -= p.weightKg;
    skipped.push({ packageId: p.id, reason: couriers.length ? "Viršyta kurjerių talpa" : "Nėra kurjerių" });
  }
  // 2) paketai rikiuojami pagal kampą nuo sandėlio ir dalijami ištisiniais sektoriais
  keep = keep.sort((a, b) => angle(depot, a.location) - angle(depot, b.location));
  let ci = 0;
  let quota = couriers.length ? (demand * couriers[0].capacityKg) / capacity : 0;
  for (const p of keep) {
    while (
      ci < couriers.length - 1 &&
      ((load.get(couriers[ci].id) ?? 0) >= quota || (load.get(couriers[ci].id) ?? 0) + p.weightKg > couriers[ci].capacityKg)
    ) {
      ci++;
      quota = (demand * couriers[ci].capacityKg) / capacity;
    }
    const c = couriers[ci];
    if ((load.get(c.id) ?? 0) + p.weightKg > c.capacityKg) {
      skipped.push({ packageId: p.id, reason: "Viršyta kurjerių talpa" });
      continue;
    }
    load.set(c.id, (load.get(c.id) ?? 0) + p.weightKg);
    assigned.get(c.id)!.push(p);
  }

  const routes: Route[] = [];
  let lateCount = 0;
  for (const c of couriers) {
    const todo = [...assigned.get(c.id)!];
    const stops: Stop[] = [];
    const shiftStart = toMin(c.shiftStart);
    const shiftEnd = toMin(c.shiftEnd);
    let t = shiftStart;
    let pos = depot;
    let km = 0;
    let weight = 0;
    while (todo.length) {
      // artimiausias pagal laiką, kai galima pradėti aptarnavimą; vėlavimas baudžiamas pagal prioritetą
      let best = -1;
      let bestScore = Infinity;
      for (let i = 0; i < todo.length; i++) {
        const p = todo[i];
        const arr = t + travelMin(roadKm(pos, p.location));
        const start = Math.max(arr, toMin(p.window.start));
        const late = Math.max(0, start - toMin(p.window.end));
        const score = start + late * (4 - p.priority) * 3;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      const p = todo.splice(best, 1)[0];
      const d = roadKm(pos, p.location);
      const arrival = t + travelMin(d);
      const wait = Math.max(0, toMin(p.window.start) - arrival);
      const serviceStart = arrival + wait;
      const late = Math.max(0, serviceStart - toMin(p.window.end));
      const departure = serviceStart + p.serviceMinutes;
      const back = departure + travelMin(roadKm(p.location, depot));
      if (back > shiftEnd) {
        skipped.push({ packageId: p.id, reason: "Netelpa į kurjerio pamainą" });
        continue;
      }
      if (late >= 1) lateCount++;
      stops.push({
        seq: stops.length + 1,
        packageId: p.id,
        arrival: iso(ds.depot.date, arrival),
        departure: iso(ds.depot.date, departure),
        lateMinutes: Math.round(late),
        waitMinutes: Math.round(wait),
        distanceFromPrevKm: Math.round(d * 10) / 10,
      });
      km += d;
      weight += p.weightKg;
      t = departure;
      pos = p.location;
    }
    const backKm = stops.length ? roadKm(pos, depot) : 0;
    const end = stops.length ? t + travelMin(backKm) : shiftStart;
    km += backKm;
    routes.push({
      courierId: c.id,
      start: iso(ds.depot.date, shiftStart),
      end: iso(ds.depot.date, end),
      stops,
      totalKm: Math.round(km * 10) / 10,
      totalMinutes: Math.round(end - shiftStart),
      totalWeightKg: weight,
    });
  }

  const totalKm = routes.reduce((s, r) => s + r.totalKm, 0);
  const totalMin = routes.reduce((s, r) => s + r.totalMinutes, 0);
  return {
    generatedAt: new Date().toISOString(),
    mode: "mock",
    dataset: ds,
    routes,
    skipped,
    metrics: {
      totalKm: Math.round(totalKm * 10) / 10,
      totalHours: Math.round((totalMin / 60) * 10) / 10,
      deliveredCount: routes.reduce((s, r) => s + r.stops.length, 0),
      skippedCount: skipped.length,
      lateCount,
      totalCost: Math.round(
        couriers.reduce((s, c) => {
          const r = routes.find((x) => x.courierId === c.id)!;
          return s + (r.totalMinutes / 60) * c.costPerHour + r.totalKm * c.costPerKm;
        }, 0),
      ),
    },
  };
}
