import { describe, expect, it } from "vitest";
import { blob, deploy, KNI, newBattle, reg, SAM } from "./helpers.js";
import { DIFFICULTY, holdForSyncPolicy, maybeSurrender, nearestEnemy, runAiActivation, shouldSurrender, tryFusion } from "../src/ai.js";
import { computeStat } from "../src/modifiers.js";
import { defeat } from "../src/combat.js";
import { doctrineState } from "../src/composition.js";
import { attackArc, hexDistance, hexKey, hexNeighbors, hexRing } from "../src/hex.js";
import type { Battle } from "../src/state.js";
import type { Hex } from "../src/hex.js";
import { createRitual } from "../src/rituals.js";

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

describe("the AI reaches for Fusion once it is worth the bodies it costs", () => {
  it("fuses two adjacent foot soldiers into a stronger single body once a fight is close enough to matter", () => {
    const { b, ctrl } = newBattle();
    const a = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const c = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 6, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 11, r: 5 });   // six hexes off: within reach
    b.sides.get("A")!.fusionCharges = 1;
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(tryFusion(ctrl, a)).toBe(true);
    expect(b.events.some((e) => e.type === "Fusion" && e.data["recipe"] === "FUS_PAIRED_LINE")).toBe(true);
    expect(a.defeated).toBe(true);
    expect(c.defeated).toBe(true);
    expect(b.sides.get("A")!.fusionCharges).toBe(0);
  });

  it("does not thin the line for a fight nobody is near", () => {
    const { b, ctrl } = newBattle();
    const a = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 6, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 20, r: 5 });   // far past the fusion gate
    b.sides.get("A")!.fusionCharges = 1;
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(tryFusion(ctrl, a)).toBe(false);
    expect(a.defeated).toBe(false);
    expect(b.sides.get("A")!.fusionCharges).toBe(1);
  });

  it("will not spend a Fusion charge the holding has not granted", () => {
    const { b, ctrl } = newBattle();
    const a = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 6, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 11, r: 5 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(tryFusion(ctrl, a)).toBe(false);
    expect(a.defeated).toBe(false);
  });

  it("a full activation spends a spare second AP on the fusion instead of standing idle", () => {
    const { b, ctrl } = newBattle();
    const a = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const c = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 6, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 11, r: 5 });
    pocket(b, { q: 5, r: 5 }, []); pocket(b, { q: 6, r: 5 }, []);   // sealed in: there is nowhere to march
    b.terrain.set(hexKey({ q: 5, r: 5 }), "Open"); b.terrain.set(hexKey({ q: 6, r: 5 }), "Open");
    b.sides.get("A")!.fusionCharges = 1;
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(b.events.some((e) => e.type === "Fusion")).toBe(true);
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

describe("AI: siege positioning", () => {
  it("retreats out of minimum range instead of standing at the front, then sets up once safe", () => {
    const { b, ctrl } = newBattle();
    const gun = b.spawn("KNI_SIEGE_BASTION-BOMBARD", "A", { q: 5, r: 5 }); // minRange 2, range 4, mov 2
    const enemy = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 6, r: 5 }); // distance 1, inside minimum range
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(b.distance(gun, enemy)).toBe(3); // the farthest one activation's movement can buy, and outside minRange
    expect(gun.setUp).toBe(true); // safe and still within its own firing range, so it emplaces
  });

  it("closes only as far as its own firing range requires, then sets up instead of charging in", () => {
    const { b, ctrl } = newBattle();
    const gun = b.spawn("KNI_SIEGE_BASTION-BOMBARD", "A", { q: 2, r: 5 });
    const enemy = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 8, r: 5 }); // distance 6, out of range 4
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(b.distance(gun, enemy)).toBe(4); // never closer than its own range needs
    expect(gun.setUp).toBe(true);
  });
});

describe("AI: cavalry flanking", () => {
  it("routes around to a flank or rear hex instead of charging the front arc", () => {
    const { b, ctrl } = newBattle();
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 10, r: 10 }, { facing: 0 });
    const rider = b.spawn("SHI_CAVALRY_NIGHT-COURIER-RIDER", "A", { q: 17, r: 10 }); // due "front" of facing 0
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(b.distance(rider, enemy)).toBe(1);
    expect(attackArc(enemy.pos!, enemy.facing, rider.pos!)).not.toBe("front");
  });
});

describe("AI: surrender policy", () => {
  it("yields once every platoon is leaderless and average morale has collapsed, but not from either alone", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    b.sides.get("A")!.leaderUid = p.commanderUid;
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 20, r: 5 });

    // Morale has collapsed, but Doctrine still stands: no surrender.
    for (const u of b.activeUnits("A")) u.morale = 0;
    expect(shouldSurrender(ctrl, "A")).toBe(false);
    for (const u of b.activeUnits("A")) u.morale = b.def(u).morale;

    // Doctrine collapses (commander and second both fall, succession fails), but morale is still fine: no surrender.
    defeat(b, b.unit(p.secondUid!), "test");
    defeat(b, b.unit(p.commanderUid!), "test");
    ctrl.commandPhase();
    expect(doctrineState(b, p)).toBe("Broken");
    expect(shouldSurrender(ctrl, "A")).toBe(false);

    // Both together: the side yields.
    for (const u of b.activeUnits("A")) u.morale = 0;
    expect(shouldSurrender(ctrl, "A")).toBe(true);
    expect(maybeSurrender(ctrl, "A")).toBe(true);
    expect(b.sides.get("A")!.surrendered).toBe(true);
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("Surrender");
  });

  it("never re-surrenders or acts once a side has already yielded", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    b.sides.get("A")!.leaderUid = p.commanderUid;
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 20, r: 5 });
    defeat(b, b.unit(p.secondUid!), "test");
    defeat(b, b.unit(p.commanderUid!), "test");
    ctrl.commandPhase();
    for (const u of b.activeUnits("A")) u.morale = 0;
    expect(maybeSurrender(ctrl, "A")).toBe(true);
    expect(maybeSurrender(ctrl, "A")).toBe(false);
  });
});

describe("AI treats splitting as a trade, not a free gain", () => {
  it("never splits against a single hard hitter", () => {
    const { b, ctrl } = newBattle();
    const adept = b.spawn("SHI_ELITE_MIRROR-SHADE-ADEPT", "A", { q: 5, r: 5 });
    b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 5, r: 7 }); // the only threat on the field, well within range to consider splitting
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(adept.splitBodies ?? 1).toBe(1);
    expect([...b.units.values()].filter((u) => u.isClone)).toHaveLength(0);
  });

  it("splits to hold ground when a crowd of enemies is closing in", () => {
    const { b, ctrl } = newBattle();
    const adept = b.spawn("SHI_ELITE_MIRROR-SHADE-ADEPT", "A", { q: 5, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 7 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 7 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(adept.splitBodies).toBe(3);
    expect([...b.units.values()].filter((u) => u.isClone)).toHaveLength(2);
  });

  it("hunts a reachable enemy copy over a live soldier, shrinking the original", () => {
    const { b, ctrl } = newBattle();
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const original = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 10, r: 10 });
    original.splitBodies = 2;
    const clone = b.spawn(original.defId, "B", { q: 6, r: 5 }, { platoonId: null, uidPrefix: "clone" });
    clone.isClone = true; clone.cloneOf = original.uid; clone.splitBodies = 2; clone.hp = 1; clone.morale = 0;
    const soldier = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 6 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);

    expect(clone.defeated).toBe(true);
    expect(soldier.defeated).toBe(false);
    // the original reclaims the fallen copy's share
    expect(original.splitBodies).toBe(1);
    expect(b.events.some((e) => e.type === "SplitShareReclaimed")).toBe(true);
  });
});

describe("nearestEnemy", () => {
  it("returns null with no enemies on the field, otherwise the closest one", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 8 });
    expect(nearestEnemy(ctrl, u)).toBeNull();
    const far = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 10, r: 14 });
    const near = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 10, r: 10 });
    expect(nearestEnemy(ctrl, u)).toBe(near);
    expect(nearestEnemy(ctrl, u)).not.toBe(far);
  });
});

describe("runAiActivation", () => {
  it("defends rather than passing when there is nothing to fight or reach for", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 8 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(b.events.some((e) => e.type === "Defend" && e.data["uid"] === u.uid)).toBe(true);
  });

  it("picks the higher-value target: a ritualist outscores a plain foot soldier at equal range", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 8 });
    const [h1, h2] = hexNeighbors(u.pos!);
    const plain = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", h1!);
    const ritualist = b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "B", h2!);
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    const attack = b.events.find((e) => e.type === "Attack");
    expect(attack?.data["target"]).toBe(ritualist.uid);
    expect(plain.hp).toBe(1250);
  });

  it("takes the copy first when both are equally reachable: killing it hands its share back", () => {
    // Under the split economy (Q-16) a copy is not a decoy to be waved off. It carries a share of
    // the original's attack and defence and falls in one hit, so cutting it down shrinks the
    // original — which is worth more than the same swing spent on the full-strength body.
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 8 });
    const [h1, h2] = hexNeighbors(u.pos!);
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", h1!);
    const clone = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", h2!);
    clone.isClone = true;
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    const attack = b.events.find((e) => e.type === "Attack");
    expect(attack?.data["target"]).toBe(clone.uid);
  });

  it("with no enemy units on the field, marches on an enemy ritual circle as the only goal worth reaching", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const center = { q: 5, r: 10 };
    const circle = createRitual(b, { id: "enemy-circle", side: "B", center, radius: 1, required: 30, leaderUid: null, summonDefId: null, linkGroup: null });
    circle.progress = 15;
    const startDist = hexDistance(u.pos!, center);
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(hexDistance(u.pos!, center)).toBeLessThan(startDist);
  });

  it("a platoon leader auto-issues its faction's order once an enemy comes within range", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 9 }); // 4 hexes from the commander at (5,5)
    ctrl.commandPhase();
    runAiActivation(ctrl, "S", DIFFICULTY.normal);
    expect(p.orderUsedThisRound).toBe(true);
    expect(b.events.some((e) => e.type === "AbilityUsed" && e.data["ability"] === "ORD_MEASURED_ADVANCE")).toBe(true);
  });

  it("spends a SpawnClones active on nearby enemies when it has the room", () => {
    const { b, ctrl } = newBattle();
    const adept = b.spawn("SHI_ELITE_MIRROR-SHADE-ADEPT", "A", { q: 10, r: 8 }); // ABL_TWIN_ECHO
    // Splitting is a trade, not a gain (Q-16): copies are worth it to hold ground against a group,
    // never against one hard hitter, so the AI needs two enemies in reach before it will split.
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 13, r: 8 }); // 3 hexes away
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 12, r: 9 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    const spawned = b.events.find((e) => e.type === "ClonesSpawned");
    expect(spawned?.data["uid"]).toBe(adept.uid);
    expect((spawned?.data["clones"] as string[]).length).toBe(2);
  });

  it("challenges an adjacent enemy elite to a Duel rather than letting anyone else pile in", () => {
    const { b, ctrl } = newBattle();
    const champion = b.spawn("SAM_ELITE_ONI-GATE-CHAMPION", "A", { q: 10, r: 8 }); // ABL_FORMAL_DUEL
    const dragoon = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", hexNeighbors({ q: 10, r: 8 })[0]!);
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(b.duels.get(champion.uid)).toBe(dragoon.uid);
    expect(b.duels.get(dragoon.uid)).toBe(champion.uid);
  });
});

describe("holdForSyncPolicy", () => {
  it("holds every ritual in a link group until all of them are complete", () => {
    const { b, ctrl } = newBattle();
    const fast = createRitual(b, { id: "fast", side: "A", center: { q: 5, r: 5 }, radius: 1, required: 10, leaderUid: null, summonDefId: null, linkGroup: "g" });
    const slow = createRitual(b, { id: "slow", side: "A", center: { q: 5, r: 12 }, radius: 1, required: 10, leaderUid: null, summonDefId: null, linkGroup: "g" });
    fast.state = "CompletedHeld";
    slow.state = "Channeling";
    expect(holdForSyncPolicy(ctrl, "A")).toEqual({});
    slow.state = "CompletedHeld";
    expect(holdForSyncPolicy(ctrl, "A")).toEqual({ fast: true, slow: true });
  });

  it("releases a held ritual early once it crosses the danger threshold, without waiting on the rest of the group", () => {
    const { b, ctrl } = newBattle();
    const fast = createRitual(b, { id: "fast", side: "A", center: { q: 5, r: 5 }, radius: 1, required: 10, leaderUid: null, summonDefId: null, linkGroup: "g" });
    const slow = createRitual(b, { id: "slow", side: "A", center: { q: 5, r: 12 }, radius: 1, required: 10, leaderUid: null, summonDefId: null, linkGroup: "g" });
    fast.state = "CompletedHeld";
    fast.unstableStacks = 3;
    slow.state = "Channeling";
    expect(holdForSyncPolicy(ctrl, "A")).toEqual({ fast: true });
  });
});
