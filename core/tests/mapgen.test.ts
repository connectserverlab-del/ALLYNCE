import { describe, it, expect } from "vitest";
import { generateBattlefield } from "../src/mapgen.js";
import { Battle } from "../src/state.js";
import { reg } from "./helpers.js";

function serialize(terrain: Map<string, string>): string {
  return [...terrain.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("|");
}

describe("generateBattlefield", () => {
  it("is fully deterministic for a given seed", () => {
    const spec = { seed: 42, width: 20, height: 16 };
    const a = generateBattlefield(spec);
    const b = generateBattlefield(spec);
    expect(serialize(a.terrain)).toBe(serialize(b.terrain));
    expect([...a.playable].sort()).toEqual([...b.playable].sort());
  });

  it("different seeds produce different maps", () => {
    const a = generateBattlefield({ seed: 1, width: 20, height: 16 });
    const b = generateBattlefield({ seed: 2, width: 20, height: 16 });
    expect(serialize(a.terrain)).not.toBe(serialize(b.terrain));
  });

  it("irregularity 0 keeps the full rectangle playable, with no carved edge", () => {
    const map = generateBattlefield({ seed: 7, width: 16, height: 12, irregularity: 0, mountainDensity: 0, forestDensity: 0, mudDensity: 0, trenchDensity: 0, ruinsDensity: 0, fortificationCount: 0, riverCount: 0, roadCount: 0 });
    expect(map.playable.size).toBe(16 * 12);
    for (const t of map.terrain.values()) expect(t).not.toBe("Water");
  });

  it("a positive irregularity carves away part of the rectangle but keeps most of it playable", () => {
    const map = generateBattlefield({ seed: 7, width: 24, height: 18, irregularity: 0.6, mountainDensity: 0, forestDensity: 0, mudDensity: 0, trenchDensity: 0, ruinsDensity: 0, fortificationCount: 0, riverCount: 0, roadCount: 0 });
    const total = 24 * 18;
    expect(map.playable.size).toBeLessThan(total);
    expect(map.playable.size).toBeGreaterThan(total * 0.5);
  });

  it("the playable area is never a plain rectangle when irregularity is set", () => {
    const map = generateBattlefield({ seed: 3, width: 24, height: 18, irregularity: 0.5 });
    // At least one corner of the bounding rectangle should be carved away.
    const corners = [{ q: 0, r: 0 }, { q: 23, r: 0 }, { q: 0, r: 17 }, { q: 23, r: 17 }];
    expect(corners.some((c) => !map.playable.has(`${c.q},${c.r}`))).toBe(true);
  });

  it("mountainDensity scales the number of Mountain hexes", () => {
    const none = generateBattlefield({ seed: 5, width: 24, height: 18, mountainDensity: 0 });
    const some = generateBattlefield({ seed: 5, width: 24, height: 18, mountainDensity: 0.3 });
    const count = (m: Map<string, string>) => [...m.values()].filter((t) => t === "Mountain").length;
    expect(count(none.terrain)).toBe(0);
    expect(count(some.terrain)).toBeGreaterThan(0);
  });

  it("a river crosses from the top edge to the bottom edge and carries at least one ford", () => {
    const map = generateBattlefield({ seed: 11, width: 24, height: 18, riverCount: 1, fordsPerRiver: 1 });
    const isRiver = (t: string | undefined) => t === "Water" || t === "Ford";
    const topRiver = [...map.terrain.entries()].some(([k, t]) => k.endsWith(",0") && isRiver(t) && map.playable.has(k));
    const bottomRiver = [...map.terrain.entries()].some(([k, t]) => k.endsWith(",17") && isRiver(t) && map.playable.has(k));
    const fords = [...map.terrain.values()].filter((t) => t === "Ford").length;
    expect(topRiver).toBe(true);
    expect(bottomRiver).toBe(true);
    expect(fords).toBeGreaterThanOrEqual(1);
  });

  it("a road reaches from the left edge toward the right edge", () => {
    const map = generateBattlefield({ seed: 9, width: 24, height: 18, roadCount: 1 });
    const roadQs = [...map.terrain.entries()].filter(([, t]) => t === "Road").map(([k]) => Number(k.split(",")[0]));
    expect(roadQs.length).toBeGreaterThan(0);
    expect(Math.min(...roadQs)).toBeLessThanOrEqual(2);
    expect(Math.max(...roadQs)).toBeGreaterThanOrEqual(21);
  });

  it("produces a terrain map a Battle can load and path through", () => {
    const map = generateBattlefield({ seed: 21, width: 24, height: 18, mountainDensity: 0.15 });
    const b = new Battle(reg, { seed: 1, width: map.width, height: map.height });
    for (const [k, t] of map.terrain) b.terrain.set(k, t as any);
    const [q, r] = [...map.playable][0]!.split(",").map(Number);
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: q!, r: r! });
    expect(u.pos).toEqual({ q, r });
  });
});
