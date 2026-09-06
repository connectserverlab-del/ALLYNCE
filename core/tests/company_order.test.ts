import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, ANG } from "./helpers.js";
import { companyLeader } from "../src/composition.js";
import { tempMods } from "../src/modifiers.js";

/**
 * `data/compositions/platoon.json` has always declared Company organization's effect as "One
 * army-level order per round", but nothing issued it. Company leadership (`canLead: [..., "Company"]`)
 * already gates army legality (see composition.test.ts); this is the battlefield half: a qualifying
 * commander or second spends the side's one Company Order to reissue their faction's own signature
 * platoon order to every platoon on the side at once, through the same interpreter each platoon's
 * own order already uses.
 */

const churo: typeof SAM = { ...SAM, commander: "SAM_SECOND_WHITE-CRANE-RETAINER", second: "SAM_SECOND_WHITE-CRANE-RETAINER" };

describe("companyLeader", () => {
  it("is null until a Company-capable commander or second is present", () => {
    const { b } = newBattle();
    deploy(b, "P1", "A", churo, [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 4, r: 1 }]);
    expect(companyLeader(b, "A")).toBeNull();
  });

  it("finds the Hatamoto commander once one is fielded", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 4, r: 1 }]);
    expect(companyLeader(b, "A")?.uid).toBe(p.commanderUid);
  });
});

describe("useCompanyOrder", () => {
  it("refuses a side with fewer than three non-Broken platoons", () => {
    const { b, ctrl } = newBattle();
    const p1 = deploy(b, "P1", "A", SAM, [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 4, r: 1 }]);
    deploy(b, "P2", "A", SAM, [{ q: 0, r: 4 }, { q: 1, r: 4 }, { q: 2, r: 4 }, { q: 0, r: 5 }, { q: 1, r: 5 }, { q: 2, r: 5 }, { q: 3, r: 5 }, { q: 4, r: 5 }]);
    ctrl.commandPhase(); ctrl.beginActivation("P1");
    expect(() => ctrl.useCompanyOrder(b.unit(p1.commanderUid!))).toThrow(/Company organization/);
  });

  it("refuses a Company-sized side with no commander or second who may lead a Company", () => {
    const { b, ctrl } = newBattle();
    const p1 = deploy(b, "P1", "A", churo, [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 4, r: 1 }]);
    deploy(b, "P2", "A", churo, [{ q: 0, r: 4 }, { q: 1, r: 4 }, { q: 2, r: 4 }, { q: 0, r: 5 }, { q: 1, r: 5 }, { q: 2, r: 5 }, { q: 3, r: 5 }, { q: 4, r: 5 }]);
    deploy(b, "P3", "A", churo, [{ q: 0, r: 8 }, { q: 1, r: 8 }, { q: 2, r: 8 }, { q: 0, r: 9 }, { q: 1, r: 9 }, { q: 2, r: 9 }, { q: 3, r: 9 }, { q: 4, r: 9 }]);
    ctrl.commandPhase(); ctrl.beginActivation("P1");
    expect(() => ctrl.useCompanyOrder(b.unit(p1.commanderUid!))).toThrow(/may lead a Company/);
  });

  it("refuses a faction with no signature platoon order to issue army-wide", () => {
    const { b, ctrl } = newBattle();
    const p1 = deploy(b, "P1", "A", ANG, [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 4, r: 1 }]);
    deploy(b, "P2", "A", ANG, [{ q: 0, r: 4 }, { q: 1, r: 4 }, { q: 2, r: 4 }, { q: 0, r: 5 }, { q: 1, r: 5 }, { q: 2, r: 5 }, { q: 3, r: 5 }, { q: 4, r: 5 }]);
    deploy(b, "P3", "A", ANG, [{ q: 0, r: 8 }, { q: 1, r: 8 }, { q: 2, r: 8 }, { q: 0, r: 9 }, { q: 1, r: 9 }, { q: 2, r: 9 }, { q: 3, r: 9 }, { q: 4, r: 9 }]);
    ctrl.commandPhase(); ctrl.beginActivation("P1");
    expect(() => ctrl.useCompanyOrder(b.unit(p1.commanderUid!))).toThrow(/no signature platoon order/);
  });

  it("reissues the faction's signature order to every platoon on the side, not only the caster's own", () => {
    const { b, ctrl } = newBattle();
    const p1 = deploy(b, "P1", "A", SAM, [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 4, r: 1 }]);
    const p2 = deploy(b, "P2", "A", SAM, [{ q: 0, r: 4 }, { q: 1, r: 4 }, { q: 2, r: 4 }, { q: 0, r: 5 }, { q: 1, r: 5 }, { q: 2, r: 5 }, { q: 3, r: 5 }, { q: 4, r: 5 }]);
    const p3 = deploy(b, "P3", "A", SAM, [{ q: 0, r: 8 }, { q: 1, r: 8 }, { q: 2, r: 8 }, { q: 0, r: 9 }, { q: 1, r: 9 }, { q: 2, r: 9 }, { q: 3, r: 9 }, { q: 4, r: 9 }]);
    ctrl.commandPhase(); ctrl.beginActivation("P1");
    const cmdr = b.unit(p1.commanderUid!);
    const apBefore = cmdr.ap;
    ctrl.useCompanyOrder(cmdr);
    expect(cmdr.ap).toBe(apBefore - 1);
    for (const p of [p1, p2, p3]) {
      const foot = b.unit(p.footUids[4]!); // the far end of each platoon's own line
      expect(tempMods(foot).some((m) => m.source === "Measured Advance" && m.value === 100)).toBe(true);
    }
  });

  it("is a once-per-round resource shared by the whole side, and refreshes next round", () => {
    const { b, ctrl } = newBattle();
    const p1 = deploy(b, "P1", "A", SAM, [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 4, r: 1 }]);
    deploy(b, "P2", "A", SAM, [{ q: 0, r: 4 }, { q: 1, r: 4 }, { q: 2, r: 4 }, { q: 0, r: 5 }, { q: 1, r: 5 }, { q: 2, r: 5 }, { q: 3, r: 5 }, { q: 4, r: 5 }]);
    deploy(b, "P3", "A", SAM, [{ q: 0, r: 8 }, { q: 1, r: 8 }, { q: 2, r: 8 }, { q: 0, r: 9 }, { q: 1, r: 9 }, { q: 2, r: 9 }, { q: 3, r: 9 }, { q: 4, r: 9 }]);
    ctrl.commandPhase(); ctrl.beginActivation("P1");
    const cmdr = b.unit(p1.commanderUid!);
    ctrl.useCompanyOrder(cmdr);
    expect(() => ctrl.useCompanyOrder(cmdr)).toThrow(/already used/);
    b.round++;
    ctrl.commandPhase(); ctrl.beginActivation("P1");
    expect(() => ctrl.useCompanyOrder(b.unit(p1.commanderUid!))).not.toThrow();
  });

  it("lets a qualifying second issue it even when the platoon's own commander cannot lead a Company", () => {
    const { b, ctrl } = newBattle();
    const mixed: typeof SAM = { ...SAM, commander: "SAM_SECOND_WHITE-CRANE-RETAINER", second: "SAM_COMMANDER_EMBER-BANNER-DAIMYO" };
    const p1 = deploy(b, "P1", "A", mixed, [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 4, r: 1 }]);
    deploy(b, "P2", "A", mixed, [{ q: 0, r: 4 }, { q: 1, r: 4 }, { q: 2, r: 4 }, { q: 0, r: 5 }, { q: 1, r: 5 }, { q: 2, r: 5 }, { q: 3, r: 5 }, { q: 4, r: 5 }]);
    deploy(b, "P3", "A", mixed, [{ q: 0, r: 8 }, { q: 1, r: 8 }, { q: 2, r: 8 }, { q: 0, r: 9 }, { q: 1, r: 9 }, { q: 2, r: 9 }, { q: 3, r: 9 }, { q: 4, r: 9 }]);
    ctrl.commandPhase(); ctrl.beginActivation("P1");
    const second = b.unit(p1.secondUid!);
    expect(() => ctrl.useCompanyOrder(second)).not.toThrow();
  });
});
