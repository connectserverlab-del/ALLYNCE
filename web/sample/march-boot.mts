/**
 * The march screen's engine, compiled for the browser.
 *
 * Every other screen on the sample page reads a JSON snapshot the engine wrote at build time, which is
 * fine for a battle paused mid-activation. A march cannot work that way: the user drags a squad to a
 * point of their choosing and watches it walk, so the walk has to be computed in the page, at the moment
 * of the drag, from the real rules. Replaying a baked trace would mean the destinations were decided
 * here rather than there, and the 45-second cap on the page would be a number copied off the engine
 * instead of the engine's own answer.
 *
 * So this module bundles `core/src/march.ts` and its data unchanged. `scripts/bundle-march.mjs` runs it
 * through esbuild into one IIFE that the template inlines; nothing is reimplemented in the template, and
 * anything the page shows about a march — arrival times, terrain underfoot, who has joined which squad —
 * is the same code the tests run against.
 */
import { generateMap } from "../../core/src/mapgen.js";
import * as march from "../../core/src/march.js";
import { reg } from "./registry-boot.mjs";

export { reg };

/** The field the Field screen is painted on, generated from the same seed so the two agree. */
export const map = generateMap({ seed: 42, name: "Ashfall Crossing" });

export { generateMap };
export const engine = march;
