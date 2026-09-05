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
import { Registry } from "../../core/src/registry.js";
import { generateMap } from "../../core/src/mapgen.js";
import * as march from "../../core/src/march.js";

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

/** The field the Field screen is painted on, generated from the same seed so the two agree. */
export const map = generateMap({ seed: 42, name: "Ashfall Crossing" });

export { generateMap };
export const engine = march;
