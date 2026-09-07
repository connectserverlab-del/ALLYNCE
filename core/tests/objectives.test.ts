import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { evaluateObjective, markSynchronized, type ObjectiveDef } from "../src/objectives.js";
import { createRitual } from "../src/rituals.js";
import { callPortal, destroyPortal } from "../src/portals.js";
import { defeat } from "../src/combat.js";

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
