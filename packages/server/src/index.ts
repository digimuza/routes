// Paleidimas: npm run dev:server (arba kartu su dashboard: npm run dev). PORT – numatyta 8787.
import { join } from "node:path";
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

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Maršrutų serveris: http://localhost:${info.port}  (API /api/*, rezultatai /out/*)`);
});
