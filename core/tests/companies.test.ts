import { describe, it, expect } from "vitest";
import { reg } from "./helpers.js";
import { validateArmy } from "../src/composition.js";

/**
 * Q-12: three divisions (Choir Militant, Ashpit Legion, Winter Famine) gained a second, distinct
 * FootSoldier-capable card so a deck built around them can field a platoon of its own instead of
 * five copies of the same body. Winter Famine also had no card able to fill the Second slot at
 * all (two Elites, no Second) and gets one here. The other divisions and all five sworn companies
 * keep their single foot line: their faction text names that as the point (see docs/ROADMAP.md,
 * OWN-3), so widening them waits on an owner call rather than a guess here.
 */
const DEPTH_FACTIONS: Array<{ faction: string; commander: string; second: string; elite: string; foot: [string, string] }> = [
  { faction: "ANG", commander: "ANG_COMMANDER_THRONE-ARCHON", second: "ANG_SECOND_WARDING-SERAPH", elite: "ANG_ELITE_SWORD-OF-THE-SEVENTH-GATE", foot: ["ANG_FOOT_LAMPBEARER-CHORISTER", "ANG_LEVY_ASHWING-NOVICE"] },
  { faction: "DEM", commander: "DEM_COMMANDER_ASHPIT-ARCHDEMON", second: "DEM_SECOND_FLENSING-TORMENTOR", elite: "DEM_ELITE_PIT-COLONEL", foot: ["DEM_FOOT_CINDER-IMP", "DEM_LEVY_PIT-STRAY"] },
  { faction: "WEN", commander: "WEN_COMMANDER_WINTER-MAW", second: "WEN_SECOND_RIME-ANTLER-WARDEN", elite: "WEN_ELITE_ANTLER-WRAITH", foot: ["WEN_FOOT_STARVELING", "WEN_LEVY_GAUNT-STRAGGLER"] },
];

describe("division depth (Q-12)", () => {
  for (const f of DEPTH_FACTIONS) {
    it(`${f.faction} fields a legal five-foot platoon mixing its two distinct foot cards`, () => {
      const foot = [f.foot[0], f.foot[0], f.foot[1], f.foot[1], f.foot[1]];
      const r = validateArmy(reg, { side: "A", capacity: 999, platoons: [{ id: "P", side: "A", faction: f.faction, commander: f.commander, second: f.second, elite: f.elite, foot }], specialists: [] });
      expect(r.errors.join("\n")).toBe("");
      expect(r.ok).toBe(true);
    });

    it(`${f.faction}'s new levy shares the foot card's primary theme, so it still stacks Theme Cohesion`, () => {
      const foot = reg.unit(f.foot[0]);
      const levy = reg.unit(f.foot[1]);
      expect(levy.themes[0]).toBe(foot.themes[0]);
      expect(levy.rank).toBe("Levy");
      expect(levy.stars).toBeLessThan(4); // below the four-star skill floor; no ability required
    });
  }
});
