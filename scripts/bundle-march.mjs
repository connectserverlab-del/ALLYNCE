#!/usr/bin/env node
/**
 * Compile the march engine for the browser.
 *
 * The march screen runs the real engine rather than replaying a recording, because the user picks the
 * destination and the walk has to be computed against it. This bundles `web/sample/march-boot.mts` — the
 * engine, the map generator and the data JSON — into one IIFE that `scripts/build-sample.mjs` inlines
 * into the page under `window.MARCH`.
 *
 *     node scripts/bundle-march.mjs out.js
 *
 * Nothing is reimplemented in the template. If a march on the page behaves differently from a march in
 * `core/tests/march.test.ts`, the bundle is stale.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";
import esbuild from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
if (!out) { console.error("usage: bundle-march.mjs <out.js>"); process.exit(1); }

await esbuild.build({
  entryPoints: [resolve(ROOT, "web/sample/march-boot.mts")],
  bundle: true, format: "iife", globalName: "MARCH", platform: "browser",
  target: "es2020", minify: true, legalComments: "none",
  loader: { ".json": "json" },
  outfile: out,
});
console.log(`bundled march engine (${(statSync(out).size / 1e3).toFixed(0)} kB)`);
