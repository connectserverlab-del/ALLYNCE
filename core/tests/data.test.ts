import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DATA_ROOT, loadRegistry, loadScenario } from "../src/data.js";

describe("loading game data off disk", () => {
  it("DATA_ROOT resolves to the repo's data/ directory", () => {
    expect(existsSync(DATA_ROOT)).toBe(true);
    expect(existsSync(resolve(DATA_ROOT, "units/units.json"))).toBe(true);
  });

  it("loadRegistry() reads every table from data/ into a validated Registry", () => {
    const reg = loadRegistry();
    expect(reg.units.size).toBeGreaterThan(0);
    expect(reg.abilities.size).toBeGreaterThan(0);
    expect(reg.factions.size).toBeGreaterThan(0);
    expect(reg.ranks.size).toBeGreaterThan(0);
    expect(reg.deckRules).toBeDefined();
    expect(reg.kingdom).toBeDefined();
    expect(reg.wanted).toBeDefined();
    expect(reg.march).toBeDefined();
  });

  it("loadScenario() reads a named file out of data/scenarios/", () => {
    const file = loadScenario<{ title: string }>("threefold_invocation");
    expect(file.title).toBeTruthy();
  });

  it("loadScenario() throws instead of returning undefined for a scenario that doesn't exist", () => {
    expect(() => loadScenario("not_a_real_scenario")).toThrow();
  });
});
