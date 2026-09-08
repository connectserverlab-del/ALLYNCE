#!/usr/bin/env node
/**
 * Compile the deck rules engine for the browser.
 *
 * The Deck and Rites screens let the owner sleeve and pull cards in the page, and every add or remove
 * has to be checked against real legality, not a copy of it. This bundles `web/sample/cards-boot.mts` —
 * the registry and `validateDeck` — into one IIFE that `scripts/build-sample.mjs` inlines under
 * `window.CARDS`, the same pattern `bundle-march.mjs` uses for the march engine.
 *
 *     node scripts/bundle-cards.mjs out.js
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";
import esbuild from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
if (!out) { console.error("usage: bundle-cards.mjs <out.js>"); process.exit(1); }

await esbuild.build({
  entryPoints: [resolve(ROOT, "web/sample/cards-boot.mts")],
  bundle: true, format: "iife", globalName: "CARDS", platform: "browser",
  target: "es2020", minify: true, legalComments: "none",
  loader: { ".json": "json" },
  outfile: out,
});
console.log(`bundled cards engine (${(statSync(out).size / 1e3).toFixed(0)} kB)`);
