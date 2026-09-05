import { describe, it, expect } from "vitest";
import { newBattle, deploy, SHI, blob, reg } from "./helpers.js";
import { themeCohesionBonus } from "../src/cohesion.js";
import { doctrineState } from "../src/composition.js";
import { computeStat } from "../src/modifiers.js";
import { defeat } from "../src/combat.js";

describe("Twin Echo clones", () => {
  it("splits the body three ways: two 1-HP copies that grant nothing and expire after two rounds", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SHI, blob(5, 5));
    const adept = b.unit(p.eliteUid!);
    const d = b.def(adept);
    ctrl.commandPhase();
    ctrl.beginActivation("P1");

    ctrl.useAbility(adept, "ABL_TWIN_ECHO");
    const clones = [...b.units.values()].filter((u) => u.isClone);
    expect(clones).toHaveLength(2);

    // the original and both copies each carry a third of the raw attack and defence
    expect(adept.splitBodies).toBe(3);
    expect(computeStat(b, adept, "ATK").base).toBe(Math.floor(d.atk / 3));
    expect(computeStat(b, adept, "DEF").base).toBe(Math.floor(d.def / 3));
    for (const c of clones) {
      expect(c.hp).toBe(1);
      expect(c.splitBodies).toBe(3);
      expect(computeStat(b, c, "ATK").final).toBe(Math.floor(d.atk / 3));
      expect(computeStat(b, c, "DEF").final).toBe(Math.floor(d.def / 3));
      expect(c.platoonId).toBeNull();
      expect(themeCohesionBonus(b, c)).toBe(0);
    }

    // clones neither grant cohesion to neighbours nor count toward composition
    const neighbour = b.adjacentAllies(clones[0]!).find((u) => !u.isClone)!;
    expect(themeCohesionBonus(b, neighbour)).toBe(
      b.adjacentAllies(neighbour).filter((u) => !u.isClone && b.def(u).themes[0] === "Shinobi").length * 50);
    expect(doctrineState(b, p)).toBe("Full");

    expect(() => ctrl.useAbility(clones[0]!, "ABL_TWIN_ECHO")).toThrow();
    expect(adept.cooldowns["ABL_TWIN_ECHO"]).toBe(3);

    ctrl.endActivation("P1");
    ctrl.objectivePhase(); ctrl.endPhase();                      // round 1 end: one round left
    ctrl.commandPhase(); ctrl.objectivePhase(); ctrl.endPhase(); // round 2 end: expire
    expect([...b.units.values()].filter((u) => u.isClone && !u.defeated)).toHaveLength(0);
    expect(b.events.filter((e) => e.type === "CloneExpired")).toHaveLength(2);

    // with the copies gone the original is whole again
    expect(adept.splitBodies).toBe(1);
    expect(computeStat(b, adept, "ATK").base).toBe(d.atk);
    expect(computeStat(b, adept, "DEF").base).toBe(d.def);
  });

  it("hands each share back as the copies fall, one at a time", () => {
    const { b, ctrl } = newBattle(11);
    const p = deploy(b, "P1", "A", SHI, blob(5, 5));
    const adept = b.unit(p.eliteUid!);
    const d = b.def(adept);
    ctrl.commandPhase();
    ctrl.beginActivation("P1");
    ctrl.useAbility(adept, "ABL_TWIN_ECHO");

    const clones = [...b.units.values()].filter((u) => u.isClone);
    defeat(b, clones[0]!, "test");
    expect(adept.splitBodies).toBe(2);
    expect(computeStat(b, adept, "ATK").base).toBe(Math.floor(d.atk / 2));
    // the surviving copy keeps the share it was made with; only the original reclaims
    expect(clones[1]!.splitBodies).toBe(3);

    defeat(b, clones[1]!, "test");
    expect(adept.splitBodies).toBe(1);
    expect(computeStat(b, adept, "ATK").base).toBe(d.atk);
    expect(computeStat(b, adept, "DEF").base).toBe(d.def);
  });

  it("will not let an already-split body split again", () => {
    const { b, ctrl } = newBattle(12);
    const p = deploy(b, "P1", "A", SHI, blob(5, 5));
    const adept = b.unit(p.eliteUid!);
    ctrl.commandPhase();
    ctrl.beginActivation("P1");
    ctrl.useAbility(adept, "ABL_TWIN_ECHO");
    expect([...b.units.values()].filter((u) => u.isClone)).toHaveLength(2);

    adept.cooldowns = {};
    adept.ap = 2;
    expect(() => ctrl.useAbility(adept, "ABL_TWIN_ECHO")).toThrow();
    expect([...b.units.values()].filter((u) => u.isClone)).toHaveLength(2);
  });

  it("every clone ability divides the body evenly, whatever the copy count", () => {
    for (const a of reg.abilities.values()) {
      if (a.effect.kind !== "SpawnClones") continue;
      // the data no longer carries a share: it is derived from the count, so the two cannot drift apart
      expect(a.effect, a.id).not.toHaveProperty("atkPercent");
      expect(a.text.toLowerCase(), a.id).toContain("share");
    }
  });
});
