#!/usr/bin/env node
/**
 * UI smoke test.
 *
 *   npm run test:ui
 *
 * Boots the static server, drives the client in headless Chromium and asserts the things
 * that actually broke in review: cards whose contents escape the card frame, cards with no
 * art, dead village buttons, an unusable deck builder, and a battle screen that will not
 * start. Exits non-zero on the first failure.
 */
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 5199);
const URL_BASE = `http://localhost:${PORT}/web/index.html`;

const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
};

const { chromium } = await import("playwright").catch(() => {
  console.error("playwright is not installed. Run: npm install");
  process.exit(2);
});

const server = spawn(process.execPath, [resolve(ROOT, "tools/serve.mjs")], {
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 600));

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400) consoleErrors.push(`${r.status()} ${r.url()}`); });

try {
  await page.goto(URL_BASE, { waitUntil: "networkidle" });
  await page.waitForSelector(".topbar:not([hidden])", { timeout: 20000 });
  check("client boots", true);

  /* every route renders its own content */
  for (const [route, sel] of [
    ["guide", ".guide-nav button"], ["map", ".map-frame svg .node"],
    ["village", ".village-ground .building"], ["muster", "#deck-count"], ["armoury", "#grid .card"],
  ]) {
    await page.evaluate((r) => { location.hash = `#/${r}`; }, route);
    const ok = await page.waitForSelector(sel, { timeout: 10000 }).then(() => true, () => false);
    check(`route "${route}" renders`, ok, ok ? "" : `missing ${sel}`);
  }

  /* the loading overlay must not remain in flow */
  check("loading overlay is dismissed", await page.$eval("#boot", (n) => getComputedStyle(n).display === "none"));

  /* card frame containment and art coverage */
  await page.evaluate(() => { location.hash = "#/armoury"; });
  await page.waitForSelector("#grid .card");
  const total = await page.$$eval("#grid .card", (c) => c.length);
  check("whole roster renders as cards", total >= 250, `${total} cards`);

  const spills = await page.$$eval(".card", (cards) => cards.map((c) => {
    const box = c.getBoundingClientRect();
    const bad = [...c.querySelectorAll("*")].filter((n) => {
      if (n.closest("svg")) return false;          // SVG internals are clipped by the viewBox
      const r = n.getBoundingClientRect();
      if (!r.width && !r.height) return false;
      return r.right > box.right + 1 || r.left < box.left - 1
        || r.bottom > box.bottom + 1 || r.top < box.top - 1;
    });
    return bad.length ? c.querySelector(".card-name")?.textContent?.trim() : null;
  }).filter(Boolean));
  check("nothing spills outside a card frame", spills.length === 0, spills.slice(0, 3).join("; "));

  const noArt = await page.$$eval(".card", (c) => c.filter((x) => !x.querySelector(".card-art svg, .card-art img")).length);
  check("every card has art", noArt === 0, `${noArt} without art`);

  /* village: every building opens and offers a real action */
  await page.evaluate(() => { location.hash = "#/village"; });
  await page.waitForSelector(".building");
  const ids = await page.$$eval(".building", (n) => n.map((x) => x.dataset.b));
  check("village has buildings", ids.length >= 8, `${ids.length}`);
  let dead = [];
  for (const id of ids) {
    await page.click(`.building[data-b="${id}"]`);
    const buttons = await page.$$eval("#side [data-do]", (n) => n.length);
    if (!buttons) dead.push(id);
  }
  check("every village building has a working control", dead.length === 0, dead.join(", "));

  await page.click('.building[data-b="barracks"]');
  await page.click('#side [data-do="upgrade"]');
  await page.click('#side [data-do="act"]');
  await page.waitForTimeout(200);
  const toast = await page.textContent("#toast");
  check("recruiting adds a unit to the inventory", /Recruited/.test(toast), toast.trim());

  /* deck builder */
  await page.evaluate(() => { location.hash = "#/muster"; });
  await page.waitForSelector("#auto");
  await page.click("#auto");
  await page.waitForTimeout(250);
  const size = await page.textContent("#deck-count");
  check("auto-fill builds a deck", /[1-9]/.test(size), size);
  check("a legal deck enables deployment", (await page.getAttribute("#fight", "disabled")) === null);

  /* battle */
  await page.evaluate(() => { location.hash = "#/battle"; });
  await page.waitForSelector(".board .pawn", { timeout: 10000 });
  const mine = await page.$$eval(".pawn.player", (n) => n.length);
  const theirs = await page.$$eval(".pawn.enemy", (n) => n.length);
  check("both forces deploy", mine >= 8 && theirs >= 8, `${mine} v ${theirs}`);

  await page.click(".pawn.player");
  const moves = await page.$$eval(".hex.move", (n) => n.length);
  check("selecting a unit shows its movement range", moves > 0, `${moves} hexes`);
  if (moves) await page.click(".hex.move");

  await page.click("#end");
  // The enemy turn is animated one action at a time, so wait for the round counter itself.
  const advanced = await page.waitForFunction(
    () => /Round 2\//.test(document.querySelector("#phase")?.textContent ?? ""),
    null, { timeout: 25000 }).then(() => true, () => false);
  const logged = await page.$$eval(".battle-log div", (n) => n.length);
  check("the enemy takes its turn and the round advances", advanced, `${logged} log entries`);

  check("no console errors or failed requests", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  server.kill();
}

if (failures.length) {
  console.error(`\n${failures.length} UI check(s) failed.`);
  process.exit(1);
}
console.log("\nAll UI checks passed.");
