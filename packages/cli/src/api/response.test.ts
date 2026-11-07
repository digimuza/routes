import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatasetSchema, PlanSchema } from "@marsrutai/shared";
import { buildPlan, type OptimizeToursResponse } from "./response.js";

const fx = (f: string) => JSON.parse(readFileSync(new URL(`../../fixtures/api/${f}`, import.meta.url), "utf8"));
// Įrašyta reali užklausa/atsakymas sukurti be ėjimo laiko, todėl jis čia išjungtas.
const dataset = DatasetSchema.parse({ ...fx("dataset.json"), settings: { walkMinutes: 0 } });
const response = fx("response.json") as OptimizeToursResponse;
const NOW = new Date("2026-11-07T10:00:00Z");

test("planas validus ir atitinka API visits tvarką", () => {
  const plan = buildPlan(dataset, response, NOW);
  PlanSchema.parse(plan);
  assert.equal(plan.mode, "api");
  assert.equal(plan.generatedAt, "2026-11-07T12:00:00+02:00");
  assert.deepEqual(plan.routes.map((r) => r.courierId), ["C01", "C02", "C03"]);
  for (const [i, r] of plan.routes.entries()) {
    const api = response.routes!.find((x) => x.vehicleLabel === r.courierId)!;
    assert.deepEqual(r.stops.map((s) => s.packageId), api.visits!.map((v) => v.shipmentLabel), `route ${i}`);
    assert.deepEqual(r.stops.map((s) => s.seq), r.stops.map((_, k) => k + 1));
  }
});

test("stotelės laikai, vėlavimas, atstumai", () => {
  const plan = buildPlan(dataset, response, NOW);
  const c03 = plan.routes.find((r) => r.courierId === "C03")!;
  assert.equal(c03.start, "2026-11-10T09:21:58+02:00");
  assert.equal(c03.end, "2026-11-10T10:21:52+02:00");
  assert.deepEqual(c03.stops[0], {
    seq: 1,
    packageId: "PKG-001",
    arrival: "2026-11-10T09:32:34+02:00",
    departure: "2026-11-10T09:37:34+02:00",
    lateMinutes: 0,
    waitMinutes: 0,
    distanceFromPrevKm: 4.89,
  });
  assert.equal(c03.totalKm, 20.18);
  assert.equal(c03.totalMinutes, 59.9);
  assert.equal(c03.totalWeightKg, 36);
  assert.ok(c03.path && c03.path.length > 10);
  // kelias prasideda ir baigiasi prie sandėlio
  const [lat, lng] = c03.path![0]!;
  assert.ok(Math.abs(lat - 54.672) < 0.01 && Math.abs(lng - 25.241) < 0.01);

  // PKG-007 langas 08:00–08:15, pristatyta 08:19:02 → 4 min vėlavimas
  const c02 = plan.routes.find((r) => r.courierId === "C02")!;
  assert.equal(c02.stops[0]!.packageId, "PKG-007");
  assert.equal(c02.stops[0]!.lateMinutes, 4);
  assert.equal(c02.totalWeightKg, 3.5);
});

test("suvestinė ir praleisti paketai", () => {
  const plan = buildPlan(dataset, response, NOW);
  assert.deepEqual(plan.skipped, [
    { packageId: "PKG-006", reason: "Paketas per sunkus – viršija kurjerio talpą (pvz. C01)" },
  ]);
  assert.equal(plan.metrics.deliveredCount, 6);
  assert.equal(plan.metrics.skippedCount, 1);
  assert.equal(plan.metrics.lateCount, 1);
  assert.equal(plan.metrics.totalKm, 65.92);
  assert.equal(plan.metrics.totalCost, 156.22);
  assert.equal(plan.metrics.totalHours, Math.round((9305 / 3600) * 100) / 100);
});

test("kurjeris be maršruto gauna tuščią maršrutą", () => {
  const ds = structuredClone(dataset);
  ds.couriers.push({ ...ds.couriers[0]!, id: "C04", shiftStart: "09:00" });
  const resp = structuredClone(response);
  resp.routes!.push({ vehicleIndex: 3, vehicleLabel: "C04" }); // API tuščias maršrutas
  const plan = buildPlan(ds, resp, NOW);
  const c04 = plan.routes[3]!;
  assert.equal(c04.courierId, "C04");
  assert.deepEqual(c04.stops, []);
  assert.equal(c04.start, "2026-11-10T09:00:00+02:00");
  assert.equal(c04.totalKm, 0);
  // ir jei API maršruto visai negrąžina
  const ds2 = structuredClone(ds);
  ds2.couriers.push({ ...ds.couriers[0]!, id: "C05" });
  assert.deepEqual(buildPlan(ds2, resp, NOW).routes[4]!.stops, []);
});

test("praleistas be priežasties kodo → bendras paaiškinimas; index 0 be label", () => {
  const resp: OptimizeToursResponse = {
    routes: [],
    skippedShipments: [{ reasons: [] }, { index: 2, label: "PKG-003" }],
  };
  const plan = buildPlan(dataset, resp, NOW);
  assert.equal(plan.skipped[0]!.packageId, "PKG-001");
  assert.match(plan.skipped[0]!.reason, /talpos ar darbo laiko/);
  assert.equal(plan.skipped[1]!.packageId, "PKG-003");
  // likę paketai, kurių nėra atsakyme, taip pat pažymimi
  assert.equal(plan.skipped.length, dataset.packages.length);
  assert.equal(plan.routes.length, dataset.couriers.length);
  assert.equal(plan.metrics.totalCost, undefined);
});

test("arrival = atvykimas prie durų (vizito pradžia − laukimas), departure = pradžia + aptarnavimas", () => {
  const resp = structuredClone(response);
  const r = resp.routes!.find((x) => x.vehicleLabel === "C03")!;
  // Dirbtinai: 7 min 30 s laukimo prieš pirmą vizitą.
  r.transitions![0]!.waitDuration = "450s";
  const plan = buildPlan(dataset, resp, NOW);
  const s = plan.routes.find((x) => x.courierId === "C03")!.stops[0]!;
  assert.equal(s.arrival, "2026-11-10T09:25:04+02:00");
  assert.equal(s.departure, "2026-11-10T09:37:34+02:00");
  assert.equal(s.waitMinutes, 7.5);
  // be laukimo arrival sutampa su vizito pradžia
  const s2 = plan.routes.find((x) => x.courierId === "C03")!.stops[1]!;
  const visit2 = new Date(r.visits![1]!.startTime).getTime();
  assert.equal(new Date(s2.arrival).getTime(), visit2);
});
