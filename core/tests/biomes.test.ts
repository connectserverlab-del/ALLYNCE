import { describe, it, expect } from "vitest";
import { loadBiomes } from "../src/data.js";
import { generateMap, terrainCounts, biomeMapSpec } from "../src/mapgen.js";

describe("named biomes", () => {
  const biomes = loadBiomes();

  it("defines Ashfall, Marsh and Highland Pass, each with a name and preset knobs", () => {
    for (const id of ["ASHFALL", "MARSH", "HIGHLAND_PASS"]) {
      expect(biomes[id], id).toBeTruthy();
      expect(biomes[id]!.name.length).toBeGreaterThan(0);
      expect(biomes[id]!.text.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for a seed, like the plain generator", () => {
    const marsh = biomes.MARSH!;
    const a = generateMap(biomeMapSpec(marsh, 11));
    const b = generateMap(biomeMapSpec(marsh, 11));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("carries the biome's name onto the generated field unless overridden", () => {
    const ashfall = biomes.ASHFALL!;
    const named = generateMap(biomeMapSpec(ashfall, 5));
    expect(named.name).toBe("Ashfall");
    const renamed = generateMap(biomeMapSpec(ashfall, 5, { name: "Ashfall, third watch" }));
    expect(renamed.name).toBe("Ashfall, third watch");
  });

  it("Marsh reads wetter than Highland Pass: more mud and water, less mountain and forest", () => {
    const marsh = generateMap(biomeMapSpec(biomes.MARSH!, 100));
    const pass = generateMap(biomeMapSpec(biomes.HIGHLAND_PASS!, 100));
    const mc = terrainCounts(marsh), pc = terrainCounts(pass);
    const wet = (c: Record<string, number>) => (c.Mud ?? 0) + (c.Water ?? 0) + (c.Ford ?? 0);
    const high = (c: Record<string, number>) => (c.Mountain ?? 0) + (c.HighGround ?? 0);
    expect(wet(mc)).toBeGreaterThan(wet(pc));
    expect(high(pc)).toBeGreaterThan(high(mc));
    expect(mc.Forest ?? 0).toBeLessThan(pc.Forest ?? 0);
  });

  it("Highland Pass is rugged: mountain and high ground cover a large share of the field", () => {
    const pass = generateMap(biomeMapSpec(biomes.HIGHLAND_PASS!, 100));
    const plain = generateMap({ seed: 100 });
    const pc = terrainCounts(pass), plc = terrainCounts(plain);
    const high = (c: Record<string, number>) => ((c.Mountain ?? 0) + (c.HighGround ?? 0)) / Object.values(c).reduce((s, v) => s + v, 0);
    expect(high(pc)).toBeGreaterThan(high(plc));
  });

  it("Ashfall keeps its ruins and stays dry: no river, thin forest", () => {
    const ashfall = generateMap(biomeMapSpec(biomes.ASHFALL!, 7));
    const counts = terrainCounts(ashfall);
    expect(counts.Water ?? 0).toBe(0);
    expect(counts.Ruins ?? 0).toBeGreaterThan(0);
    const plain = generateMap({ seed: 7 });
    const plc = terrainCounts(plain);
    expect((counts.Forest ?? 0) / ashfall.hexes.length).toBeLessThan((plc.Forest ?? 0) / plain.hexes.length);
  });

  it("a per-battle override wins over the biome preset", () => {
    const marsh = biomes.MARSH!;
    const noRiver = generateMap(biomeMapSpec(marsh, 100, { river: false }));
    expect(terrainCounts(noRiver).Water ?? 0).toBe(0);
  });
});
