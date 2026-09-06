import { describe, it, expect } from "vitest";
import { Rng } from "../src/rng.js";

describe("Rng (mulberry32)", () => {
  it("is deterministic: the same seed replays the same sequence", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("diverges across seeds", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("remembers its own seed", () => {
    expect(new Rng(1234).seed).toBe(1234);
  });

  it("next() stays in [0, 1) across many draws", () => {
    const r = new Rng(7);
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(n) stays in [0, n) and covers more than one value over many draws", () => {
    const r = new Rng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = r.int(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      seen.add(v);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("int(1) is always 0", () => {
    const r = new Rng(3);
    for (let i = 0; i < 20; i++) expect(r.int(1)).toBe(0);
  });

  it("pick() only returns elements of the array, and can return every element over enough draws", () => {
    const r = new Rng(5);
    const arr = ["a", "b", "c", "d"] as const;
    const picked = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const v = r.pick(arr);
      expect(arr).toContain(v);
      picked.add(v);
    }
    expect(picked).toEqual(new Set(arr));
  });

  it("a seed reproduces the same run even if other Rng instances have advanced in between", () => {
    const control = new Rng(2026);
    const expected = Array.from({ length: 5 }, () => control.next());

    const replay = new Rng(2026);
    const decoy = new Rng(1);
    const got: number[] = [];
    for (let i = 0; i < 5; i++) {
      got.push(replay.next());
      decoy.next();
    }
    expect(got).toEqual(expected);
  });
});
