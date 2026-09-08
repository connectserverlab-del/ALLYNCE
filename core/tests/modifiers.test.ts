import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { computeStat } from "../src/modifiers.js";

describe("modifier pipeline: sources with no direct coverage yet", () => {
  it("a castle-ranked lord grants allies on Fortification within command radius +100 DEF, named by source", () => {
    const { b } = newBattle();
    const lord = b.spawn("SAM_LORD_ASHFALL-DAIMYO", "A", { q: 10, r: 10 }); // JOSHU_DAIMYO: castle privilege, radius 5
    const ally = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 12, r: 10 }); // distance 2, inside radius
    b.terrain.set("12,10", "Fortification");
    const def = computeStat(b, ally, "DEF");
    expect(def.modifiers.map((m) => m.source)).toContain("Rank: castle lord nearby");
    expect(def.modifiers.find((m) => m.source === "Rank: castle lord nearby")?.value).toBe(100);
    void lord;
  });

  it("the castle bonus needs a castle-ranked ally in range, not just any commander or any terrain", () => {
    const { b } = newBattle();
    b.spawn("SAM_COMMANDER_EMBER-BANNER-DAIMYO", "A", { q: 10, r: 10 }); // Hatamoto: no castle privilege
    const onFort = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 12, r: 10 });
    b.terrain.set("12,10", "Fortification");
    expect(computeStat(b, onFort, "DEF").modifiers.map((m) => m.source)).not.toContain("Rank: castle lord nearby");

    const lord = b.spawn("SAM_LORD_ASHFALL-DAIMYO", "B", { q: 0, r: 0 });
    const offFort = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 2, r: 0 }); // in radius, open ground
    expect(computeStat(b, offFort, "DEF").modifiers.map((m) => m.source)).not.toContain("Rank: castle lord nearby");
    void lord;
  });

  it("a divine entity's stats scale down 15% of base per anchor lost, and the source names the count", () => {
    const { b } = newBattle();
    const boss = b.spawn("DIV_BOSS_SOVEREIGN-OF-MEMORY", "A", { q: 5, r: 5 }); // atk 3200, def 3000, 3 anchors
    expect(computeStat(b, boss, "ATK").final).toBe(3200);
    expect(computeStat(b, boss, "DEF").final).toBe(3000);

    boss.divine!.anchors = 1; // lost 2 of 3
    const atk = computeStat(b, boss, "ATK");
    const def = computeStat(b, boss, "DEF");
    expect(atk.modifiers.map((m) => m.source)).toContain("Anchors broken x2");
    expect(atk.modifiers.find((m) => m.source === "Anchors broken x2")?.value).toBe(-Math.round(3200 * 0.15 * 2));
    expect(atk.final).toBe(3200 - Math.round(3200 * 0.15 * 2));
    expect(def.final).toBe(3000 - Math.round(3000 * 0.15 * 2));
  });
});
