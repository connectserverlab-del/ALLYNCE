/**
 * The wanted board's engine, compiled for the browser.
 *
 * Every other screen but March reads a snapshot the engine wrote at build time. The board's numbers
 * are safe to bake — a posted warrant does not change until the board rotates — but *taking* one is a
 * decision the person looking at the page makes, and it has to change what the page shows: the count
 * in hand, which warrant is locked, and which of the remaining gaps in the current deck are still open.
 * Recomputing that in the template would mean a second copy of `acceptContract` and `missingForDeck`
 * that could quietly drift from the ones `core/tests/wanted.test.ts` runs against, so instead this
 * bundles the real `core/src/wanted.ts` unchanged, the same way `march-boot.mts` bundles the march
 * engine. Nothing about accepting, abandoning or reading a gap is reimplemented in the page.
 */
import * as wanted from "../../core/src/wanted.js";
import { reg } from "./registry-boot.mjs";

export { reg };

export const engine = wanted;
