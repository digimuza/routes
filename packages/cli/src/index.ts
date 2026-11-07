// CLI įėjimo taškas (SPEC 4.4).
//   npm run demo                      -> data/normal.json per realų Google Route Optimization API
//   npm run demo -- overload          -> data/overload.json
//   npm run demo -- <failas.json>     -> bet koks Dataset (arba Plan, iš jo imamas dataset)
//   npm run demo -- --mock            -> lokalus algoritmas, be GCP
//   --out <katalogas>                 -> rezultatų katalogas (numatyta <repo>/out)
//   --no-pdf                          -> neskaičiuoti PDF
import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Optimizer, Plan } from "@marsrutai/shared";
import { RouteOptimizationError, apiOptimizer } from "./api/index.js";
import { findRepoRoot, loadDataset } from "./load.js";
import { mockOptimizer } from "./mock/index.js";
import { courierRows, summaryMarkdown } from "./summary.js";

const USAGE = "Naudojimas: npm run demo -- [normal|overload|<dataset.json>] [--mock] [--out <katalogas>] [--no-pdf]";

interface PdfModule {
  renderAllPdfs(plan: Plan, outDir: string): Promise<string[]>;
}

/**
 * PDF modulis (src/pdf) kuriamas atskiroje šakoje; kol jis nesujungtas, CLI veikia be PDF.
 * Kelias kintamajame, kad tsc nereikalautų modulio kompiliavimo metu.
 */
async function loadPdfModule(): Promise<PdfModule | null> {
  const spec = "./pdf/index.js";
  try {
    return (await import(spec)) as PdfModule;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND" && String(e).includes("/pdf/")) return null;
    throw e;
  }
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      mock: { type: "boolean", default: false },
      out: { type: "string" },
      "no-pdf": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (positionals.length > 1) {
    console.error(USAGE);
    return 2;
  }

  // npm -w paleidžia skriptą packages/cli kataloge; santykinius kelius skaičiuojame nuo vartotojo katalogo.
  const userCwd = process.env.INIT_CWD ?? process.cwd();
  const fromUser = (p: string) => (isAbsolute(p) ? p : resolve(userCwd, p));
  const datasetArg = positionals[0] ?? "normal";
  const isPath = /[\\/]/.test(datasetArg) || datasetArg.toLowerCase().endsWith(".json");
  const outDir = values.out ? fromUser(values.out) : join(findRepoRoot(), "out");

  const dataset = loadDataset(isPath ? fromUser(datasetArg) : datasetArg);
  const optimizer: Optimizer = values.mock ? mockOptimizer : apiOptimizer;
  const label = values.mock ? "MOCK" : "Google Route Optimization API";
  console.log(
    `Optimizuojama (${label}): ${dataset.packages.length} paketų, ${dataset.couriers.length} kurjerių, ${dataset.depot.date}…`,
  );

  const t0 = Date.now();
  let plan: Plan;
  try {
    plan = await optimizer.optimize(dataset);
  } catch (e) {
    if (e instanceof RouteOptimizationError || !values.mock) {
      console.error(`\nAPI klaida: ${(e as Error).message}`);
      console.error(
        "Patikrinkite `gcloud auth application-default login` ir GOOGLE_CLOUD_PROJECT, arba paleiskite su --mock.",
      );
      return 1;
    }
    throw e;
  }
  console.log(`Planas gautas per ${((Date.now() - t0) / 1000).toFixed(1)} s.`);

  mkdirSync(outDir, { recursive: true });
  const planFile = join(outDir, "plan.json");
  writeFileSync(planFile, JSON.stringify(plan, null, 2) + "\n");
  const summaryFile = join(outDir, "summary.md");
  writeFileSync(summaryFile, summaryMarkdown(plan));

  let pdfs: string[] = [];
  if (!values["no-pdf"]) {
    const pdf = await loadPdfModule();
    if (pdf) pdfs = await pdf.renderAllPdfs(plan, outDir);
    else console.warn("PDF modulis dar neprijungtas (src/pdf) – PDF praleidžiami.");
  }

  console.table(
    courierRows(plan).map((r) => ({
      kurjeris: `${r.courierId} ${r.name}`,
      paketai: r.stops,
      km: r.km,
      val: r.hours,
      "kg / talpa": `${r.loadKg} / ${r.capacityKg}`,
      vėluoja: r.late,
      išvyksta: r.start,
      grįžta: r.end,
    })),
  );
  const m = plan.metrics;
  console.log(
    `Pristatyta ${m.deliveredCount}/${dataset.packages.length}, nepristatyta ${m.skippedCount}, vėluoja ${m.lateCount}, ` +
      `${m.totalKm} km, ${m.totalHours} h` +
      (m.totalCost !== undefined ? `, kaina ${m.totalCost}` : ""),
  );
  for (const s of plan.skipped) console.log(`  × ${s.packageId}: ${s.reason}`);
  console.log(`\n${planFile}\n${summaryFile}`);
  if (pdfs.length) console.log(`${pdfs.length} PDF -> ${outDir}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error((e as Error).message ?? e);
    process.exit(1);
  },
);
