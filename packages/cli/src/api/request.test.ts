import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatasetSchema } from "@marsrutai/shared";
import { buildRequest, COST_TUNING } from "./request.js";

const fx = (f: string) => JSON.parse(readFileSync(new URL(`../../fixtures/api/${f}`, import.meta.url), "utf8"));
const dataset = DatasetSchema.parse(fx("dataset.json"));

test("buildRequest atitinka įrašytą realią užklausą (be vėliau pridėto balansavimo)", () => {
  // Įrašas padarytas prieš routeDurationLimit balansavimą; jį tikriname atskirai žemiau.
  const r = buildRequest(dataset);
  for (const v of r.model.vehicles) delete v.routeDurationLimit;
  assert.deepEqual(r, fx("request.json"));
});

test("balansavimas: kvadratinė maršruto trukmės kaina nuo 0 h, riba = pamainos trukmė", () => {
  const v = buildRequest(dataset).model.vehicles[0]!;
  assert.deepEqual(v.routeDurationLimit, {
    maxDuration: "36000s",
    quadraticSoftMaxDuration: "0s",
    costPerSquareHourAfterQuadraticSoftMax: COST_TUNING.balanceCostPerSquareHour,
  });
});

test("globalūs laikai = sandėlio darbo laikas UTC", () => {
  const r = buildRequest(dataset);
  assert.equal(r.model.globalStartTime, "2026-11-10T06:00:00Z");
  assert.equal(r.model.globalEndTime, "2026-11-10T16:00:00Z");
  assert.equal(r.populatePolylines, true);
  assert.equal(r.considerRoadTraffic, false);
});

test("siunta: langas su minkšta pabaiga, bauda ir svoris pagal prioritetą", () => {
  const r = buildRequest(dataset);
  assert.equal(r.model.shipments.length, dataset.packages.length);
  const s = r.model.shipments[0]!; // PKG-001, p1, 09:00–11:00, 12 kg
  assert.equal(s.label, "PKG-001");
  assert.equal(s.penaltyCost, COST_TUNING.penaltyCost[1]);
  assert.deepEqual(s.deliveries[0]!.timeWindows, [
    {
      startTime: "2026-11-10T07:00:00Z",
      softEndTime: "2026-11-10T09:00:00Z",
      costPerHourAfterSoftEndTime: COST_TUNING.lateCostPerHour[1],
      endTime: "2026-11-10T16:00:00Z",
    },
  ]);
  assert.equal(s.deliveries[0]!.duration, "300s");
  assert.deepEqual(s.loadDemands, { weight_kg: { amount: "12" } });
  // 3.5 kg apvalinama į viršų
  const p7 = r.model.shipments.find((x) => x.label === "PKG-007")!;
  assert.deepEqual(p7.loadDemands, { weight_kg: { amount: "4" } });
});

test("prioritetų kaštai griežtai mažėja", () => {
  const { penaltyCost: p, lateCostPerHour: l } = COST_TUNING;
  assert.ok(p[1] > p[2] && p[2] > p[3]);
  assert.ok(l[1] > l[2] && l[2] > l[3]);
});

test("transporto priemonė = kurjeris", () => {
  const v = buildRequest(dataset).model.vehicles;
  assert.equal(v.length, dataset.couriers.length);
  assert.deepEqual(v[1], {
    label: "C02",
    travelMode: "DRIVING",
    startLocation: { latitude: 54.672, longitude: 25.241 },
    endLocation: { latitude: 54.672, longitude: 25.241 },
    startTimeWindows: [{ startTime: "2026-11-10T06:00:00Z" }],
    endTimeWindows: [{ endTime: "2026-11-10T16:00:00Z" }],
    loadLimits: { weight_kg: { maxLoad: "80" } },
    costPerHour: 12,
    costPerKilometer: 0.25,
    routeDurationLimit: {
      maxDuration: "36000s",
      quadraticSoftMaxDuration: "0s",
      costPerSquareHourAfterQuadraticSoftMax: COST_TUNING.balanceCostPerSquareHour,
    },
  });
});

test("langas už sandėlio darbo laiko ribų apkarpomas", () => {
  const ds = structuredClone(dataset);
  ds.packages[0]!.window = { start: "07:00", end: "19:00" };
  const tw = buildRequest(ds).model.shipments[0]!.deliveries[0]!.timeWindows[0]!;
  assert.equal(tw.startTime, "2026-11-10T06:00:00Z");
  assert.equal(tw.softEndTime, "2026-11-10T16:00:00Z");
});
