import { describe, it, expect } from "vitest";
import { hexAlong } from "../src/hex.js";
import { generateMap } from "../src/mapgen.js";
import { resolvePlacement } from "../src/scenario-roles.js";
import { buildScenario } from "../src/scenario.js";
import { runAiActivation, holdForSyncPolicy, DIFFICULTY } from "../src/ai.js";

describe("hexAlong", () => {
  it("returns the endpoints at distance 0 and the full span, and extrapolates past either end", () => {
    const a = { q: 0, r: 0 }, b = { q: 10, r: 0 };
    expect(hexAlong(a, b, 0)).toEqual(a);
    expect(hexAlong(a, b, 10)).toEqual(b);
    expect(hexAlong(a, b, -3).q).toBeLessThan(a.q);
    expect(hexAlong(a, b, 13).q).toBeGreaterThan(b.q);
  });
  it("nudges sideways off the line without moving along it", () => {
    const a = { q: 0, r: 0 }, b = { q: 10, r: 0 };
    const mid = hexAlong(a, b, 5);
    const left = hexAlong(a, b, 5, 2), right = hexAlong(a, b, 5, -2);
    expect(left).not.toEqual(mid);
    expect(right).not.toEqual(mid);
    expect(left).not.toEqual(right);
  });
});

describe("resolvePlacement", () => {
  it("passes literal hexes through unchanged, even with no generated map", () => {
    expect(resolvePlacement(null, [4, 5])).toEqual({ q: 4, r: 5 });
  });
  it("refuses a role placement without a generated map", () => {
    expect(() => resolvePlacement(null, { role: "anchor", side: "A" })).toThrow(/generated field/);
  });
  it("resolves anchor, deployZone and along roles against a real generated map", () => {
    const map = generateMap({ seed: 42, width: 30, height: 22, size: 300 });
    expect(resolvePlacement(map, { role: "anchor", side: "A" })).toEqual(map.anchors.A);
    expect(resolvePlacement(map, { role: "deployZone", side: "B", index: 0 })).toEqual(map.deployZones.B[0]);
    const along = resolvePlacement(map, { role: "along", from: "A", to: "B", distance: 5 });
    expect(along.q).toEqual(expect.any(Number));
    expect(along.r).toEqual(expect.any(Number));
  });
});

describe("Ford Crossing scenario (generated field, role-pinned features)", () => {
  it("builds a legal battle whose ritual, portal and objective hexes move with the field", () => {
    const { ctrl: c1, file } = buildScenario("ford_crossing", undefined, 111);
    const { ctrl: c2 } = buildScenario("ford_crossing", undefined, 222);
    expect(c1.b.platoons.size).toBe(2);
    expect(c1.b.rituals.size).toBe(1);
    expect(c1.b.portals.size).toBe(1);
    const ritual1 = [...c1.b.rituals.values()][0]!, ritual2 = [...c2.b.rituals.values()][0]!;
    const portal1 = [...c1.b.portals.values()][0]!, portal2 = [...c2.b.portals.values()][0]!;
    // different seeds regenerate the field, so role-pinned features land on different hexes...
    expect(ritual1.center).not.toEqual(ritual2.center);
    expect(portal1.pos).not.toEqual(portal2.pos);
    // ...yet every objective hex still resolved to a concrete hex, not a leftover role object
    for (const ctrl of [c1, c2]) for (const side of Object.values(ctrl.victory.sides)) for (const o of side) {
      if (o.type === "CaptureHold" || o.type === "Escort") { expect(typeof o.hex.q).toBe("number"); expect(typeof o.hex.r).toBe("number"); }
    }
    expect(file.roundLimit).toBe(10);
  });

  it("plays out to a decision within the round limit on more than one regeneration of the field", () => {
    for (const seed of [111, 222, 333]) {
      const { ctrl } = buildScenario("ford_crossing", undefined, seed);
      const b = ctrl.b;
      while (!b.winner && b.round <= 11) {
        ctrl.commandPhase();
        let turn = b.round % 2 === 1 ? 0 : 1; const sides = ["A", "B"];
        for (let g = 0; g < 20; g++) {
          const mine = ctrl.groupsFor(sides[turn]!), theirs = ctrl.groupsFor(sides[1 - turn]!);
          if (!mine.length && !theirs.length) break;
          if (mine.length) runAiActivation(ctrl, mine[0]!, DIFFICULTY.normal!);
          turn = 1 - turn;
        }
        ctrl.objectivePhase(holdForSyncPolicy(ctrl, "A"));
        ctrl.endPhase();
      }
      expect(["A", "B", "draw"]).toContain(b.winner);
    }
  });
});
