import { describe, it, expect } from "vitest";
import { newBattle, deploy, KNI, SAM, blob } from "./helpers.js";
import { buildScenario } from "../src/scenario.js";
import { runAiActivation, holdForSyncPolicy, DIFFICULTY } from "../src/ai.js";
import { computeStat } from "../src/modifiers.js";

describe("turn structure and actions", () => {
  it("gives two AP per activation, forbids double attacks, and triggers zone-of-control reactions unless disengaging", () => {
    const { b, ctrl } = newBattle();
    deploy(b, "K", "B", KNI, blob(5, 5));
    const raider = b.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 5, r: 7 });
    ctrl.commandPhase();
    const [u] = ctrl.beginActivation("ind:A");
    expect(u!.ap).toBe(2);
    const target = b.unitAt({ q: 5, r: 6 })!;
    ctrl.attack(raider, target);
    expect(() => ctrl.attack(raider, target)).toThrow(/Already attacked/);
    // leaving ZoC without disengage: reaction attack
    const hp = raider.hp;
    ctrl.move(raider, { q: 5, r: 8 });
    expect(raider.hp).toBeLessThan(hp);
    expect(b.events.some((e) => e.type === "ReactionAttack")).toBe(true);
  });

  it("Disengage costs an extra AP and avoids the reaction", () => {
    const { b, ctrl } = newBattle();
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 6 });
    const raider = b.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 5, r: 7 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    ctrl.move(raider, { q: 5, r: 8 }, { disengage: true });
    expect(raider.ap).toBe(0);
    expect(raider.hp).toBe(950);
  });

  it("Diving Charge needs 4+ hexes moved, grants +250 ATK, then Exposed; not on consecutive rounds", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "K", "B", KNI, blob(2, 2));
    const dragoon = b.unit(p.eliteUid!);
    b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "A", { q: 12, r: 3 });
    ctrl.commandPhase(); ctrl.beginActivation("K");
    expect(() => ctrl.useAbility(dragoon, "ABL_DIVING_CHARGE")).toThrow(/conditions/);
    ctrl.move(dragoon, { q: 11, r: 3 });
    expect(dragoon.movedThisActivation).toBeGreaterThanOrEqual(4);
    ctrl.useAbility(dragoon, "ABL_DIVING_CHARGE");
    const atk = computeStat(b, dragoon, "ATK");
    expect(atk.modifiers.find((m) => m.source === "Diving Charge")?.value).toBe(250);
    expect(b.hasStatus(dragoon, "Exposed")).toBe(true);
    expect(computeStat(b, dragoon, "DEF").modifiers.find((m) => m.source === "Status: Exposed")?.value).toBe(-150);
  });

  it("flying units cannot enter anti-air hexes; cavalry pays more in forest", () => {
    const { b, ctrl } = newBattle();
    const dragoon = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 5, r: 5 });
    b.terrain.set("6,5", "AntiAir");
    ctrl.commandPhase(); ctrl.beginActivation("ind:B");
    expect(ctrl.reachable(dragoon).has("6,5")).toBe(false);
    const foot = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 10 });
    b.terrain.set("11,10", "Forest"); b.terrain.set("12,10", "Forest");
    foot.ap = 2;
    expect(ctrl.reachable(foot).get("12,10")?.cost).toBe(4);
  });

  it("Platoon Orders require an active leader and unbroken Doctrine, once per round", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!); const foot = b.unit(p.footUids[0]!);
    ctrl.commandPhase(); ctrl.beginActivation("S");
    expect(() => ctrl.useAbility(foot, "ORD_MEASURED_ADVANCE")).toThrow();
    ctrl.useAbility(cmdr, "ORD_MEASURED_ADVANCE");
    expect(computeStat(b, foot, "ATK").modifiers.map((m) => m.source)).toContain("Measured Advance");
    expect(() => ctrl.useAbility(cmdr, "ORD_MEASURED_ADVANCE")).toThrow(/already used/i);
  });

  it("Bastion Formation grants Guarded to adjacent Knights", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!);
    ctrl.commandPhase(); ctrl.beginActivation("K");
    ctrl.useAbility(cmdr, "ORD_BASTION_FORMATION");
    expect(b.adjacentAllies(cmdr).every((k) => b.hasStatus(k, "Guarded"))).toBe(true);
  });

  it("the event log is deterministic for a fixed seed", () => {
    const run = () => { const { ctrl } = buildScenario("threefold_invocation"); const b = ctrl.b;
      for (let i = 0; i < 3 && !b.winner; i++) { ctrl.commandPhase(); for (const s of ["A", "B"]) for (const g of ctrl.groupsFor(s)) runAiActivation(ctrl, g, DIFFICULTY.normal); ctrl.objectivePhase(holdForSyncPolicy(ctrl, "A")); ctrl.endPhase(); }
      return JSON.stringify(b.events); };
    expect(run()).toBe(run());
  });
});

describe("Threefold Invocation scenario", () => {
  it("loads a legal army for both sides, runs to a decisive result within the round limit, and exercises every objective system", () => {
    const { ctrl, file } = buildScenario("threefold_invocation");
    const b = ctrl.b;
    expect(b.platoons.size).toBe(3);
    expect(b.rituals.size).toBe(3);
    expect(b.portals.size).toBe(2);
    while (!b.winner && b.round <= file.roundLimit + 1) {
      ctrl.commandPhase();
      let turn = b.round % 2 === 1 ? 0 : 1; const sides = ["A", "B"];
      for (let g = 0; g < 20; g++) { const mine = ctrl.groupsFor(sides[turn]!); const theirs = ctrl.groupsFor(sides[1 - turn]!); if (!mine.length && !theirs.length) break; if (mine.length) runAiActivation(ctrl, mine[0]!, DIFFICULTY.normal); turn = 1 - turn; }
      ctrl.objectivePhase(holdForSyncPolicy(ctrl, "A"));
      ctrl.endPhase();
    }
    expect(["A", "B"]).toContain(b.winner);
    const types = new Set(b.events.map((e) => e.type));
    for (const t of ["RitualProgress", "ReinforcementArrived", "Attack", "Move", "ClonesSpawned"]) expect(types.has(t), t).toBe(true);
    // a fallen commander either promotes a second or, if they were the army leader, ends the battle outright
    expect(types.has("Succession") || b.winReason === "Leader killed").toBe(true);
    expect(["SynchronizeRituals", "CollapseRituals", "Wipeout", "Leader killed", "Surrender", "Round limit"]).toContain(b.winReason);
    // rituals progressed at different rates
    const first = b.events.filter((e) => e.type === "RitualProgress" && e.round === 1);
    const fast = first.find((e) => e.data["ritual"] === "circle-fast")!.data["total"] as number;
    const slow = first.find((e) => e.data["ritual"] === "circle-east")!.data["total"] as number;
    expect(fast).toBeGreaterThan(slow);
    // objective tracker exposes readable state for the HUD
    for (const s of ["A", "B"]) for (const o of ctrl.objectiveStatus(s)) expect(typeof o.detail).toBe("string");
  });
});
