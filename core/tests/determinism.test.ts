import { describe, it, expect } from "vitest";
import { reg } from "./helpers.js";
import { buildStarterDeck } from "../src/cards.js";
import { runMatch } from "../src/match.js";
import { hashEvents, roundHashes } from "../src/determinism.js";

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

  it("refuses an event carrying a value JSON.stringify would flatten to {}", () => {
    // The failure this guards against is silent: a Set logged as `duels` or `interceptUsed` would
    // stringify to "{}" and the hash would simply stop seeing that field.
    const events = scriptedMatch(41).battle.events;
    const withSet = [{ ...events[0]!, data: { ...events[0]!.data, uids: new Set(["u1"]) } }];
    expect(() => hashEvents(withSet)).toThrow(/flattens to/);
    const withNested = [{ ...events[0]!, data: { ...events[0]!.data, at: { hexes: new Map() } } }];
    expect(() => hashEvents(withNested)).toThrow(/at\.hexes/);
  });

  it("accepts the plain shapes events actually use", () => {
    const events = scriptedMatch(41).battle.events;
    const plain = [{ ...events[0]!, data: { a: 1, b: "s", c: true, d: null, e: [1, "2", { f: 3 }], g: undefined } }];
    expect(() => hashEvents(plain)).not.toThrow();
  });

  it("the hash itself is sensitive to a single changed event field", () => {
    const events = scriptedMatch(41).battle.events;
    const before = hashEvents(events);
    const mutated = events.map((e, i) => (i === 0 ? { ...e, round: e.round + 1 } : e));
    expect(hashEvents(mutated)).not.toBe(before);
  });
});

describe("Q-20 per-round state hash", () => {
  it("logs one RoundHash event at the end of every round the battle actually played", () => {
    const { battle } = scriptedMatch(41);
    const hashes = roundHashes(battle.events);
    const roundsPlayed = new Set(battle.events.filter((e) => e.type !== "RoundHash").map((e) => e.round));
    // A RoundHash closes out every round that produced any other event, and only those rounds.
    expect([...hashes.keys()].sort((a, b) => a - b)).toEqual([...roundsPlayed].sort((a, b) => a - b));
  });

  it("matches, round for round, across two runs of the same seed", () => {
    const a = roundHashes(scriptedMatch(41).battle.events);
    const b = roundHashes(scriptedMatch(41).battle.events);
    expect(a.size).toBeGreaterThan(0);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("is a desync detector: a log that diverges only after round N keeps rounds 1..N identical and disagrees from N+1 on", () => {
    const events = scriptedMatch(41).battle.events;
    const hashesBefore = roundHashes(events);
    const rounds = [...hashesBefore.keys()].sort((a, b) => a - b);
    expect(rounds.length).toBeGreaterThan(1);
    const splitRound = rounds[Math.floor(rounds.length / 2)]!;
    // Simulate a client that desynced starting exactly at splitRound: perturb one event from that round on.
    const diverged = events.map((e) => (e.round >= splitRound && e.type === "Move" ? { ...e, data: { ...e.data, cost: 999 } } : e));
    // Recompute each round's own hash the same way BattleController does: hashEvents over that round's slice.
    const recomputed = new Map<number, string>();
    for (const r of rounds) recomputed.set(r, hashEvents(diverged.filter((e) => e.round === r && e.type !== "RoundHash")));
    for (const r of rounds) {
      const original = hashEvents(events.filter((e) => e.round === r && e.type !== "RoundHash"));
      if (r < splitRound) expect(recomputed.get(r)).toBe(original);
      else if (diverged.some((e) => e.round === r && e.type === "Move")) expect(recomputed.get(r)).not.toBe(original);
    }
  });

  it("covers position, HP, status and morale changes: perturbing any one of them changes that round's hash", () => {
    const all = scriptedMatch(41).battle.events;
    const perturbations: Array<{ type: string; apply: (e: (typeof all)[number]) => (typeof all)[number] }> = [
      { type: "Move", apply: (e) => ({ ...e, data: { ...e.data, to: { q: 99, r: 99 } } }) },
      { type: "Attack", apply: (e) => ({ ...e, data: { ...e.data, damage: (e.data.damage as number) + 1 } }) },
      { type: "StatusApplied", apply: (e) => ({ ...e, data: { ...e.data, status: "Silenced" } }) },
      { type: "Morale", apply: (e) => ({ ...e, data: { ...e.data, morale: (e.data.morale as number) + 1 } }) },
    ];
    let checked = 0;
    for (const { type, apply } of perturbations) {
      const round = all.find((e) => e.type === type)?.round;
      if (round === undefined) continue; // this scripted match never produced that event type
      const slice = all.filter((e) => e.round === round && e.type !== "RoundHash");
      const base = hashEvents(slice);
      const perturbed = slice.map((e) => (e.type === type ? apply(e) : e));
      expect(hashEvents(perturbed)).not.toBe(base);
      checked++;
    }
    expect(checked).toBeGreaterThan(0); // not a vacuous pass because no scripted event matched
  });
});
