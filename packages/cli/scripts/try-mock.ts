// Greitas mock optimizatoriaus paleidimas:
//   npm run try-mock -w @marsrutai/cli -- [dataset.json] [out/plan.mock.json]
// Be argumentų naudoja packages/shared/fixtures/sample-plan.json `dataset` ir rašo į <repo>/out/plan.mock.json.
// Santykiniai keliai skaičiuojami nuo katalogo, kuriame paleistas npm (INIT_CWD).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatasetSchema } from "@marsrutai/shared";
import { mockOptimizer } from "../src/mock/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cwd = process.env.INIT_CWD ?? process.cwd();

const [inArg, outArg] = process.argv.slice(2);
const inPath = inArg ? resolve(cwd, inArg) : resolve(repoRoot, "packages/shared/fixtures/sample-plan.json");
const outPath = outArg ? resolve(cwd, outArg) : resolve(repoRoot, "out/plan.mock.json");

const raw = JSON.parse(readFileSync(inPath, "utf8"));
// Priimame tiek gryną Dataset, tiek Plan (paimame jo `dataset`).
const dataset = DatasetSchema.parse("dataset" in raw && !("depot" in raw) ? raw.dataset : raw);

const plan = await mockOptimizer.optimize(dataset);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n");

const m = plan.metrics;
console.log(`Įvestis:  ${inPath}`);
console.log(`Planas:   ${outPath}`);
console.table(
  plan.routes.map((r) => ({
    kurjeris: r.courierId,
    stotelės: r.stops.length,
    km: r.totalKm,
    val: Math.round((r.totalMinutes / 60) * 10) / 10,
    kg: r.totalWeightKg,
    vėluoja: r.stops.filter((s) => s.lateMinutes > 0).length,
    išvyksta: r.start.slice(11, 16),
    grįžta: r.end.slice(11, 16),
  })),
);
console.log(
  `Pristatyta ${m.deliveredCount}, nepristatyta ${m.skippedCount}, vėluoja ${m.lateCount}, ` +
    `${m.totalKm} km, ${m.totalHours} h, ~${m.totalCost} €`,
);
for (const s of plan.skipped) console.log(`  × ${s.packageId}: ${s.reason}`);
