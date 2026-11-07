// Smoke testas: tsx scripts/try-api.ts <dataset.json> [out/plan.api.json] [--record <dir>]
// --record išsaugo request.json ir response.json į nurodytą katalogą (fixtures testams).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatasetSchema } from "@marsrutai/shared";
import { apiOptimizer, buildPlan, buildRequest, optimizeTours } from "../src/api/index.js";

const args = process.argv.slice(2);
const recIdx = args.indexOf("--record");
const recordDir = recIdx >= 0 ? args.splice(recIdx, 2)[1] : undefined;
const [input, output = "out/plan.api.json"] = args;
if (!input) {
  console.error("Naudojimas: tsx scripts/try-api.ts <dataset.json> [plan.json] [--record <dir>]");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(input, "utf8"));
const dataset = DatasetSchema.parse(raw.dataset ?? raw); // priima ir Plan failą (sample-plan.json)

const t0 = Date.now();
let plan;
if (recordDir) {
  const request = buildRequest(dataset);
  const response = await optimizeTours(request);
  mkdirSync(recordDir, { recursive: true });
  writeFileSync(join(recordDir, "dataset.json"), JSON.stringify(dataset, null, 2));
  writeFileSync(join(recordDir, "request.json"), JSON.stringify(request, null, 2));
  writeFileSync(join(recordDir, "response.json"), JSON.stringify(response, null, 2));
  plan = buildPlan(dataset, response);
} else {
  plan = await apiOptimizer.optimize(dataset);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(plan, null, 2));
const m = plan.metrics;
console.log(`Planas: ${output} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
console.log(
  `  pristatyta ${m.deliveredCount}, praleista ${m.skippedCount}, vėluota ${m.lateCount}, ` +
    `${m.totalKm} km, ${m.totalHours} h, kaina ${m.totalCost ?? "-"}`,
);
for (const r of plan.routes) {
  console.log(`  ${r.courierId}: ${r.stops.length} stot., ${r.totalKm} km, ${r.totalMinutes} min, ${r.totalWeightKg} kg`);
}
for (const s of plan.skipped) console.log(`  praleista ${s.packageId}: ${s.reason}`);
