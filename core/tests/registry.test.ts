import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Registry } from "../src/registry.js";
import { DATA_ROOT } from "../src/data.js";
import { reg } from "./helpers.js";

function readJson(rel: string) {
  return JSON.parse(readFileSync(resolve(DATA_ROOT, rel), "utf8"));
}

/** Every table `loadRegistry` reads, so a test can hand `new Registry` one deliberately-broken table. */
function loadTables() {
  return {
    units: readJson("units/units.json"),
    abilities: readJson("abilities/abilities.json"),
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
  };
}

const AnyRegistry = Registry as unknown as new (...args: unknown[]) => Registry;

function buildWithBanners(banners: unknown[]): Registry {
  const t = loadTables();
  return new AnyRegistry(
    t.units, t.abilities, t.factions, t.rules, t.ladders, t.fusions,
    t.deckRules, t.sideCards, t.kingdom, t.research, banners, t.wanted, t.march,
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
