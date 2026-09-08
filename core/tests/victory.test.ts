import { describe, expect, it } from "vitest";
import { blob, deploy, KNI, newBattle, reg, SAM } from "./helpers.js";
import { defeat } from "../src/combat.js";
import { buildScenario } from "../src/scenario.js";
import { Battle } from "../src/state.js";
import { BattleController, type VictoryRules } from "../src/battle.js";
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

function bareBattle(): Battle {
  return new Battle(reg, { seed: 1, width: 10, height: 10 });
}

function controller(b: Battle, victory: Partial<VictoryRules> = {}): BattleController {
  return new BattleController(b, { sides: { A: [], B: [] }, roundLimit: 99, ...victory });
}

describe("the three universal win conditions", () => {
  it("Wipeout: a side with no living units loses even with no scenario objectives declared", () => {
    const b = bareBattle();
    const a = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 1, r: 1 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 5 });
    const ctrl = controller(b);
    defeat(b, a, "test");
    ctrl.commandPhase();
    ctrl.endPhase();
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("Wipeout");
  });

  it("LeaderKilled: defeating the designated army leader ends the battle even with troops still standing", () => {
    const b = bareBattle();
    const leader = b.spawn("SAM_COMMANDER_EMBER-BANNER-DAIMYO", "A", { q: 1, r: 1 });
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 2, r: 1 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 5 });
    const ctrl = controller(b, { armyLeaderUid: { A: leader.uid, B: null } });
    defeat(b, leader, "test");
    ctrl.commandPhase();
    ctrl.endPhase();
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("LeaderKilled");
  });

  it("LeaderKilled stays inactive for a side with no designated army leader", () => {
    const b = bareBattle();
    const commander = b.spawn("SAM_COMMANDER_EMBER-BANNER-DAIMYO", "A", { q: 1, r: 1 });
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 2, r: 1 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 5 });
    const ctrl = controller(b); // no armyLeaderUid supplied
    defeat(b, commander, "test");
    ctrl.commandPhase();
    ctrl.endPhase();
    expect(b.winner).toBeNull();
  });

  it("Surrender: average morale at or below the threshold must hold for the sustained window, not just one bad round", () => {
    const b = bareBattle();
    const a = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 1, r: 1 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 5 });
    a.morale = 10;
    const ctrl = controller(b, { surrenderMoraleThreshold: 15, surrenderSustainedRounds: 2 });

    ctrl.commandPhase();
    ctrl.endPhase();
    expect(b.winner).toBeNull();
    expect(b.round).toBe(2);

    ctrl.commandPhase();
    ctrl.endPhase();
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("Surrender");
  });

  it("Surrender recovers if morale climbs back above the threshold before the window closes", () => {
    const b = bareBattle();
    const a = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 1, r: 1 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 5 });
    a.morale = 10;
    const ctrl = controller(b, { surrenderMoraleThreshold: 15, surrenderSustainedRounds: 2 });

    ctrl.commandPhase();
    ctrl.endPhase();
    a.morale = 80;
    ctrl.commandPhase();
    ctrl.endPhase();
    expect(b.winner).toBeNull();
  });
});

describe("scenario-authored objectives are ANDed per side", () => {
  it("a side with two primary objectives does not win on the first one alone", () => {
    const { b, ctrl } = newBattle();
    deploy(b, "K", "A", KNI, blob(2, 2));
    deploy(b, "S", "B", SAM, blob(12, 12));
    ctrl.victory.sides.A = [
      { type: "MoraleBelow", side: "A", threshold: 1000 },
      { type: "CollapseRituals", side: "A", count: 1 },
    ];
    ctrl.evaluateVictory();
    expect(b.winner).toBeNull();
  });
  it("wins once every primary objective for that side is satisfied", () => {
    const { b, ctrl } = newBattle();
    deploy(b, "K", "A", KNI, blob(2, 2));
    deploy(b, "S", "B", SAM, blob(12, 12));
    ctrl.victory.sides.A = [
      { type: "MoraleBelow", side: "A", threshold: 1000 },
      { type: "DestroyPortals", side: "A", count: 0 },
    ];
    ctrl.evaluateVictory();
    expect(b.winner).toBe("A");
    expect(b.winReason).toBe("MoraleBelow+DestroyPortals");
  });
  it("SurviveRounds and DefendForRounds never trigger the AND check on their own", () => {
    const { b, ctrl } = newBattle();
    deploy(b, "K", "A", KNI, blob(2, 2));
    deploy(b, "S", "B", SAM, blob(12, 12));
    ctrl.victory.sides.A = [{ type: "SurviveRounds", side: "A", rounds: 12 }];
    ctrl.evaluateVictory();
    expect(b.winner).toBeNull();
  });
});
