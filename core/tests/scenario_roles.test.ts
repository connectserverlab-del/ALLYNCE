import { describe, it, expect } from "vitest";
import { buildScenario, resolvePosition, mapContext, type PositionSpec } from "../src/scenario.js";
import { generateMap } from "../src/mapgen.js";
import { hexDistance, hexKey } from "../src/hex.js";
import { reg } from "./helpers.js";

describe("position roles against a generated field", () => {
  const map = generateMap({ seed: 99 });
  const ctx = mapContext(map);

  it("anchor resolves to the map's own deployment anchor", () => {
    expect(resolvePosition(ctx, new Set(), { role: "anchor", side: "A" })).toEqual(map.anchors.A);
    expect(resolvePosition(ctx, new Set(), { role: "anchor", side: "B" })).toEqual(map.anchors.B);
  });

  it("deployZone indexes into the generated zone and wraps out-of-range indices", () => {
    const zone = map.deployZones.A;
    expect(resolvePosition(ctx, new Set(), { role: "deployZone", side: "A", index: 0 })).toEqual(zone[0]);
    expect(resolvePosition(ctx, new Set(), { role: "deployZone", side: "A", index: zone.length })).toEqual(zone[0]);
    expect(resolvePosition(ctx, new Set(), { role: "deployZone", side: "A", index: -1 })).toEqual(zone[zone.length - 1]);
  });

  it("lerp walks the line between two positions and snaps to standable ground", () => {
    const a = resolvePosition(ctx, new Set(), { role: "anchor", side: "A" });
    const b = resolvePosition(ctx, new Set(), { role: "anchor", side: "B" });
    const mid = resolvePosition(ctx, new Set(), { role: "lerp", from: { role: "anchor", side: "A" }, to: { role: "anchor", side: "B" }, frac: 0.5 }) as { q: number; r: number };
    expect(hexDistance(mid, a)).toBeLessThan(hexDistance(a, b));
    expect(hexDistance(mid, b)).toBeLessThan(hexDistance(a, b));
    const mh = ctx.index!.get(hexKey(mid));
    expect(mh).toBeTruthy();
    expect(mh!.terrain).not.toBe("Mountain");
    expect(mh!.terrain).not.toBe("Water");
  });

  it("lerp's lateral offset moves the point off the direct line without leaving standable ground", () => {
    const spec = (lateral: number): PositionSpec => ({ role: "lerp", from: { role: "anchor", side: "A" }, to: { role: "anchor", side: "B" }, frac: 0.4, lateral });
    const straight = resolvePosition(ctx, new Set(), spec(0));
    const offset = resolvePosition(ctx, new Set(), spec(3));
    expect(offset).not.toEqual(straight);
    const oh = ctx.index!.get(hexKey(offset));
    expect(oh).toBeTruthy();
  });

  it("near picks a deterministic, wrapping hex off the ring and skips hexes already claimed", () => {
    const from: PositionSpec = { role: "anchor", side: "A" };
    const used = new Set<string>();
    const first = resolvePosition(ctx, used, { role: "near", from, ring: 2, index: 0 });
    used.add(hexKey(first));
    const second = resolvePosition(ctx, used, { role: "near", from, ring: 2, index: 0 });
    expect(second).not.toEqual(first); // the first candidate is claimed, so this call must land elsewhere
    expect(hexDistance(first, map.anchors.A)).toBeLessThanOrEqual(2);
  });

  it("ritualCenter looks up a name registered by the caller, and rejects an unknown one", () => {
    const withCenter = mapContext(map);
    withCenter.ritualCenters.set("circle-x", { q: 1, r: 1 });
    expect(resolvePosition(withCenter, new Set(), { role: "ritualCenter", id: "circle-x" })).toEqual({ q: 1, r: 1 });
    expect(() => resolvePosition(withCenter, new Set(), { role: "ritualCenter", id: "circle-missing" })).toThrow(/no resolved center/);
  });

  it("a role position on a fixed (non-generated) map throws a clear error", () => {
    const fixedCtx = mapContext(null);
    expect(() => resolvePosition(fixedCtx, new Set(), { role: "anchor", side: "A" })).toThrow(/needs a generated map/);
  });

  it("a literal [q, r] tuple always resolves to itself, generated map or not", () => {
    expect(resolvePosition(ctx, new Set(), [3, 4])).toEqual({ q: 3, r: 4 });
    expect(resolvePosition(mapContext(null), new Set(), [3, 4])).toEqual({ q: 3, r: 4 });
  });
});

describe("scenario authoring on a generated field (ashfall_crossing)", () => {
  it("builds a fresh, legal battlefield from the same file on every seed", () => {
    const seeds = [1, 2, 3, 4, 20260905];
    const layouts = seeds.map((seed) => buildScenario("ashfall_crossing", reg, seed));
    // every seed gets its own concrete field: anchors differ across at least some of these seeds
    const anchorSets = new Set(layouts.map((l) => JSON.stringify(l.map!.anchors)));
    expect(anchorSets.size).toBeGreaterThan(1);
    for (const { ctrl, map } of layouts) {
      const b = ctrl.b;
      expect(map).toBeTruthy();
      // every spawned unit sits on standable, in-mask ground
      for (const u of b.units.values()) {
        expect(u.pos).toBeTruthy();
        expect(b.inBounds(u.pos!)).toBe(true);
        expect(b.terrainAt(u.pos!)).not.toBe("Mountain");
        expect(b.terrainAt(u.pos!)).not.toBe("Water");
      }
      // no two units share a hex
      const seen = new Set<string>();
      for (const u of b.units.values()) { const k = hexKey(u.pos!); expect(seen.has(k)).toBe(false); seen.add(k); }
      // both sides have a leader and a Fusion charge, same as every scenario
      for (const s of b.sides.values()) { expect(s.leaderUid).toBeTruthy(); expect(s.fusionCharges).toBe(1); }
    }
  });

  it("keeps the ritual's leader and ritualists inside the ritual's own radius, seed after seed", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { ctrl } = buildScenario("ashfall_crossing", reg, seed);
      const b = ctrl.b;
      const ritual = [...b.rituals.values()][0]!;
      const participants = [...b.units.values()].filter((u) => u.defId === "RIT_LEADER_AFFILIATED-SUMMONER" || u.defId === "RIT_FOOT_FOREIGN-RITUALIST");
      expect(participants.length).toBe(3);
      for (const u of participants) expect(hexDistance(u.pos!, ritual.center)).toBeLessThanOrEqual(ritual.radius);
    }
  });

  it("resolves the CaptureHold objective to a concrete hex between the two anchors", () => {
    const { ctrl, map } = buildScenario("ashfall_crossing", reg, 5);
    const captureHold = ctrl.victory.sides["A"]!.find((o) => o.type === "CaptureHold") as { hex: { q: number; r: number } } | undefined;
    expect(captureHold).toBeTruthy();
    expect(hexDistance(captureHold!.hex, map!.anchors.A)).toBeLessThan(hexDistance(map!.anchors.A, map!.anchors.B));
    expect(hexDistance(captureHold!.hex, map!.anchors.B)).toBeLessThan(hexDistance(map!.anchors.A, map!.anchors.B));
  });

  it("the reinforcement portal opens clear of the DRG lines and queues its reinforcement", () => {
    const { ctrl } = buildScenario("ashfall_crossing", reg, 3);
    const portal = [...ctrl.b.portals.values()].find((p) => p.id === "portal-riverguard");
    expect(portal).toBeTruthy();
    expect(portal!.queue.length).toBe(1);
  });

  it("still builds and plays a round on its authored seed without throwing", () => {
    const { ctrl } = buildScenario("ashfall_crossing");
    ctrl.commandPhase();
    expect(ctrl.b.round).toBe(1);
  });
});
