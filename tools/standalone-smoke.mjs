#!/usr/bin/env node
/**
 * Opens the built single-page client and plays it far enough to draw a battlefield.
 *
 *   node tools/standalone-smoke.mjs        (after `npm run build:standalone`)
 *
 * The point of that build is that it has no external requests at all — every style, module,
 * game table and painted plate is inlined, so it opens from a disk, an email attachment or a
 * host that serves one file. Nothing checked that claim. The battle board built its unit
 * tokens from `unit.art.concept` directly instead of going through `art.js`, so every painted
 * unit on the field asked for a file that was not there and drew nothing: an <image> with a
 * dead href is silently blank, so the painted units looked worse than the unpainted ones,
 * which at least fall back to their initials.
 *
 * A failed request is therefore the assertion, not a warning. The walk to the battle screen
 * matters just as much — the tokens are the only thing in the build that draws art from a
 * screen you have to reach through three clicks, which is why nothing had ever seen them.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = resolve(ROOT, "dist/allynce.html");

if (!existsSync(PAGE)) {
  console.error(`  ! ${PAGE} is missing — run \`npm run build:standalone\` first`);
  process.exit(1);
}

const { chromium } = await import("playwright");
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const problems = [];
const requested = new Set();
page.on("pageerror", (e) => problems.push(`script error: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") problems.push(`console error: ${m.text()}`); });
page.on("requestfailed", (r) => problems.push(`external request: ${r.url()}`));
page.on("request", (r) => { requested.add(r.url()); });

const click = async (selector) => {
  const el = await page.$(selector);
  if (!el) throw new Error(`no control matching ${selector}`);
  await el.click();
  await page.waitForTimeout(700);
};

await page.goto(pathToFileURL(PAGE).href, { waitUntil: "load" });
await page.waitForTimeout(900);

// Every screen, then the three clicks that reach a live battle.
for (const tab of ["Campaign", "Village", "Deck", "Armoury", "Battle", "Guide"]) {
  await click(`#tabs :text-is("${tab}")`);
}
await click('#tabs :text-is("Deck")');
await click(':text-is("Auto-fill")');
await click(':text-is("Take to battle")');
await page.waitForTimeout(900);

const board = await page.$$eval("svg .pawn, svg image, .pawn-initials", (ns) => ns.length).catch(() => 0);
if (!board) problems.push("battle screen drew no units");

// A self-contained page requests exactly itself. Anything else is a plate, style or module
// that did not get inlined, whether or not the fetch happened to succeed.
const external = [...requested].filter((u) => u !== pathToFileURL(PAGE).href && !u.startsWith("data:"));
for (const u of external) problems.push(`not inlined: ${u}`);

await browser.close();

if (problems.length) {
  for (const p of problems) console.error(`  ! ${p}`);
  console.error(`\n${problems.length} problem(s) in the single-page build`);
  process.exit(1);
}
console.log(`  every screen opened, a battle drew ${board} tokens, no external request`);
