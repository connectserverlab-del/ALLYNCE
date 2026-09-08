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
import { Registry } from "../../core/src/registry.js";
import { validateDeck, effectiveCopyLimit } from "../../core/src/cards.js";

import units from "../../data/units/units.json";
import abilities from "../../data/abilities/abilities.json";
import factions from "../../data/factions/factions.json";
import platoon from "../../data/compositions/platoon.json";
// Only the two factions that have a ladder; `loadRegistry` probes the disk for the rest, which a
// bundle cannot do, so the list is written out and stays in step with `data/factions/ranks/`.
import ranksSAM from "../../data/factions/ranks/SAM.json";
import ranksSHI from "../../data/factions/ranks/SHI.json";
import fusions from "../../data/abilities/fusions.json";
import deckRules from "../../data/cards/deck_rules.json";
import sideCards from "../../data/cards/side_cards.json";
import buildings from "../../data/kingdom/buildings.json";
import research from "../../data/kingdom/research.json";
import banners from "../../data/kingdom/banners.json";
import wanted from "../../data/missions/wanted.json";
import marchRules from "../../data/movement/march.json";

const any = (x: unknown) => x as never;

/** The same registry the build-time export uses, assembled from JSON inlined by the bundler. */
export const reg = new Registry(
  any(units), any(abilities), any(factions), any(platoon),
  any([ranksSAM, ranksSHI]), any(fusions), any(deckRules), any(sideCards),
  any(buildings), any(research), any(banners), any(wanted), any(marchRules),
);

export { validateDeck, effectiveCopyLimit };
