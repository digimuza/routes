// Paleidimas: npm run dev (serveris + Vite) arba npm run start (sukompiliuotas dashboard + API
// vienu adresu). PORT – numatyta 8787.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { Hono } from "hono";
import { findRepoRoot } from "@marsrutai/cli/load";
import { createApp } from "./app.js";

const root = findRepoRoot();
const port = Number(process.env.PORT) || 8787;

const app = new Hono();
app.use(logger());
app.route("/", createApp({ scenariosDir: join(root, "data", "scenarios"), outRoot: join(root, "out") }));

// Sukompiliuotas dashboard (npm run build) – servuojamas iš to paties adreso, jei yra.
const dist = join(root, "packages", "dashboard", "dist");
const hasDashboard = existsSync(join(dist, "index.html"));
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
if (hasDashboard) {
  app.get("*", async (c) => {
    const path = c.req.path;
    if (path.startsWith("/api/") || path.startsWith("/out/")) return c.notFound();
    const file = normalize(join(dist, decodeURIComponent(path)));
    const inside = file.startsWith(dist + sep) && extname(file) !== "";
    const target = inside && existsSync(file) ? file : join(dist, "index.html");
    const body = await readFile(target);
    const immutable = target.includes(`${sep}assets${sep}`);
    return c.body(body, 200, {
      "Content-Type": TYPES[extname(target)] ?? "application/octet-stream",
      "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    });
  });
}

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Maršrutų serveris: http://localhost:${info.port}  (API /api/*, rezultatai /out/*)`);
  console.log(
    hasDashboard
      ? `Dashboard: http://localhost:${info.port}`
      : "Dashboard nesukompiliuotas – paleiskite npm run start (arba npm run dev).",
  );
});

// Užimtas prievadas: jei ten jau veikia šis demo – pasakome adresą, kitaip – kaip pakeisti prievadą.
server.on("error", async (err: NodeJS.ErrnoException) => {
  if (err.code !== "EADDRINUSE") throw err;
  let ours = false;
  try {
    const res = await fetch(`http://localhost:${port}/api/cities`, { signal: AbortSignal.timeout(2000) });
    ours = res.ok && JSON.stringify(await res.json()).includes("vilnius");
  } catch {
    ours = false;
  }
  if (ours) {
    console.log(`\nDemo jau veikia: http://localhost:${port}  (antrą kartą paleisti nereikia).`);
    console.log(`Norėdami paleisti iš naujo, sustabdykite seną procesą:  lsof -ti tcp:${port} | xargs kill`);
    process.exit(0);
  }
  console.error(`\nPrievadas ${port} užimtas kitos programos. Paleiskite kitu prievadu, pvz.:  PORT=8788 npm run start`);
  process.exit(1);
});
