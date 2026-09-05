#!/usr/bin/env node
/**
 * Build the standalone sample page.
 *
 * The page has to open from a file:// path with nothing beside it, so every painting, frame, icon
 * and star is inlined as a data URI and the exported game state is inlined as JSON. Three steps:
 *
 *   1. `scripts/pack-sample-assets.py` reads the art off disk, downscales each class of asset to
 *      the size the page actually draws it at, and encodes it.
 *   2. Run `web/sample/data.mts` under tsx, which drives the real engine — a holding, a battle
 *      mid-activation, a deck, a warrant board — and writes the state as JSON.
 *   3. Substitute both into `web/sample/template.html` and write `docs/samples/ashfall-hold.html`.
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
try {
  execFileSync("python3", [p("scripts/pack-sample-assets.py"), assetPath], { cwd: ROOT, stdio: "inherit" });
  execFileSync("npx", ["tsx", p("web/sample/data.mts"), statePath], { cwd: ROOT, stdio: "inherit" });
  const html = readFileSync(p("web/sample/template.html"), "utf8")
    .replace("__DATA__", () => readFileSync(statePath, "utf8"))
    .replace("__ASSETS__", () => readFileSync(assetPath, "utf8"));
  const out = p("docs/samples/ashfall-hold.html");
  writeFileSync(out, html);
  console.log(`wrote ${out} (${(html.length / 1e6).toFixed(1)} MB)`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
