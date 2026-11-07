import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "../..");
/** CLI rezultatų katalogas: <repo>/out */
const outDir = resolve(repoRoot, "out");

const MIME: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".html": "text/html; charset=utf-8",
};

/** Servuoja <repo>/out kaip /out/* (dev ir preview), visada skaito "gyvai" iš disko. */
function serveOut(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url) return next();
    const url = new URL(req.url, "http://x");
    if (!url.pathname.startsWith("/out/")) return next();
    let rel: string;
    try {
      rel = decodeURIComponent(url.pathname.slice("/out/".length));
    } catch {
      res.statusCode = 400;
      return res.end("Bad request");
    }
    const file = resolve(outDir, rel);
    if (file !== outDir && !file.startsWith(outDir + sep)) {
      res.statusCode = 403;
      return res.end("Forbidden");
    }
    let size: number;
    try {
      const st = statSync(file);
      if (!st.isFile()) throw new Error("not a file");
      size = st.size;
    } catch {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end(`Nerasta: /out/${rel}`);
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[extname(file).toLowerCase()] ?? "application/octet-stream");
    res.setHeader("Content-Length", String(size));
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  };
}

function outDirPlugin(): Plugin {
  return {
    name: "marsrutai-serve-out",
    configureServer(server) {
      server.middlewares.use(serveOut());
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveOut());
    },
  };
}

export default defineConfig({
  plugins: [react(), outDirPlugin()],
  server: {
    // leidžiama skaityti bendrų tipų paketą ir pavyzdinį planą
    fs: { allow: [repoRoot] },
  },
});
