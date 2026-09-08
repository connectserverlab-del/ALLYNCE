#!/usr/bin/env node
/**
 * Compile the holding engine for the browser.
 *
 * The Hold screen is interactive: the player drags a building to another plot, raises it against its
 * prerequisites, buys a card border and merges duplicates. Every one of those is a rule with a real
 * implementation in `core/src/kingdom.ts` and `core/src/cosmetics.ts`, so the page runs those rather
 * than a second copy of them in the template. This bundles `web/sample/hold-boot.mts` into one IIFE
 * that `scripts/build-sample.mjs` inlines into the page under `window.HOLD`.
 *
 *     node scripts/bundle-hold.mjs out.js
 *
 * Nothing is reimplemented in the template. If a hold on the page behaves differently from a hold in
 * `core/tests/hold.test.ts`, the bundle is stale.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";
import esbuild from "esbuild";
import { gamedataPlugin } from "./gamedata-plugin.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
if (!out) { console.error("usage: bundle-hold.mjs <out.js>"); process.exit(1); }

await esbuild.build({
  entryPoints: [resolve(ROOT, "web/sample/hold-boot.mts")],
  bundle: true, format: "iife", globalName: "HOLD", platform: "browser",
  target: "es2020", minify: true, legalComments: "none",
  loader: { ".json": "json" },
  plugins: [gamedataPlugin(ROOT)],
  outfile: out,
});
console.log(`bundled hold engine (${(statSync(out).size / 1e3).toFixed(0)} kB)`);
