#!/usr/bin/env node
/**
 * Build the standalone sample page.
 *
 * The page has to open from a file:// path with nothing beside it, so every painting, frame, icon
 * and star is inlined as a data URI and the exported game state is inlined as JSON. Three steps:
 *
 *   1. `scripts/pack-sample-assets.py` reads the art off disk, downscales each class of asset to
 *      the size the page actually draws it at, and encodes it.
 *   1b. `scripts/bundle-march.mjs` compiles the march engine for the browser. The March screen is the
 *      one screen that cannot be a snapshot — the user chooses where a squad walks — so it runs the
 *      real `core/src/march.ts` in the page rather than replaying a recording.
 *   1c. `scripts/bundle-writs.mjs` compiles the wanted-board engine for the browser, so taking or
 *      giving back a warrant on the Writs screen runs the real `core/src/wanted.ts` instead of a
 *      second copy of it living in the template.
 *   2. Run `web/sample/data.mts` under tsx, which drives the real engine — a holding, a battle
 *      mid-activation, a deck, a warrant board — and writes the state as JSON.
 *   3. Substitute all into `web/sample/template.html` and write `docs/samples/ashfall-hold.html`.
 *
 *     node scripts/build-sample.mjs
 *
 * Nothing here invents game state. If a number on the page looks wrong, it is wrong in the engine.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...xs) => join(ROOT, ...xs);

const scratch = mkdtempSync(join(tmpdir(), "allynce-sample-"));
const statePath = join(scratch, "state.json");
const assetPath = join(scratch, "assets.json");
const marchPath = join(scratch, "march.js");
const writsPath = join(scratch, "writs.js");
try {
  execFileSync("python3", [p("scripts/pack-sample-assets.py"), assetPath], { cwd: ROOT, stdio: "inherit" });
  execFileSync("node", [p("scripts/bundle-march.mjs"), marchPath], { cwd: ROOT, stdio: "inherit" });
  execFileSync("node", [p("scripts/bundle-writs.mjs"), writsPath], { cwd: ROOT, stdio: "inherit" });
  execFileSync("npx", ["tsx", p("web/sample/data.mts"), statePath], { cwd: ROOT, stdio: "inherit" });
  const html = readFileSync(p("web/sample/template.html"), "utf8")
    .replace("__DATA__", () => readFileSync(statePath, "utf8"))
    .replace("__ASSETS__", () => readFileSync(assetPath, "utf8"))
    .replace("__MARCH_ENGINE__", () => readFileSync(marchPath, "utf8"))
    .replace("__WRITS_ENGINE__", () => readFileSync(writsPath, "utf8"));
  const out = p("docs/samples/ashfall-hold.html");
  writeFileSync(out, html);
  console.log(`wrote ${out} (${(html.length / 1e6).toFixed(1)} MB)`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
