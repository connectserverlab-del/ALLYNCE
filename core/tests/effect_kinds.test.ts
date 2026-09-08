import { describe, it, expect } from "vitest";
import { reg } from "./helpers.js";
import { EFFECT_KINDS } from "../src/effects.js";

describe("effect kind registry", () => {
  it("has no duplicate kinds", () => {
    expect(new Set(EFFECT_KINDS).size).toBe(EFFECT_KINDS.length);
  });

  it("covers every effect.kind used by the loaded ability data", () => {
    const known = new Set<string>(EFFECT_KINDS);
    for (const ability of reg.abilities.values()) {
      expect(known.has(ability.effect.kind), `${ability.id} uses unregistered effect kind "${ability.effect.kind}"`).toBe(true);
    }
  });
});
