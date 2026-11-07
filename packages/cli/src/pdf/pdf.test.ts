// Paleidimas: npm run test:pdf -w @marsrutai/cli
// Sintetinis didelis planas: tikrina puslapiavimą, kartojamas lentelių antraštes, tuščią kurjerį.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename } from "node:path";
import { PlanSchema, type Package, type Plan, type Stop } from "@marsrutai/shared";
import { renderAllPdfs } from "./index.js";
import { courierPdfFileName, formatTime, slugify } from "./format.js";

const outDir = fileURLToPath(new URL("../../../../out/pdf-test/", import.meta.url));

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function bigPlan(stopCount: number): Plan {
  const depot = { lat: 54.672, lng: 25.241 };
  const packages: Package[] = [];
  const stops: Stop[] = [];
  const path: [number, number][] = [[depot.lat, depot.lng]];
  let minute = 8 * 60 + 30;
  const streets = ["Gedimino pr.", "Žirmūnų g.", "Šeškinės g.", "Ąžuolyno g.", "Čiurlionio g.", "Įsruties g.", "Ūmėdžių g."];
  for (let i = 0; i < stopCount; i++) {
    const a = (i / stopCount) * 2 * Math.PI;
    const r = 0.02 + (i % 4) * 0.008;
    const loc = { lat: depot.lat + 0.03 + r * Math.sin(a), lng: depot.lng + 0.04 + (r / 0.58) * Math.cos(a) };
    const id = `PKG-${String(100 + i).padStart(3, "0")}`;
    const priority = ((i % 3) + 1) as 1 | 2 | 3;
    const startH = 9 + Math.floor(i / 4);
    packages.push({
      id,
      recipient: i % 5 === 0 ? `UAB „Šiaurės ąžuolas Nr. ${i}“ ilgas pavadinimas` : `Gavėjas Žemaitė ${i}`,
      phone: i % 2 === 0 ? `+3706${String(1000000 + i)}` : undefined,
      address: `${streets[i % streets.length]} ${i + 1}-${i + 3}, Vilnius`,
      location: loc,
      priority,
      window: { start: `${pad(Math.min(startH, 16))}:00`, end: `${pad(Math.min(startH + 2, 18))}:00` },
      weightKg: 2 + (i % 7) * 1.5,
      serviceMinutes: 5,
      note: i % 6 === 0 ? "Skambinti prieš atvykstant, kodas 1234, laiptinė iš kiemo" : undefined,
    });
    minute += 12;
    const late = i % 7 === 3 ? 12 : 0;
    const wait = i % 7 === 5 ? 8 : 0;
    const iso = (m: number) => `2026-11-10T${pad(Math.floor(m / 60))}:${pad(m % 60)}:00+02:00`;
    stops.push({
      seq: i + 1,
      packageId: id,
      arrival: iso(minute),
      departure: iso(minute + 5 + wait),
      lateMinutes: late,
      waitMinutes: wait,
      distanceFromPrevKm: 1.2 + (i % 3) * 0.7,
    });
    minute += 5 + wait;
    path.push([loc.lat, loc.lng]);
  }
  path.push([depot.lat, depot.lng]);
  const totalWeightKg = packages.reduce((s, p) => s + p.weightKg, 0);
  return PlanSchema.parse({
    generatedAt: "2026-11-07T14:23:00+02:00",
    mode: "api",
    dataset: {
      depot: {
        id: "D1",
        name: "Sandėlis Vilnius",
        address: "Savanorių pr. 178, Vilnius",
        location: depot,
        date: "2026-11-10",
        timezone: "Europe/Vilnius",
        open: "08:00",
        close: "18:00",
      },
      couriers: [
        { id: "C01", name: "Jonas Petraitis", phone: "+37060000001", vehicle: "Furgonas", capacityKg: 300, shiftStart: "08:00", shiftEnd: "18:00", costPerHour: 12, costPerKm: 0.3, color: "#8e24aa" },
        { id: "C02", name: "Šarūnė Ąžuolaitė-Čėsnienė", phone: "+37060000002", vehicle: "Dviratis", capacityKg: 20, shiftStart: "08:00", shiftEnd: "18:00", costPerHour: 10, costPerKm: 0, color: "#00897b" },
      ],
      packages,
    },
    routes: [
      { courierId: "C01", start: "2026-11-10T08:30:00+02:00", end: `2026-11-10T${pad(Math.floor((minute + 20) / 60))}:${pad((minute + 20) % 60)}:00+02:00`, stops, totalKm: 48.7, totalMinutes: minute + 20 - 510, totalWeightKg, path },
    ],
    skipped: [],
    metrics: { totalKm: 48.7, totalHours: 6, deliveredCount: stopCount, skippedCount: 0, lateCount: 4 },
  });
}

function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type \/Page\b(?!s)/g) ?? []).length;
}

test("helpers", () => {
  assert.equal(slugify("Rūta Žemaitė"), "ruta-zemaite");
  assert.equal(courierPdfFileName(0, "Jonas Petraitis"), "courier-01-jonas-petraitis.pdf");
  assert.equal(courierPdfFileName(9, "Šarūnė Ąžuolaitė-Čėsnienė"), "courier-10-sarune-azuolaite-cesniene.pdf");
  assert.equal(formatTime("2026-11-10T07:05:00Z", "Europe/Vilnius"), "09:05");
  assert.equal(formatTime("2026-11-10T09:05:00+02:00", "Europe/Vilnius"), "09:05");
});

test("big plan paginates, empty courier still gets a PDF", async () => {
  const files = await renderAllPdfs(bigPlan(30), outDir);
  assert.deepEqual(files.map((f) => basename(f)), [
    "courier-01-jonas-petraitis.pdf",
    "courier-02-sarune-azuolaite-cesniene.pdf",
  ]);
  const big = await readFile(files[0]!);
  const empty = await readFile(files[1]!);
  assert.ok(big.subarray(0, 5).toString() === "%PDF-");
  assert.ok(pageCount(big) >= 3, `expected >= 3 pages, got ${pageCount(big)}`);
  assert.equal(pageCount(empty), 1);
});
