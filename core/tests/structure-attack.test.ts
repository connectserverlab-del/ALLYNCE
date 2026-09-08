import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { callPortal } from "../src/portals.js";
import { computeStat } from "../src/modifiers.js";

// attackStructure (firing a siege piece on a reinforcement portal) had never been exercised by a
// test. It also computed its attack number by adding the Breaching Shot bonus in by hand instead
// of through the modifier pipeline, so that bonus never carried a source and never showed up in
// a breakdown. These tests pin the fixed behaviour: the bonus is a named modifier and the final
// damage is unchanged.
describe("attacking a structure", () => {
  it("records Breaching Shot as a named modifier, not a silent number", () => {
    const { b, ctrl } = newBattle();
    const wyrm = b.spawn("DRG_SIEGE_CINDERTHROAT-SIEGEWYRM", "A", { q: 5, r: 5 });
    const portal = callPortal(b, "B", { q: 7, r: 5 }, { telegraph: 0, hp: 5000, def: 1200 })!;
    ctrl.commandPhase();
    ctrl.beginActivation("ind:A");

    const breakdown = computeStat(b, wyrm, "ATK", { attacker: wyrm, structureTarget: true });
    expect(breakdown.modifiers).toContainEqual({ source: "Breaching Shot", stat: "ATK", value: 300 });
    expect(breakdown.final).toBe(2200 + 300); // base atk + Breaching Shot

    const hpBefore = portal.hp;
    ctrl.attackStructure(wyrm, portal);
    expect(portal.hp).toBe(hpBefore - (2200 + 300 - 1200)); // damage floors at attack - portal def
  });

  it("gives no structure bonus to a siege piece without Breaching Shot", () => {
    const { b, ctrl } = newBattle();
    const mortar = b.spawn("SHI_SIEGE_REED-SMOKE-MORTAR", "A", { q: 5, r: 5 });
    const portal = callPortal(b, "B", { q: 8, r: 5 }, { telegraph: 0, hp: 5000, def: 1000 })!;
    ctrl.commandPhase();
    ctrl.beginActivation("ind:A");
    ctrl.useAbility(mortar, "ABL_SIEGE_SETUP");

    const breakdown = computeStat(b, mortar, "ATK", { attacker: mortar, structureTarget: true });
    expect(breakdown.modifiers.some((m) => m.source === "Breaching Shot")).toBe(false);
    expect(breakdown.final).toBe(1500);

    const hpBefore = portal.hp;
    ctrl.attackStructure(mortar, portal);
    expect(portal.hp).toBe(hpBefore - (1500 - 1000));
  });

  it("a siege piece that must set up cannot fire on a structure without doing so first", () => {
    const { b, ctrl } = newBattle();
    const gun = b.spawn("KNI_SIEGE_BASTION-BOMBARD", "A", { q: 5, r: 5 });
    const portal = callPortal(b, "B", { q: 7, r: 5 }, { telegraph: 0 })!;
    ctrl.commandPhase();
    ctrl.beginActivation("ind:A");
    expect(() => ctrl.attackStructure(gun, portal)).toThrow(/Set Up/);
  });
});
