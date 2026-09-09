/**
 * The card and deck rules, compiled for the browser.
 *
 * The Deck and Rites screens let the owner sleeve and pull copies while looking at the page, and every
 * change has to be checked against the same legality `validateDeck` enforces everywhere else — copy
 * limits, ownership, the primary-faction minimum, the fixed deck sizes. Baking a second, simplified
 * version of those rules into the template would drift from the engine in silence the first time a rule
 * changes, so this bundles `core/src/cards.js` unchanged, the same way `march-boot.mts` bundles the
 * march engine for the March screen. `scripts/bundle-cards.mjs` compiles it into the IIFE the template
 * inlines under `window.CARDS`.
 *
 * Nothing is reimplemented in the template. If the deck screen calls a build illegal, `validateDeck`
 * said so.
 */
import { validateDeck, effectiveCopyLimit } from "../../core/src/cards.js";
import { reg } from "./registry-boot.mjs";

export { reg };

export { validateDeck, effectiveCopyLimit };
