import { describe, it, expect } from "vitest";
import { reg } from "./helpers.js";
import { buildStarterDeck } from "../src/cards.js";
import { runMatch, HOST_FACTIONS } from "../src/match.js";

const pairs: Array<[string, string]> = [];
for (let i = 0; i < HOST_FACTIONS.length; i++) for (let j = i + 1; j < HOST_FACTIONS.length; j++) pairs.push([HOST_FACTIONS[i]!, HOST_FACTIONS[j]!]);

describe("every host faction against every other, across several seeds", () => {
  const seeds = [1, 2, 5, 6, 17, 22];

  it.each(pairs)("%s vs %s always reaches a clean decision and never pays a negative reward", (A, B) => {
    for (const seed of seeds) {
      const r = runMatch({ reg, seed, roundLimit: 16, A: { deck: buildStarterDeck(reg, A), name: A }, B: { deck: buildStarterDeck(reg, B), name: B } });
      expect(["A", "B", "draw"]).toContain(r.winner);
      expect(r.reason).toBeTruthy();
      expect(r.rounds).toBeGreaterThan(0);
      for (const s of ["A", "B"]) {
        // A side that reinforces well during the fight must never make its opponent's purse go
        // negative: "stars broken" has to mean stars actually destroyed, not a net roster delta.
        expect(r.starsLost[s]).toBeGreaterThanOrEqual(0);
        for (const res of ["koku", "iron", "timber", "silver"] as const) expect(r.reward[s]![res]).toBeGreaterThanOrEqual(0);
        expect(r.survivors[s]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("is deterministic per seed", () => {
    const [A, B] = pairs[0]!;
    const run = () => JSON.stringify(runMatch({ reg, seed: 7, roundLimit: 10, A: { deck: buildStarterDeck(reg, A), name: A }, B: { deck: buildStarterDeck(reg, B), name: B } }).battle.events);
    expect(run()).toBe(run());
  });
});
