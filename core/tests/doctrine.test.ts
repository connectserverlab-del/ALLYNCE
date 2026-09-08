import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, KNI, SHI, DRG, blob } from "./helpers.js";
import { hexKey } from "../src/hex.js";
import { computeStat } from "../src/modifiers.js";

/**
 * Every host faction (Samurai, Shinobi, Knight, Dragon Host) carries one signature doctrine
 * passive. Nothing before this file exercised any of the four: a declared-but-unwired passive
 * fails silently rather than with an error, which is how Unseen Network went dark — Hidden
 * Shinobi were sharing vision with nobody.
 */
describe("faction doctrine passives", () => {
  it("Oath Line: adjacent Samurai foot soldiers facing the same direction gain +50 DEF", () => {
    const { b } = newBattle();
    const p = deploy(b, "M", "A", SAM, blob(2, 2));
    const foot0 = b.units.get(p.footUids[0]!)!; // (2,3), beside footUids[1] at (3,3)
    const def = computeStat(b, foot0, "DEF");
    expect(def.modifiers.find((m) => m.source === "Oath Line")?.value).toBe(50);
  });

  it("Unseen Network: a Hidden platoon-mate beside a Hidden target lets the platoon's ranged leader strike it beyond arm's reach", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SHI, blob(2, 2));
    // Simulate a succession that left the ranged Second (range 2) holding the commander's slot.
    p.commanderUid = p.secondUid;
    const leader = b.units.get(p.commanderUid!)!;
    const spotter = b.units.get(p.footUids[3]!)!; // (5,3), one hex from the target below
    const target = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 2 });
    b.addStatus(target, "Hidden", 3, "test");

    ctrl.commandPhase();
    ctrl.beginActivation("S");
    expect(() => ctrl.attack(leader, target)).toThrow(/Hidden/);

    b.addStatus(spotter, "Hidden", 3, "test");
    const hpBefore = target.hp;
    ctrl.attack(leader, target);
    expect(target.hp).toBeLessThan(hpBefore);
  });

  it("Oath of Intercession: a Guarded non-foot Knight beside the target takes the hit instead, once per round", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(2, 2));
    const commander = b.units.get(p.commanderUid!)!; // (2,2)
    const footTarget = b.units.get(p.footUids[0]!)!; // (2,3), adjacent to the commander
    const second = b.units.get(p.secondUid!)!;        // (3,2), also adjacent to the commander
    const raider = b.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "B", { q: 2, r: 4 });

    ctrl.commandPhase();
    ctrl.beginActivation("K");
    ctrl.useAbility(commander, "ORD_BASTION_FORMATION"); // Guards the commander and adjacent Knight-themed allies
    expect(b.hasStatus(second, "Guarded")).toBe(true);

    ctrl.beginActivation("ind:B");
    const footHpBefore = footTarget.hp, secondHpBefore = second.hp;
    ctrl.attack(raider, footTarget);
    expect(footTarget.hp).toBe(footHpBefore);
    expect(second.hp).toBeLessThan(secondHpBefore);
  });

  it("Predatory Airspace: enemy flying movement into a Dragon Flight commander's radius is denied, outside it is not", () => {
    const { b, ctrl } = newBattle();
    deploy(b, "D", "A", DRG, blob(2, 5)); // commander at (2,5), command radius 4
    const flier = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 9, r: 5 });

    ctrl.commandPhase();
    ctrl.beginActivation("ind:B");
    const reach = ctrl.reachable(flier);
    expect(reach.has(hexKey({ q: 6, r: 5 }))).toBe(false);  // distance 4 from the commander: inside the radius
    expect(reach.has(hexKey({ q: 10, r: 5 }))).toBe(true);  // distance 8: outside it, ordinary flying cost
  });
});
