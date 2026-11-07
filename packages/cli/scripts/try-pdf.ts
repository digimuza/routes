// Naudojimas: npm run try-pdf -w @marsrutai/cli -- [plan.json] [išvesties katalogas]
// Numatyta: packages/shared/fixtures/sample-plan.json → out/pdf-sample/
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { PlanSchema } from "@marsrutai/shared";
import { renderAllPdfs } from "../src/pdf/index.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const planPath = resolve(process.cwd(), process.argv[2] ?? resolve(repoRoot, "packages/shared/fixtures/sample-plan.json"));
const outDir = resolve(process.cwd(), process.argv[3] ?? resolve(repoRoot, "out/pdf-sample"));

const plan = PlanSchema.parse(JSON.parse(await readFile(planPath, "utf8")));
const files = await renderAllPdfs(plan, outDir);
console.log(`Sugeneruota ${files.length} PDF iš ${planPath}:`);
for (const f of files) console.log(`  ${f}`);
