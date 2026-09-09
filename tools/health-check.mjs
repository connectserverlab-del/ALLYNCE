#!/usr/bin/env node
/**
 * Project health check.
 *
 *   npm run check
 *
 * Runs everything that can silently rot: generated data drifting from the authored rosters,
 * the type check, the rules tests, the browser checks and the cut-out art audit. Intended for CI
 * and for the scheduled routine; safe to run locally at any time.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const results = [];

const digest = (p) => {
  try { return createHash("sha256").update(readFileSync(resolve(ROOT, p))).digest("hex"); }
  catch { return "missing"; }
};

function step(name, fn) {
  process.stdout.write(`\n── ${name}\n`);
  try {
    fn();
    results.push([name, true, ""]);
  } catch (err) {
    const detail = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "") || String(err.message ?? err);
    process.stdout.write(detail.slice(-2000));
    results.push([name, false, detail.split("\n").filter(Boolean).slice(-1)[0] ?? ""]);
  }
}

const run = (args, opts = {}) =>
  execFileSync(npm, args, { cwd: ROOT, stdio: "inherit", ...opts });

/* Generated data must match what the authored rosters produce right now. */
step("generated data is in sync with tools/content", () => {
  const before = ["data/units/expansion.json", "data/abilities/expansion.json", "data/factions/factions.json"].map(digest);
  run(["run", "gen:content"]);
  const after = ["data/units/expansion.json", "data/abilities/expansion.json", "data/factions/factions.json"].map(digest);
  if (before.join() !== after.join()) {
    throw new Error("data/ is out of date — run `npm run gen:content` and commit the result");
  }
});

step("typecheck", () => run(["run", "typecheck"]));
step("rules tests", () => run(["test"]));
step("browser checks", () => run(["run", "test:ui"]));

/* The single-page build has always refused to write a file over 16 MB — the artifact ceiling it has
   to fit under — but nothing ever ran it: `build:standalone` is in neither this script nor CI, so
   the budget guarded a command a person had to remember to type. It matters because the page only
   fits by thumbnailing the plates, and thumbnailing is the step that degrades quietly: when
   Playwright is missing the build embeds the originals instead and produces 28 MB, which the
   ceiling catches and no one sees. Running it here is what makes the refusal mean anything. */
step("standalone page budget", () => run(["run", "build:standalone"]));

/* Every cut-out asset must actually have been cut. A plate that kept its background or lost its
   subject is a file the registry happily counts as present: one fully opaque unit cutout sat on the
   deck screen for several passes, and cutting the approved building plates against a pale ground
   once ate them outright. Arithmetic catches both; the eye did not. */
step("cutouts", () => execFileSync("python3", [resolve(ROOT, "scripts/audit-cutouts.py")], { cwd: ROOT, stdio: "inherit" }));

/* Roster invariants worth watching as content grows. */
step("roster invariants", () => {
  const core = JSON.parse(readFileSync(resolve(ROOT, "data/units/units.json"), "utf8"));
  const expansion = JSON.parse(readFileSync(resolve(ROOT, "data/units/expansion.json"), "utf8"));
  const units = [...core, ...expansion];
  const problems = [];
  // The Ascendant convention (an explicit one-copy limit and a named signature) is the expansion's.
  // The hand-authored ten-stars predate it and hold the same line through `unique`, which
  // composition already enforces, so each roster is checked against its own rule.
  const ten = expansion.filter((u) => u.stars === 10);
  for (const u of ten) {
    if (u.uniqueLimit !== 1) problems.push(`${u.id}: ten-star without a one-copy limit`);
    if (!u.signature) problems.push(`${u.id}: ten-star without a signature ability`);
  }
  for (const u of core.filter((u) => u.stars === 10)) {
    if (!u.unique) problems.push(`${u.id}: hand-authored ten-star that is not unique`);
  }
  for (const a of units.filter((u) => u.faction === "ANG")) {
    if (!a.flying) problems.push(`${a.id}: angel that does not fly`);
    if (a.keywords?.includes("Archangel") && a.uniqueLimit !== 1) problems.push(`${a.id}: archangel without a one-copy limit`);
  }
  // Every unit needs an explicit star. `stars` is optional on the type and every consumer reads it
  // as `stars ?? 1`, so an omission is not an error anywhere — it quietly files the unit as a
  // one-star. Six core units had no star at all, which put four siege pieces and two unique Elite
  // riders (1900-2300 attack) into the Muster Call's one-star pool, the most common roll on the
  // cheapest banner, against a real one-star ceiling of 1100. Nothing failed; the roster just lied.
  for (const u of units) {
    if (u.stars === undefined) problems.push(`${u.id}: no star rating (every consumer would read it as a one-star)`);
  }
  const ids = units.map((u) => u.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) problems.push(`duplicate unit ids: ${[...new Set(dupes)].join(", ")}`);
  if (problems.length) throw new Error(problems.join("\n"));
  console.log(`  ${units.length} units, ${ten.length} Ascendants, all invariants hold`);
});

/* ------------------------------------------------------------------ report */
console.log("\n────────── summary ──────────");
for (const [name, ok, detail] of results) console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail && !ok ? ` — ${detail}` : ""}`);
const failed = results.filter(([, ok]) => !ok);
process.exit(failed.length ? 1 : 0);
