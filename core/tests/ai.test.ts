import { describe, it, expect } from "vitest";
import { reg, newBattle } from "./helpers.js";
import { runAiActivation, DIFFICULTY } from "../src/ai.js";
import { computeStat } from "../src/modifiers.js";

/**
 * The AI's utility loop already reached for clones, charges and duels. These tests hold it to the
 * other four card skills every four-star-and-above unit can carry: a self buff spent right before
 * a swing, a band buff spent the same way, a haste spent to close ground it could not otherwise
 * cover, and an area debuff spent on whoever is already close enough to hit back.
 */
describe("the AI spends the six card skills", () => {
  it("pays a self-sacrifice buff for reach when a target is already in range and it can afford the price", () => {
    const { b, ctrl } = newBattle(11);
    const mine = b.spawn("DEM_SECOND_FLENSING-TORMENTOR", "A", { q: 5, r: 5 });
    const theirs = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    const maxHp = b.def(mine).hp;
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(computeStat(b, mine, "ATK").modifiers.map((m) => m.source)).toContain("Blood Offering");
    expect(mine.hp).toBeLessThan(maxHp);
    expect(theirs.hp).toBeLessThanOrEqual(b.def(theirs).hp);
  });

  it("refuses the same buff when the price would leave it too fragile to survive the next hit", () => {
    const { b, ctrl } = newBattle(11);
    const mine = b.spawn("DEM_SECOND_FLENSING-TORMENTOR", "A", { q: 5, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    mine.hp = Math.floor(b.def(mine).hp * 0.2);
    const before = mine.hp;
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(computeStat(b, mine, "ATK").modifiers.map((m) => m.source)).not.toContain("Blood Offering");
    expect(mine.hp).toBe(before);
  });

  it("lifts its band with a team attack buff before engaging, and leaves the enemy untouched", () => {
    const { b, ctrl } = newBattle(3);
    const mine = b.spawn("ANG_SECOND_WARDING-SERAPH", "A", { q: 5, r: 5 });
    const friend = b.spawn("ANG_FOOT_LAMPBEARER-CHORISTER", "A", { q: 5, r: 4 });
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    const enemyBefore = computeStat(b, enemy, "ATK").final;
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(computeStat(b, mine, "ATK").modifiers.map((m) => m.source)).toContain("Choir of Edges");
    expect(computeStat(b, friend, "ATK").modifiers.map((m) => m.source)).toContain("Choir of Edges");
    expect(computeStat(b, enemy, "ATK").final).toBe(enemyBefore);
  });

  it("spends haste to close ground a goal too far for its base movement to reach this activation", () => {
    const { b, ctrl } = newBattle(5);
    const mine = b.spawn("DMG_FOOT_GODTOUCHED-SCION", "A", { q: 2, r: 9 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 20, r: 9 });
    expect(ctrl.movementAllowance(mine)).toBeLessThan(18);
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(mine.cooldowns["ABL_SECOND_WIND"]).toBeGreaterThan(0);
  });

  it("does not bother with haste once it is already close enough to fight this activation", () => {
    const { b, ctrl } = newBattle(5);
    const mine = b.spawn("DMG_FOOT_GODTOUCHED-SCION", "A", { q: 5, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(mine.cooldowns["ABL_SECOND_WIND"] ?? 0).toBe(0);
  });

  it("softens an approaching enemy with an area debuff before it is in melee range to hit back", () => {
    const { b, ctrl } = newBattle(9);
    const mine = b.spawn("ANG_ELITE_SWORD-OF-THE-SEVENTH-GATE", "A", { q: 5, r: 5 });
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 7, r: 5 });
    const before = computeStat(b, enemy, "ATK").final;
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(mine.cooldowns["ABL_JUDGEMENT_WEIGHT"]).toBeGreaterThan(0);
    expect(computeStat(b, enemy, "ATK").final).toBe(before - 300);
  });

  it("slows an approaching enemy with an area debuff before it is in melee range to hit back", () => {
    const { b, ctrl } = newBattle(9);
    const mine = b.spawn("WEN_ELITE_ANTLER-WRAITH", "A", { q: 5, r: 5 });
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 7, r: 5 });
    const before = ctrl.movementAllowance(enemy);
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(mine.cooldowns["ABL_DEEP_FROST"]).toBeGreaterThan(0);
    expect(ctrl.movementAllowance(enemy)).toBe(before - 3);
    expect(b.hasStatus(enemy, "Suppressed")).toBe(true);
  });
});
