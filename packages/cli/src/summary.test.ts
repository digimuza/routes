import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PlanSchema } from "@marsrutai/shared";
import { courierRows, summaryMarkdown } from "./summary.js";

const plan = PlanSchema.parse(
  JSON.parse(readFileSync(new URL("../../shared/fixtures/sample-plan.json", import.meta.url), "utf8")),
);

test("courierRows: one row per route with load vs capacity", () => {
  const rows = courierRows(plan);
  assert.equal(rows.length, plan.routes.length);
  for (const [i, r] of rows.entries()) {
    assert.equal(r.courierId, plan.routes[i]!.courierId);
    assert.equal(r.stops, plan.routes[i]!.stops.length);
    assert.ok(r.capacityKg > 0);
  }
});

test("summaryMarkdown: courier table, skipped section and totals", () => {
  const md = summaryMarkdown(plan);
  assert.match(md, /^# Maršrutų suvestinė – 2026-11-10/);
  for (const c of plan.dataset.couriers) assert.ok(md.includes(`| ${c.id} | ${c.name} |`));
  assert.match(md, /## Nepristatyti paketai/);
  assert.match(md, new RegExp(`pristatyta: ${plan.metrics.deliveredCount}`));
  const withSkip = { ...plan, skipped: [{ packageId: plan.dataset.packages[0]!.id, reason: "Viršyta kurjerių talpa" }] };
  assert.match(summaryMarkdown(withSkip), /\| PKG-001 \| 1 \| .* \| Viršyta kurjerių talpa \|/);
});
