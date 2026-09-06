#!/usr/bin/env node
/**
 * Project health check.
 *
 *   npm run check
 *
 * Runs everything that can silently rot: generated data drifting from the authored rosters,
 * the type check, the rules tests and the browser checks. Intended for CI and for the
 * scheduled routine; safe to run locally at any time.
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

/* Roster invariants worth watching as content grows. */
step("roster invariants", () => {
  const units = [
    ...JSON.parse(readFileSync(resolve(ROOT, "data/units/units.json"), "utf8")),
    ...JSON.parse(readFileSync(resolve(ROOT, "data/units/expansion.json"), "utf8")),
  ];
  const problems = [];
  const ten = units.filter((u) => u.stars === 10);
  for (const u of ten) {
    if (u.uniqueLimit !== 1) problems.push(`${u.id}: ten-star without a one-copy limit`);
    if (!u.signature) problems.push(`${u.id}: ten-star without a signature ability`);
  }
  for (const a of units.filter((u) => u.faction === "ANG")) {
    if (!a.flying) problems.push(`${a.id}: angel that does not fly`);
    if (a.keywords?.includes("Archangel") && a.uniqueLimit !== 1) problems.push(`${a.id}: archangel without a one-copy limit`);
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
