import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, KNI, blob, reg } from "./helpers.js";
import { Battle } from "../src/state.js";
import { BattleController } from "../src/battle.js";
import { defeat } from "../src/combat.js";
import { organizationLevel } from "../src/composition.js";

describe("universal win conditions", () => {
  it("Wipeout: a side with no living units loses to the other, independent of objectives", () => {
    const { b, ctrl } = newBattle();
    deploy(b, "P1", "A", SAM, blob(5, 5));
    // side B never deploys anything
    ctrl.evaluateVictory();
    expect(b.winner).toBe("A");
    expect(b.winReason).toBe("Wipeout");
  });

  it("Army Leader Killed: a designated leader's death ends the battle even though their side is far from wiped out", () => {
    const b = new Battle(reg, { seed: 1, width: 24, height: 18 });
    deploy(b, "PA", "A", SAM, blob(5, 5));
    const pb = deploy(b, "PB", "B", KNI, blob(12, 5));
    const leader = b.unit(pb.eliteUid!); // a unit distinct from Commander/Second so succession is untouched
    const ctrl = new BattleController(b, { sides: { A: [], B: [] }, roundLimit: 99, armyLeaderUids: { B: leader.uid } });
    defeat(b, leader, "test");
    ctrl.evaluateVictory();
    expect(b.winner).toBe("A");
    expect(b.winReason).toBe("ArmyLeaderKilled");
    expect(b.unit(pb.commanderUid!).defeated).toBe(false); // not a Wipeout: the rest of B's platoon is alive
  });

  it("does not fire Army Leader Killed while the designated leader is still alive", () => {
    const b = new Battle(reg, { seed: 1, width: 24, height: 18 });
    deploy(b, "PA", "A", SAM, blob(5, 5));
    const pb = deploy(b, "PB", "B", KNI, blob(12, 5));
    const ctrl = new BattleController(b, { sides: { A: [], B: [] }, roundLimit: 99, armyLeaderUids: { B: b.unit(pb.eliteUid!).uid } });
    ctrl.evaluateVictory();
    expect(b.winner).toBeNull();
  });

  it("Surrender: command fully broken (organizationLevel None) and crushed morale ends the battle", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    deploy(b, "P2", "B", KNI, blob(12, 5));
    const ctrl = new BattleController(b, { sides: { A: [], B: [] }, roundLimit: 99, surrenderMoraleThreshold: 50 });
    defeat(b, b.unit(p.eliteUid!), "test"); // no Elite -> Doctrine Broken -> organizationLevel("A") === "None"
    for (const u of b.activeUnits("A")) u.morale = 10; // well under the 50-morale line
    expect(organizationLevel(b, "A")).toBe("None");
    ctrl.evaluateVictory();
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("Surrender");
  });

  it("does not surrender while organized, even at crushed morale, or while morale holds, even fully disorganized", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    deploy(b, "P2", "B", KNI, blob(12, 5));
    const ctrl = new BattleController(b, { sides: { A: [], B: [] }, roundLimit: 99, surrenderMoraleThreshold: 50 });
    for (const u of b.activeUnits("A")) u.morale = 10;
    ctrl.evaluateVictory(); // still organized: low morale alone is not surrender
    expect(b.winner).toBeNull();

    for (const u of b.activeUnits("A")) u.morale = 90;
    defeat(b, b.unit(p.eliteUid!), "test"); // now disorganized, but morale is fine
    ctrl.evaluateVictory();
    expect(b.winner).toBeNull();
  });

  it("surrender() ends the battle immediately for the side that calls it, and is a no-op once decided", () => {
    const { b, ctrl } = newBattle();
    deploy(b, "P1", "A", SAM, blob(5, 5));
    deploy(b, "P2", "B", KNI, blob(12, 5));
    ctrl.surrender("A");
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("Surrender");
    ctrl.surrender("B"); // battle already decided; must not overwrite the result
    expect(b.winner).toBe("B");
  });
});
