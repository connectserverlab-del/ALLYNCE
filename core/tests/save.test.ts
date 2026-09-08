import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM } from "./helpers.js";
import { saveBattle, loadBattle, SAVE_VERSION } from "../src/save.js";
import { loadRegistry } from "../src/data.js";
import { addTempMod, clearTempMods, computeStat } from "../src/modifiers.js";

const reg = loadRegistry();
const BLOB = [{ q: 2, r: 2 }, { q: 3, r: 2 }, { q: 4, r: 2 }, { q: 2, r: 3 }, { q: 3, r: 3 }, { q: 4, r: 3 }, { q: 5, r: 3 }, { q: 6, r: 3 }];

describe("temporary stat modifiers survive a save/load round trip", () => {
  it("carries a unit's addTempMod entries across saveBattle/loadBattle", () => {
    const { b } = newBattle();
    deploy(b, "pa", "A", SAM, BLOB);
    const u = [...b.units.values()][0]!;
    addTempMod(u, { source: "Measured Advance", stat: "ATK", value: 100 });
    expect(computeStat(b, u, "ATK").modifiers.map((m) => m.source)).toContain("Measured Advance");

    const back = loadBattle(reg, saveBattle(b));
    const restored = back.unit(u.uid);
    expect(restored.tempMods).toEqual(u.tempMods);
    expect(computeStat(back, restored, "ATK").modifiers.map((m) => m.source)).toContain("Measured Advance");
  });

  it("keeps a restored unit's temp mods independently clearable from the original", () => {
    const { b } = newBattle();
    deploy(b, "pa", "A", SAM, BLOB);
    const u = [...b.units.values()][0]!;
    addTempMod(u, { source: "Forced March", stat: "MOV", value: 3 });

    const back = loadBattle(reg, saveBattle(b));
    const restored = back.unit(u.uid);
    clearTempMods(restored);
    expect(restored.tempMods).toEqual([]);
    expect(u.tempMods.map((m) => m.source)).toEqual(["Forced March"]); // the live battle is untouched
  });

  it("bumped SAVE_VERSION rejects a save from the previous version rather than silently misreading it", () => {
    const { b } = newBattle();
    const save = saveBattle(b);
    expect(save.version).toBe(SAVE_VERSION);
    expect(() => loadBattle(reg, { ...save, version: SAVE_VERSION - 1 })).toThrow(/cannot be read/);
  });
});
