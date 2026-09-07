import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM } from "./helpers.js";
import { evaluateObjective, type ObjectiveDef } from "../src/objectives.js";
import { defeat } from "../src/combat.js";
import { callPortal, destroyPortal } from "../src/portals.js";

describe("DefendForRounds", () => {
  it("with no named target behaves like SurviveRounds: only the round count matters", () => {
    const { b } = newBattle();
    const obj: ObjectiveDef = { type: "DefendForRounds", side: "A", rounds: 5 };
    b.round = 5;
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
    b.round = 6;
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
  });

  it("never satisfies once the named unit is defeated, even after the round count passes", () => {
    const { b } = newBattle();
    const p = deploy(b, "A", "A", SAM, [{ q: 2, r: 2 }, { q: 3, r: 2 }, { q: 4, r: 2 }, { q: 2, r: 3 }, { q: 3, r: 3 }, { q: 4, r: 3 }, { q: 5, r: 3 }, { q: 6, r: 3 }]);
    const cmd = b.unit(p.commanderUid!);
    const obj: ObjectiveDef = { type: "DefendForRounds", side: "A", rounds: 5, uidOrPortal: cmd.uid };
    b.round = 6;
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
    defeat(b, cmd, "test");
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
  });

  it("never satisfies once the named portal is destroyed or captured, even after the round count passes", () => {
    const { b } = newBattle();
    const portal = callPortal(b, "A", { q: 5, r: 5 }, { telegraph: 0 })!;
    const obj: ObjectiveDef = { type: "DefendForRounds", side: "A", rounds: 5, uidOrPortal: portal.id };
    b.round = 6;
    expect(evaluateObjective(b, obj).satisfied).toBe(true);
    destroyPortal(b, portal, "test");
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
  });

  it("never satisfies when the named target never existed on the field at all", () => {
    const { b } = newBattle();
    const obj: ObjectiveDef = { type: "DefendForRounds", side: "A", rounds: 5, uidOrPortal: "no-such-uid-or-portal" };
    b.round = 6;
    expect(evaluateObjective(b, obj).satisfied).toBe(false);
  });
});
