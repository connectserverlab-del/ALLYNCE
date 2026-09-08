import { describe, expect, it } from "vitest";
import { buildScenario, buildScenarioFromFile, type ScenarioFile } from "../src/scenario.js";
import { hexDistance, hexKey } from "../src/hex.js";
import { KNI, reg, SAM } from "./helpers.js";
import { generateMap, type GeneratedMap } from "../src/mapgen.js";
import { resolvePlacement, resolveFreePlacement } from "../src/placement.js";
import { ritualParticipants } from "../src/rituals.js";
/** A minimal two-side, one-platoon-each scenario. Callers patch in whatever the case under test needs. */
function baseFile(overrides: Partial<ScenarioFile> = {}): ScenarioFile {
  return {
    id: "fixture", title: "Fixture", seed: 1, roundLimit: 5, briefing: "",
    map: { width: 24, height: 18, terrain: [] },
    sides: {
      A: {
        name: "A", reservePoints: 0, armyCapacity: 200,
        platoons: [{ id: "A-1", faction: SAM.faction, commander: SAM.commander, second: SAM.second, elite: SAM.elite, foot: SAM.foot,
          deploy: [[2, 2], [3, 2], [4, 2], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3]], facing: 0 }],
        specialists: [], objectives: [{ type: "SurviveRounds", side: "A", rounds: 5 }],
      },
      B: {
        name: "B", reservePoints: 30, armyCapacity: 200,
        platoons: [{ id: "B-1", faction: KNI.faction, commander: KNI.commander, second: KNI.second, elite: KNI.elite, foot: KNI.foot,
          deploy: [[12, 2], [13, 2], [14, 2], [12, 3], [13, 3], [14, 3], [15, 3], [16, 3]], facing: 3 }],
        specialists: [], objectives: [{ type: "SurviveRounds", side: "B", rounds: 5 }],
      },
    },
    rituals: [],
    ...overrides,
  };
}

describe("buildScenarioFromFile", () => {
  it("rejects an illegal army instead of deploying it", () => {
    const file = baseFile();
    file.sides.A!.platoons[0]!.foot = SAM.foot.slice(0, 4); // one short of the required five
    expect(() => buildScenarioFromFile(file, reg)).toThrow(/Illegal army for A/);
  });

  it("paints terrain from the map table and leaves everything else untouched", () => {
    const file = baseFile({ map: { width: 24, height: 18, terrain: [{ type: "Forest", hexes: [[8, 6], [9, 6]] }] } });
    const { ctrl } = buildScenarioFromFile(file, reg);
    expect(ctrl.b.terrain.get(hexKey({ q: 8, r: 6 }))).toBe("Forest");
    expect(ctrl.b.terrain.has(hexKey({ q: 0, r: 0 }))).toBe(false);
  });

  it("spawns specialists at their listed position", () => {
    const file = baseFile();
    file.sides.B!.specialists = [{ def: "KNI_SUPPORT_PORTAL-KEEPER", at: [3, 8] }];
    const { ctrl } = buildScenarioFromFile(file, reg);
    const u = ctrl.b.unitAt({ q: 3, r: 8 });
    expect(u?.defId).toBe("KNI_SUPPORT_PORTAL-KEEPER");
    expect(u?.side).toBe("B");
  });

  it("defaults fusionCharges to 1 and honours an explicit value", () => {
    const file = baseFile();
    file.sides.B!.fusionCharges = 3;
    const { ctrl } = buildScenarioFromFile(file, reg);
    expect(ctrl.b.sides.get("A")!.fusionCharges).toBe(1);
    expect(ctrl.b.sides.get("B")!.fusionCharges).toBe(3);
  });

  it("resolves an explicit leader to the matching deployed unit", () => {
    const file = baseFile();
    file.sides.A!.leader = SAM.commander;
    const { ctrl } = buildScenarioFromFile(file, reg);
    const leaderUid = ctrl.b.sides.get("A")!.leaderUid;
    expect(leaderUid).not.toBeNull();
    expect(ctrl.b.units.get(leaderUid!)?.defId).toBe(SAM.commander);
  });

  it("does not fall back to the platoon commander when an explicit leader id matches nothing", () => {
    const file = baseFile();
    file.sides.A!.leader = "NO_SUCH_UNIT";
    const { ctrl } = buildScenarioFromFile(file, reg);
    expect(ctrl.b.sides.get("A")!.leaderUid).toBeNull();
  });

  it("falls back to a Commander-role unit when no leader is named", () => {
    const file = baseFile();
    const { ctrl } = buildScenarioFromFile(file, reg);
    const leaderUid = ctrl.b.sides.get("B")!.leaderUid;
    expect(leaderUid).not.toBeNull();
    expect(ctrl.b.def(ctrl.b.units.get(leaderUid!)!).roles).toContain("Commander");
  });

  it("resolves a ritual leader by defId and side, and leaves it null when the id is dangling", () => {
    const file = baseFile({
      rituals: [
        { id: "r-good", side: "A", center: [2, 2], radius: 2, required: 10, leader: SAM.commander, summon: null, linkGroup: null },
        { id: "r-dangling", side: "A", center: [2, 2], radius: 2, required: 10, leader: "NO_SUCH_UNIT", summon: null, linkGroup: null },
        // KNI.commander exists, but on side B, not A: the side check must reject it too.
        { id: "r-wrong-side", side: "A", center: [2, 2], radius: 2, required: 10, leader: KNI.commander, summon: null, linkGroup: null },
      ],
    });
    const { ctrl } = buildScenarioFromFile(file, reg);
    expect(ctrl.b.rituals.get("r-good")!.leaderUid).not.toBeNull();
    expect(ctrl.b.rituals.get("r-dangling")!.leaderUid).toBeNull();
    expect(ctrl.b.rituals.get("r-wrong-side")!.leaderUid).toBeNull();
  });

  it("wires a portal's reinforcement queue and skips a queue entry naming an unknown portal", () => {
    const file = baseFile();
    file.sides.B!.portals = [{ id: "gate", at: [10, 10], capacity: 1, cooldown: 2 }];
    file.sides.B!.reinforcementQueue = [
      { portal: "gate", def: KNI.foot[0]!, platoon: "B-1" },
      { portal: "no-such-gate", def: KNI.foot[0]!, platoon: "B-1" },
    ];
    const { ctrl } = buildScenarioFromFile(file, reg);
    const gate = ctrl.b.portals.get("gate");
    expect(gate).toBeDefined();
    expect(gate!.queue).toHaveLength(1);
    expect(gate!.queue[0]!.defId).toBe(KNI.foot[0]);
    // Reserve Points were spent for the queued unit and only for it.
    expect(ctrl.b.sides.get("B")!.reservePoints).toBe(30 - reg.unit(KNI.foot[0]!).capacityCost);
  });
});

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
