import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { computeStat } from "../src/modifiers.js";
import { breakAnchor } from "../src/combat.js";

describe("modifier breakdown: sources not covered elsewhere", () => {
  it("Shaken morale applies a flat -50 to both ATK and DEF, named as its source", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const d = b.def(u);
    u.morale = 50; // Shaken band is [40, 69]
    const atk = computeStat(b, u, "ATK");
    const def = computeStat(b, u, "DEF");
    expect(atk.modifiers.find((m) => m.source === "Morale: Shaken")?.value).toBe(-50);
    expect(def.modifiers.find((m) => m.source === "Morale: Shaken")?.value).toBe(-50);
    expect(atk.final).toBe(d.atk - 50);
    u.morale = 70; // Steady: penalty drops off entirely
    expect(computeStat(b, u, "ATK").modifiers.map((m) => m.source)).not.toContain("Morale: Shaken");
  });

  it("a castle-ranked lord grants allies on Fortification within command radius +100 DEF, and only there", () => {
    const { b } = newBattle();
    const lord = b.spawn("SAM_LORD_ASHFALL-DAIMYO", "A", { q: 10, r: 10 });
    const guard = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 11, r: 10 });
    b.terrain.set("11,10", "Fortification");
    const inRange = computeStat(b, guard, "DEF");
    expect(inRange.modifiers.map((m) => m.source)).toContain("Rank: castle lord nearby");
    expect(inRange.modifiers.find((m) => m.source === "Rank: castle lord nearby")?.value).toBe(100);

    // off the wall, same distance: no bonus even though the lord is still near
    b.terrain.set("11,10", "Open");
    expect(computeStat(b, guard, "DEF").modifiers.map((m) => m.source)).not.toContain("Rank: castle lord nearby");

    // on the wall, but outside the lord's command radius: no bonus
    b.terrain.set("11,10", "Fortification");
    const farGuard = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 20, r: 10 });
    b.terrain.set("20,10", "Fortification");
    expect(computeStat(b, farGuard, "DEF").modifiers.map((m) => m.source)).not.toContain("Rank: castle lord nearby");
  });

  it("each broken anchor scales a Divine Entity's stats down by 15% of base, named per anchor lost", () => {
    const { b } = newBattle();
    const god = b.spawn("DIV_BOSS_SOVEREIGN-OF-MEMORY", "A", { q: 8, r: 8 });
    const d = b.def(god);
    expect(god.divine!.anchors).toBe(3);
    expect(computeStat(b, god, "ATK").modifiers.some((m) => m.source.startsWith("Anchors broken"))).toBe(false);

    breakAnchor(b, god, "test");
    const atk1 = computeStat(b, god, "ATK");
    const pen1 = -Math.round(d.atk * 0.15 * 1);
    expect(atk1.modifiers.find((m) => m.source === "Anchors broken x1")?.value).toBe(pen1);
    expect(atk1.final).toBe(d.atk + pen1);

    breakAnchor(b, god, "test");
    const def2 = computeStat(b, god, "DEF");
    const pen2 = -Math.round(d.def * 0.15 * 2);
    expect(def2.modifiers.find((m) => m.source === "Anchors broken x2")?.value).toBe(pen2);
    expect(def2.final).toBe(d.def + pen2);
  });
});
