/**
 * Reading the game data off disk.
 *
 * Node only: this is where node:fs lives, which is why `Registry` itself sits in `registry.ts` and is
 * re-exported here. Anything that only needs the shape of the data can import it from either; anything
 * that needs it loaded from `data/` has to come through here.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { UnitDef, AbilityDef, FactionDef } from "./types.js";
import type { RankLadder } from "./ranks.js";
import type { FusionRecipe } from "./fusion.js";
import type { DeckRules, SideCard } from "./cards.js";
import type { KingdomData, ResearchDef, BannerDef } from "./kingdom.js";
import type { WantedRules } from "./wanted.js";
import type { MarchRules } from "./march.js";
import { Registry, type CompositionRules } from "./registry.js";

export { Registry } from "./registry.js";
export type { CompositionRules } from "./registry.js";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_ROOT = resolve(here, "../../data");

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(DATA_ROOT, rel), "utf8")) as T;
}

export function loadRegistry(): Registry {
  return new Registry(
    readJson<UnitDef[]>("units/units.json"),
    readJson<AbilityDef[]>("abilities/abilities.json"),
    readJson<Record<string, FactionDef>>("factions/factions.json"),
    readJson<CompositionRules>("compositions/platoon.json"),
    ["SAM", "SHI", "KNI", "DRG", "RIT"].filter((f) => existsSync(resolve(DATA_ROOT, `factions/ranks/${f}.json`))).map((f) => readJson<RankLadder>(`factions/ranks/${f}.json`)),
    readJson<FusionRecipe[]>("abilities/fusions.json"),
    readJson<DeckRules>("cards/deck_rules.json"),
    readJson<SideCard[]>("cards/side_cards.json"),
    readJson<KingdomData>("kingdom/buildings.json"),
    readJson<ResearchDef[]>("kingdom/research.json"),
    readJson<BannerDef[]>("kingdom/banners.json"),
    readJson<WantedRules>("missions/wanted.json"),
    readJson<MarchRules>("movement/march.json"),
  );
}

export function loadScenario<T = unknown>(name: string): T {
  return readJson<T>(`scenarios/${name}.json`);
}
