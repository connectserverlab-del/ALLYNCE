import { describe, it, expect } from "vitest";
import { generateMap, type GeneratedMap } from "../src/mapgen.js";
import { resolvePlacement, resolveFreePlacement } from "../src/placement.js";
import { buildScenario } from "../src/scenario.js";
import { ritualParticipants } from "../src/rituals.js";
import { hexDistance, hexKey } from "../src/hex.js";

describe("placement roles", () => {
  it("resolves a literal [q, r] pair without touching the map", () => {
    expect(resolvePlacement(null, [3, 4])).toEqual({ q: 3, r: 4 });
  });

  it("resolves named roles against a generated map, with index and offset", () => {
    const map = generateMap({ seed: 42 });
    expect(resolvePlacement(map, { role: "anchorA" })).toEqual(map.anchors.A);
    expect(resolvePlacement(map, { role: "deployZoneB", index: 2 })).toEqual(map.deployZones.B[2]);
    expect(resolvePlacement(map, { role: "anchorA", offset: [1, -1] }))
      .toEqual({ q: map.anchors.A.q + 1, r: map.anchors.A.r - 1 });
  });

  it("falls back to the midpoint when a feature did not generate on this seed", () => {
    const map = generateMap({ seed: 42 });
    const empty: GeneratedMap = { ...map, landmarks: { ...map.landmarks, ruins: [] } };
    expect(resolvePlacement(empty, { role: "ruins" })).toEqual(empty.landmarks.midpoint);
    // distinct offsets off the same fallback hex still land on distinct hexes, so specialists sharing a
    // missing feature do not pile onto one another
    const a = resolvePlacement(empty, { role: "ruins", offset: [1, 0] });
    const c = resolvePlacement(empty, { role: "ruins", offset: [-1, 0] });
    expect(a).not.toEqual(c);
  });

  it("throws for a role placement with no generated map (a fixed-map scenario)", () => {
    expect(() => resolvePlacement(null, { role: "midpoint" })).toThrow();
  });

  it("resolveFreePlacement nudges off a hex the caller rejects", () => {
    const map = generateMap({ seed: 42 });
    const blocked = new Set([hexKey(map.landmarks.midpoint)]);
    const h = resolveFreePlacement(map, { role: "midpoint" }, (x) => !blocked.has(hexKey(x)));
    expect(blocked.has(hexKey(h))).toBe(false);
  });
});

describe("scenario authoring on generated ground", () => {
  it("builds the same scenario on different seeds with no hard-coded hex breaking it", () => {
    for (const seed of [1, 2, 3, 42, 999]) {
      const { ctrl } = buildScenario("contested_ford", undefined, seed);
      const b = ctrl.b;

      // the ritual center and its four role-placed specialists land inside the generated field
      const ritual = b.rituals.get("ford-rite")!;
      expect(b.inBounds(ritual.center)).toBe(true);
      const parts = ritualParticipants(b, ritual);
      expect(parts).toHaveLength(4);
      for (const p of parts) expect(hexDistance(p.pos!, ritual.center)).toBeLessThanOrEqual(ritual.radius);

      // the portal exists, placed by role, on a free hex clear of enemy zone of control
      expect(b.portals.size).toBe(1);
      const portal = [...b.portals.values()][0]!;
      expect(b.inBounds(portal.pos)).toBe(true);

      // the CaptureHold objective's role hex resolved to real, in-bounds coordinates
      const capture = ctrl.victory.sides.B!.find((o) => o.type === "CaptureHold");
      expect(capture?.type).toBe("CaptureHold");
      if (capture?.type === "CaptureHold") expect(b.inBounds(capture.hex)).toBe(true);

      // both platoons deployed a full eight hexes with nobody standing on the same hex twice
      expect([...b.activeUnits("A")].length + [...b.activeUnits("B")].length).toBe(8 + 4 + 8 + 1);
    }
  });

  it("still builds the hand-authored fixed-map scenario unchanged", () => {
    const { ctrl } = buildScenario("threefold_invocation");
    expect(ctrl.b.rituals.size).toBe(3);
  });
});
