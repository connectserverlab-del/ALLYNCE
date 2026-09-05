import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, KNI, blob } from "./helpers.js";
import { defeat } from "../src/combat.js";
import { buildScenario } from "../src/scenario.js";

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
