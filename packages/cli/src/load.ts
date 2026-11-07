import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatasetSchema, type Dataset } from "@marsrutai/shared";
import type { ZodIssue } from "zod";

/** Built-in dataset names that map to `data/<name>.json` in the repo root. */
export const BUILTIN_DATASETS = ["normal", "overload"] as const;

function isWorkspaceRoot(dir: string): boolean {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { workspaces?: unknown };
    return pkg.workspaces !== undefined;
  } catch {
    return false;
  }
}

function walkUp(start: string): string | undefined {
  let dir = resolve(start);
  for (;;) {
    if (isWorkspaceRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Finds the monorepo root: the nearest ancestor directory whose package.json
 * declares `workspaces`. Searches from this module's location first, then cwd.
 */
export function findRepoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = walkUp(here) ?? walkUp(process.cwd());
  if (!root) {
    throw new Error(`Nepavyko rasti repozitorijos šaknies (package.json su "workspaces") nuo ${here}`);
  }
  return root;
}

/**
 * "normal" / "overload" (or any bare name without path separators or extension)
 * → `<repoRoot>/data/<name>.json`. Anything else is treated as a path relative to cwd.
 */
export function resolveDatasetPath(nameOrPath: string): string {
  const looksLikeName = !/[\\/]/.test(nameOrPath) && !nameOrPath.toLowerCase().endsWith(".json");
  if (looksLikeName) return join(findRepoRoot(), "data", `${nameOrPath}.json`);
  return isAbsolute(nameOrPath) ? nameOrPath : resolve(process.cwd(), nameOrPath);
}

export function formatIssuePath(path: (string | number)[]): string {
  if (path.length === 0) return "(šaknis)";
  return path
    .map((p, i) => (typeof p === "number" ? `[${p}]` : i === 0 ? p : `.${p}`))
    .join("");
}

export function formatZodIssues(issues: ZodIssue[]): string {
  return issues.map((i) => `  - ${formatIssuePath(i.path)}: ${i.message}`).join("\n");
}

export interface DatasetProblem {
  /** JSON kelias, pvz. "packages[3].window". */
  path: string;
  message: string;
}

/** Semantic checks the schema can't express (unique ids, start < end). */
export function datasetProblems(ds: Dataset): DatasetProblem[] {
  const problems: DatasetProblem[] = [];
  const dup = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of new Set(dup(ds.packages.map((p) => p.id)))) {
    problems.push({ path: "packages", message: `pasikartojantis id "${id}"` });
  }
  for (const id of new Set(dup(ds.couriers.map((c) => c.id)))) {
    problems.push({ path: "couriers", message: `pasikartojantis id "${id}"` });
  }
  ds.packages.forEach((p, i) => {
    if (p.window.start >= p.window.end) {
      problems.push({
        path: `packages[${i}].window`,
        message: `${p.id}: pradžia ${p.window.start} nėra prieš pabaigą ${p.window.end}`,
      });
    }
  });
  ds.couriers.forEach((c, i) => {
    if (c.shiftStart >= c.shiftEnd) {
      problems.push({
        path: `couriers[${i}]`,
        message: `${c.id}: pamainos pradžia ${c.shiftStart} nėra prieš pabaigą ${c.shiftEnd}`,
      });
    }
  });
  if (ds.depot.open >= ds.depot.close) {
    problems.push({ path: "depot", message: `atidarymas ${ds.depot.open} nėra prieš uždarymą ${ds.depot.close}` });
  }
  return problems;
}

/**
 * Parses and validates an in-memory value as a Dataset. Throws an Error whose
 * message lists every zod issue (and semantic problem) with its JSON path.
 */
export function parseDataset(value: unknown, source = "duomenys"): Dataset {
  const result = DatasetSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Netinkamas duomenų rinkinys ${source}:\n${formatZodIssues(result.error.issues)}`);
  }
  const problems = datasetProblems(result.data);
  if (problems.length > 0) {
    throw new Error(`Netinkamas duomenų rinkinys ${source}:\n${problems.map((p) => `  - ${p.path}: ${p.message}`).join("\n")}`);
  }
  return result.data;
}

/** Reads a dataset JSON file (path or built-in name, see resolveDatasetPath) and validates it. */
export function loadDataset(path: string): Dataset {
  const file = resolveDatasetPath(path);
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (e) {
    throw new Error(`Nepavyko nuskaityti duomenų failo ${file}: ${(e as Error).message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Duomenų failas ${file} nėra validus JSON: ${(e as Error).message}`);
  }
  return parseDataset(json, file);
}
