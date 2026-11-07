import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "../..");

/** Lokalus serveris (packages/server), SPEC 5b. */
const API_TARGET = process.env.MARSRUTAI_API ?? "http://localhost:8787";

const proxy: Record<string, ProxyOptions> = {
  "/api": { target: API_TARGET, changeOrigin: true },
  "/out": { target: API_TARGET, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy,
    // leidžiama skaityti bendrų tipų paketą ir fixtures (mock režimui)
    fs: { allow: [repoRoot] },
  },
  preview: { proxy },
});
