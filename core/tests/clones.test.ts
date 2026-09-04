import { describe, it, expect } from "vitest";
import { newBattle, deploy, SHI, blob } from "./helpers.js";
import { themeCohesionBonus } from "../src/cohesion.js";
import { doctrineState } from "../src/composition.js";
import { computeStat } from "../src/modifiers.js";

describe("Twin Echo clones", () => {
  it("creates exactly two 1-HP clones at 40% ATK that grant nothing and expire after two rounds", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SHI, blob(5, 5));
    const adept = b.unit(p.eliteUid!);
    ctrl.commandPhase();
    ctrl.beginActivation("P1");
    const before = computeStat(b, adept, "ATK").final;
    ctrl.useAbility(adept, "ABL_TWIN_ECHO");
    const clones = [...b.units.values()].filter((u) => u.isClone);
    expect(clones).toHaveLength(2);
    for (const c of clones) {
      expect(c.hp).toBe(1);
      expect(computeStat(b, c, "ATK").final).toBe(Math.floor(before * 0.4));
      expect(c.platoonId).toBeNull();
      expect(themeCohesionBonus(b, c)).toBe(0);
    }
    // clones neither grant cohesion to neighbours nor count toward composition
    const neighbour = b.adjacentAllies(clones[0]!).find((u) => !u.isClone)!;
    const conn = themeCohesionBonus(b, neighbour);
    expect(conn).toBe(b.adjacentAllies(neighbour).filter((u) => !u.isClone && b.def(u).themes[0] === "Shinobi").length * 50);
    expect(doctrineState(b, p)).toBe("Full");
    expect(() => ctrl.useAbility(clones[0]!, "ABL_TWIN_ECHO")).toThrow();
    expect(adept.cooldowns["ABL_TWIN_ECHO"]).toBe(3);
    ctrl.endActivation("P1");
    ctrl.objectivePhase(); ctrl.endPhase();      // round 1 end: 1 left
    ctrl.commandPhase(); ctrl.objectivePhase(); ctrl.endPhase(); // round 2 end: expire
    expect([...b.units.values()].filter((u) => u.isClone && !u.defeated)).toHaveLength(0);
    expect(b.events.filter((e) => e.type === "CloneExpired")).toHaveLength(2);
  });
});
