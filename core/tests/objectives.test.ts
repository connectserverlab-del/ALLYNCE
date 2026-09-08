import { describe, expect, it } from "vitest";
import { deploy, newBattle, SAM } from "./helpers.js";
import { evaluateObjective, markSynchronized, type ObjectiveDef } from "../src/objectives.js";
import { collapse, createRitual } from "../src/rituals.js";
import { callPortal, destroyPortal } from "../src/portals.js";
import { defeat } from "../src/combat.js";
import { changeMorale } from "../src/morale.js";
describe("composable objectives", () => {
  it("EliminateLeader is satisfied once the named enemy is defeated", () => {
    const { b } = newBattle();
    const p = deploy(b, "S", "B", SAM, [{ q: 2, r: 2 }, { q: 3, r: 2 }, { q: 4, r: 2 }, { q: 2, r: 3 }, { q: 3, r: 3 }, { q: 4, r: 3 }, { q: 5, r: 3 }, { q: 6, r: 3 }]);
    const obj: ObjectiveDef = { type: "EliminateLeader", side: "A", targetDefId: "SAM_COMMANDER_EMBER-BANNER-DAIMYO" };
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
    defeat(b, b.unit(p.commanderUid!), "test");
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
  });

  it("DefendForRounds and SurviveRounds trip once the round count exceeds the target", () => {
    const { b } = newBattle();
    b.round = 5;
    expect(evaluateObjective(b, { type: "DefendForRounds", side: "A", rounds: 5 }).satisfied).toBe(false);
    expect(evaluateObjective(b, { type: "SurviveRounds", side: "A", rounds: 5 }).satisfied).toBe(false);
    b.round = 6;
    expect(evaluateObjective(b, { type: "DefendForRounds", side: "A", rounds: 5 }).satisfied).toBe(true);
    expect(evaluateObjective(b, { type: "SurviveRounds", side: "A", rounds: 5 }).satisfied).toBe(true);
  });

  it("CompleteRituals is satisfied only once every named ritual has released", () => {
    const { b } = newBattle();
    const r1 = createRitual(b, { id: "r1", side: "A", center: { q: 5, r: 5 }, radius: 1, required: 1, leaderUid: null, summonDefId: null, linkGroup: null });
    const r2 = createRitual(b, { id: "r2", side: "A", center: { q: 15, r: 5 }, radius: 1, required: 1, leaderUid: null, summonDefId: null, linkGroup: null });
    const obj: ObjectiveDef = { type: "CompleteRituals", side: "A", ritualIds: ["r1", "r2"] };
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
    r1.state = "CompletedReleased";
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
    r2.state = "CompletedReleased";
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
  });

  it("SynchronizeRituals reads the flag the battle loop sets when a link group releases together", () => {
    const { b } = newBattle();
    createRitual(b, { id: "r1", side: "A", center: { q: 5, r: 5 }, radius: 1, required: 1, leaderUid: null, summonDefId: null, linkGroup: "g" });
    const obj: ObjectiveDef = { type: "SynchronizeRituals", side: "A", linkGroup: "g" };
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
    markSynchronized(b, "g");
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
  });

  it("CollapseRituals counts enemy rituals that have collapsed", () => {
    const { b } = newBattle();
    const r1 = createRitual(b, { id: "r1", side: "B", center: { q: 5, r: 5 }, radius: 1, required: 1, leaderUid: null, summonDefId: null, linkGroup: null });
    const obj: ObjectiveDef = { type: "CollapseRituals", side: "A", count: 1 };
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
    collapse(b, r1, "test");
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
  });

  it("DestroyPortals counts enemy portals that are destroyed or captured", () => {
    const { b } = newBattle();
    const p = callPortal(b, "B", { q: 5, r: 5 })!;
    const obj: ObjectiveDef = { type: "DestroyPortals", side: "A", count: 1 };
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
    destroyPortal(b, p, "test");
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
  });

  it("MaintainPortals needs the count open past the round threshold, not merely open once", () => {
    const { b } = newBattle();
    callPortal(b, "A", { q: 5, r: 5 }, { telegraph: 0 });
    const obj: ObjectiveDef = { type: "MaintainPortals", side: "A", count: 1, rounds: 3 };
    b.round = 3;
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
    b.round = 4;
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
  });

  it("MoraleBelow reads the enemy's average morale, not any one unit's", () => {
    const { b } = newBattle();
    const e1 = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 5, r: 5 });
    const e2 = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 6, r: 5 });
    const obj: ObjectiveDef = { type: "MoraleBelow", side: "A", threshold: 50 };
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
    changeMorale(b, e1, -60, "test");
    changeMorale(b, e2, -60, "test");
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
  });

  it("CaptureHold needs consecutive rounds, excludes fliers, and resets when the hex is vacated", () => {
    const { b } = newBattle();
    const hex = { q: 10, r: 10 };
    const obj: ObjectiveDef = { type: "CaptureHold", side: "A", hex, rounds: 2 };
    const flier = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "A", hex);
    expect(evaluateObjective(b, obj).satisfied).toBe(false); // a flier standing on the hex never counts
    b.remove(flier);
    const grounded = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", hex);
    expect(evaluateObjective(b, obj).satisfied).toBe(false); // held 1 of 2
    expect(evaluateObjective(b, obj).satisfied).toBe(true); // held 2 of 2
    b.remove(grounded);
    expect(evaluateObjective(b, obj).satisfied).toBe(false); // vacating resets the count
  });

  it("Escort is satisfied only while the named unit is alive and standing on the exact hex", () => {
    const { b } = newBattle();
    const hex = { q: 10, r: 10 };
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const obj: ObjectiveDef = { type: "Escort", side: "A", unitDefId: "SAM_FOOT_EMBERLINE-ASHIGARU", hex };
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
    b.remove(u);
    b.place(u, hex);
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
    defeat(b, u, "test");
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
  });
});

describe("DefendForRounds", () => {
  it("with no named target behaves like SurviveRounds: only the round count matters", () => {
    const { b } = newBattle();
    const obj: ObjectiveDef = { type: "DefendForRounds", side: "A", rounds: 5 };
    b.round = 5;
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
    b.round = 6;
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
  });

  it("never satisfies once the named unit is defeated, even after the round count passes", () => {
    const { b } = newBattle();
    const p = deploy(b, "A", "A", SAM, [{ q: 2, r: 2 }, { q: 3, r: 2 }, { q: 4, r: 2 }, { q: 2, r: 3 }, { q: 3, r: 3 }, { q: 4, r: 3 }, { q: 5, r: 3 }, { q: 6, r: 3 }]);
    const cmd = b.unit(p.commanderUid!);
    const obj: ObjectiveDef = { type: "DefendForRounds", side: "A", rounds: 5, uidOrPortal: cmd.uid };
    b.round = 6;
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
    defeat(b, cmd, "test");
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
  });

  it("never satisfies once the named portal is destroyed or captured, even after the round count passes", () => {
    const { b } = newBattle();
    const portal = callPortal(b, "A", { q: 5, r: 5 }, { telegraph: 0 })!;
    const obj: ObjectiveDef = { type: "DefendForRounds", side: "A", rounds: 5, uidOrPortal: portal.id };
    b.round = 6;
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
    destroyPortal(b, portal, "test");
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
  });

  it("never satisfies when the named target never existed on the field at all", () => {
    const { b } = newBattle();
    const obj: ObjectiveDef = { type: "DefendForRounds", side: "A", rounds: 5, uidOrPortal: "no-such-uid-or-portal" };
    b.round = 6;
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
  });
});

describe("objectives", () => {
  it("EliminateLeader is unsatisfied while the target lives and reports its HP", () => {
    const { b } = newBattle();
    const o: ObjectiveDef = { type: "EliminateLeader", side: "A", targetDefId: "KNI_FOOT_BASTION-MAN-AT-ARMS" };
    expect(evaluateObjective(b, o)).toMatchObject({ satisfied: false, detail: "target not present" });
    const t = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 5 });
    expect(evaluateObjective(b, o)).toMatchObject({ satisfied: false, detail: `Bastion Man-at-Arms HP ${t.hp}` });
    defeat(b, t, "test");
    expect(evaluateObjective(b, o).satisfied).toBe(true);
  });

  it("SurviveRounds and DefendForRounds are satisfied once the round has passed the target", () => {
    const { b } = newBattle();
    const survive: ObjectiveDef = { type: "SurviveRounds", side: "A", rounds: 3 };
    const defend: ObjectiveDef = { type: "DefendForRounds", side: "A", rounds: 3 };
    b.round = 3;
    expect(evaluateObjective(b, survive).satisfied).toBe(false);
    expect(evaluateObjective(b, defend).satisfied).toBe(false);
    b.round = 4;
    expect(evaluateObjective(b, survive).satisfied).toBe(true);
    expect(evaluateObjective(b, defend).satisfied).toBe(true);
  });

  it("CompleteRituals counts only rituals released for that side, by id", () => {
    const { b } = newBattle();
    const a = createRitual(b, { id: "a", side: "A", center: { q: 5, r: 5 }, radius: 1, required: 10, leaderUid: null, summonDefId: "DIV_BOSS_SOVEREIGN-OF-MEMORY", linkGroup: "g1" });
    const c = createRitual(b, { id: "c", side: "A", center: { q: 9, r: 5 }, radius: 1, required: 10, leaderUid: null, summonDefId: "DIV_BOSS_SOVEREIGN-OF-TORMENT", linkGroup: "g2" });
    const o: ObjectiveDef = { type: "CompleteRituals", side: "A", ritualIds: ["a", "c"] };
    expect(evaluateObjective(b, o)).toMatchObject({ satisfied: false, detail: "0/2 released" });
    a.state = "CompletedReleased";
    expect(evaluateObjective(b, o)).toMatchObject({ satisfied: false, detail: "1/2 released" });
    c.state = "CompletedReleased";
    expect(evaluateObjective(b, o).satisfied).toBe(true);
  });

  it("SynchronizeRituals only satisfies once the shared link group is flagged synchronized", () => {
    const { b } = newBattle();
    createRitual(b, { id: "a", side: "A", center: { q: 5, r: 5 }, radius: 1, required: 10, leaderUid: null, summonDefId: "DIV_BOSS_SOVEREIGN-OF-MEMORY", linkGroup: "g" });
    const o: ObjectiveDef = { type: "SynchronizeRituals", side: "A", linkGroup: "g" };
    expect(evaluateObjective(b, o).satisfied).toBe(false);
    markSynchronized(b, "g");
    expect(evaluateObjective(b, o).satisfied).toBe(true);
    expect(evaluateObjective(b, { ...o, linkGroup: "other" }).satisfied).toBe(false);
  });

  it("CollapseRituals counts only the enemy's collapsed circles", () => {
    const { b } = newBattle();
    const enemy = createRitual(b, { id: "e", side: "B", center: { q: 5, r: 5 }, radius: 1, required: 10, leaderUid: null, summonDefId: "DIV_BOSS_SOVEREIGN-OF-MEMORY", linkGroup: "g" });
    const own = createRitual(b, { id: "o", side: "A", center: { q: 9, r: 5 }, radius: 1, required: 10, leaderUid: null, summonDefId: "DIV_BOSS_SOVEREIGN-OF-TORMENT", linkGroup: "g2" });
    const o: ObjectiveDef = { type: "CollapseRituals", side: "A", count: 1 };
    own.state = "Collapsed"; // our own collapse does not count toward our objective
    expect(evaluateObjective(b, o).satisfied).toBe(false);
    enemy.state = "Collapsed";
    expect(evaluateObjective(b, o).satisfied).toBe(true);
  });

  it("DestroyPortals counts destroyed enemy portals, and MaintainPortals needs count and rounds together", () => {
    const { b } = newBattle();
    const p1 = callPortal(b, "B", { q: 5, r: 5 }, { telegraph: 0 })!;
    const destroyGoal: ObjectiveDef = { type: "DestroyPortals", side: "A", count: 1 };
    expect(evaluateObjective(b, destroyGoal).satisfied).toBe(false);
    destroyPortal(b, p1, "test");
    expect(evaluateObjective(b, destroyGoal).satisfied).toBe(true);

    const p2 = callPortal(b, "A", { q: 9, r: 5 }, { telegraph: 0 })!;
    const maintainGoal: ObjectiveDef = { type: "MaintainPortals", side: "A", count: 1, rounds: 2 };
    expect(p2.state).toBe("Open");
    b.round = 2;
    expect(evaluateObjective(b, maintainGoal).satisfied).toBe(false); // round not past target yet
    b.round = 3;
    expect(evaluateObjective(b, maintainGoal).satisfied).toBe(true);
    destroyPortal(b, p2, "test");
    expect(evaluateObjective(b, maintainGoal).satisfied).toBe(false); // no longer open
  });

  it("MoraleBelow reads the enemy's average morale, and is unsatisfied with no enemies present", () => {
    const { b } = newBattle();
    const o: ObjectiveDef = { type: "MoraleBelow", side: "A", threshold: 20 };
    expect(evaluateObjective(b, o).satisfied).toBe(false); // no enemies yet
    const e1 = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 5 });
    const e2 = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    e1.morale = 10; e2.morale = 40;
    expect(evaluateObjective(b, o)).toMatchObject({ satisfied: false, detail: "enemy avg morale 25" });
    e2.morale = 15;
    expect(evaluateObjective(b, o).satisfied).toBe(true);
  });

  it("Escort is satisfied only while the named unit is alive and standing on the hex", () => {
    const { b } = newBattle();
    const hex = { q: 5, r: 5 };
    const o: ObjectiveDef = { type: "Escort", side: "A", unitDefId: "KNI_FOOT_BASTION-MAN-AT-ARMS", hex };
    expect(evaluateObjective(b, o)).toMatchObject({ satisfied: false, detail: "no escort" });
    const u = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 6, r: 5 });
    expect(evaluateObjective(b, o).satisfied).toBe(false);
    b.remove(u); b.place(u, hex);
    expect(evaluateObjective(b, o).satisfied).toBe(true);
    defeat(b, u, "test");
    expect(evaluateObjective(b, o)).toMatchObject({ satisfied: false, detail: "escort lost" });
  });

  it("CaptureHold advances at most once per round no matter how many times it is polled, and resets when the hex is lost", () => {
    const { b } = newBattle();
    const hex = { q: 5, r: 5 };
    const o: ObjectiveDef = { type: "CaptureHold", side: "A", hex, rounds: 2 };
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", hex);
    // three polls in the same round (as a HUD or the AI might do) must count as one round held
    expect(evaluateObjective(b, o).detail).toBe("held 1/2");
    expect(evaluateObjective(b, o).detail).toBe("held 1/2");
    expect(evaluateObjective(b, o)).toMatchObject({ satisfied: false, detail: "held 1/2" });
    b.round += 1;
    expect(evaluateObjective(b, o)).toMatchObject({ satisfied: true, detail: "held 2/2" });
    // leaving the hex resets progress back to zero
    b.remove(u); b.round += 1;
    expect(evaluateObjective(b, o)).toMatchObject({ satisfied: false, detail: "held 0/2" });
    // a flier cannot hold ground for this objective
    const flier = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "A", hex);
    expect(evaluateObjective(b, o)).toMatchObject({ satisfied: false, detail: "held 0/2" });
    expect(flier).toBeDefined();
  });
});
