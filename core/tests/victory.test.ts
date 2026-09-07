import { describe, it, expect } from "vitest";
import { Battle } from "../src/state.js";
import { BattleController } from "../src/battle.js";
import { defeat } from "../src/combat.js";
import { changeMorale } from "../src/morale.js";
import { hasCommandStructure } from "../src/command.js";
import { maybeSurrender } from "../src/ai.js";
import { reg, newBattle, deploy, SAM, KNI, blob } from "./helpers.js";

/** A battle wired with an army-leader designation, like buildScenario() does for a scenario file. */
function newLeaderBattle(leaderDefId: string) {
  const b = new Battle(reg, { seed: 1, width: 24, height: 18 });
  const ctrl = new BattleController(b, { sides: { A: [], B: [] }, roundLimit: 99, leaders: { A: leaderDefId } });
  return { b, ctrl };
}

describe("universal win conditions", () => {
  it("Leader killed: the designated army leader falling ends the battle for the other side immediately", () => {
    const { b, ctrl } = newLeaderBattle(SAM.commander);
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    deploy(b, "P2", "B", KNI, blob(12, 5));
    ctrl.evaluateVictory();
    expect(b.winner).toBeNull(); // leader alive: no verdict yet
    defeat(b, b.unit(p.commanderUid!), "test");
    ctrl.evaluateVictory();
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("Leader killed");
  });

  it("does not fire Leader killed when a scenario names no leader for that side", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    deploy(b, "P2", "B", KNI, blob(12, 5));
    defeat(b, b.unit(p.commanderUid!), "test");
    ctrl.evaluateVictory();
    expect(b.winner).toBeNull();
  });

  it("Surrender ends the battle immediately for the other side and cannot be called twice", () => {
    const { b, ctrl } = newBattle();
    ctrl.surrender("A");
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("Surrender");
    expect(() => ctrl.surrender("B")).toThrow(/already ended/i);
  });

  it("surrender rejects a side that does not exist", () => {
    const { ctrl } = newBattle();
    expect(() => ctrl.surrender("Z")).toThrow(/Unknown side/);
  });

  it("a decision already reached by surrender is not overwritten by the round's objective evaluation", () => {
    const { b, ctrl } = newBattle();
    ctrl.surrender("A");
    ctrl.evaluateVictory(); // must be a no-op once b.winner is set
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("Surrender");
  });
});

describe("command structure and the AI surrender heuristic", () => {
  it("hasCommandStructure is true while any platoon keeps a living Commander or Second", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    expect(hasCommandStructure(b, "A")).toBe(true);
    defeat(b, b.unit(p.commanderUid!), "test");
    expect(hasCommandStructure(b, "A")).toBe(true); // the Second still stands
    defeat(b, b.unit(p.secondUid!), "test");
    expect(hasCommandStructure(b, "A")).toBe(false);
  });

  it("maybeSurrender concedes once command is gone and average morale is below 20, never before either is true", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    deploy(b, "P2", "B", KNI, blob(12, 5));

    // Command structure intact, morale crashed: no surrender yet.
    for (const uid of [p.commanderUid!, p.secondUid!, p.eliteUid!, ...p.footUids]) changeMorale(b, b.unit(uid), -100, "test");
    expect(maybeSurrender(ctrl, "A")).toBe(false);
    expect(b.winner).toBeNull();

    // Command gone, morale still fine: no surrender yet.
    const { b: b2, ctrl: ctrl2 } = newBattle();
    const p2 = deploy(b2, "P1", "A", SAM, blob(5, 5));
    deploy(b2, "P2", "B", KNI, blob(12, 5));
    defeat(b2, b2.unit(p2.commanderUid!), "test");
    defeat(b2, b2.unit(p2.secondUid!), "test");
    expect(maybeSurrender(ctrl2, "A")).toBe(false);
    expect(b2.winner).toBeNull();

    // Both conditions met: concede rather than fight to a wipeout.
    defeat(b, b.unit(p.commanderUid!), "test");
    defeat(b, b.unit(p.secondUid!), "test");
    expect(maybeSurrender(ctrl, "A")).toBe(true);
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("Surrender");
  });

  it("maybeSurrender is a no-op once the battle has already ended", () => {
    const { b, ctrl } = newBattle();
    ctrl.surrender("B");
    expect(maybeSurrender(ctrl, "A")).toBe(false);
    expect(b.winReason).toBe("Surrender"); // unchanged
  });
});
