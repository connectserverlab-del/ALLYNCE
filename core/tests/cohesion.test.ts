import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { themeCohesionBonus, cohesionEdges } from "../src/cohesion.js";
import { computeStat } from "../src/modifiers.js";

describe("theme cohesion", () => {
  it("+50 per adjacent matching ally, capped at 4 connections, updates on move", () => {
    const { b, ctrl } = newBattle();
    const c = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    for (const h of [{ q: 6, r: 5 }, { q: 6, r: 4 }, { q: 5, r: 4 }, { q: 4, r: 5 }, { q: 4, r: 6 }]) b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", h);
    expect(themeCohesionBonus(b, c)).toBe(200); // 5 neighbours -> capped at 4 x 50
    const knight = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 5, r: 6 });
    expect(themeCohesionBonus(b, knight)).toBe(0); // different theme
    // move one neighbour away and the bonus updates immediately
    const n = b.unitAt({ q: 4, r: 6 })!;
    n.ap = 2; b.remove(knight); ctrl.move(n, { q: 3, r: 8 });
    expect(themeCohesionBonus(b, c)).toBe(200); // still 4 left
    const n2 = b.unitAt({ q: 4, r: 5 })!; n2.ap = 2; ctrl.move(n2, { q: 2, r: 5 });
    expect(themeCohesionBonus(b, c)).toBe(150);
    expect(cohesionEdges(b, "A").length).toBeGreaterThan(0);
  });
  it("Disordered morale caps cohesion at +100", () => {
    const { b } = newBattle();
    const c = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    for (const h of [{ q: 6, r: 5 }, { q: 6, r: 4 }, { q: 5, r: 4 }, { q: 4, r: 5 }]) b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", h);
    c.morale = 30;
    const atk = computeStat(b, c, "ATK");
    expect(atk.modifiers.find((m) => m.source === "Theme Cohesion")?.value).toBe(100);
  });
});
