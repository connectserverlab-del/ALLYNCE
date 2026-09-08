#!/usr/bin/env node
/**
 * Zero-dependency static server for the web client.
 *
 *   npm run web
 *
 * The client is plain ES modules and fetches the JSON in data/ directly, so it needs
 * no build step — only an HTTP origin, which is what this provides.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 5173);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".woff2": "font/woff2", ".map": "application/json",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let path = decodeURIComponent(url.pathname);
    if (path === "/") path = "/web/index.html";
    // Contain every request inside the repository root.
    const target = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
    if (!target.startsWith(ROOT)) { res.writeHead(403).end("Forbidden"); return; }

    const info = await stat(target).catch(() => null);
    if (!info || info.isDirectory()) { res.writeHead(404).end("Not found"); return; }

    const body = await readFile(target);
    res.writeHead(200, {
      "content-type": TYPES[extname(target)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    }).end(body);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

server.listen(PORT, () => {
  console.log(`ALLYNCE client:  http://localhost:${PORT}/web/index.html`);
});
