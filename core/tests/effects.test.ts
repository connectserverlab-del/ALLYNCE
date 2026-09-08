import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, SHI, KNI, blob } from "./helpers.js";
import type { PlatoonBlueprint } from "../src/composition.js";
import { computeStat } from "../src/modifiers.js";
import { resolveAttack } from "../src/combat.js";
import { changeMorale } from "../src/morale.js";
import {
  applyEffect, bandOf, enemiesWithin, clearRoundEffectFlags,
  hideAfterAttack, orderFlags, duels,
} from "../src/effects.js";

/**
 * `applyEffect` is the shared interpreter behind every order, succession ability and card skill.
 * The six card skills are exercised end to end in skills.test.ts, and the siege/fusion kinds
 * (SiegeSetup, SpawnTerrainAt, AreaShock, StructureAtk) in fusion_siege.test.ts. This file covers
 * the remaining effect kinds that no other suite reaches: platoon orders, morale and rout control,
 * terrain conjuring, hidden attacks, formal duels, and the phased-movement orders.
 */

const DRG: Omit<PlatoonBlueprint, "id" | "side"> = {
  faction: "DRG",
  commander: "DRG_COMMANDER_RIFTWING-DOMINANT", second: "DRG_SECOND_STORMCLAW-WINGSECOND", elite: "DRG_ELITE_OBSIDIAN-MAW",
  foot: Array(5).fill("DRG_FOOT_SLATEWING-DRAKE"),
};

describe("platoon orders", () => {
  it("Coordinated Cut marks one enemy and only that enemy takes the bonus", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!); const foot = b.unit(p.footUids[0]!);
    const marked = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 10, r: 5 });
    const other = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 1, r: 1 });
    ctrl.commandPhase(); ctrl.beginActivation("S");
    ctrl.useAbility(cmdr, "ABL_COORDINATED_CUT", { target: marked });
    expect(p.markedTarget).toEqual({ uid: marked.uid, atk: 150 });
    const vsMarked = computeStat(b, foot, "ATK", { attacker: foot, defender: marked });
    const vsOther = computeStat(b, foot, "ATK", { attacker: foot, defender: other });
    expect(vsMarked.modifiers.map((m) => m.source)).toContain("Order: Coordinated Cut");
    expect(vsOther.modifiers.map((m) => m.source)).not.toContain("Order: Coordinated Cut");
  });

  it("Hold the Standard clears Routed inside command radius and prevents it reapplying this round", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!); const foot = b.unit(p.footUids[0]!);
    changeMorale(b, foot, -100, "test"); // drives morale to 0, Broken
    expect(b.hasStatus(foot, "Routed")).toBe(true);
    ctrl.commandPhase(); ctrl.beginActivation("K");
    ctrl.useAbility(cmdr, "ABL_HOLD_THE_STANDARD");
    expect(b.hasStatus(foot, "Routed")).toBe(false);
    changeMorale(b, foot, -1, "test"); // still Broken; without the order this would re-add Routed
    expect(b.hasStatus(foot, "Routed")).toBe(false);
  });

  it("Wing Roar drops morale on adjacent enemies only", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "D", "A", DRG, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!);
    const near = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 4 });
    const far = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 12, r: 12 });
    const [n0, f0] = [near.morale, far.morale];
    ctrl.commandPhase(); ctrl.beginActivation("D");
    ctrl.useAbility(cmdr, "ABL_WING_ROAR");
    expect(near.morale).toBe(n0 - 5);
    expect(far.morale).toBe(f0);
  });
});

describe("succession-triggered abilities used directly", () => {
  it("Slipstream raises the whole flight's movement allowance", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "D", "A", DRG, blob(5, 5));
    const second = b.unit(p.secondUid!); const foot = b.unit(p.footUids[3]!);
    const cmdrBefore = ctrl.movementAllowance(b.unit(p.commanderUid!));
    const footBefore = ctrl.movementAllowance(foot);
    ctrl.commandPhase(); ctrl.beginActivation("D");
    ctrl.useAbility(second, "ABL_SLIPSTREAM");
    expect(ctrl.movementAllowance(b.unit(p.commanderUid!))).toBe(cmdrBefore + 1);
    expect(ctrl.movementAllowance(foot)).toBe(footBefore + 1);
  });

  it("Smoke Relay turns up to two neighbouring Open hexes to Smoke, skipping ground that already isn't Open", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SHI, blob(5, 5));
    const second = b.unit(p.secondUid!); // at (6,5)
    b.terrain.set("7,5", "Mountain"); // the first neighbour in iteration order; must be skipped, not counted
    ctrl.commandPhase(); ctrl.beginActivation("S");
    ctrl.useAbility(second, "ABL_SMOKE_RELAY");
    expect(b.terrain.get("7,5")).toBe("Mountain"); // untouched, it was not Open
    expect(b.terrain.get("7,4")).toBe("Smoke");
    expect(b.terrain.get("6,4")).toBe("Smoke");
    expect(b.terrain.get("5,5")).not.toBe("Smoke"); // the loop stopped after two hits
  });
});

describe("hidden strikes and formal duels", () => {
  it("Silent Directive lets the designated ally Hide the round it attacks", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SHI, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!); const striker = b.unit(p.footUids[0]!);
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 15, r: 15 });
    ctrl.commandPhase(); ctrl.beginActivation("S");
    ctrl.useAbility(cmdr, "ABL_SILENT_DIRECTIVE", { target: striker });
    expect(hideAfterAttack.has(striker.uid)).toBe(true);
    expect(b.hasStatus(striker, "Hidden")).toBe(false); // not yet, only after the attack lands
    resolveAttack(b, striker, enemy);
    expect(b.hasStatus(striker, "Hidden")).toBe(true);
    expect(hideAfterAttack.has(striker.uid)).toBe(false); // one-shot
  });

  it("Formal Duel bars everyone but the two combatants from the target", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    const elite = b.unit(p.eliteUid!);
    const rival = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: elite.pos!.q + 1, r: elite.pos!.r });
    const bystander = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: rival.pos!.q + 1, r: rival.pos!.r });
    ctrl.commandPhase(); ctrl.beginActivation("S");
    ctrl.useAbility(elite, "ABL_FORMAL_DUEL", { target: rival });
    expect(duels.get(elite.uid)).toBe(rival.uid);
    expect(duels.get(rival.uid)).toBe(elite.uid);
    expect(() => resolveAttack(b, bystander, rival)).toThrow(/Formal Duel/);
    expect(() => resolveAttack(b, elite, rival)).not.toThrow();
  });
});

describe("phased and sequenced movement orders", () => {
  it("Veil Crossing lets the platoon ignore zones of control when it moves", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SHI, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!); // at (5,5)
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 4 }); // adjacent, free hex
    ctrl.commandPhase(); ctrl.beginActivation("S");
    ctrl.useAbility(cmdr, "ORD_VEIL_CROSSING");
    expect(orderFlags.get(cmdr.uid)).toBe("PhaseMove"); // every platoon member is flagged, not only the caster
    expect(orderFlags.get(b.unit(p.footUids[0]!).uid)).toBe("PhaseMove");
    const hpBefore = cmdr.hp;
    ctrl.move(cmdr, { q: 2, r: 5 });
    expect(cmdr.hp).toBe(hpBefore); // left the enemy's zone of control without a reaction attack
    expect(b.events.some((e) => e.type === "ReactionAttack")).toBe(false);
  });

  it("Wing Dominion buffs the platoon's attack but still pays the reaction attack for leaving a zone of control", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "D", "A", DRG, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!); // at (5,5)
    const before = computeStat(b, cmdr, "ATK").final;
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 4 }); // adjacent, free hex
    ctrl.commandPhase(); ctrl.beginActivation("D");
    ctrl.useAbility(cmdr, "ORD_WING_DOMINION");
    expect(orderFlags.get(cmdr.uid)).toBe("SequencedMove");
    expect(computeStat(b, cmdr, "ATK").final).toBe(before + 100);
    const hpBefore = cmdr.hp;
    ctrl.move(cmdr, { q: 2, r: 5 });
    expect(cmdr.hp).toBeLessThan(hpBefore); // unlike Veil Crossing, Wing Dominion does not grant zone-of-control immunity
    expect(b.events.some((e) => e.type === "ReactionAttack")).toBe(true);
  });
});

describe("the generic interpreter", () => {
  it("a Surrender effect ends the battle for the user's side, even off the data table", () => {
    const { b } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!);
    applyEffect(b, cmdr, { id: "TEST_SURRENDER", name: "Test Surrender", category: "Active", effect: { kind: "Surrender" }, text: "" });
    expect(b.sides.get("A")!.surrendered).toBe(true);
    expect(b.events.some((e) => e.type === "Surrender" && e.data["by"] === cmdr.uid)).toBe(true);
  });

  it("bandOf falls back to the caster plus its adjacent, non-clone allies when there is no platoon", () => {
    const { b } = newBattle();
    const loner = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 5, r: 5 });
    const neighbour = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 6, r: 5 });
    const clone = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 5, r: 6 });
    clone.isClone = true;
    const far = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 10, r: 10 });
    const band = bandOf(b, loner).map((u) => u.uid);
    expect(band).toContain(loner.uid);
    expect(band).toContain(neighbour.uid);
    expect(band).not.toContain(clone.uid);
    expect(band).not.toContain(far.uid);
  });

  it("bandOf uses the whole living platoon, adjacent or not, when there is one", () => {
    const { b } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(5, 5));
    const band = bandOf(b, b.unit(p.commanderUid!), p).map((u) => u.uid);
    expect(band).toHaveLength(8);
    expect(band).toContain(p.footUids[4]!); // the far end of the line, not adjacent to the commander
  });

  it("enemiesWithin filters by side and distance", () => {
    const { b } = newBattle();
    const user = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 5, r: 5 });
    const ally = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 6, r: 5 });
    const near = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 6, r: 6 });
    const far = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 12, r: 12 });
    const hit = enemiesWithin(b, user, 2).map((u) => u.uid);
    expect(hit).toContain(near.uid);
    expect(hit).not.toContain(ally.uid);
    expect(hit).not.toContain(far.uid);
  });

  it("clearRoundEffectFlags empties every one-round marker the interpreter keeps", () => {
    hideAfterAttack.add("x"); orderFlags.set("x", "PhaseMove"); duels.set("x", "y");
    clearRoundEffectFlags();
    expect(hideAfterAttack.size).toBe(0);
    expect(orderFlags.size).toBe(0);
    expect(duels.size).toBe(0);
  });
});
