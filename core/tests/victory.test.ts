import { describe, expect, it } from "vitest";
import { blob, deploy, KNI, newBattle, reg, SAM } from "./helpers.js";
import { defeat } from "../src/combat.js";
import { buildScenario } from "../src/scenario.js";
import { Battle } from "../src/state.js";
import { BattleController } from "../src/battle.js";
import { organizationLevel } from "../src/composition.js";
import { changeMorale } from "../src/morale.js";
import { hasCommandStructure } from "../src/command.js";
import { maybeSurrender } from "../src/ai.js";
describe("universal win conditions", () => {
  it("wipeout ends the battle", () => {
    const { b, ctrl } = newBattle();
    deploy(b, "K", "A", KNI, blob(2, 2));
    const lone = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 15, r: 15 });
    defeat(b, lone, "test");
    ctrl.evaluateVictory();
    expect(b.winner).toBe("A"); expect(b.winReason).toBe("Wipeout");
  });
  it("killing the army leader ends the battle even with the army intact", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "B", SAM, blob(2, 2));
    deploy(b, "K", "A", KNI, blob(12, 12));
    b.sides.get("B")!.leaderUid = p.commanderUid;
    defeat(b, b.unit(p.commanderUid!), "test");
    ctrl.evaluateVictory();
    expect(b.winner).toBe("A"); expect(b.winReason).toBe("Leader killed");
  });
  it("only the leader may surrender while alive; surrender ends the battle", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "B", SAM, blob(2, 2));
    deploy(b, "K", "A", KNI, blob(12, 12));
    b.sides.get("B")!.leaderUid = p.commanderUid;
    expect(() => ctrl.surrender("B", b.unit(p.footUids[0]!))).toThrow(/Only the army leader/);
    ctrl.surrender("B", b.unit(p.commanderUid!));
    expect(b.winner).toBe("A"); expect(b.winReason).toBe("Surrender");
  });
  it("scenarios designate a leader per side and start with a Fusion charge", () => {
    const { ctrl } = buildScenario("threefold_invocation");
    for (const s of ctrl.b.sides.values()) { expect(s.leaderUid).toBeTruthy(); expect(s.fusionCharges).toBe(1); }
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
    // Both sides need someone standing, or wipeout wins the race to end the battle first.
    deploy(b, "P1", "A", SAM, blob(5, 5));
    deploy(b, "P2", "B", KNI, blob(12, 5));
    ctrl.surrender("B");
    expect(maybeSurrender(ctrl, "A")).toBe(false);
    expect(b.winReason).toBe("Surrender"); // unchanged
  });
});
