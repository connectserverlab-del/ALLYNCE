/**
 * The holding's engine, compiled for the browser.
 *
 * The Hold screen used to be a snapshot like most of this page, and that was fine while it only
 * showed numbers. It is not fine now: the player drags buildings between plots, raises them against
 * prerequisites, buys a border and merges duplicates, and every one of those is a rule with a real
 * implementation in `core/src/`. A second copy of `moveBuilding`'s collision check or of
 * `buyBorder`'s tier order living in the template would drift the first time either changed.
 *
 * So this bundles the real modules unchanged, the same way `march-boot.mts` bundles the march
 * engine, and the template drives them. `scripts/bundle-hold.mjs` compiles it into the IIFE the
 * page inlines under `window.HOLD`.
 */
import { reg } from "./registry-boot.mjs";
import * as kingdom from "../../core/src/kingdom.js";
import * as cosmetics from "../../core/src/cosmetics.js";
import { power } from "../../core/src/power.js";

export { reg, power };
export const engine = { ...kingdom, ...cosmetics };
