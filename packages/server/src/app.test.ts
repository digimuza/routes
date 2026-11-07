import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import {
  ApiErrorSchema,
  CitiesResponseSchema,
  GenerateResponseSchema,
  OptimizeResponseSchema,
  ScenarioSchema,
  type Dataset,
  type Optimizer,
} from "@marsrutai/shared";
import { mockOptimizer } from "@marsrutai/cli/mock";
import { cityById, inCityBounds } from "@marsrutai/cli/generate";
import { createApp } from "./app.js";

const NOW = new Date("2026-11-07T10:00:00Z"); // šeštadienis → kita darbo diena pirmadienis 11-09

function setup(optimizers?: Partial<Record<"api" | "mock", Optimizer>>) {
  const root = mkdtempSync(join(tmpdir(), "marsrutai-server-"));
  const opts = { scenariosDir: join(root, "data", "scenarios"), outRoot: join(root, "out"), optimizers, now: () => NOW };
  const app = createApp(opts);
  const req = (path: string, init?: RequestInit) => app.request(path, init);
  const json = (method: string, path: string, body: unknown) =>
    app.request(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { root, opts, app, req, json };
}

async function expectError(res: Response, status: number, re?: RegExp) {
  assert.equal(res.status, status);
  const body = ApiErrorSchema.parse(await res.json());
  if (re) assert.match(body.error, re);
  return body;
}

test("GET /api/cities", async () => {
  const { req } = setup();
  const res = await req("/api/cities");
  assert.equal(res.status, 200);
  const { cities } = CitiesResponseSchema.parse(await res.json());
  assert.deepEqual(cities.map((c) => c.id), ["vilnius", "kaunas"]);
  for (const c of cities) assert.ok(inCityBounds(c.id, c.depot.location), `${c.id} sandėlis ribose`);
});

test("GET /api/scenario: tuščias scenarijus neįrašomas; nežinomas miestas → 400", async () => {
  const { req, opts } = setup();
  const res = await req("/api/scenario?city=kaunas");
  assert.equal(res.status, 200);
  const ds = ScenarioSchema.parse(await res.json());
  assert.equal(ds.packages.length, 0);
  assert.equal(ds.couriers.length, 10);
  assert.equal(ds.depot.date, "2026-11-09");
  assert.deepEqual(ds.depot.location, cityById("kaunas").depot.location);
  assert.equal(existsSync(join(opts.scenariosDir, "kaunas.json")), false);

  await expectError(await req("/api/scenario?city=riga"), 400, /Nežinomas miestas/);
  await expectError(await req("/api/scenario"), 400, /Nežinomas miestas/);
});

test("POST /api/generate: paketai miesto ribose, seed deterministinis, validacija", async () => {
  const { json } = setup();
  const body = { city: "kaunas", count: 30, mix: { p1: 20, p2: 45, p3: 35 }, seed: 5, existingIds: ["PKG-001"] };
  const a = GenerateResponseSchema.parse(await (await json("POST", "/api/generate", body)).json());
  const b = GenerateResponseSchema.parse(await (await json("POST", "/api/generate", body)).json());
  assert.equal(a.packages.length, 30);
  assert.deepEqual(a, b);
  assert.ok(!a.packages.some((p) => p.id === "PKG-001"));
  for (const p of a.packages) assert.ok(inCityBounds("kaunas", p.location), p.address);
  assert.ok(a.packages.every((p) => p.address.endsWith(", Kaunas")));

  const bad = await expectError(await json("POST", "/api/generate", { city: "kaunas", count: 0, mix: {} }), 400);
  assert.ok(Array.isArray((bad.details as { issues: unknown[] }).issues));
  await expectError(
    await json("POST", "/api/generate", { city: "vilnius", count: 3, mix: { p1: 0, p2: 0, p3: 0 } }),
    400,
    /suma/,
  );
  const notJson = await setup().req("/api/generate", { method: "POST", body: "{nope" });
  await expectError(notJson, 400, /JSON/);
});

async function savedScenario(s: ReturnType<typeof setup>, city: "vilnius" | "kaunas", count: number): Promise<Dataset> {
  const empty = ScenarioSchema.parse(await (await s.req(`/api/scenario?city=${city}`)).json());
  const gen = GenerateResponseSchema.parse(
    await (await s.json("POST", "/api/generate", { city, count, mix: { p1: 20, p2: 45, p3: 35 }, seed: 11 })).json(),
  );
  const ds = { ...empty, packages: gen.packages };
  const res = await s.json("PUT", `/api/scenario?city=${city}`, ds);
  assert.equal(res.status, 200);
  return ScenarioSchema.parse(await res.json());
}

test("PUT /api/scenario: validacija (zod ir unikalūs ID), įrašymas ir GET", async () => {
  const s = setup();
  const ds = await savedScenario(s, "kaunas", 12);
  assert.ok(existsSync(join(s.opts.scenariosDir, "kaunas.json")));
  assert.deepEqual(ScenarioSchema.parse(await (await s.req("/api/scenario?city=kaunas")).json()), ds);

  const dup = structuredClone(ds);
  dup.packages[1]!.id = dup.packages[0]!.id;
  dup.packages[2]!.window = { start: "12:00", end: "11:00" };
  const e1 = await expectError(await s.json("PUT", "/api/scenario?city=kaunas", dup), 400, /Netinkamas scenarijus/);
  const issues = (e1.details as { issues: { path: string; message: string }[] }).issues;
  assert.ok(issues.some((i) => i.path === "packages" && /pasikartojantis/.test(i.message)));
  assert.ok(issues.some((i) => i.path === "packages[2].window"));

  const broken = structuredClone(ds) as unknown as { packages: { priority: number }[] };
  broken.packages[0]!.priority = 7;
  const e2 = await expectError(await s.json("PUT", "/api/scenario?city=kaunas", broken), 400);
  assert.ok((e2.details as { issues: { path: string }[] }).issues.some((i) => i.path === "packages[0].priority"));
  // nepavykęs PUT nepakeitė failo
  assert.deepEqual(ScenarioSchema.parse(await (await s.req("/api/scenario?city=kaunas")).json()), ds);
});

test("POST /api/optimize (mock): plan.json, summary, PDF, ZIP, /out, /api/plan", async () => {
  const s = setup();
  // be paketų → 400
  await expectError(await s.json("POST", "/api/optimize", { city: "vilnius", mode: "mock" }), 400, /nėra paketų/);
  await expectError(await s.json("POST", "/api/optimize", { city: "vilnius", mode: "x" }), 400);
  await expectError(await s.req("/api/plan?city=kaunas"), 404, /dar nėra/);
  await expectError(await s.req("/api/pdfs.zip?city=kaunas"), 404);

  const ds = await savedScenario(s, "kaunas", 25);
  const res = await s.json("POST", "/api/optimize", { city: "kaunas", mode: "mock" });
  assert.equal(res.status, 200);
  const out = OptimizeResponseSchema.parse(await res.json());
  assert.equal(out.plan.mode, "mock");
  assert.equal(out.plan.dataset.packages.length, 25);
  assert.equal(out.planUrl, "/out/kaunas/plan.json");
  assert.equal(out.zipUrl, "/api/pdfs.zip?city=kaunas");
  assert.deepEqual(out.pdfs.map((p) => p.courierId), ds.couriers.map((c) => c.id));
  assert.equal(out.pdfs[0]!.url, "/out/kaunas/courier-01-tomas-kazlauskas.pdf");

  const dir = join(s.opts.outRoot, "kaunas");
  for (const f of ["plan.json", "summary.md", "pdfs.zip"]) assert.ok(existsSync(join(dir, f)), f);
  assert.equal(readdirSync(dir).filter((f) => f.endsWith(".pdf")).length, ds.couriers.length);

  const pdf = await s.req(out.pdfs[0]!.url);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
  const plan = await s.req(out.planUrl);
  assert.match(plan.headers.get("content-type")!, /application\/json/);

  const zipRes = await s.req(out.zipUrl);
  assert.equal(zipRes.status, 200);
  assert.equal(zipRes.headers.get("content-type"), "application/zip");
  assert.match(zipRes.headers.get("content-disposition")!, /attachment/);
  const entries = unzipSync(new Uint8Array(await zipRes.arrayBuffer()));
  assert.deepEqual(Object.keys(entries).sort(), out.pdfs.map((p) => p.url.split("/").pop()!).sort());

  // GET /api/plan: iš atminties ir (nauja instancija) iš disko
  const cached = OptimizeResponseSchema.parse(await (await s.req("/api/plan?city=kaunas")).json());
  assert.deepEqual(cached, out);
  const fresh = createApp(s.opts);
  const rebuilt = OptimizeResponseSchema.parse(await (await fresh.request("/api/plan?city=kaunas")).json());
  assert.deepEqual(rebuilt.plan, out.plan);
  assert.deepEqual(rebuilt.pdfs, out.pdfs);
  assert.equal(rebuilt.durationMs, 0);

  // Ištrynus kurjerį, jo senas PDF dingsta
  const fewer = { ...ds, couriers: ds.couriers.slice(0, 3) };
  assert.equal((await s.json("PUT", "/api/scenario?city=kaunas", fewer)).status, 200);
  const out2 = OptimizeResponseSchema.parse(
    await (await s.json("POST", "/api/optimize", { city: "kaunas", mode: "mock" })).json(),
  );
  assert.equal(out2.pdfs.length, 3);
  assert.equal(readdirSync(dir).filter((f) => f.endsWith(".pdf")).length, 3);
});

test("/out: be directory traversal, 404 kaip ApiError", async () => {
  const s = setup();
  writeFileSync(join(s.root, "secret.txt"), "slapta");
  for (const p of ["/out/..%2fsecret.txt", "/out/%2e%2e/secret.txt", "/out/kaunas/..%2f..%2fsecret.txt", "/out/nera.pdf", "/out/"]) {
    const res = await s.req(p);
    assert.equal(res.status, 404, p);
    ApiErrorSchema.parse(await res.json());
  }
  await expectError(await s.req("/api/nera"), 404);
});

test("API režimo klaida → 502 su patarimu; optimizavimai mieste vykdomi nuosekliai", async () => {
  let running = 0;
  let maxRunning = 0;
  const slowMock: Optimizer = {
    name: "mock",
    async optimize(ds) {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 30));
      running--;
      return mockOptimizer.optimize(ds);
    },
  };
  const failingApi: Optimizer = {
    name: "api",
    async optimize() {
      throw Object.assign(new Error("Route Optimization API klaida HTTP 403: PERMISSION_DENIED billing"), { status: 403 });
    },
  };
  const s = setup({ api: failingApi, mock: slowMock });
  await savedScenario(s, "vilnius", 8);

  const err = await expectError(await s.json("POST", "/api/optimize", { city: "vilnius", mode: "api" }), 502, /Google/);
  const details = err.details as { hint: string; status: number };
  assert.match(details.hint, /gcloud auth application-default login/);
  assert.equal(details.status, 403);

  const results = await Promise.all(
    [0, 1, 2].map(() => s.json("POST", "/api/optimize", { city: "vilnius", mode: "mock" })),
  );
  assert.deepEqual(results.map((r) => r.status), [200, 200, 200]);
  assert.equal(maxRunning, 1);
});
