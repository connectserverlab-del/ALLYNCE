import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { computeStat } from "../src/modifiers.js";

describe("siege units: minimum range", () => {
  it("cannot fire at an adjacent target, and can fire once the target is far enough away", () => {
    const { b, ctrl } = newBattle();
    const battery = b.spawn("SAM_SIEGE_CINDERTHROAT-BATTERY", "A", { q: 5, r: 5 });
    const adjacent = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    battery.ap = 2;
    expect(() => ctrl.attack(battery, adjacent)).toThrow(/minimum range/);
    expect(battery.ap).toBe(2); // the failed attack never spent AP

    const distant = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 7, r: 5 });
    ctrl.attack(battery, distant); // distance 2, within [minRange 2, range 3]
    expect(battery.attackedThisActivation).toBe(true);
  });

  it("is still bound by its maximum range", () => {
    const { b, ctrl } = newBattle();
    const battery = b.spawn("KNI_SIEGE_WARDENS-BOMBARD", "A", { q: 5, r: 5 });
    const farAway = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 9, r: 5 });
    battery.ap = 2;
    expect(() => ctrl.attack(battery, farAway)).toThrow(/Out of range/);
  });
});

describe("Breaching Volley", () => {
  it("adds +200 ATK against a defender on Fortification terrain, and nothing otherwise", () => {
    const { b } = newBattle();
    const battery = b.spawn("DRG_SIEGE_BONEFORGE-BALLISTA", "A", { q: 5, r: 5 });
    const target = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 7, r: 5 });

    const openGround = computeStat(b, battery, "ATK", { attacker: battery, defender: target });
    expect(openGround.modifiers.map((m) => m.source)).not.toContain("Breaching Volley");

    b.terrain.set("7,5", "Fortification");
    const fortified = computeStat(b, battery, "ATK", { attacker: battery, defender: target });
    const mod = fortified.modifiers.find((m) => m.source === "Breaching Volley");
    expect(mod?.value).toBe(200);
    expect(fortified.final).toBe(openGround.final + 200);
  });
});

describe("cavalry charge abilities", () => {
  it("Lance Charge requires three hexes of movement, grants +220 ATK, and leaves the rider Exposed", () => {
    const { b, ctrl } = newBattle();
    const rider = b.spawn("SAM_CAVALRY_CHARWIND-LANCERS", "A", { q: 3, r: 5 });
    rider.ap = 2;
    // not enough movement yet: the charge condition fails and the ability refunds its AP cost
    expect(() => ctrl.useAbility(rider, "ABL_LANCE_CHARGE")).toThrow(/conditions not met/);

    rider.movedThisActivation = 3;
    const before = computeStat(b, rider, "ATK").final;
    ctrl.useAbility(rider, "ABL_LANCE_CHARGE");
    const after = computeStat(b, rider, "ATK").final;
    expect(after).toBe(before + 220);
    expect(b.hasStatus(rider, "Exposed")).toBe(true);
    expect(rider.cooldowns["ABL_LANCE_CHARGE"]).toBe(2);
  });

  it("Fleet Strike triggers off two hexes moved and does not force Exposed", () => {
    const { b, ctrl } = newBattle();
    const outrider = b.spawn("SHI_CAVALRY_REED-MARSH-OUTRIDERS", "A", { q: 3, r: 5 });
    outrider.ap = 2;
    outrider.movedThisActivation = 2;
    const before = computeStat(b, outrider, "ATK").final;
    ctrl.useAbility(outrider, "ABL_FLEET_STRIKE");
    const after = computeStat(b, outrider, "ATK").final;
    expect(after).toBe(before + 150);
    expect(b.hasStatus(outrider, "Exposed")).toBe(false);
  });
});

describe("registry", () => {
  it("every siege unit carries a minRange less than its range, and every new unit resolves its abilities", () => {
    const { b } = newBattle();
    for (const id of [
      "SAM_SIEGE_CINDERTHROAT-BATTERY", "SHI_SIEGE_HOLLOW-REED-MORTAR",
      "KNI_SIEGE_WARDENS-BOMBARD", "DRG_SIEGE_BONEFORGE-BALLISTA",
    ]) {
      const d = b.reg.unit(id);
      expect(d.roles).toContain("Siege");
      expect(d.minRange).toBeLessThan(d.range);
    }
    for (const id of ["SAM_CAVALRY_CHARWIND-LANCERS", "SHI_CAVALRY_REED-MARSH-OUTRIDERS"]) {
      const d = b.reg.unit(id);
      expect(d.roles).toContain("Cavalry");
      expect(d.slots).toContain("Elite");
    }
  });
});
