import { describe, it, expect } from "vitest";
import { reg } from "./helpers.js";
import { buildStarterDeck } from "../src/cards.js";
import { runMatch } from "../src/match.js";
import { hashEvents } from "../src/determinism.js";

const decks = { SHI: buildStarterDeck(reg, "SHI"), KNI: buildStarterDeck(reg, "KNI") };

/** One scripted match: two fixed decks and a round limit, nothing left to chance but the seed. */
function scriptedMatch(seed: number) {
  return runMatch({ reg, seed, roundLimit: 20, A: { deck: decks.SHI, name: "a" }, B: { deck: decks.KNI, name: "b" } });
}

describe("determinism harness", () => {
  it("hashes two runs of the same seed identically", () => {
    const events = scriptedMatch(41).battle.events;
    expect(events.length).toBeGreaterThan(0); // not a vacuous pass on an empty log
    expect(hashEvents(events)).toBe(hashEvents(scriptedMatch(41).battle.events));
  });

  it("hashes diverge across different seeds", () => {
    const hashes = new Set([17, 41, 99, 213].map((seed) => hashEvents(scriptedMatch(seed).battle.events)));
    expect(hashes.size).toBe(4);
  });

  it("the hash itself is sensitive to a single changed event field", () => {
    const events = scriptedMatch(41).battle.events;
    const before = hashEvents(events);
    const mutated = events.map((e, i) => (i === 0 ? { ...e, round: e.round + 1 } : e));
    expect(hashEvents(mutated)).not.toBe(before);
  });
});
