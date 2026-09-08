#!/usr/bin/env node
/**
 * Card-sized thumbnails of the painted plates, for the single-file build.
 *
 * The plates are print resolution — 13 MB across 88 files — while the largest place a
 * card ever draws one is a 220pt art window, so embedding the originals wasted an order
 * of magnitude and pushed the bundle past what a single page should carry.
 *
 * Re-encoding runs in the Chromium that already ships for the UI checks: each plate is
 * drawn to a canvas at card resolution and exported as a JPEG data URI. Results are cached
 * by path, size and mtime, so a rebuild only re-encodes what changed.
 *
 * If Chromium is unavailable the caller gets null and falls back to the originals.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = resolve(ROOT, "dist/.art-thumbs.json");

/** Long edge in device pixels: the art window at 220pt on a 2x display, plus headroom. */
export const THUMB = { w: 460, h: 575, quality: 0.82 };

const stamp = (p) => { const s = statSync(resolve(ROOT, p)); return `${s.size}:${Math.floor(s.mtimeMs)}`; };

export async function buildThumbnails(paths, { log = () => {} } = {}) {
  let cache = {};
  if (existsSync(CACHE)) { try { cache = JSON.parse(readFileSync(CACHE, "utf8")); } catch { cache = {}; } }

  const stale = paths.filter((p) => cache[p]?.stamp !== stamp(p));
  if (!stale.length) {
    log(`  thumbnails: ${paths.length} cached`);
    return Object.fromEntries(paths.map((p) => [p, cache[p].uri]));
  }

  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { log("  thumbnails: playwright unavailable, embedding originals"); return null; }

  const port = 5100 + (process.pid % 400);
  const server = spawn(process.execPath, [resolve(ROOT, "tools/serve.mjs")],
    { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));

  let browser;
  try {
    browser = await chromium.launch(
      process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
    const page = await browser.newPage();
    await page.goto(`http://localhost:${port}/web/index.html`, { waitUntil: "domcontentloaded" });

    log(`  thumbnails: re-encoding ${stale.length} of ${paths.length}`);
    for (const p of stale) {
      const uri = await page.evaluate(async ({ src, t }) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        // Cover the target box, cropping the overflow — the same fit the card uses.
        const scale = Math.max(t.w / img.naturalWidth, t.h / img.naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = t.w; canvas.height = t.h;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
        ctx.drawImage(img, (t.w - dw) / 2, (t.h - dh) / 2, dw, dh);
        return canvas.toDataURL("image/jpeg", t.quality);
      }, { src: `http://localhost:${port}/${p}`, t: THUMB }).catch(() => null);
      if (uri) cache[p] = { stamp: stamp(p), uri };
    }
  } catch (err) {
    log(`  thumbnails: ${err.message} — embedding originals`);
    return null;
  } finally {
    await browser?.close();
    server.kill();
  }

  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache));
  const out = {};
  for (const p of paths) if (cache[p]) out[p] = cache[p].uri;
  return out;
}
