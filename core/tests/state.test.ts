import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";

describe("Battle primitives (core/src/state.ts)", () => {
  it("newUid hands out increasing ids per prefix, setUidCounter only ever raises the floor", () => {
    const { b } = newBattle();
    const a = b.newUid();
    const c = b.newUid("p");
    expect(a).not.toBe(c);
    expect(c.startsWith("p")).toBe(true);
    const before = b.newUid();
    b.setUidCounter(0); // restoring a lower counter must not rewind it
    const after = b.newUid();
    expect(after).not.toBe(before);
  });

  it("isFree is false off the board, on an occupied hex, or on Water", () => {
    const { b } = newBattle();
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    expect(b.isFree({ q: 5, r: 5 })).toBe(false); // occupied
    expect(b.isFree({ q: -1, r: 5 })).toBe(false); // out of bounds
    b.terrain.set("6,5", "Water");
    expect(b.isFree({ q: 6, r: 5 })).toBe(false); // water
    expect(b.isFree({ q: 7, r: 5 })).toBe(true);
  });

  it("place moves a unit's occupancy and frees its old hex; remove clears pos and occupancy", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    b.place(u, { q: 6, r: 6 });
    expect(u.pos).toEqual({ q: 6, r: 6 });
    expect(b.unitAt({ q: 5, r: 5 })).toBeUndefined();
    expect(b.unitAt({ q: 6, r: 6 })?.uid).toBe(u.uid);
    b.remove(u);
    expect(u.pos).toBeNull();
    expect(b.unitAt({ q: 6, r: 6 })).toBeUndefined();
  });

  it("place throws onto an occupied hex", () => {
    const { b } = newBattle();
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const other = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 6, r: 6 });
    expect(() => b.place(other, { q: 5, r: 5 })).toThrow();
  });

  it("distance is Infinity when either unit is off the board", () => {
    const { b } = newBattle();
    const onField = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const reserve = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", null);
    expect(b.distance(onField, reserve)).toBe(Infinity);
    const other = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 5, r: 6 });
    expect(b.distance(onField, other)).toBe(1);
  });

  it("isIsolated ignores clone allies: a unit ringed only by clones still counts as isolated", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    expect(b.isIsolated(u)).toBe(true);
    const clone = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 6, r: 5 });
    clone.isClone = true;
    expect(b.isIsolated(u)).toBe(true); // the only neighbour is a clone, so still isolated
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 6, r: 4 });
    expect(b.isIsolated(u)).toBe(false); // a real ally now stands beside it
  });

  it("adjacentAllies and adjacentEnemies split by side and drop defeated units", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const ally = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 6, r: 5 });
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 4 });
    expect(b.adjacentAllies(u).map((x) => x.uid)).toEqual([ally.uid]);
    expect(b.adjacentEnemies(u).map((x) => x.uid)).toEqual([enemy.uid]);
    enemy.defeated = true;
    expect(b.adjacentUnits(u).some((x) => x.uid === enemy.uid)).toBe(false);
  });

  it("addStatus stacks Unstable and refreshes the longer duration; Revealed clears Hidden instead of stacking", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    b.addStatus(u, "Unstable", 2, "Rite A");
    b.addStatus(u, "Unstable", 5, "Rite B");
    const unstable = u.statuses.find((s) => s.status === "Unstable")!;
    expect(unstable.roundsLeft).toBe(5); // takes the longer of the two
    expect(unstable.stacks).toBe(2); // a second application stacks
    expect(u.statuses.filter((s) => s.status === "Unstable").length).toBe(1); // one entry, not two

    b.addStatus(u, "Hidden", 3, "Shadow Step");
    expect(b.hasStatus(u, "Hidden")).toBe(true);
    b.addStatus(u, "Revealed", 1, "Spotted");
    expect(b.hasStatus(u, "Hidden")).toBe(false);
    expect(b.hasStatus(u, "Revealed")).toBe(false); // Revealed only clears Hidden, it is never itself stored

    b.removeStatus(u, "Unstable");
    expect(b.hasStatus(u, "Unstable")).toBe(false);
  });

  it("spawn gives a fresh unit its definition's hp and morale, zero ap, no statuses", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", null);
    const d = b.def(u);
    expect(u.hp).toBe(d.hp);
    expect(u.morale).toBe(d.morale);
    expect(u.ap).toBe(0);
    expect(u.pos).toBeNull();
    expect(u.statuses).toEqual([]);
    expect(u.isClone).toBe(false);
  });

  it("unit() and platoon() throw a clear error for an unknown id", () => {
    const { b } = newBattle();
    expect(() => b.unit("missing")).toThrow(/No unit missing/);
    expect(() => b.platoon("missing")).toThrow(/No platoon missing/);
  });
});
