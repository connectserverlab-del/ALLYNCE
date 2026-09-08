import { describe, it, expect } from "vitest";
import { generateMap, terrainCounts, applyMap } from "../src/mapgen.js";
import { newBattle } from "./helpers.js";
import { hexKey, hexNeighbors } from "../src/hex.js";

describe("irregular battlefield generator", () => {
  it("produces odd-shaped, connected, varied fields deterministically", () => {
    const a = generateMap({ seed: 42 }), b = generateMap({ seed: 42 }), c = generateMap({ seed: 7 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a.hexes)).not.toBe(JSON.stringify(c.hexes));
    expect(a.hexes.length).toBeGreaterThan(250);
    // not a rectangle: row widths differ a lot
    const widths = new Map<number, number>();
    for (const h of a.hexes) widths.set(h.r, (widths.get(h.r) ?? 0) + 1);
    const ws = [...widths.values()];
    expect(Math.max(...ws) - Math.min(...ws)).toBeGreaterThan(6);
    // real ground: mountains, valleys, forest, trenches, roads all present
    const counts = terrainCounts(a);
    for (const t of ["Mountain", "Valley", "Forest", "Trench", "Road", "HighGround"]) expect(counts[t] ?? 0, t).toBeGreaterThan(0);
    // every hex is connected to the rest
    const set = new Set(a.hexes.map(hexKey));
    const seen = new Set<string>([hexKey(a.hexes[0]!)]); const stack: Array<{ q: number; r: number }> = [{ q: a.hexes[0]!.q, r: a.hexes[0]!.r }];
    while (stack.length) { const h = stack.pop()!; for (const n of hexNeighbors(h)) { const k = hexKey(n); if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push(n); } } }
    expect(seen.size).toBe(set.size);
    // deployment zones are standable and far apart
    expect(a.deployZones.A.length).toBeGreaterThanOrEqual(8);
    expect(a.deployZones.B.length).toBeGreaterThanOrEqual(8);
    const byKey = new Map(a.hexes.map((h) => [hexKey({ q: h.q, r: h.r }), h]));
    for (const z of [...a.deployZones.A, ...a.deployZones.B]) expect(["Water", "Mountain", "Trench"]).not.toContain(byKey.get(hexKey(z))!.terrain);
  });

  it("loads into a battle: mountains block ground units, trenches block cavalry, mud slows, roads are cheap", () => {
    const { b, ctrl } = newBattle();
    const m = generateMap({ seed: 42 });
    applyMap(b, m);
    expect(b.mask!.size).toBe(m.hexes.length);
    const anyOff = { q: -50, r: -50 };
    expect(b.inBounds(anyOff)).toBe(false);
    // synthetic movement check on a cleared patch
    b.mask = null; b.terrain.clear(); b.elevation.clear(); b.width = 24; b.height = 18;
    const foot = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 5, r: 5 });
    const cav = b.spawn("KNI_CAVALRY_DAWN-LANCER", "A", { q: 12, r: 12 });
    b.terrain.set("6,5", "Mountain"); b.terrain.set("5,6", "Trench"); b.terrain.set("4,5", "Mud"); b.terrain.set("5,4", "Road");
    b.terrain.set("13,12", "Trench"); b.terrain.set("12,13", "Mud");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    const rf = ctrl.reachable(foot);
    // mountains are not walls: a foot soldier may still climb one hex, but it costs the whole activation
    expect(rf.get("6,5")?.cost).toBe(5);
    expect(rf.get("6,5")?.labored).toBe(true);
    expect(rf.get("5,6")?.cost).toBe(2);
    expect(rf.get("5,6")?.labored).toBeUndefined();
    expect(rf.get("4,5")?.cost).toBe(2);
    expect(rf.get("5,4")?.cost).toBe(1);
    const rc = ctrl.reachable(cav);
    expect(rc.has("13,12")).toBe(false);           // a trench is closed to horses outright, not merely slow
    expect(rc.get("12,13")?.cost).toBe(1);         // Knight-Errant rank: surefoot, mud costs 1 instead of 3
  });

  it("charges break in rough ground and elevation gives attackers an edge", async () => {
    const { b, ctrl } = newBattle();
    const lancer = b.spawn("KNI_CAVALRY_DAWN-LANCER", "A", { q: 2, r: 5 });
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 9, r: 5 });
    b.terrain.set("5,5", "Mud");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    ctrl.move(lancer, { q: 5, r: 5 });
    expect(lancer.chargeMoved).toBe(0); // mud broke the charge
    lancer.ap = 2; ctrl.move(lancer, { q: 8, r: 5 });
    expect(lancer.chargeMoved).toBe(3);
    ctrl.useAbility(lancer, "ABL_LANCE_CHARGE");
    const enemy = b.unitAt({ q: 9, r: 5 })!;
    b.elevation.set("8,5", 2); b.elevation.set("9,5", 1);
    const { computeStat } = await import("../src/modifiers.js");
    const atk = computeStat(b, lancer, "ATK", { attacker: lancer, defender: enemy });
    expect(atk.modifiers.map((m) => m.source)).toContain("Lance Charge");
    expect(atk.modifiers.map((m) => m.source)).toContain("Elevation advantage");
  });
});

describe("mountains", () => {
  it("cost five times open ground for foot, six for cavalry, and only two on the wing", async () => {
    const { TERRAIN_RULES } = await import("../src/types.js");
    expect(TERRAIN_RULES.Mountain.costFoot).toBe(5);
    expect(TERRAIN_RULES.Mountain.costCavalry).toBe(6);
    expect(TERRAIN_RULES.Mountain.costFlying).toBe(2);
    expect(TERRAIN_RULES.Open.costFoot).toBe(1);
  });

  it("a climb takes a whole activation for foot, while a flier crosses the range in stride", () => {
    const { b, ctrl } = newBattle();
    const foot = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const drake = b.spawn("DRG_FOOT_SLATEWING-DRAKE", "A", { q: 5, r: 10 });
    for (const q of [6, 7, 8]) { b.terrain.set(`${q},5`, "Mountain"); b.terrain.set(`${q},10`, "Mountain"); }
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    // the flier crosses the range in stride: two points a hex, no labour
    const rd = ctrl.reachable(drake);
    expect(rd.get("6,10")?.cost).toBe(2);
    expect(rd.get("6,10")?.labored).toBeUndefined();
    expect(rd.get("8,10")?.labored).toBeUndefined();
    // the foot soldier can only take the first hex, and it ends the activation
    const r = ctrl.reachable(foot);
    expect(r.get("6,5")?.labored).toBe(true);
    expect(r.has("7,5")).toBe(false);
    ctrl.move(foot, { q: 6, r: 5 });
    expect(foot.ap).toBe(0);
    expect(foot.pos).toEqual({ q: 6, r: 5 });
    expect(b.events.some((e) => e.type === "LaboredClimb")).toBe(true);
    // and a second climb in the same activation is refused
    expect(() => ctrl.move(foot, { q: 7, r: 5 })).toThrow();
  });

  it("a charge cannot be built up across a mountain", () => {
    const { b, ctrl } = newBattle();
    const lancer = b.spawn("KNI_CAVALRY_DAWN-LANCER", "A", { q: 4, r: 4 });
    b.terrain.set("5,4", "Mountain");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    ctrl.move(lancer, { q: 5, r: 4 });
    expect(lancer.chargeMoved).toBe(0);
  });
});
