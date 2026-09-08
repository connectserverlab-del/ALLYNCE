import { describe, it, expect } from "vitest";
import { reg, SAM, KNI } from "./helpers.js";
import { validateArmy } from "../src/composition.js";

describe("validateArmy: Company leadership", () => {
  it("a single platoon never needs a Company-capable leader, whatever its commander's rank", () => {
    const churo: typeof SAM = { ...SAM, commander: "SAM_SECOND_WHITE-CRANE-RETAINER", second: "SAM_SECOND_WHITE-CRANE-RETAINER" };
    const r = validateArmy(reg, { side: "A", capacity: 200, platoons: [{ id: "P1", side: "A", ...churo }], specialists: [] });
    expect(r.errors.some((e) => e.includes("may lead a Company"))).toBe(false);
  });

  it("two platoons led only by Churo (Platoon-only rank) fails: no one in the army may lead a Company", () => {
    const churo: typeof SAM = { ...SAM, commander: "SAM_SECOND_WHITE-CRANE-RETAINER", second: "SAM_SECOND_WHITE-CRANE-RETAINER" };
    const r = validateArmy(reg, {
      side: "A", capacity: 400,
      platoons: [{ id: "P1", side: "A", ...churo }, { id: "P2", side: "A", ...churo }],
      specialists: [],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("2 platoons but no commander or second holds a rank that may lead a Company"))).toBe(true);
  });

  it("two platoons pass once one commander (Hatamoto) may lead a Company", () => {
    // The default SAM blueprint's commander is a Hatamoto, which the ladder lets lead a Company.
    const r = validateArmy(reg, {
      side: "A", capacity: 400,
      platoons: [{ id: "P1", side: "A", ...SAM }, { id: "P2", side: "A", ...SAM }],
      specialists: [],
    });
    expect(r.errors.some((e) => e.includes("may lead a Company"))).toBe(false);
  });

  it("a second who may lead a Company is enough, even if the commander cannot", () => {
    const mixed: typeof SAM = { ...SAM, commander: "SAM_SECOND_WHITE-CRANE-RETAINER", second: "SAM_COMMANDER_EMBER-BANNER-DAIMYO" };
    const r = validateArmy(reg, {
      side: "A", capacity: 400,
      platoons: [{ id: "P1", side: "A", ...mixed }, { id: "P2", side: "A", ...mixed }],
      specialists: [],
    });
    expect(r.errors.some((e) => e.includes("may lead a Company"))).toBe(false);
  });

  it("a faction with no rank ladder yet is unrestricted, like the existing Platoon check", () => {
    const r = validateArmy(reg, {
      side: "A", capacity: 400,
      platoons: [{ id: "P1", side: "A", ...KNI }, { id: "P2", side: "A", ...KNI }],
      specialists: [],
    });
    expect(r.errors.some((e) => e.includes("may lead a Company"))).toBe(false);
  });
});
