import { describe, it, expect } from "vitest";
import { newBattle, deploy, KNI, blob } from "./helpers.js";
import { runAiActivation, DIFFICULTY } from "../src/ai.js";
import { computeStat } from "../src/modifiers.js";
import { hexDistance, hexKey, hexRing } from "../src/hex.js";
import type { Battle } from "../src/state.js";
import type { Hex } from "../src/hex.js";

/** Did the AI actually spend that skill this activation? */
function used(b: Battle, ability: string): boolean {
  return b.events.some((e) => e.type === "AbilityUsed" && e.data["ability"] === ability);
}
function sources(b: Battle, uid: string, stat: "ATK" | "DEF"): string[] {
  return computeStat(b, b.unit(uid), stat).modifiers.map((m) => m.source);
}

/**
 * A pocket two hexes wide: water everywhere within two hexes of the mover except the two exits, so a
 * move has exactly one real decision in it and the test can say which ground the AI chose and why.
 */
function pocket(b: Battle, center: Hex, exits: Hex[]): void {
  const walls = [...hexRing(center, 1), ...hexRing(center, 2)].filter((h) => !exits.some((e) => e.q === h.q && e.r === h.r));
  for (const h of walls) b.terrain.set(hexKey(h), "Water");
}

describe("the AI spends the card skills when they pay", () => {
  it("bleeds itself for reach with a target in front of it, and never at a price it cannot afford", () => {
    const { b, ctrl } = newBattle();
    const tormentor = b.spawn("DEM_SECOND_FLENSING-TORMENTOR", "A", { q: 5, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    const maxHp = b.def(tormentor).hp;
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(used(b, "ABL_BLOOD_OFFERING")).toBe(true);
    expect(tormentor.hp).toBe(maxHp - Math.floor(maxHp * 0.15));
    // it paid for a swing, so it took one
    expect(b.events.some((e) => e.type === "Attack" && e.data["attacker"] === tormentor.uid)).toBe(true);
  });

  it("will not open a vein it cannot close", () => {
    const { b, ctrl } = newBattle();
    const tormentor = b.spawn("DEM_SECOND_FLENSING-TORMENTOR", "A", { q: 5, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    tormentor.hp = 700;   // half of 1300 is 650, and the offering costs 195
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(used(b, "ABL_BLOOD_OFFERING")).toBe(false);
    expect(tormentor.hp).toBe(700);
  });

  it("hastes when the extra ground is the difference between reaching a fight and not", () => {
    const { b, ctrl } = newBattle();
    const scion = b.spawn("DMG_FOOT_GODTOUCHED-SCION", "A", { q: 2, r: 5 });   // MOV 6, reach 1, +3 from the skill
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 11, r: 5 });             // nine hexes: too far to walk, near enough to run
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(used(b, "ABL_SECOND_WIND")).toBe(true);
    expect(hexDistance(scion.pos!, { q: 11, r: 5 })).toBeLessThan(9);
  });

  it("does not burn haste on ground it could have walked", () => {
    const { b, ctrl } = newBattle();
    b.spawn("DMG_FOOT_GODTOUCHED-SCION", "A", { q: 2, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(used(b, "ABL_SECOND_WIND")).toBe(false);
  });

  it("lifts the band's attack only when the band is about to swing", () => {
    const { b, ctrl } = newBattle();
    const seraph = b.spawn("ANG_SECOND_WARDING-SERAPH", "A", { q: 5, r: 5 });
    const chorister = b.spawn("ANG_FOOT_LAMPBEARER-CHORISTER", "A", { q: 5, r: 4 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 4 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(used(b, "ABL_CHOIR_OF_EDGES")).toBe(true);
    expect(sources(b, chorister.uid, "ATK")).toContain("Choir of Edges");
    expect(sources(b, seraph.uid, "ATK")).toContain("Choir of Edges");
  });

  it("holds the band buff when one soldier stands alone in an empty field", () => {
    const { b, ctrl } = newBattle();
    b.spawn("ANG_SECOND_WARDING-SERAPH", "A", { q: 5, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 16, r: 12 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(used(b, "ABL_CHOIR_OF_EDGES")).toBe(false);
  });

  it("spends a radius debuff and a radius slow once they catch two enemies, and not on one", () => {
    const { b, ctrl } = newBattle();
    b.spawn("ANG_ELITE_SWORD-OF-THE-SEVENTH-GATE", "A", { q: 5, r: 5 });   // Judgement's Weight, radius 2
    b.spawn("DEM_ELITE_PIT-COLONEL", "A", { q: 5, r: 6 });                 // Tar the Ground, radius 2
    const near = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 6 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(used(b, "ABL_JUDGEMENT_WEIGHT")).toBe(true);
    expect(used(b, "ABL_TAR_THE_GROUND")).toBe(true);
    expect(sources(b, near.uid, "ATK")).toContain("Judgement's Weight");

    const lone = newBattle(2);
    lone.b.spawn("ANG_ELITE_SWORD-OF-THE-SEVENTH-GATE", "A", { q: 5, r: 5 });
    lone.b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    lone.ctrl.commandPhase();
    runAiActivation(lone.ctrl, "ind:A", DIFFICULTY.normal);
    expect(used(lone.b, "ABL_JUDGEMENT_WEIGHT")).toBe(false);
  });
});

describe("the AI fights the ground it is standing on", () => {
  it("takes the walls when the walls are on the way", () => {
    const { b, ctrl } = newBattle();
    const foot = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 5, r: 5 });
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 9, r: 8 });
    pocket(b, { q: 5, r: 5 }, [{ q: 6, r: 5 }, { q: 5, r: 6 }]);   // both exits close the same distance
    b.terrain.set(hexKey({ q: 6, r: 5 }), "Fortification");
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(foot.pos).toEqual({ q: 6, r: 5 });
    expect(sources(b, foot.uid, "DEF")).toContain("Terrain: Fortification");
  });

  it("puts a shooter on the high ground rather than the flat beside it", () => {
    const { b, ctrl } = newBattle();
    const mage = b.spawn("ARC_FOOT_COBALT-LINE-MAGE", "A", { q: 5, r: 5 });
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 9, r: 8 });
    pocket(b, { q: 5, r: 5 }, [{ q: 6, r: 5 }, { q: 5, r: 6 }]);
    b.terrain.set(hexKey({ q: 5, r: 6 }), "HighGround");
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(mage.pos).toEqual({ q: 5, r: 6 });
  });

  it("routes cavalry around the ground that would break its charge, where foot would happily stand", () => {
    const ride = (defId: string): Hex => {
      const { b, ctrl } = newBattle();
      const u = b.spawn(defId, "A", { q: 5, r: 5 });
      b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 9, r: 8 });
      pocket(b, { q: 5, r: 5 }, [{ q: 6, r: 5 }, { q: 5, r: 6 }]);
      b.terrain.set(hexKey({ q: 6, r: 5 }), "Fortification");   // +200 DEF, and it stops a charge dead
      ctrl.commandPhase();
      runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
      return u.pos!;
    };
    expect(ride("KNI_FOOT_BASTION-MAN-AT-ARMS")).toEqual({ q: 6, r: 5 });
    expect(ride("KNI_CAVALRY_DAWN-LANCER")).toEqual({ q: 5, r: 6 });
  });

  it("aims a cavalry approach at the arc the target's shield does not cover", () => {
    const { b, ctrl } = newBattle();
    const lancer = b.spawn("KNI_CAVALRY_DAWN-LANCER", "A", { q: 8, r: 5 });   // MOV 6: enough to ride around
    const target = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 12, r: 5 });
    target.facing = 3;   // braced toward the lancer, so the ground behind it is the ground to want
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(lancer.pos).toEqual({ q: 13, r: 5 });
    const hit = b.events.filter((e) => e.type === "Attack" && e.data["attacker"] === lancer.uid).pop()!;
    expect(hit.data["arc"]).toBe("rear");
  });

  it("emplaces a siege piece and fires instead of walking into the line", () => {
    const { b, ctrl } = newBattle();
    const gun = b.spawn("KNI_SIEGE_BASTION-BOMBARD", "A", { q: 5, r: 5 });   // range 4, minimum range 2
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 8, r: 5 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(gun.setUp).toBe(true);
    expect(gun.pos).toEqual({ q: 5, r: 5 });
    expect(b.events.some((e) => e.type === "Attack" && e.data["attacker"] === gun.uid)).toBe(true);
  });

  it("closes a siege piece only as far as its own range and then stops", () => {
    const { b, ctrl } = newBattle();
    const gun = b.spawn("KNI_SIEGE_BASTION-BOMBARD", "A", { q: 5, r: 5 });   // MOV 2
    const mark = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 11, r: 5 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(hexDistance(gun.pos!, mark.pos!)).toBe(4);
    ctrl.objectivePhase(); ctrl.endPhase(); ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(hexDistance(gun.pos!, mark.pos!)).toBe(4);   // it held the range instead of closing
    expect(b.events.some((e) => e.type === "Attack" && e.data["attacker"] === gun.uid)).toBe(true);
  });

  it("yields the field when nobody is left to command and the men will not stand", () => {
    const { b, ctrl } = newBattle();
    const last = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 5, r: 5 });
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 9, r: 9 });
    last.morale = 0;
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(b.sides.get("A")!.surrendered).toBe(true);
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("Surrender");
  });

  it("fights on while a commander still stands, however bad the morale", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(5, 5));
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 15, r: 12 });
    for (const u of b.activeUnits("A")) u.morale = 0;
    ctrl.commandPhase();
    runAiActivation(ctrl, "K", DIFFICULTY.normal);
    expect(b.unit(p.commanderUid!).defeated).toBe(false);
    expect(b.sides.get("A")!.surrendered).toBeFalsy();
    expect(b.winner).toBeNull();
  });
});

describe("the AI stays deterministic", () => {
  it("plays a skill-carrying board the same way twice for the same seed", () => {
    const play = () => {
      const { b, ctrl } = newBattle(11);
      b.spawn("ANG_ELITE_SWORD-OF-THE-SEVENTH-GATE", "A", { q: 5, r: 5 });
      b.spawn("ANG_SECOND_WARDING-SERAPH", "A", { q: 5, r: 6 });
      b.spawn("KNI_CAVALRY_DAWN-LANCER", "A", { q: 4, r: 6 });
      b.spawn("KNI_SIEGE_BASTION-BOMBARD", "B", { q: 12, r: 8 });
      b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 9, r: 7 });
      b.terrain.set(hexKey({ q: 7, r: 6 }), "Fortification");
      b.terrain.set(hexKey({ q: 8, r: 6 }), "HighGround");
      for (let i = 0; i < 3 && !b.winner; i++) {
        ctrl.commandPhase();
        for (const s of ["A", "B"]) runAiActivation(ctrl, `ind:${s}`, DIFFICULTY.normal);
        ctrl.objectivePhase(); ctrl.endPhase();
      }
      return JSON.stringify(b.events);
    };
    expect(play()).toBe(play());
  });
});
