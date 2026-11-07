/**
 * Deterministic synthetic dataset generator.
 *
 *   npm run gen-data                 # seed 42
 *   npm run gen-data -- --seed 7
 *
 * Writes data/normal.json (~70 packages) and data/overload.json (~140 packages,
 * heavier, total weight exceeds fleet capacity so some priority-3 packages get skipped).
 * Same seed → byte-identical output. No Math.random.
 * Generation logic lives in src/generate (shared with the server's POST /api/generate).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Dataset } from "@marsrutai/shared";
import { DEMO_PROFILES, inCityBounds, makeDemoDataset } from "../src/generate/index.js";
import { findRepoRoot, parseDataset } from "../src/load.js";

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

function checkBounds(ds: Dataset, label: string) {
  for (const p of ds.packages) {
    if (!inCityBounds("vilnius", p.location)) {
      throw new Error(`${label}: ${p.id} (${p.address}) už miesto ribų: ${p.location.lat},${p.location.lng}`);
    }
  }
}

function summary(ds: Dataset): string {
  const byP = [1, 2, 3].map((p) => ds.packages.filter((x) => x.priority === p).length);
  const kg = round(ds.packages.reduce((s, p) => s + p.weightKg, 0), 1);
  const cap = ds.couriers.reduce((s, c) => s + c.capacityKg, 0);
  return `${ds.packages.length} paketų (p1=${byP[0]}, p2=${byP[1]}, p3=${byP[2]}), ${kg} kg / talpa ${cap} kg`;
}

function parseSeed(argv: string[]): number {
  let raw: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--seed") raw = argv[++i];
    else if (a.startsWith("--seed=")) raw = a.slice("--seed=".length);
  }
  if (raw === undefined) return 42;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`--seed turi būti sveikasis skaičius, gauta: ${raw}`);
  return n;
}

function main() {
  const seed = parseSeed(process.argv.slice(2));
  const outDir = join(findRepoRoot(), "data");
  mkdirSync(outDir, { recursive: true });

  for (const [label, profile] of DEMO_PROFILES) {
    const ds = makeDemoDataset(seed, label, profile);
    checkBounds(ds, label);
    parseDataset(ds, label); // throws with readable zod issues if invalid
    const file = join(outDir, `${label}.json`);
    writeFileSync(file, JSON.stringify(ds, null, 2) + "\n", "utf8");
    console.log(`${file}: ${summary(ds)} (seed ${seed})`);
  }
}

main();
