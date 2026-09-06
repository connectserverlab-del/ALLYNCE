import { describe, it, expect } from "vitest";
import { reg, newBattle } from "./helpers.js";

/**
 * The five sworn companies (Cobalt Conclave, Thorn Coven, Cutpurse Court, Windmarch Host, Dunewake
 * Compact) fielded a Commander, Second, Elite and FootSoldier each but no themed siege piece or
 * cavalry unit, unlike every host army. The standing intent calls for both on every faction; this
 * closes the gap for the sworn companies (Windmarch Host already had cavalry through its Elite and
 * Commander, so it only needed a siege piece). Ritual Cult and the seven divisions are their own,
 * separate gaps, left for later passes.
 */
describe("sworn companies: themed siege and cavalry roster", () => {
  it("every sworn company now fields at least one Siege-role and one Cavalry-role unit", () => {
    const companies = ["ARC", "WIT", "ROG", "STP", "DUN"];
    for (const faction of companies) {
      const roster = [...reg.units.values()].filter((u) => u.faction === faction);
      expect(roster.some((u) => u.roles.includes("Siege")), `${faction} siege`).toBe(true);
      expect(roster.some((u) => u.roles.includes("Cavalry")), `${faction} cavalry`).toBe(true);
    }
  });

  it("every new unit fills the Specialist slot and stays within its company's theme for cohesion", () => {
    const newUnits = [
      "ARC_SIEGE_WARDED-CULVERIN", "ARC_CAVALRY_WARDBOUND-COURSER",
      "WIT_SIEGE_BLIGHT-MORTAR", "WIT_CAVALRY_BRAMBLEHORN-RIDER",
      "ROG_SIEGE_STOLEN-BOMBARD", "ROG_CAVALRY_BACKSTREET-COURSER",
      "STP_SIEGE_STEPPE-FALCONET",
      "DUN_SIEGE_GLASSROAD-BALLISTA", "DUN_CAVALRY_DUNEWAKE-VANGUARD",
    ];
    for (const id of newUnits) {
      const d = reg.unit(id);
      expect(d.slots, id).toContain("Specialist");
      expect(d.themes, id).toEqual([reg.factions.get(d.faction)!.primaryTheme]);
      expect(d.unique, id).toBe(false);
    }
  });
});

describe("sworn company siege pieces", () => {
  it("the Warded Culverin must set up, respects minimum range, and breaches Fortification", () => {
    const { b, ctrl } = newBattle();
    const gun = b.spawn("ARC_SIEGE_WARDED-CULVERIN", "A", { q: 5, r: 5 });
    const near = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    const far = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 8, r: 5 });
    b.terrain.set("8,5", "Fortification");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(() => ctrl.attack(gun, far)).toThrow(/Set Up/);
    ctrl.useAbility(gun, "ABL_SIEGE_SETUP");
    expect(() => ctrl.attack(gun, near)).toThrow(/minimum range/);
    const hp = far.hp;
    ctrl.attack(gun, far);
    const atkEvent = b.events.filter((e) => e.type === "Attack").pop()!;
    expect(far.hp).toBeLessThan(hp);
    expect(atkEvent.data["atk"]).toBe(1750 + 220); // Breaching Shot against Fortification
  });

  it("the Steppe Falconet needs no Set Up and can fire a Concussive Blast the round it arrives", () => {
    const { b, ctrl } = newBattle();
    const gun = b.spawn("STP_SIEGE_STEPPE-FALCONET", "A", { q: 2, r: 2 });
    const e1 = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 4, r: 2 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    const hp = e1.hp;
    ctrl.useAbility(gun, "ABL_CONCUSSIVE_BLAST", { targetHex: { q: 4, r: 2 } });
    expect(e1.hp).toBeLessThan(hp);
    expect(b.hasStatus(e1, "Suppressed")).toBe(true);
    expect(gun.setUp).toBe(false); // never needed one
  });
});

describe("sworn company cavalry", () => {
  it("the Backstreet Courser charges for bonus ATK after 3+ hexes, then fades without a reaction attack", async () => {
    const { b, ctrl } = newBattle();
    const rider = b.spawn("ROG_CAVALRY_BACKSTREET-COURSER", "A", { q: 0, r: 0 });
    const target = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 4, r: 0 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    ctrl.move(rider, { q: 3, r: 0 });
    expect(rider.chargeMoved).toBe(3);
    ctrl.useAbility(rider, "ABL_LANCE_CHARGE");
    const { computeStat } = await import("../src/modifiers.js");
    const atk = computeStat(b, rider, "ATK", { attacker: rider, defender: target });
    expect(atk.modifiers.map((m) => m.source)).toContain("Lance Charge");
    ctrl.attack(rider, target);
    expect(rider.freeMoveHexes).toBe(2); // Hit and Fade
  });

  it("the Wardbound Courser and Dunewake Vanguard carry the same Lance Charge kit", () => {
    for (const id of ["ARC_CAVALRY_WARDBOUND-COURSER", "WIT_CAVALRY_BRAMBLEHORN-RIDER", "DUN_CAVALRY_DUNEWAKE-VANGUARD"]) {
      const d = reg.unit(id);
      expect(d.actives, id).toContain("ABL_LANCE_CHARGE");
      expect(d.roles, id).toContain("Cavalry");
    }
  });
});
