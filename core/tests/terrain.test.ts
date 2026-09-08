import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { computeStat, addTempMod } from "../src/modifiers.js";

describe("rough terrain movement cost", () => {
  it("Mountain costs five movement for ground units", () => {
    const { b, ctrl } = newBattle();
    const foot = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    b.terrain.set("6,5", "Mountain");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    addTempMod(foot, { source: "test: extra reach", stat: "MOV", value: 10 }); // base mov (4) < Mountain's cost (5)
    expect(ctrl.reachable(foot).get("6,5")?.cost).toBe(5);
  });

  it("a Mountain one step away is out of reach for a plain foot soldier's normal movement", () => {
    const { b, ctrl } = newBattle();
    const foot = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 }); // mov 4, Mountain costs 5
    b.terrain.set("6,5", "Mountain");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(ctrl.reachable(foot).has("6,5")).toBe(false);
  });

  it("flying units ignore Mountain cost entirely", () => {
    const { b, ctrl } = newBattle();
    const dragoon = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 5, r: 5 });
    b.terrain.set("6,5", "Mountain");
    ctrl.commandPhase(); ctrl.beginActivation("ind:B");
    expect(ctrl.reachable(dragoon).get("6,5")?.cost).toBe(1);
  });

  it("Mud costs two movement", () => {
    const { b, ctrl } = newBattle();
    const foot = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    b.terrain.set("6,5", "Mud");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(ctrl.reachable(foot).get("6,5")?.cost).toBe(2);
  });

  it("Trench and Ford both cost two movement", () => {
    const { b, ctrl } = newBattle();
    const foot = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    b.terrain.set("6,5", "Trench");
    b.terrain.set("4,5", "Ford");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    const reach = ctrl.reachable(foot);
    expect(reach.get("6,5")?.cost).toBe(2);
    expect(reach.get("4,5")?.cost).toBe(2);
  });

  it("Ford is passable, unlike Water", () => {
    const { b } = newBattle();
    expect(b.isFree({ q: 6, r: 5 })).toBe(true);
    b.terrain.set("6,5", "Ford");
    expect(b.isFree({ q: 6, r: 5 })).toBe(true);
    b.terrain.set("6,5", "Water");
    expect(b.isFree({ q: 6, r: 5 })).toBe(false);
  });

  it("Road always costs one movement, even where it crosses rough terrain", () => {
    const { b, ctrl } = newBattle();
    const foot = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    b.terrain.set("6,5", "Road");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    const reach = ctrl.reachable(foot);
    expect(reach.get("6,5")?.cost).toBe(1);
    expect(reach.get("7,5")?.cost).toBe(2); // Road (1) then one Open hex (1)
  });
});

describe("rough terrain defensive bonus", () => {
  it("Trench grants +100 DEF, source-tracked", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 3, r: 3 });
    b.terrain.set("3,3", "Trench");
    const def = computeStat(b, u, "DEF");
    expect(def.modifiers.find((m) => m.source === "Terrain: Trench")?.value).toBe(100);
  });

  it("Ruins grants +50 DEF, source-tracked", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 3, r: 3 });
    b.terrain.set("3,3", "Ruins");
    const def = computeStat(b, u, "DEF");
    expect(def.modifiers.find((m) => m.source === "Terrain: Ruins")?.value).toBe(50);
  });

  it("Mountain, Mud, Road and Ford grant no defensive bonus", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 3, r: 3 });
    for (const t of ["Mountain", "Mud", "Road", "Ford"] as const) {
      b.terrain.set("3,3", t);
      const def = computeStat(b, u, "DEF");
      expect(def.modifiers.some((m) => m.source.startsWith("Terrain:"))).toBe(false);
    }
  });

  it("flying units get no terrain bonus at all, rough terrain included", () => {
    const { b } = newBattle();
    const dragoon = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 3, r: 3 });
    b.terrain.set("3,3", "Trench");
    const def = computeStat(b, dragoon, "DEF");
    expect(def.modifiers.some((m) => m.source.startsWith("Terrain:"))).toBe(false);
  });
});
