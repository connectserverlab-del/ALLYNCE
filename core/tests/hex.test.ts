import { describe, it, expect } from "vitest";
import { hexDistance, hexNeighbors, isAdjacent, attackArc, hexRing, directionTo } from "../src/hex.js";

describe("hex grid", () => {
  it("distance and adjacency", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
    expect(hexNeighbors({ q: 0, r: 0 })).toHaveLength(6);
    expect(isAdjacent({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(true);
    expect(isAdjacent({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(false);
  });
  it("rings have 6r hexes", () => {
    expect(hexRing({ q: 5, r: 5 }, 2)).toHaveLength(12);
    expect(new Set(hexRing({ q: 5, r: 5 }, 2).map((h) => hexDistance(h, { q: 5, r: 5 })))).toEqual(new Set([2]));
  });
  it("classifies front / flank / rear arcs", () => {
    const d = { q: 0, r: 0 };
    expect(attackArc(d, 0, { q: 1, r: 0 })).toBe("front");
    expect(attackArc(d, 0, { q: -1, r: 0 })).toBe("rear");
    expect(attackArc(d, 0, { q: -1, r: 1 })).toBe("flank");
    expect(directionTo(d, { q: 0, r: 1 })).toBe(5);
  });
});
