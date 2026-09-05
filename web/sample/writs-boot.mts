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
import { Registry } from "../../core/src/registry.js";
import * as wanted from "../../core/src/wanted.js";

import units from "../../data/units/units.json";
import abilities from "../../data/abilities/abilities.json";
import factions from "../../data/factions/factions.json";
import platoon from "../../data/compositions/platoon.json";
import ranksSAM from "../../data/factions/ranks/SAM.json";
import ranksSHI from "../../data/factions/ranks/SHI.json";
import fusions from "../../data/abilities/fusions.json";
import deckRules from "../../data/cards/deck_rules.json";
import sideCards from "../../data/cards/side_cards.json";
import buildings from "../../data/kingdom/buildings.json";
import research from "../../data/kingdom/research.json";
import banners from "../../data/kingdom/banners.json";
import wantedRules from "../../data/missions/wanted.json";
import marchRules from "../../data/movement/march.json";

const any = (x: unknown) => x as never;

/** The same registry the build-time export uses, assembled from JSON inlined by the bundler. */
export const reg = new Registry(
  any(units), any(abilities), any(factions), any(platoon),
  any([ranksSAM, ranksSHI]), any(fusions), any(deckRules), any(sideCards),
  any(buildings), any(research), any(banners), any(wantedRules), any(marchRules),
);

export const engine = wanted;
