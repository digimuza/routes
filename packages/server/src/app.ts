// Lokalus demo serveris (SPEC 5b): scenarijų redaktoriaus API + statiniai rezultatai iš out/.
// Kontraktas: packages/shared/src/api.ts.
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  CityId,
  GenerateRequestSchema,
  OptimizeRequestSchema,
  PlanSchema,
  ScenarioSchema,
  courierPdfFileName,
  outDirForCity,
  type CitiesResponse,
  type Dataset,
  type GenerateResponse,
  type OptimizeResponse,
  type Optimizer,
  type Plan,
} from "@marsrutai/shared";
import { apiOptimizer } from "@marsrutai/cli/api";
import { CITIES, emptyScenario, generatePackages } from "@marsrutai/cli/generate";
import { datasetProblems, formatIssuePath } from "@marsrutai/cli/load";
import { mockOptimizer } from "@marsrutai/cli/mock";
import { renderAllPdfs } from "@marsrutai/cli/pdf";
import { summaryMarkdown } from "@marsrutai/cli/summary";
import { HttpError, badRequest, notFound } from "./errors.js";
import { writeZip } from "./zip.js";

export interface AppOptions {
  /** Katalogas scenarijams, numatyta <repo>/data/scenarios. */
  scenariosDir: string;
  /** Rezultatų šaknis, numatyta <repo>/out (miestui – <out>/<city>/). */
  outRoot: string;
  /** Testams galima pakeisti optimizatorius. */
  optimizers?: Partial<Record<"api" | "mock", Optimizer>>;
  /** Laikrodis tuščio scenarijaus datai (testams). */
  now?: () => Date;
}

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".html": "text/html; charset=utf-8",
};

const API_HINT =
  "Patikrinkite prisijungimą (`gcloud auth application-default login` ir " +
  "`gcloud auth application-default set-quota-project marsrutai-digimuza`), ar projekte įjungtas billing " +
  "ir routeoptimization.googleapis.com, arba rinkitės režimą „Mock“.";

const issuesOf = (issues: { path: (string | number)[]; message: string }[]) =>
  issues.map((i) => ({ path: formatIssuePath(i.path), message: i.message }));

function parseCity(raw: string | undefined): CityId {
  const r = CityId.safeParse(raw);
  if (!r.success) {
    throw badRequest(`Nežinomas miestas „${raw ?? ""}“. Galimi: ${CityId.options.join(", ")}.`);
  }
  return r.data;
}

async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw badRequest("Užklausos turinys nėra validus JSON.");
  }
}

/** Scenarijus: zod schema + papildomos patikros (unikalūs ID, pradžia < pabaiga). */
function validateScenario(value: unknown, what = "Netinkamas scenarijus"): Dataset {
  const r = ScenarioSchema.safeParse(value);
  if (!r.success) throw badRequest(`${what}: ${r.error.issues.length} klaid.`, { issues: issuesOf(r.error.issues) });
  const problems = datasetProblems(r.data);
  if (problems.length) throw badRequest(`${what}: ${problems.length} klaid.`, { issues: problems });
  return r.data;
}

async function writeAtomic(file: string, data: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, data, "utf8");
  await rename(tmp, file);
}

const isMissing = (e: unknown) => (e as NodeJS.ErrnoException)?.code === "ENOENT";

export function createApp(opts: AppOptions) {
  const outRoot = resolve(opts.outRoot);
  const scenariosDir = resolve(opts.scenariosDir);
  const optimizers: Record<"api" | "mock", Optimizer> = {
    api: opts.optimizers?.api ?? apiOptimizer,
    mock: opts.optimizers?.mock ?? mockOptimizer,
  };
  const now = opts.now ?? (() => new Date());

  const cityOut = (city: CityId) => join(outRoot, city);
  const scenarioFile = (city: CityId) => join(scenariosDir, `${city}.json`);
  /** Paskutiniai optimizavimo atsakymai (durationMs neišsaugomas diske). */
  const lastResponses = new Map<CityId, OptimizeResponse>();
  /** Vienu metu vienas optimizavimas miestui. */
  const locks = new Map<CityId, Promise<unknown>>();

  function serialized<T>(city: CityId, fn: () => Promise<T>): Promise<T> {
    const prev = locks.get(city) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    locks.set(city, next.catch(() => undefined));
    return next;
  }

  async function loadScenario(city: CityId): Promise<Dataset> {
    let raw: string;
    try {
      raw = await readFile(scenarioFile(city), "utf8");
    } catch (e) {
      if (isMissing(e)) return emptyScenario(city, now());
      throw e;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      throw new HttpError(500, `Išsaugotas scenarijus ${city}.json nėra validus JSON – išsaugokite scenarijų iš naujo.`, {
        message: (e as Error).message,
      });
    }
    try {
      return validateScenario(json, `Išsaugotas scenarijus ${city}.json netinkamas`);
    } catch (e) {
      if (e instanceof HttpError) throw new HttpError(500, e.message, e.details);
      throw e;
    }
  }

  function buildResponse(city: CityId, plan: Plan, durationMs: number): OptimizeResponse {
    const base = `/${outDirForCity(city)}`;
    return {
      plan,
      pdfs: plan.dataset.couriers.map((c, i) => ({ courierId: c.id, url: `${base}/${courierPdfFileName(i, c.name)}` })),
      planUrl: `${base}/plan.json`,
      zipUrl: `/api/pdfs.zip?city=${city}`,
      durationMs,
    };
  }

  async function optimize(city: CityId, mode: "api" | "mock"): Promise<OptimizeResponse> {
    const t0 = Date.now();
    const dataset = await loadScenario(city);
    if (dataset.packages.length === 0) {
      throw badRequest("Scenarijuje nėra paketų – sugeneruokite arba pridėkite paketų žemėlapyje ir išsaugokite scenarijų.");
    }
    if (dataset.couriers.length === 0) throw badRequest("Scenarijuje nėra kurjerių – pridėkite bent vieną kurjerį.");

    let plan: Plan;
    try {
      plan = await optimizers[mode].optimize(dataset);
    } catch (e) {
      const message = (e as Error)?.message ?? String(e);
      if (mode === "api") {
        const status = (e as { status?: number }).status;
        throw new HttpError(502, `Google Route Optimization API klaida: ${message.split("\n")[0]}`, {
          hint: API_HINT,
          ...(status !== undefined ? { status } : {}),
          message,
        });
      }
      throw new HttpError(500, `Mock optimizatoriaus klaida: ${message}`);
    }

    const dir = cityOut(city);
    await mkdir(dir, { recursive: true });
    // Seni PDF ir ZIP šalinami, kad neliktų ištrintų / pervadintų kurjerių failų.
    for (const f of await readdir(dir)) {
      if ((f.startsWith("courier-") && f.endsWith(".pdf")) || f === "pdfs.zip") await rm(join(dir, f), { force: true });
    }
    await writeAtomic(join(dir, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
    await writeAtomic(join(dir, "summary.md"), summaryMarkdown(plan));
    const files = await renderAllPdfs(plan, dir);
    await writeZip(files, join(dir, "pdfs.zip"));

    const response = buildResponse(city, plan, Date.now() - t0);
    lastResponses.set(city, response);
    return response;
  }

  async function sendFile(c: Context, file: string, extraHeaders: Record<string, string> = {}) {
    let st;
    try {
      st = await stat(file);
    } catch (e) {
      if (isMissing(e)) return null;
      throw e;
    }
    if (!st.isFile()) return null;
    const type = CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
    const body = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
    return c.body(body, 200, {
      "Content-Type": type,
      "Content-Length": String(st.size),
      // Failai perrašomi kiekvieno optimizavimo metu – naršyklė turi pertikrinti.
      "Cache-Control": "no-cache",
      ...extraHeaders,
    });
  }

  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json(err.toJSON(), err.status);
    console.error(err);
    return c.json({ error: "Vidinė serverio klaida.", details: { message: (err as Error).message } }, 500);
  });
  app.notFound((c) => c.json({ error: `Nerasta: ${c.req.method} ${c.req.path}` }, 404));

  app.get("/api/cities", (c) => c.json({ cities: CITIES } satisfies CitiesResponse));

  app.get("/api/scenario", async (c) => {
    const city = parseCity(c.req.query("city"));
    return c.json(await loadScenario(city));
  });

  app.put(
    "/api/scenario",
    bodyLimit({
      maxSize: 5 * 1024 * 1024,
      onError: () => {
        throw new HttpError(413, "Scenarijus per didelis (daugiau nei 5 MB).");
      },
    }),
    async (c) => {
      const city = parseCity(c.req.query("city"));
      const dataset = validateScenario(await readJsonBody(c));
      await mkdir(scenariosDir, { recursive: true });
      await writeAtomic(scenarioFile(city), JSON.stringify(dataset, null, 2) + "\n");
      return c.json(dataset);
    },
  );

  app.post("/api/generate", async (c) => {
    const r = GenerateRequestSchema.safeParse(await readJsonBody(c));
    if (!r.success) throw badRequest("Netinkama generavimo užklausa.", { issues: issuesOf(r.error.issues) });
    const { mix } = r.data;
    if (mix.p1 + mix.p2 + mix.p3 <= 0) {
      throw badRequest("Prioritetų pasiskirstymo suma turi būti didesnė už 0 (pvz. 20 / 45 / 35).");
    }
    return c.json({ packages: generatePackages(r.data) } satisfies GenerateResponse);
  });

  app.post("/api/optimize", async (c) => {
    const r = OptimizeRequestSchema.safeParse(await readJsonBody(c));
    if (!r.success) throw badRequest("Netinkama optimizavimo užklausa.", { issues: issuesOf(r.error.issues) });
    const { city, mode } = r.data;
    return c.json(await serialized(city, () => optimize(city, mode)));
  });

  app.get("/api/plan", async (c) => {
    const city = parseCity(c.req.query("city"));
    const cached = lastResponses.get(city);
    if (cached) return c.json(cached);
    let raw: string;
    try {
      raw = await readFile(join(cityOut(city), "plan.json"), "utf8");
    } catch (e) {
      if (isMissing(e)) throw notFound(`Miestui „${city}“ dar nėra sudaryto plano.`);
      throw e;
    }
    const parsed = PlanSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new HttpError(500, `Išsaugotas planas ${outDirForCity(city)}/plan.json netinkamas.`, {
        issues: issuesOf(parsed.error.issues),
      });
    }
    return c.json(buildResponse(city, parsed.data, 0));
  });

  app.get("/api/pdfs.zip", async (c) => {
    const city = parseCity(c.req.query("city"));
    const res = await sendFile(c, join(cityOut(city), "pdfs.zip"), {
      "Content-Disposition": `attachment; filename="marsrutai-${city}-pdf.zip"`,
    });
    if (!res) throw notFound(`Miestui „${city}“ dar nėra PDF – pirmiausia sudarykite maršrutus.`);
    return res;
  });

  app.get("/out/*", async (c) => {
    let rel: string;
    try {
      rel = decodeURIComponent(c.req.path.slice("/out/".length));
    } catch {
      throw badRequest("Netinkamas kelias.");
    }
    const file = resolve(outRoot, rel);
    // Jokio išėjimo už out/ ribų (../, %2e%2e, absoliutūs keliai, NUL).
    if (rel.includes("\0") || !file.startsWith(outRoot + sep)) throw notFound(`Nerasta: ${c.req.path}`);
    const res = await sendFile(c, file);
    if (!res) throw notFound(`Nerasta: ${c.req.path}`);
    return res;
  });

  return app;
}
