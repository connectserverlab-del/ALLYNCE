import { describe, it, expect } from "vitest";
import { Registry, type CompositionRules } from "../src/registry.js";
import type { UnitDef, AbilityDef, FactionDef } from "../src/types.js";
import type { RankLadder } from "../src/ranks.js";
import type { SideCard } from "../src/cards.js";
import type { ResearchDef } from "../src/kingdom.js";
import { reg } from "./helpers.js";

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
