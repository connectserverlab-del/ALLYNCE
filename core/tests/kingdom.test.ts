import { describe, it, expect } from "vitest";
import { newBattle, deploy, KNI, blob, reg } from "./helpers.js";
import { newKingdom, startUpgrade, upgradeCost, upgradeSeconds, tick, startResearch, researchable, drawFromBanner, kingdomEffects, applyKingdom, storageCap } from "../src/kingdom.js";
import { computeStat } from "../src/modifiers.js";

describe("the holding", () => {
  it("starts with a level-one Keep and nothing else, and the Keep gates every other building", () => {
    const k = newKingdom(reg, "KNI");
    expect(k.levels.KEEP).toBe(1);
    expect(k.levels.FORGE).toBe(0);
    expect(startUpgrade(reg, k, "FORGE").ok).toBe(true);   // level 0 -> 1 is allowed under a level-1 Keep
    tick(reg, k, 100000);
    expect(k.levels.FORGE).toBe(1);
    const blocked = startUpgrade(reg, k, "FORGE");
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toMatch(/Raise the Keep past level 1/);
  });

  it("charges resources, runs a build timer, and refuses what you cannot pay for", () => {
    const k = newKingdom(reg, "KNI");
    const cost = upgradeCost(reg, k, "GRANARY");
    const before = { ...k.resources };
    expect(startUpgrade(reg, k, "GRANARY").ok).toBe(true);
    expect(k.resources.timber).toBe(before.timber - (cost.timber ?? 0));
    expect(k.buildQueue[0]!.secondsLeft).toBe(upgradeSeconds(reg, k, "GRANARY"));
    expect(startUpgrade(reg, k, "GRANARY").reason).toMatch(/already being raised/);
    tick(reg, k, 10);
    expect(k.levels.GRANARY).toBe(0);
    const r = tick(reg, k, 100000);
    expect(r.finishedBuildings).toContain("GRANARY");
    expect(k.levels.GRANARY).toBe(1);
    k.resources.koku = 0; k.resources.timber = 0;
    expect(startUpgrade(reg, k, "MINE").reason).toMatch(/Not enough/);
  });

  it("produces resources over time and never exceeds storage", () => {
    const k = newKingdom(reg, "KNI");
    startUpgrade(reg, k, "GRANARY"); tick(reg, k, 100000);
    const koku = k.resources.koku;
    const rep = tick(reg, k, 3600);
    expect(rep.produced.koku).toBe(120);
    expect(k.resources.koku).toBe(koku + 120);
    tick(reg, k, 3600 * 1000);
    expect(k.resources.koku).toBeLessThanOrEqual(storageCap(reg, k));
  });

  it("gates research behind the Research Hall and prerequisites, then completes it on a timer", () => {
    const k = newKingdom(reg, "KNI");
    k.resources = { koku: 99999, iron: 99999, timber: 99999, silver: 99999 };
    expect(startResearch(reg, k, "RES_FORGED_EDGE").reason).toMatch(/higher Research Hall/);
    startUpgrade(reg, k, "RESEARCH_HALL"); tick(reg, k, 100000);
    expect(researchable(reg, k).map((r) => r.id)).toContain("RES_FORGED_EDGE");
    expect(researchable(reg, k).map((r) => r.id)).not.toContain("RES_LONG_MARCH"); // tier 2 needs a bigger hall
    expect(startResearch(reg, k, "RES_FORGED_EDGE").ok).toBe(true);
    expect(startResearch(reg, k, "RES_LAYERED_PLATE").reason).toMatch(/already under way/);
    const rep = tick(reg, k, 100000);
    expect(rep.finishedResearch).toContain("RES_FORGED_EDGE");
    expect(k.research.done).toContain("RES_FORGED_EDGE");
  });

  it("recruitment draws cards, spends silver, records duplicates and honours pity", () => {
    const k = newKingdom(reg, "SAM");
    expect(drawFromBanner(reg, k, "BANNER_MUSTER", 1).reason).toMatch(/Recruitment Hall/);
    startUpgrade(reg, k, "RECRUITMENT_HALL"); tick(reg, k, 100000);
    k.resources.silver = 100000; k.resources.koku = 100000; k.resources.iron = 100000;
    const res = drawFromBanner(reg, k, "BANNER_MUSTER", 10);
    expect(res.ok).toBe(true);
    expect(res.cards).toHaveLength(10);
    expect(Object.values(k.collection).reduce((a, b) => a + b, 0)).toBe(10);
    for (const c of res.cards) expect(c.stars).toBeGreaterThanOrEqual(1);
    // the Oathfire banner never hands out a levy
    const rite = drawFromBanner(reg, k, "BANNER_OATHFIRE", 12);
    expect(Math.min(...rite.cards.map((c) => c.stars))).toBeGreaterThanOrEqual(4);
    // pity: 30 draws on Oathfire must have produced at least one 7-star or better
    const long = drawFromBanner(reg, k, "BANNER_OATHFIRE", 30);
    expect(Math.max(...long.cards.map((c) => c.stars))).toBeGreaterThanOrEqual(7);
  });

  it("carries buildings and research into a battle as named, source-tracked modifiers", () => {
    const { b } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(5, 5));
    const k = newKingdom(reg, "KNI");
    k.resources = { koku: 999999, iron: 999999, timber: 999999, silver: 999999 };
    for (const bld of ["FORGE", "WALL", "BARRACKS", "RESEARCH_HALL", "STABLE"] as const) { startUpgrade(reg, k, bld); tick(reg, k, 100000); }
    startResearch(reg, k, "RES_FORGED_EDGE"); tick(reg, k, 100000);
    const e = kingdomEffects(reg, k);
    expect(e.armyCapacity).toBe(12);
    const capBefore = b.sides.get("A")!.armyCapacity;
    applyKingdom(b, "A", k);
    expect(b.sides.get("A")!.armyCapacity).toBe(capBefore + 12);
    const foot = b.unit(p.footUids[0]!);
    const atk = computeStat(b, foot, "ATK");
    const sources = atk.modifiers.map((m) => m.source);
    expect(sources).toContain("Forge 1");
    expect(sources).toContain("Research: Forged Edge");
    expect(computeStat(b, foot, "DEF").modifiers.map((m) => m.source)).toContain("Curtain Wall 1");
    // cavalry-only bonuses do not leak onto foot soldiers
    expect(sources).not.toContain("Stable 1");
    const lancer = b.spawn("KNI_CAVALRY_DAWN-LANCER", "A", { q: 12, r: 12 });
    expect(computeStat(b, lancer, "ATK").modifiers.map((m) => m.source)).toContain("Stable 1");
  });
});

describe("building tiers", () => {
  it("bands levels into three looks and falls back to the nearest painted tier", async () => {
    const { buildingTier, buildingArt, nextTierAt, newKingdom, startUpgrade, tick } = await import("../src/kingdom.js");
    expect(buildingTier(reg, 1).tier).toBe(1);
    expect(buildingTier(reg, 3).tier).toBe(1);
    expect(buildingTier(reg, 4).tier).toBe(2);
    expect(buildingTier(reg, 7).tier).toBe(2);
    expect(buildingTier(reg, 10).tier).toBe(3);
    expect(nextTierAt(reg, 2)).toBe(4);
    expect(nextTierAt(reg, 9)).toBeNull();
    expect(buildingArt(reg, "KEEP", 0)).toBeNull();
    expect(buildingArt(reg, "KEEP", 2)).toMatch(/KEEP_T1/);
    expect(buildingArt(reg, "WALL", 9)).toMatch(/WALL_T3/);
    // the Barracks has no tier-two painting yet, so level 5 keeps showing tier one rather than blanking
    expect(buildingArt(reg, "BARRACKS", 5)).toMatch(/BARRACKS_T1/);
    expect(buildingArt(reg, "BARRACKS", 9)).toMatch(/BARRACKS_T3/);
    // a building with no art at all stays null without throwing
    expect(buildingArt(reg, "SHRINE", 5)).toBeNull();
    const k = newKingdom(reg, "KNI");
    expect(buildingArt(reg, "GRANARY", k.levels.GRANARY)).toBeNull();
    void startUpgrade; void tick;
  });
});
