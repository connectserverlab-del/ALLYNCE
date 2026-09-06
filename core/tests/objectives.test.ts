import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM } from "./helpers.js";
import { evaluateObjective, markSynchronized, type ObjectiveDef } from "../src/objectives.js";
import { createRitual, collapse } from "../src/rituals.js";
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
