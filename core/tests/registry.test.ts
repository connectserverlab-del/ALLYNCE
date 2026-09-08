import { describe, expect, it } from "vitest";
import { Registry, type CompositionRules } from "../src/registry.js";
import { reg } from "./helpers.js";
import type { FusionRecipe } from "../src/fusion.js";
import type { AbilityDef, FactionDef, UnitDef } from "../src/types.js";
import type { RankLadder } from "../src/ranks.js";
import type { SideCard } from "../src/cards.js";
import type { ResearchDef } from "../src/kingdom.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { DATA_ROOT } from "../src/data.js";
/** Rebuild a Registry from the real loaded data, swapping in one replacement fusion list. */
function withFusions(fusions: FusionRecipe[]): () => Registry {
  return () =>
    new Registry(
      [...reg.units.values()],
      [...reg.abilities.values()],
      Object.fromEntries([...reg.factions.values()].map((f) => [f.id, f])),
      reg.rules,
      [...reg.ranks.values()],
      fusions,
      reg.deckRules,
      [...reg.sideCards.values()],
      reg.kingdom,
      [...reg.research.values()],
      [...reg.banners.values()],
      reg.wanted,
      reg.march,
    );
}

const REAL_FUSION = reg.fusions.get("FUS_PAIRED_LINE")!;

/** The real fusion table with FUS_PAIRED_LINE swapped for a broken copy. Every recipe here is named by
 * a side card (see data/cards/side_cards.json), so dropping one instead of swapping it fails that
 * unrelated check first. */
function withPairedLineReplacedBy(broken: FusionRecipe): FusionRecipe[] {
  return [...reg.fusions.values()].map((r) => (r.id === "FUS_PAIRED_LINE" ? broken : r));
}

const RULES: CompositionRules = {
  standardPlatoon: {
    slots: { Commander: 1, Second: 1, Elite: 1, FootSoldier: 5 }, total: 8,
    doctrine: {
      full: { atk: 0, def: 0, morale: 0, minFoot: 4 },
      reduced: { atk: -10, def: -10, morale: -10, minFoot: 2 },
      broken: { atk: -20, def: -20, morale: -20 },
    },
    continuityRounds: 1,
  },
  themeCohesion: { perAdjacentAlly: 5, maxConnections: 6, disorderedCap: 0 },
  limits: { eliteSlotsPerPlatoon: 1, uniqueCopiesPerArmy: 1, bossDeityStartingDeployment: false, wizardsPerPlatoon: 1 },
};

function makeUnit(overrides: Partial<UnitDef> = {}): UnitDef {
  return {
    id: "TEST_UNIT", name: "Test Unit", faction: "SAM",
    themes: ["Steel"], roles: ["FootSoldier"], rank: "Line", size: "Standard",
    hp: 100, atk: 100, def: 100, mov: 3, range: 1,
    initiative: 5, morale: 100, capacityCost: 1,
    passives: [], actives: [], slots: ["FootSoldier"],
    unique: false, summonOnly: false, ai: "Balanced",
    ...overrides,
  };
}

function makeAbility(overrides: Partial<AbilityDef> = {}): AbilityDef {
  return {
    id: "TEST_ABILITY", name: "Test Ability", category: "Passive",
    effect: { kind: "Noop" }, text: "Does nothing.",
    ...overrides,
  };
}

function makeFaction(overrides: Partial<FactionDef> = {}): FactionDef {
  return {
    id: "SAM", name: "Samurai", identity: "Honor", palette: ["#000"], primaryTheme: "Steel",
    platoonOrder: null, passiveDoctrine: null, weakness: "None",
    ...overrides,
  };
}

describe("fusion recipes are checked at load time, the same as unit and faction references", () => {
  it("accepts the real fusion table", () => {
    expect(withFusions([...reg.fusions.values()])).not.toThrow();
  });

  it("rejects a recipe naming a missing input unit", () => {
    const broken: FusionRecipe = { ...REAL_FUSION, inputs: [{ defId: "SAM_NO_SUCH_UNIT" }, { defId: "SAM_NO_SUCH_UNIT" }] };
    expect(withFusions(withPairedLineReplacedBy(broken))).toThrow(/missing input/);
  });

  it("rejects a recipe naming a missing result unit", () => {
    const broken: FusionRecipe = { ...REAL_FUSION, result: { ...REAL_FUSION.result, defId: "DIV_NO_SUCH_UNIT" } };
    expect(withFusions(withPairedLineReplacedBy(broken))).toThrow(/missing result unit/);
  });

  it("rejects a recipe granting a missing ability", () => {
    const broken: FusionRecipe = { ...REAL_FUSION, result: { ...REAL_FUSION.result, passives: ["ABL_NO_SUCH_ABILITY"] } };
    expect(withFusions(withPairedLineReplacedBy(broken))).toThrow(/missing ability/);
  });
});

describe("Registry", () => {
  it("loads and validates the real game data without throwing", () => {
    expect(reg.units.size).toBeGreaterThan(0);
    expect(reg.factions.size).toBeGreaterThan(0);
  });

  it("indexes units, abilities and factions by id", () => {
    const r = new Registry([makeUnit()], [makeAbility()], { SAM: makeFaction() }, RULES);
    expect(r.unit("TEST_UNIT").name).toBe("Test Unit");
    expect(r.ability("TEST_ABILITY").name).toBe("Test Ability");
    expect(r.factions.get("SAM")?.name).toBe("Samurai");
  });

  it("unit() throws on an unknown id", () => {
    const r = new Registry([makeUnit()], [makeAbility()], { SAM: makeFaction() }, RULES);
    expect(() => r.unit("NOPE")).toThrow(/Unknown unit/);
  });

  it("ability() throws on an unknown id", () => {
    const r = new Registry([makeUnit()], [makeAbility()], { SAM: makeFaction() }, RULES);
    expect(() => r.ability("NOPE")).toThrow(/Unknown ability/);
  });

  it("rejects a unit that references a missing passive or active ability", () => {
    const withPassive = makeUnit({ passives: ["GHOST_ABILITY"] });
    expect(() => new Registry([withPassive], [], { SAM: makeFaction() }, RULES)).toThrow(/references missing ability GHOST_ABILITY/);
    const withActive = makeUnit({ actives: ["GHOST_ABILITY"] });
    expect(() => new Registry([withActive], [], { SAM: makeFaction() }, RULES)).toThrow(/references missing ability GHOST_ABILITY/);
  });

  it("rejects a unit whose faction is not registered", () => {
    const orphan = makeUnit({ faction: "GHOST_FACTION" });
    expect(() => new Registry([orphan], [], { SAM: makeFaction() }, RULES)).toThrow(/references missing faction GHOST_FACTION/);
  });

  it("exempts the DIV pseudo-faction from the faction reference check", () => {
    const divUnit = makeUnit({ faction: "DIV" });
    expect(() => new Registry([divUnit], [], {}, RULES)).not.toThrow();
  });

  it("rejects a unit whose factionRank has no matching rank on its faction's ladder", () => {
    const ranked = makeUnit({ factionRank: "GHOST_RANK" });
    const ladder: RankLadder = { faction: "SAM", ranks: [{ id: "REAL_RANK", title: "Real", tier: 1, description: "", privileges: {}, canLead: [] }], privilegeRules: {} };
    expect(() => new Registry([ranked], [], { SAM: makeFaction() }, RULES, [ladder])).toThrow(/references unknown rank GHOST_RANK/);
  });

  it("accepts a unit whose factionRank matches its faction's ladder", () => {
    const ranked = makeUnit({ factionRank: "REAL_RANK" });
    const ladder: RankLadder = { faction: "SAM", ranks: [{ id: "REAL_RANK", title: "Real", tier: 1, description: "", privileges: {}, canLead: [] }], privilegeRules: {} };
    expect(() => new Registry([ranked], [], { SAM: makeFaction() }, RULES, [ladder])).not.toThrow();
  });

  it("rejects a ritual side card that names a missing result unit", () => {
    const card: SideCard = { id: "RIT_CARD", name: "Ritual", kind: "ritual", stars: 5, text: "", copyLimit: 1, result: "GHOST_UNIT" };
    expect(() => new Registry([], [], {}, RULES, [], [], undefined, [card])).toThrow(/names a missing unit GHOST_UNIT/);
  });

  it("rejects a fusion side card that names a missing recipe", () => {
    const card: SideCard = { id: "FUS_CARD", name: "Fusion", kind: "fusion", stars: 5, text: "", copyLimit: 1, recipe: "GHOST_RECIPE" };
    expect(() => new Registry([], [], {}, RULES, [], [], undefined, [card])).toThrow(/names a missing recipe GHOST_RECIPE/);
  });

  it("rejects research that requires a prerequisite that does not exist", () => {
    const study: ResearchDef = { id: "R2", name: "Second Study", tier: 2, text: "", cost: {}, seconds: 1, requires: ["GHOST_STUDY"], effect: { kind: "Morale", value: 1 } };
    expect(() => new Registry([], [], {}, RULES, [], [], undefined, [], undefined, [study])).toThrow(/requires a missing study GHOST_STUDY/);
  });

  it("rejects a faction whose platoon order names a missing ability", () => {
    const faction = makeFaction({ platoonOrder: "GHOST_ORDER" });
    expect(() => new Registry([], [], { SAM: faction }, RULES)).toThrow(/missing order GHOST_ORDER/);
  });

  it("rejects a faction whose passive doctrine names a missing ability", () => {
    const faction = makeFaction({ passiveDoctrine: "GHOST_DOCTRINE" });
    expect(() => new Registry([], [], { SAM: faction }, RULES)).toThrow(/missing doctrine GHOST_DOCTRINE/);
  });
});

function readJson(rel: string) {
  return JSON.parse(readFileSync(resolve(DATA_ROOT, rel), "utf8"));
}

/** Every table `loadRegistry` reads, so a test can hand `new Registry` one deliberately-broken table. */
function loadTables() {
  return {
    // Mirrors loadRegistry: the expansion roster ships as its own file and is loaded alongside.
    units: [...(readJson("units/units.json") as unknown[]), ...(readJson("units/expansion.json") as unknown[])],
    abilities: [...(readJson("abilities/abilities.json") as unknown[]), ...(readJson("abilities/expansion.json") as unknown[])],
    factions: readJson("factions/factions.json"),
    rules: readJson("compositions/platoon.json"),
    ladders: ["SAM", "SHI", "KNI", "DRG", "RIT"]
      .filter((f) => existsSync(resolve(DATA_ROOT, `factions/ranks/${f}.json`)))
      .map((f) => readJson(`factions/ranks/${f}.json`)),
    fusions: readJson("abilities/fusions.json"),
    deckRules: readJson("cards/deck_rules.json"),
    sideCards: readJson("cards/side_cards.json"),
    kingdom: readJson("kingdom/buildings.json"),
    research: readJson("kingdom/research.json"),
    wanted: readJson("missions/wanted.json"),
    march: readJson("movement/march.json"),
    weather: readJson("rules/weather.json"),
  };
}

const AnyRegistry = Registry as unknown as new (...args: unknown[]) => Registry;

function buildWithBanners(banners: unknown[]): Registry {
  const t = loadTables();
  return new AnyRegistry(
    t.units, t.abilities, t.factions, t.rules, t.ladders, t.fusions,
    t.deckRules, t.sideCards, t.kingdom, t.research, banners, t.wanted, t.march, t.weather,
  );
}

describe("registry cross-reference validation", () => {
  it("the shipped data loads cleanly, including every banner rate", () => {
    // helpers.ts already loaded `reg` at import time without throwing; this just asserts the banners are there.
    expect(reg.banners.size).toBeGreaterThan(0);
  });

  it("refuses a banner that promises a star tier no recruitable unit can fill", () => {
    const badBanners = [
      { id: "BANNER_TEST", name: "Test Banner", text: "", cost: { silver: 1 }, pity: 10, rates: [{ stars: 11, weight: 1 }] },
    ];
    expect(() => buildWithBanners(badBanners)).toThrow(/BANNER_TEST.*11-star/);
  });

  it("accepts a banner whose rates are all fillable", () => {
    const okBanners = [
      { id: "BANNER_TEST", name: "Test Banner", text: "", cost: { silver: 1 }, pity: 10, rates: [{ stars: 1, weight: 1 }] },
    ];
    expect(() => buildWithBanners(okBanners)).not.toThrow();
  });
});
