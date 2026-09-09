/**
 * esbuild plugin supplying the browser bundles with exactly the data `loadRegistry` reads.
 *
 * `core/src/data.ts` builds the registry from `node:fs`, which a bundle cannot do, so the three
 * `web/sample/*-boot.mts` entry points each hand-listed the data files instead. Three copies of one
 * list drifted from it on every axis at once: they named two rank ladders when five existed on disk,
 * they loaded the core roster without `units/expansion.json` or `abilities/expansion.json`, and they
 * passed thirteen arguments to a fourteen-argument `Registry`. The page died on the first of those —
 * `Registry` threw `KNI_COMMANDER_SOLAR-BASTION-MARSHAL references unknown rank BARON`, so
 * `window.CARDS` never initialised and every screen leaning on it went down with it.
 *
 * Reading the files here, in the same order and combination `loadRegistry` uses, removes the lists
 * that could go stale rather than correcting them once. `core/tests/gamedata.test.ts` holds the two
 * in step from the other side.
 *
 *     import { gamedataPlugin } from "./gamedata-plugin.mjs";
 *     esbuild.build({ plugins: [gamedataPlugin(ROOT)], ... });
 *
 * A boot then does `import data from "virtual:gamedata"` and spreads it into `new Registry(...)`.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const NAMESPACE = "allynce-gamedata";

/** The data set `loadRegistry` assembles, as plain JSON. Key order is the `Registry` argument order. */
export function readGameData(root) {
  const data = join(root, "data");
  const read = (rel) => JSON.parse(readFileSync(join(data, rel), "utf8"));
  const readIfPresent = (rel, fallback) => (existsSync(join(data, rel)) ? read(rel) : fallback);

  return {
    units: [...read("units/units.json"), ...readIfPresent("units/expansion.json", [])],
    abilities: [...read("abilities/abilities.json"), ...readIfPresent("abilities/expansion.json", [])],
    factions: read("factions/factions.json"),
    platoon: read("compositions/platoon.json"),
    // Every ladder on disk, ordered by filename so a rebuild is byte-identical.
    ranks: readdirSync(join(data, "factions/ranks")).filter((f) => f.endsWith(".json")).sort()
      .map((f) => read(`factions/ranks/${f}`)),
    fusions: read("abilities/fusions.json"),
    deckRules: read("cards/deck_rules.json"),
    sideCards: read("cards/side_cards.json"),
    buildings: read("kingdom/buildings.json"),
    research: read("kingdom/research.json"),
    banners: read("kingdom/banners.json"),
    wanted: read("missions/wanted.json"),
    marchRules: read("movement/march.json"),
    weather: read("rules/weather.json"),
  };
}

export function gamedataPlugin(root) {
  return {
    name: "allynce-gamedata",
    setup(build) {
      build.onResolve({ filter: /^virtual:gamedata$/ }, () => ({ path: "virtual:gamedata", namespace: NAMESPACE }));
      build.onLoad({ filter: /.*/, namespace: NAMESPACE }, () => ({
        contents: `export default ${JSON.stringify(readGameData(root))};`,
        loader: "js",
      }));
    },
  };
}
