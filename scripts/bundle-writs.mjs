#!/usr/bin/env node
/**
 * Compile the wanted-board engine for the browser.
 *
 * The Writs screen is baked like most of the sample page, but taking or giving back a warrant is a
 * decision made in the page, so `core/src/wanted.ts` travels into the browser the same way
 * `core/src/march.ts` does for the March screen. This bundles `web/sample/writs-boot.mts` — the
 * engine and its data — into one IIFE that `scripts/build-sample.mjs` inlines under `window.WRITS`.
 *
 *     node scripts/bundle-writs.mjs out.js
 *
 * If a warrant on the page behaves differently from one in `core/tests/wanted.test.ts`, the bundle is stale.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";
import esbuild from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
if (!out) { console.error("usage: bundle-writs.mjs <out.js>"); process.exit(1); }

await esbuild.build({
  entryPoints: [resolve(ROOT, "web/sample/writs-boot.mts")],
  bundle: true, format: "iife", globalName: "WRITS", platform: "browser",
  target: "es2020", minify: true, legalComments: "none",
  loader: { ".json": "json" },
  outfile: out,
});
console.log(`bundled writs engine (${(statSync(out).size / 1e3).toFixed(0)} kB)`);
