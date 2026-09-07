import { describe, it, expect } from "vitest";
import { newBattle, deploy, KNI, blob, reg } from "./helpers.js";
import { saveBattle, loadBattle } from "../src/save.js";
import { BattleController } from "../src/battle.js";
import { newKingdom, startUpgrade, tick, startResearch, applyKingdom } from "../src/kingdom.js";
import { computeStat } from "../src/modifiers.js";

describe("saving and loading a battle with a holding attached", () => {
  it("keeps every kingdom-derived stat and movement modifier alive across a round-trip", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(5, 5));
    const k = newKingdom(reg, "KNI");
    k.resources = { koku: 999999, iron: 999999, timber: 999999, silver: 999999 };
    for (const bld of ["FORGE", "RESEARCH_HALL"] as const) { startUpgrade(reg, k, bld); tick(reg, k, 100000); }
    startResearch(reg, k, "RES_FORGED_EDGE"); tick(reg, k, 100000);
    applyKingdom(b, "A", k);

    const foot = b.unit(p.footUids[0]!);
    const before = computeStat(b, foot, "ATK");
    const sourcesBefore = before.modifiers.map((m) => m.source);
    expect(sourcesBefore).toContain("Forge 1");
    expect(sourcesBefore).toContain("Research: Forged Edge");
    const movBefore = ctrl.movementAllowance(foot);

    const restored = loadBattle(reg, saveBattle(b));
    const restoredCtrl = new BattleController(restored, ctrl.victory);
    const restoredFoot = restored.unit(foot.uid);
    const after = computeStat(restored, restoredFoot, "ATK");
    expect(after.modifiers.map((m) => m.source)).toEqual(sourcesBefore);
    expect(after.final).toBe(before.final);
    expect(restoredCtrl.movementAllowance(restoredFoot)).toBe(movBefore);
  });
});
