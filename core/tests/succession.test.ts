import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, KNI, blob, kingdomWithResearch } from "./helpers.js";
import { defeat } from "../src/combat.js";
import { doctrineState } from "../src/composition.js";
import { computeStat } from "../src/modifiers.js";
import { applyKingdom } from "../src/kingdom.js";

describe("command and succession", () => {
  it("promotes the second in the next Command Phase, fires the succession ability, and keeps Doctrine through Continuity", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!); const second = b.unit(p.secondUid!);
    const moraleBefore = b.unit(p.footUids[0]!).morale;
    defeat(b, cmdr, "test");
    expect(b.unit(p.footUids[0]!).morale).toBe(moraleBefore - 20);
    expect(p.pendingSuccession).toBe(true);
    expect(doctrineState(b, p)).toBe("Full"); // continuity
    ctrl.commandPhase();
    expect(p.commanderUid).toBe(second.uid);
    expect(second.promotedFromSecond).toBe(true);
    expect(b.events.some((e) => e.type === "Succession")).toBe(true);
    // Last Oath rallied the platoon (+10)
    expect(b.unit(p.footUids[0]!).morale).toBe(moraleBefore - 20 + 10 + 5 /* command radius recovery */);
    expect(ctrl.canIssueOrder(second)).toBe(true);
    expect(doctrineState(b, p)).toBe("Full");
  });

  it("Succession Doctrine research extends the continuity grace period by its named amount", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const baseline = b.reg.rules.standardPlatoon.continuityRounds;
    const k = kingdomWithResearch("SAM", ["RES_DRILL_YARD", "RES_BANNER_DISCIPLINE", "RES_SUCCESSION_DOCTRINE"]);
    applyKingdom(b, "A", k);
    defeat(b, b.unit(p.commanderUid!), "test");
    expect(p.continuityRoundsLeft).toBe(baseline + 1);
  });

  it("Doctrine collapses when no second survives to promote", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    defeat(b, b.unit(p.secondUid!), "test");
    defeat(b, b.unit(p.commanderUid!), "test");
    expect(doctrineState(b, p)).toBe("Full");
    ctrl.commandPhase();
    expect(doctrineState(b, p)).toBe("Broken");
    expect(b.events.some((e) => e.type === "SuccessionFailed")).toBe(true);
  });

  it("command auras never stack: strongest eligible only", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", KNI, blob(5, 5));
    const foot = b.unit(p.footUids[0]!);
    const auras = computeStat(b, foot, "ATK").modifiers.filter((m) => m.source.includes("aura"));
    expect(auras).toHaveLength(1);
    expect(auras[0]!.value).toBe(100);
  });

  it("Inherited Wall grants +150 DEF for one round after Knight succession", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", KNI, blob(5, 5));
    defeat(b, b.unit(p.commanderUid!), "test");
    ctrl.commandPhase();
    const foot = b.unit(p.footUids[0]!);
    expect(computeStat(b, foot, "DEF").modifiers.map((m) => m.source)).toContain("Inherited Wall");
  });
});
