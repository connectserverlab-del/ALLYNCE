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
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

  const columns = await page.$eval("#grid", (g) => getComputedStyle(g).gridTemplateColumns.split(" ").length);
  check("the card grid keeps its columns", columns >= 4, `${columns} columns`);

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

  // Controls must live inside the card they belong to: nested <button> elements get
  // hoisted out by the parser, which is what put the add and remove buttons adrift.
  const orphans = await page.$$eval("[data-act]", (n) =>
    n.filter((x) => !x.closest(".card, .row-card")).length);
  check("card controls stay inside their card", orphans === 0, `${orphans} orphaned controls`);
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

  // Watch the effects layer: attacks and abilities must actually animate.
  await page.evaluate(() => {
    window.__fx = new Set();
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.className) window.__fx.add(String(n.className));
    }).observe(document.getElementById("fx-layer"), { childList: true });
  });

  await page.click("#end");
  // The enemy turn is animated one action at a time, so wait for the round counter itself.
  const advanced = await page.waitForFunction(
    () => /Round 2\//.test(document.querySelector("#phase")?.textContent ?? ""),
    null, { timeout: 25000 }).then(() => true, () => false);
  const logged = await page.$$eval(".battle-log div", (n) => n.length);
  check("the enemy takes its turn and the round advances", advanced, `${logged} log entries`);

  /* keep ending rounds until the two lines meet, then confirm the effects fired */
  for (let i = 0; i < 5; i++) {
    const seen = await page.evaluate(() => [...window.__fx]);
    if (seen.length) break;
    await page.click("#end").catch(() => {});
    await page.waitForTimeout(4000);
  }
  const effects = await page.evaluate(() => [...window.__fx]);
  check("attacks and abilities animate", effects.length > 0, effects.join(", ") || "no effect elements observed");
  // Wait for the enemy to finish acting before checking for leaks: effects are created
  // continuously while it does, so sampling mid-turn would always find some in flight.
  await page.waitForFunction(() => /Your move/.test(document.querySelector("#phase")?.textContent ?? ""),
    null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1600);
  const leaked = await page.$$eval("#fx-layer .fx", (n) => n.length);
  check("effects clean themselves up", leaked === 0, `${leaked} left behind`);

  check("no console errors or failed requests", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  /* ------------------------------------------------------------ sample pages
   * The generated sample pages are the build most people actually open, and nothing checked them.
   * They boot their own bundled registry rather than the client's, so a data file missing from that
   * bundle throws at load, the field never draws, and only the static panels around it survive —
   * which is exactly how a page shipped with two of five rank ladders and no expansion roster.
   * Each page opens from file:// with nothing beside it, so it is loaded the same way here. */
  for (const sample of readdirSync(resolve(ROOT, "docs/samples")).filter((f) => f.endsWith(".html"))) {
    const sampleErrors = [];
    const sp = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    sp.on("pageerror", (e) => sampleErrors.push(e.message));
    // A failed subresource fetch is not a script error: these pages are opened offline here, and
    // the template still pulls its webfonts from the network (see `Q-37`). Filter that class out so
    // this check keeps meaning "the page's own code threw".
    sp.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource/.test(m.text())) sampleErrors.push(m.text());
    });
    try {
      await sp.goto(pathToFileURL(resolve(ROOT, "docs/samples", sample)).href, { waitUntil: "load" });
      await sp.waitForTimeout(1500);
      // Declared, or the browser reads these UTF-8 bytes as windows-1252 and every separator,
      // dash and bullet on the page renders as mojibake.
      check(`${sample}: declares its charset`,
        (await sp.evaluate(() => document.characterSet)) === "UTF-8");
      // A page that throws at load keeps its static panels and loses everything the engine draws,
      // which reads as "the game is missing" rather than as an error. Network failures are not
      // that: these pages are opened offline here on purpose.
      check(`${sample}: loads without a script error`, sampleErrors.length === 0,
        sampleErrors.slice(0, 3).join(" | "));
      // The field is drawn by the bundled engine, so an empty one is the visible symptom of the
      // failure above. Only the pages that have a field are asked for it.
      const hasField = await sp.$("#map") !== null;
      if (hasField) {
        const units = await sp.$$eval("#map .unit", (n) => n.length).catch(() => 0);
        check(`${sample}: draws units on the field`, units > 0, `${units} unit tokens`);
        const symbols = await sp.$$eval("#map image.furn", (n) => n.length).catch(() => 0);
        check(`${sample}: paints its terrain symbols`, symbols > 0, `${symbols} plan-view symbols`);
      }
      // The Hold is the one screen that runs the holding engine live rather than showing a
      // snapshot, so it is the one that breaks silently if that bundle stops loading.
      const hasHold = await sp.$('.rail button[data-s="hold"]') !== null;
      if (hasHold) {
        await sp.evaluate(() => document.querySelector('.rail button[data-s="hold"]').click());
        await sp.waitForTimeout(600);
        const power = await sp.$eval("#powerbox .n", (n) => n.textContent.trim()).catch(() => "");
        check(`${sample}: shows power in the corner`, /^[\d,]+$/.test(power) && power !== "0", power || "(missing)");
        const plots = await sp.$$eval("#isoscene .tile", (n) => n.length).catch(() => 0);
        const placed = await sp.$$eval("#isoscene .bldg", (n) => n.length).catch(() => 0);
        const props = await sp.$$eval("#isoscene .prop", (n) => n.length).catch(() => 0);
        check(`${sample}: lays the hold out on an isometric grid`, plots > 0 && placed > 0,
          `${placed} buildings and ${props} props on ${plots} tiles`);
        // The scene has to be scaled to fit, not left at 1 on a grid wider than the panel. It was
        // measured once while the pane was still display:none, which reads as a zero-sized box.
        const fitted = await sp.$eval("#isoscene", (n) => n.style.transform).catch(() => "");
        check(`${sample}: fits the hold to the panel`, /scale\(0?\.\d+\)|scale\(1\.\d+\)/.test(fitted), fitted || "(unscaled)");
        // Drag one building to a free plot and confirm the engine actually moved it. A grid that
        // looks draggable and is not is worse than one that does not invite the drag.
        const moved = await sp.evaluate(() => {
          const g = document.getElementById("isoscene");
          const b = g.querySelector(".bldg");
          if (!b) return null;
          const id = b.dataset.b;
          // A building is positioned from its tile, so its own left edge tells you which tile it
          // stands on: left = tileLeft + (tileWidth - buildingWidth) / 2. Comparing that before and
          // after is what makes this check mean "it moved" rather than "it still exists".
          const tileOf = (el) => {
            const bw = parseFloat(el.style.width);
            const centre = parseFloat(el.style.left) + bw / 2;
            return [...g.querySelectorAll(".tile")].find((t) =>
              Math.abs(parseFloat(t.style.left) + parseFloat(t.style.width) / 2 - centre) < 2);
          };
          const from = tileOf(b);
          const occupied = new Set([...g.querySelectorAll(".bldg")].map((e) => {
            const t = tileOf(e); return t ? `${t.dataset.x},${t.dataset.y}` : "";
          }));
          const empty = [...g.querySelectorAll(".tile")].find((t) => !occupied.has(`${t.dataset.x},${t.dataset.y}`));
          if (!from || !empty) return null;
          const fromXY = `${from.dataset.x},${from.dataset.y}`;
          const to = { x: +empty.dataset.x, y: +empty.dataset.y };

          const dt = new DataTransfer();
          b.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
          empty.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt, cancelable: true }));
          empty.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt, cancelable: true }));

          const g2 = document.getElementById("isoscene");
          const after = g2.querySelector(`.bldg[data-b="${id}"]`);
          if (!after) return { ok: false, id, why: "building gone after the drop" };
          const bw = parseFloat(after.style.width);
          const centre = parseFloat(after.style.left) + bw / 2;
          const landed = [...g2.querySelectorAll(".tile")].find((t) =>
            Math.abs(parseFloat(t.style.left) + parseFloat(t.style.width) / 2 - centre) < 2);
          const landedXY = landed ? `${landed.dataset.x},${landed.dataset.y}` : "(none)";
          return { ok: landedXY === `${to.x},${to.y}` && landedXY !== fromXY, id, from: fromXY, to: `${to.x},${to.y}`, landedXY };
        });
        check(`${sample}: a building can be dragged to another tile`, !!moved?.ok,
          moved ? `${moved.id} ${moved.from} -> ${moved.landedXY} (asked ${moved.to})` : "no drag target");
      }
    } finally {
      await sp.close();
    }
  }

} finally {
  await browser.close();
  server.kill();
}

if (failures.length) {
  console.error(`\n${failures.length} UI check(s) failed.`);
  process.exit(1);
}
console.log("\nAll UI checks passed.");
