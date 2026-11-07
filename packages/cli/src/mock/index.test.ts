import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  DatasetSchema,
  PlanSchema,
  type Courier,
  type Dataset,
  type Package,
  type Plan,
  type Priority,
} from "@marsrutai/shared";
import { SKIP_REASONS, createMockOptimizer, mockOptimizer, planMock } from "./index.js";

const FIXED_NOW = new Date("2026-11-07T10:00:00Z");

const sampleDataset: Dataset = DatasetSchema.parse(
  JSON.parse(readFileSync(new URL("../../../shared/fixtures/sample-plan.json", import.meta.url), "utf8")).dataset,
);

/** Deterministinis PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function syntheticDataset(opts: { seed: number; packages: number; capacities?: number[] }): Dataset {
  const r = rng(opts.seed);
  const capacities = opts.capacities ?? [150, 150, 150, 150, 150, 150, 150, 100, 80, 80];
  const couriers: Courier[] = capacities.map((capacityKg, i) => ({
    id: `C${String(i + 1).padStart(2, "0")}`,
    name: `Kurjeris ${i + 1}`,
    phone: `+3706000000${i}`,
    vehicle: capacityKg >= 150 ? "Furgonas" : "Lengvasis",
    capacityKg,
    shiftStart: "08:00",
    shiftEnd: "18:00",
    costPerHour: 12,
    costPerKm: 0.3,
    color: `#${(0x100000 + i * 0x151515).toString(16).slice(-6)}`,
  }));
  const packages: Package[] = Array.from({ length: opts.packages }, (_, i) => {
    const x = r();
    const priority: Priority = x < 0.2 ? 1 : x < 0.6 ? 2 : 3;
    // 1 prioritetas: 2–3 h langai nuo 09:00; kiti: 2–5 h, pradžia 08:30–14:00.
    const start = priority === 1 ? 540 + 30 * Math.floor(r() * 10) : 510 + 30 * Math.floor(r() * 12);
    const len = priority === 1 ? 120 + 60 * Math.floor(r() * 2) : 120 + 60 * Math.floor(r() * 4);
    return {
      id: `PKG-${String(i + 1).padStart(3, "0")}`,
      recipient: `Gavėjas ${i + 1}`,
      address: `Gatvė ${i + 1}, Vilnius`,
      location: { lat: 54.65 + r() * 0.09, lng: 25.2 + r() * 0.15 },
      priority,
      window: { start: hhmm(start), end: hhmm(Math.min(start + len, 1050)) },
      weightKg: 1 + Math.floor(r() * 15),
      serviceMinutes: 5,
    };
  });
  return DatasetSchema.parse({ depot: sampleDataset.depot, couriers, packages });
}

/** Bendri invariantai, kurie turi galioti bet kuriam mock planui. */
function assertPlanInvariants(plan: Plan) {
  PlanSchema.parse(plan);
  const { dataset } = plan;
  const pkgById = new Map(dataset.packages.map((p) => [p.id, p]));
  const courierById = new Map(dataset.couriers.map((c) => [c.id, c]));
  const shiftEndMs = (c: Courier) => Date.parse(`${dataset.depot.date}T${c.shiftEnd}:00+02:00`);
  const windowMs = (t: string) => Date.parse(`${dataset.depot.date}T${t}:00+02:00`);

  // Kiekvienas kurjeris turi lygiai vieną maršrutą.
  assert.deepEqual(
    plan.routes.map((r) => r.courierId),
    dataset.couriers.map((c) => c.id),
  );

  // Kiekvienas paketas lygiai vieną kartą: arba maršrute, arba skipped.
  const seen = new Map<string, number>();
  for (const r of plan.routes) for (const s of r.stops) seen.set(s.packageId, (seen.get(s.packageId) ?? 0) + 1);
  for (const s of plan.skipped) seen.set(s.packageId, (seen.get(s.packageId) ?? 0) + 1);
  assert.equal(seen.size, dataset.packages.length);
  for (const p of dataset.packages) assert.equal(seen.get(p.id), 1, `${p.id} appears ${seen.get(p.id)} times`);

  for (const r of plan.routes) {
    const c = courierById.get(r.courierId)!;
    const weight = r.stops.reduce((n, s) => n + pkgById.get(s.packageId)!.weightKg, 0);
    assert.ok(weight <= c.capacityKg, `${c.id} over capacity: ${weight} > ${c.capacityKg}`);
    assert.equal(r.totalWeightKg, weight);
    assert.ok(Date.parse(r.end) <= shiftEndMs(c), `${c.id} ends after shift: ${r.end}`);
    assert.ok(Date.parse(r.start) >= Date.parse(`${dataset.depot.date}T${c.shiftStart}:00+02:00`));
    assert.match(r.start, /\+02:00$/);
    assert.equal(r.path?.length, r.stops.length + 2);

    let prevDeparture = Date.parse(r.start);
    r.stops.forEach((s, i) => {
      const p = pkgById.get(s.packageId)!;
      assert.equal(s.seq, i + 1);
      const arr = Date.parse(s.arrival);
      const dep = Date.parse(s.departure);
      assert.ok(arr >= prevDeparture);
      assert.equal(dep - arr, (s.waitMinutes + p.serviceMinutes) * 60_000);
      const serviceStart = arr + s.waitMinutes * 60_000;
      assert.ok(serviceStart >= windowMs(p.window.start), `${p.id} served before window`);
      assert.equal(s.lateMinutes, Math.max(0, (serviceStart - windowMs(p.window.end)) / 60_000));
      if (p.priority === 1) assert.equal(s.lateMinutes, 0, `${p.id} (p1) is late`);
      prevDeparture = dep;
    });
    assert.ok(Date.parse(r.end) >= prevDeparture);
  }

  for (const s of plan.skipped) assert.ok(Object.values(SKIP_REASONS).includes(s.reason as never), s.reason);
  assert.equal(plan.metrics.deliveredCount + plan.metrics.skippedCount, dataset.packages.length);
}

describe("mockOptimizer", () => {
  test("implements Optimizer with name 'mock'", () => {
    assert.equal(mockOptimizer.name, "mock");
  });

  test("sample fixture dataset: valid plan, everything delivered", async () => {
    const plan = await mockOptimizer.optimize(sampleDataset);
    assert.equal(plan.mode, "mock");
    assertPlanInvariants(plan);
    assert.equal(plan.skipped.length, 0);
    assert.match(plan.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+02:00$/);
  });

  test("synthetic 70 packages / 10 couriers: invariants hold, no p1 skipped", () => {
    for (const seed of [1, 2, 3, 42, 2026]) {
      const ds = syntheticDataset({ seed, packages: 70 });
      const plan = planMock(ds, FIXED_NOW);
      assertPlanInvariants(plan);
      const p1 = new Set(ds.packages.filter((p) => p.priority === 1).map((p) => p.id));
      const skippedP1 = plan.skipped.filter((s) => p1.has(s.packageId));
      assert.deepEqual(skippedP1, [], `seed ${seed}: p1 skipped`);
      assert.ok(plan.metrics.totalKm > 0);
      assert.ok(plan.metrics.totalCost! > 0);
    }
  });

  test("deterministic: same input -> identical output", async () => {
    const ds = syntheticDataset({ seed: 7, packages: 70 });
    const opt = createMockOptimizer({ now: () => FIXED_NOW });
    const a = await opt.optimize(ds);
    const b = await opt.optimize(structuredClone(ds));
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  test("overload: capacity respected, low priority skipped with Lithuanian reason", () => {
    const ds = syntheticDataset({ seed: 11, packages: 160, capacities: [60, 60, 60, 60, 60, 40, 40, 40, 40, 40] });
    const plan = planMock(ds, FIXED_NOW);
    assertPlanInvariants(plan);
    assert.ok(plan.skipped.length > 0);
    assert.ok(plan.skipped.some((s) => s.reason === SKIP_REASONS.capacity));
    const prio = new Map(ds.packages.map((p) => [p.id, p.priority]));
    assert.ok(plan.skipped.every((s) => prio.get(s.packageId) !== 1), "p1 should be placed first");
  });

  test("unreachable or too heavy packages get specific reasons", () => {
    const base = syntheticDataset({ seed: 5, packages: 3 });
    const tmpl = base.packages[0]!;
    const ds: Dataset = {
      ...base,
      packages: [
        ...base.packages,
        { ...tmpl, id: "HEAVY", weightKg: 999 },
        // Langas pasibaigia prieš pamainą: 1 prioritetas negali vėluoti.
        { ...tmpl, id: "EARLY", priority: 1, window: { start: "06:00", end: "07:00" } },
      ],
    };
    const plan = planMock(ds, FIXED_NOW);
    assertPlanInvariants(plan);
    const reasons = Object.fromEntries(plan.skipped.map((s) => [s.packageId, s.reason]));
    assert.equal(reasons.HEAVY, SKIP_REASONS.tooHeavy);
    assert.equal(reasons.EARLY, SKIP_REASONS.window);
  });

  test("courier departs later instead of waiting at the first stop", () => {
    const pkg: Package = { ...sampleDataset.packages[0]!, window: { start: "14:00", end: "15:00" } };
    const plan = planMock({ ...sampleDataset, couriers: [sampleDataset.couriers[0]!], packages: [pkg] }, FIXED_NOW);
    const r = plan.routes[0]!;
    assert.equal(r.stops[0]!.waitMinutes, 0);
    assert.equal(r.stops[0]!.arrival, "2026-11-10T14:00:00+02:00");
    assert.ok(r.start > "2026-11-10T13:");
  });

  test("empty dataset: every courier has an empty route", () => {
    const plan = planMock({ ...sampleDataset, packages: [] }, FIXED_NOW);
    assert.equal(plan.routes.length, sampleDataset.couriers.length);
    assert.ok(plan.routes.every((r) => r.stops.length === 0 && r.totalKm === 0));
    assert.equal(plan.metrics.deliveredCount, 0);
  });
});
