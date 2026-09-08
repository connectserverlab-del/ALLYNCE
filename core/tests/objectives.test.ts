import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { evaluateObjective, markSynchronized, type ObjectiveDef } from "../src/objectives.js";
import { createRitual } from "../src/rituals.js";
import { callPortal, captureStep, destroyPortal } from "../src/portals.js";

describe("objectives: evaluateObjective", () => {
  it("EliminateLeader: satisfied only once the named enemy is defeated", () => {
    const { b } = newBattle();
    const target = b.spawn("KNI_COMMANDER_SOLAR-BASTION-MARSHAL", "B", { q: 5, r: 5 });
    const o: ObjectiveDef = { type: "EliminateLeader", side: "A", targetDefId: target.defId };
    expect(evaluateObjective(b, o).satisfied).toBe(false);
    target.defeated = true;
    expect(evaluateObjective(b, o).satisfied).toBe(true);
  });

  it("EliminateLeader: absent target (never deployed, or a different side) is not satisfied", () => {
    const { b } = newBattle();
    const o: ObjectiveDef = { type: "EliminateLeader", side: "A", targetDefId: "KNI_COMMANDER_SOLAR-BASTION-MARSHAL" };
    const status = evaluateObjective(b, o);
    expect(status.satisfied).toBe(false);
    expect(status.detail).toBe("target not present");
  });

  it("SurviveRounds and DefendForRounds are satisfied strictly after the round threshold", () => {
    const { b } = newBattle();
    b.round = 12;
    const survive: ObjectiveDef = { type: "SurviveRounds", side: "A", rounds: 12 };
    const defend: ObjectiveDef = { type: "DefendForRounds", side: "A", rounds: 12 };
    expect(evaluateObjective(b, survive).satisfied).toBe(false);
    expect(evaluateObjective(b, defend).satisfied).toBe(false);
    b.round = 13;
    expect(evaluateObjective(b, survive).satisfied).toBe(true);
    expect(evaluateObjective(b, defend).satisfied).toBe(true);
  });

  it("CompleteRituals: satisfied only once every named ritual has released", () => {
    const { b } = newBattle();
    const r1 = createRitual(b, { id: "r1", side: "A", center: { q: 1, r: 1 }, radius: 2, required: 100, leaderUid: null, summonDefId: null, linkGroup: null });
    const r2 = createRitual(b, { id: "r2", side: "A", center: { q: 3, r: 3 }, radius: 2, required: 100, leaderUid: null, summonDefId: null, linkGroup: null });
    const o: ObjectiveDef = { type: "CompleteRituals", side: "A", ritualIds: ["r1", "r2"] };
    expect(evaluateObjective(b, o).satisfied).toBe(false);
    r1.state = "CompletedReleased";
    expect(evaluateObjective(b, o).satisfied).toBe(false);
    r2.state = "CompletedReleased";
    expect(evaluateObjective(b, o).satisfied).toBe(true);
  });

  it("SynchronizeRituals: reads the flag the battle loop sets when a link group releases together", () => {
    const { b } = newBattle();
    createRitual(b, { id: "r1", side: "A", center: { q: 1, r: 1 }, radius: 2, required: 100, leaderUid: null, summonDefId: null, linkGroup: "twin" });
    const o: ObjectiveDef = { type: "SynchronizeRituals", side: "A", linkGroup: "twin" };
    expect(evaluateObjective(b, o).satisfied).toBe(false);
    markSynchronized(b, "twin");
    expect(evaluateObjective(b, o).satisfied).toBe(true);
  });

  it("CollapseRituals: counts only the enemy's collapsed circles", () => {
    const { b } = newBattle();
    const enemy = createRitual(b, { id: "er1", side: "B", center: { q: 1, r: 1 }, radius: 2, required: 100, leaderUid: null, summonDefId: null, linkGroup: null });
    const mine = createRitual(b, { id: "mr1", side: "A", center: { q: 3, r: 3 }, radius: 2, required: 100, leaderUid: null, summonDefId: null, linkGroup: null });
    mine.state = "Collapsed"; // my own collapse must not count toward my objective
    const o: ObjectiveDef = { type: "CollapseRituals", side: "A", count: 1 };
    expect(evaluateObjective(b, o).satisfied).toBe(false);
    enemy.state = "Collapsed";
    expect(evaluateObjective(b, o).satisfied).toBe(true);
  });

  it("DestroyPortals: destroying an enemy portal counts", () => {
    const { b } = newBattle();
    const p = callPortal(b, "B", { q: 5, r: 5 }, { telegraph: 0 })!;
    const o: ObjectiveDef = { type: "DestroyPortals", side: "A", count: 1 };
    expect(evaluateObjective(b, o).satisfied).toBe(false);
    destroyPortal(b, p, "test");
    expect(evaluateObjective(b, o).satisfied).toBe(true);
  });

  it("DestroyPortals: capturing an enemy portal also counts, even though it flips to the capturer's own side", () => {
    const { b } = newBattle();
    const p = callPortal(b, "B", { q: 5, r: 5 }, { telegraph: 0 })!;
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "A", { q: 6, r: 5 });
    const o: ObjectiveDef = { type: "DestroyPortals", side: "A", count: 1 };
    captureStep(b, keeper, p);
    captureStep(b, keeper, p);
    expect(p.state).toBe("Open");
    expect(p.side).toBe("A"); // capture reassigns ownership rather than setting a "Captured" state
    const status = evaluateObjective(b, o);
    expect(status.satisfied).toBe(true);
    expect(status.detail).toBe("1/1 destroyed or captured");
  });

  it("DestroyPortals: a portal that was always mine never counts toward the capture bucket", () => {
    const { b } = newBattle();
    callPortal(b, "A", { q: 5, r: 5 }, { telegraph: 0 });
    const o: ObjectiveDef = { type: "DestroyPortals", side: "A", count: 1 };
    expect(evaluateObjective(b, o).satisfied).toBe(false);
  });

  it("MaintainPortals: needs both the open count and the round threshold", () => {
    const { b } = newBattle();
    callPortal(b, "A", { q: 5, r: 5 }, { telegraph: 0 });
    const o: ObjectiveDef = { type: "MaintainPortals", side: "A", count: 1, rounds: 3 };
    b.round = 3;
    expect(evaluateObjective(b, o).satisfied).toBe(false); // round not yet past threshold
    b.round = 4;
    expect(evaluateObjective(b, o).satisfied).toBe(true);
  });

  it("MoraleBelow: average morale of the enemy's non-clone active units", () => {
    const { b } = newBattle();
    const e1 = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 5 });
    const e2 = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    e1.morale = 10; e2.morale = 10;
    const o: ObjectiveDef = { type: "MoraleBelow", side: "A", threshold: 20 };
    expect(evaluateObjective(b, o).satisfied).toBe(true);
    e2.morale = 90;
    expect(evaluateObjective(b, o).satisfied).toBe(false); // average now 50, above threshold
  });

  it("MoraleBelow: no live enemy units means never satisfied", () => {
    const { b } = newBattle();
    const o: ObjectiveDef = { type: "MoraleBelow", side: "A", threshold: 100 };
    expect(evaluateObjective(b, o).satisfied).toBe(false);
  });

  it("CaptureHold: counts consecutive rounds the objective's own side occupies the hex, resetting when it leaves", () => {
    const { b } = newBattle();
    const hex = { q: 5, r: 5 };
    const u = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", hex);
    const o: ObjectiveDef = { type: "CaptureHold", side: "A", hex, rounds: 2 };
    expect(evaluateObjective(b, o).satisfied).toBe(false); // held 1
    expect(evaluateObjective(b, o).satisfied).toBe(true); // held 2
    b.remove(u);
    b.place(u, { q: 9, r: 9 });
    expect(evaluateObjective(b, o).satisfied).toBe(false); // vacated, counter reset
  });

  it("Escort: satisfied only while the named unit is alive and standing on the hex", () => {
    const { b } = newBattle();
    const hex = { q: 5, r: 5 };
    const escort = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 1, r: 1 });
    const o: ObjectiveDef = { type: "Escort", side: "A", unitDefId: escort.defId, hex };
    expect(evaluateObjective(b, o).satisfied).toBe(false);
    b.remove(escort);
    b.place(escort, hex);
    expect(evaluateObjective(b, o).satisfied).toBe(true);
    escort.defeated = true;
    expect(evaluateObjective(b, o).satisfied).toBe(false);
  });
});
