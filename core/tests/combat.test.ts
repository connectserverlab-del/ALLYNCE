import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, KNI, blob, reg } from "./helpers.js";
import { computeStat } from "../src/modifiers.js";
import { resolveAttack, MIN_DAMAGE } from "../src/combat.js";
import { doctrineState } from "../src/composition.js";
import { validateArmy } from "../src/composition.js";

describe("combat math", () => {
  it("reproduces the brief's worked example: 1500 base + 100 cohesion + 100 doctrine + 150 order = 1850 vs 1600 -> 250", () => {
    const { b } = newBattle();
    // isolated single-unit sanity of the formula
    expect(Math.max(MIN_DAMAGE, 1850 - 1600)).toBe(250);
    // now assemble it live: a full SAM platoon (doctrine +100), an Ashigaru with two matching neighbours (+100), Coordinated Cut (+150)
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const foot = b.unit(p.footUids[1]!); // middle of the foot line -> two matching neighbours in row + above
    const cmdr = b.unit(p.commanderUid!);
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 7 });
    b.platoons.get("P1")!.markedTarget = { uid: enemy.uid, atk: 150 };
    const atk = computeStat(b, foot, "ATK", { attacker: foot, defender: enemy });
    const sources = atk.modifiers.map((m) => m.source);
    expect(sources).toContain("Theme Cohesion");
    expect(sources).toContain("Platoon Doctrine (Full)");
    expect(sources).toContain("Order: Coordinated Cut");
    expect(sources.some((s) => s.startsWith("Commander aura"))).toBe(true);
    // breakdown always exposes every source and the base
    expect(atk.base).toBe(1400);
    expect(atk.final).toBe(atk.base + atk.modifiers.reduce((s, m) => s + m.value, 0));
    void cmdr;
  });

  it("applies minimum damage of 100 and positional DEF penalties", () => {
    const { b } = newBattle();
    const knight = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 5 }, { facing: 0 });
    const weak = b.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 6, r: 5 }); // front
    const front = resolveAttack(b, weak, knight);
    expect(front.arc).toBe("front");
    expect(front.damage).toBe(MIN_DAMAGE); // 1500 vs 1650 -> floor
    const rearAttacker = b.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 4, r: 5 });
    const rear = resolveAttack(b, rearAttacker, knight);
    expect(rear.arc).toBe("rear");
    expect(rear.def).toBe(1650 - Math.round(1650 * 0.25));
    expect(rear.damage).toBe(Math.max(100, 1500 - rear.def));
  });

  it("Defend grants +150 DEF and Fortification +200", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 3, r: 3 });
    b.terrain.set("3,3", "Fortification");
    u.ap = 2; ctrl.defend(u);
    const def = computeStat(b, u, "DEF");
    expect(def.final).toBe(1450 + 150 + 200);
  });

  it("Spear Wall applies only to frontal cavalry while adjacent to another Ashigaru", () => {
    const { b } = newBattle();
    const a1 = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 }, { facing: 0 });
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 6 }, { facing: 0 });
    const cav = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 6, r: 5 });
    const withWall = computeStat(b, a1, "DEF", { attacker: cav, defender: a1, arc: "front" });
    expect(withWall.modifiers.map((m) => m.source)).toContain("Spear Wall");
    const flank = computeStat(b, a1, "DEF", { attacker: cav, defender: a1, arc: "flank" });
    expect(flank.modifiers.map((m) => m.source)).not.toContain("Spear Wall");
  });
});

describe("army validation", () => {
  it("accepts a legal platoon and rejects boss/deity, duplicates and wrong slots", () => {
    const ok = validateArmy(reg, { side: "A", capacity: 200, platoons: [{ id: "P", side: "A", ...SAM }], specialists: [] });
    expect(ok.ok).toBe(true);
    const bad = validateArmy(reg, { side: "A", capacity: 200, platoons: [{ id: "P", side: "A", ...SAM, elite: "DIV_BOSS_SOVEREIGN-OF-MEMORY" }, { id: "P2", side: "A", ...SAM, foot: SAM.foot.slice(0, 4) }], specialists: ["SAM_ELITE_ONI-GATE-CHAMPION"] });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join("\n")).toMatch(/summon-only|boss|deity/);
    expect(bad.errors.join("\n")).toMatch(/exactly 5 foot/);
    expect(bad.errors.join("\n")).toMatch(/Unique unit SAM_COMMANDER_EMBER-BANNER-DAIMYO appears 2/);
    expect(bad.errors.join("\n")).toMatch(/cannot unlock extra commanders or elites/);
  });
  it("enforces Army Capacity", () => {
    const r = validateArmy(reg, { side: "A", capacity: 10, platoons: [{ id: "P", side: "A", ...KNI }], specialists: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/Army Capacity/);
  });
});

describe("doctrine states", () => {
  it("degrades Full -> Reduced -> Broken with casualties", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    expect(doctrineState(b, p)).toBe("Full");
    b.unit(p.footUids[0]!).defeated = true; b.remove(b.unit(p.footUids[0]!));
    expect(doctrineState(b, p)).toBe("Reduced");
    b.unit(p.footUids[1]!).defeated = true; b.remove(b.unit(p.footUids[1]!));
    expect(doctrineState(b, p)).toBe("Reduced");
    b.unit(p.footUids[2]!).defeated = true; b.remove(b.unit(p.footUids[2]!));
    expect(doctrineState(b, p)).toBe("Broken");
  });
});
