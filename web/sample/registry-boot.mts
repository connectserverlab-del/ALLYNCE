/**
 * The one registry the browser bundles share.
 *
 * `loadRegistry` in `core/src/data.ts` cannot run in a page — it reads `data/` through `node:fs` —
 * so the March, Writs, Deck and Rites screens used to each rebuild the registry from their own
 * hand-written list of data files. The three lists drifted from the loader and from each other, and
 * the page died on the first faction whose rank ladder none of them had imported.
 *
 * `scripts/gamedata-plugin.mjs` now reads those files at build time under `virtual:gamedata`, in the
 * same combination `loadRegistry` uses, and this module is the only place that spreads them into a
 * `Registry`. `core/tests/gamedata.test.ts` asserts the two stay the same registry.
 */
import { Registry } from "../../core/src/registry.js";
import data from "virtual:gamedata";

const any = (x: unknown) => x as never;

export const reg = new Registry(
  any(data.units), any(data.abilities), any(data.factions), any(data.platoon),
  any(data.ranks), any(data.fusions), any(data.deckRules), any(data.sideCards),
  any(data.buildings), any(data.research), any(data.banners), any(data.wanted),
  any(data.marchRules), any(data.weather),
);
