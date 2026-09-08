import { describe, it, expect } from "vitest";
import {
  hexDistance, hexNeighbors, isAdjacent, attackArc, hexRing, hexesWithin, directionTo,
  hexKey, hexEq, hexAdd, DIRECTIONS,
} from "../src/hex.js";
import type { Facing } from "../src/hex.js";

describe("hex grid", () => {
  it("distance and adjacency", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
    expect(hexNeighbors({ q: 0, r: 0 })).toHaveLength(6);
    expect(isAdjacent({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(true);
    expect(isAdjacent({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(false);
    expect(isAdjacent({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(false); // a hex is not adjacent to itself
  });

  it("hexKey stringifies coordinates uniquely, hexEq and hexAdd are plain coordinate math", () => {
    expect(hexKey({ q: 3, r: -2 })).toBe("3,-2");
    expect(hexKey({ q: -2, r: 3 })).not.toBe(hexKey({ q: 3, r: -2 })); // order matters, no accidental collision
    expect(hexEq({ q: 1, r: 2 }, { q: 1, r: 2 })).toBe(true);
    expect(hexEq({ q: 1, r: 2 }, { q: 2, r: 1 })).toBe(false);
    expect(hexAdd({ q: 1, r: 2 }, { q: -1, r: 3 })).toEqual({ q: 0, r: 5 });
  });

  it("hexNeighbors is DIRECTIONS translated onto the origin hex", () => {
    const center = { q: 4, r: -1 };
    const expected = DIRECTIONS.map((d) => hexAdd(center, d));
    expect(hexNeighbors(center)).toEqual(expected);
  });

  it("rings have 6r hexes, all at exactly radius r, and radius 0 is just the center", () => {
    expect(hexRing({ q: 5, r: 5 }, 0)).toEqual([{ q: 5, r: 5 }]);
    expect(hexRing({ q: 5, r: 5 }, 1)).toHaveLength(6);
    expect(hexRing({ q: 5, r: 5 }, 2)).toHaveLength(12);
    expect(new Set(hexRing({ q: 5, r: 5 }, 2).map((h) => hexDistance(h, { q: 5, r: 5 })))).toEqual(new Set([2]));
  });

  it("hexesWithin is every ring from 0 to radius, with no duplicate hexes", () => {
    const center = { q: 2, r: 2 };
    const within2 = hexesWithin(center, 2);
    expect(within2).toHaveLength(1 + 6 + 12); // ring 0 + ring 1 + ring 2
    expect(new Set(within2.map(hexKey)).size).toBe(within2.length); // no repeats
    for (const h of within2) expect(hexDistance(h, center)).toBeLessThanOrEqual(2);
  });

  it("directionTo maps each of the six DIRECTIONS back to its own index", () => {
    const origin = { q: 0, r: 0 };
    for (let i = 0; i < 6; i++) expect(directionTo(origin, DIRECTIONS[i]!)).toBe(i);
    expect(directionTo({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(5);
  });

  it("classifies front / flank / rear arcs", () => {
    const d = { q: 0, r: 0 };
    expect(attackArc(d, 0, { q: 1, r: 0 })).toBe("front");
    expect(attackArc(d, 0, { q: -1, r: 0 })).toBe("rear");
    expect(attackArc(d, 0, { q: -1, r: 1 })).toBe("flank");
  });

  it("arc classification is symmetric around the facing direction, for every facing", () => {
    // For any facing, the attacker directly ahead is front, the two hexes adjacent to
    // straight-ahead are also front, the next two around are flank, and directly behind is rear.
    for (let facing = 0; facing < 6; facing++) {
      const f = facing as Facing;
      const arcAt = (offset: number) => attackArc(
        { q: 0, r: 0 }, f, DIRECTIONS[((facing + offset) % 6 + 6) % 6]!,
      );
      expect(arcAt(0)).toBe("front");
      expect(arcAt(1)).toBe("front");
      expect(arcAt(-1)).toBe("front");
      expect(arcAt(2)).toBe("flank");
      expect(arcAt(-2)).toBe("flank");
      expect(arcAt(3)).toBe("rear");
    }
  });
});
