import { describe, it, expect } from "vitest";
import { Battle } from "../src/state.js";
import { BattleController, type VictoryRules } from "../src/battle.js";
import { defeat } from "../src/combat.js";
import { reg } from "./helpers.js";

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
