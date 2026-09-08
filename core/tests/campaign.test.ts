import { describe, it, expect } from "vitest";
import { reg } from "./helpers.js";
import { loadCampaign } from "../src/data.js";
import { generateMap } from "../src/mapgen.js";
import { newKingdom, tick, storageCap } from "../src/kingdom.js";
import {
  newCampaign, region, ownedRegions, contestableRegions, battleMapSpec,
  resolveRegionBattle, regionProduction, applyCampaignProduction, type CampaignMapDef,
} from "../src/campaign.js";

const province = loadCampaign<CampaignMapDef>("samurai_province");

describe("campaign map", () => {
  it("seeds ownership from each region's starting owner", () => {
    const state = newCampaign(province);
    expect(state.owner.ASHFALL_KEEP).toBe("A");
    expect(state.owner.IRON_VALE).toBe("B");
    expect(state.owner.CINDERPEAK_HEIGHTS).toBeNull();
    expect(ownedRegions(province, state, "A").map((r) => r.id)).toEqual(["ASHFALL_KEEP"]);
  });

  it("only offers regions bordering ground a side already holds, keeping the front contiguous", () => {
    const state = newCampaign(province);
    expect(contestableRegions(province, state, "A").map((r) => r.id).sort()).toEqual(["IRON_VALE", "REED_SHALLOWS"]);
    // Cinderpeak does not border anything A holds yet
    expect(contestableRegions(province, state, "A").map((r) => r.id)).not.toContain("CINDERPEAK_HEIGHTS");
    resolveRegionBattle(state, "REED_SHALLOWS", "A");
    // taking Reed Shallows opens Stonebridge Pass next
    expect(contestableRegions(province, state, "A").map((r) => r.id)).toContain("STONEBRIDGE_PASS");
  });

  it("only changes ownership on a decisive result", () => {
    const state = newCampaign(province);
    resolveRegionBattle(state, "REED_SHALLOWS", null); // an unresolved siege
    expect(state.owner.REED_SHALLOWS).toBeNull();
    resolveRegionBattle(state, "REED_SHALLOWS", "A");
    expect(state.owner.REED_SHALLOWS).toBe("A");
    resolveRegionBattle(state, "REED_SHALLOWS", null); // holding the field afterwards does not un-take it
    expect(state.owner.REED_SHALLOWS).toBe("A");
  });

  it("builds a legal, seeded field from a region's own biome", () => {
    const spec = battleMapSpec(region(province, "STONEBRIDGE_PASS"), 42);
    expect(spec.seed).toBe(42);
    expect(spec.rugged).toBe(0.5);
    const map = generateMap(spec);
    expect(map.hexes.length).toBeGreaterThan(0);
    expect(map.deployZones.A.length).toBeGreaterThan(0);
    expect(map.deployZones.B.length).toBeGreaterThan(0);
  });

  it("reports each held region's production as a named, source-tracked line", () => {
    const state = newCampaign(province);
    resolveRegionBattle(state, "REED_SHALLOWS", "A");
    const lines = regionProduction(province, state, "A");
    const sources = lines.map((l) => l.source);
    expect(sources).toContain("Region: Ashfall Keep Lands");
    expect(sources).toContain("Region: Reed Shallows");
    expect(lines.find((l) => l.source === "Region: Ashfall Keep Lands" && l.resource === "koku")?.perHour).toBe(60);
    expect(regionProduction(province, state, "B").map((l) => l.source)).toEqual(["Region: Iron Vale", "Region: Iron Vale"]);
  });

  it("feeds held-region production into a holding, capped by its storage like any other income", () => {
    const state = newCampaign(province);
    resolveRegionBattle(state, "REED_SHALLOWS", "A");
    const k = newKingdom(reg, "SAM");
    const before = k.resources.koku;
    const report = applyCampaignProduction(reg, province, state, "A", k, 3600);
    // Ashfall Keep Lands (60 koku/h) + Reed Shallows (40 koku/h, 15 timber/h)
    expect(report.produced.koku).toBe(100);
    expect(report.produced.timber).toBe(15);
    expect(k.resources.koku).toBe(before + 100);

    k.resources.koku = storageCap(reg, k);
    const capped = applyCampaignProduction(reg, province, state, "A", k, 3600);
    expect(k.resources.koku).toBe(storageCap(reg, k));
    expect(capped.produced.koku ?? 0).toBe(0);
  });

  it("stays consistent with an ordinary holding tick: both cap at the same storage ceiling", () => {
    const state = newCampaign(province);
    resolveRegionBattle(state, "IRON_VALE", "A");
    const k = newKingdom(reg, "SAM");
    tick(reg, k, 3600 * 1000);
    applyCampaignProduction(reg, province, state, "A", k, 3600 * 1000);
    for (const r of ["koku", "iron", "timber", "silver"] as const) expect(k.resources[r]).toBeLessThanOrEqual(storageCap(reg, k));
  });
});
