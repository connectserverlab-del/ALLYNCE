import { describe, it, expect } from "vitest";
import { reg } from "./helpers.js";
import { buildStarterDeck } from "../src/cards.js";
import { runMatch, setUpMatch, openingForce, spoils, collectReward, aiPlayCards } from "../src/match.js";
import { newKingdom, startUpgrade, tick } from "../src/kingdom.js";
import { saveGame, loadGame, saveBattle, loadBattle } from "../src/save.js";
import { DIFFICULTY } from "../src/ai.js";

const decks = { SAM: buildStarterDeck(reg, "SAM"), SHI: buildStarterDeck(reg, "SHI"), KNI: buildStarterDeck(reg, "KNI") };

describe("a whole match", () => {
  it("fields a legal opening force from a deck alone", () => {
    for (const f of ["SAM", "SHI", "KNI", "DRG"]) {
      const force = openingForce(reg, buildStarterDeck(reg, f));
      expect(force, f).toBeTruthy();
      expect(force!.foot).toHaveLength(5);
      expect(reg.unit(force!.commander).slots).toContain("Commander");
      expect(reg.unit(force!.elite).slots).toContain("Elite");
    }
  });

  it("sets up two armies from decks, each with a leader, an opening hand and a side deck", () => {
    const { ctrl } = setUpMatch({ reg, seed: 5, A: { deck: decks.SHI, name: "Veiled Moon" }, B: { deck: decks.SAM, name: "Ashfall" } });
    const b = ctrl.b;
    for (const s of ["A", "B"]) {
      expect(b.sides.get(s)!.leaderUid, s).toBeTruthy();
      expect(b.decks.get(s)!.hand, s).toHaveLength(5);
      expect(b.decks.get(s)!.side, s).toHaveLength(20);
      expect([...b.activeUnits(s)].length).toBeGreaterThanOrEqual(8);
    }
  });

  it("runs start to finish, reaches a decision and pays spoils to both sides", () => {
    const r = runMatch({ reg, seed: 5, roundLimit: 14, A: { deck: decks.SHI, name: "Veiled Moon" }, B: { deck: decks.SAM, name: "Ashfall" } });
    expect(["A", "B", "draw"]).toContain(r.winner);
    expect(r.reason).toBeTruthy();
    expect(r.rounds).toBeGreaterThan(0);
    for (const s of ["A", "B"]) {
      expect(r.reward[s]!.silver).toBeGreaterThan(0);
      expect(r.survivors[s]).toBeGreaterThanOrEqual(0);
    }
    if (r.winner !== "draw") expect(r.reward[r.winner!]!.cards.length).toBe(1);
    // the log records the whole match, not just the ending
    const kinds = new Set(r.battle.events.map((e) => e.type));
    expect(kinds.has("Attack")).toBe(true);
    expect(kinds.has("Draw")).toBe(true);
  });

  it("is deterministic for a seed and different across seeds", () => {
    const run = (seed: number) => { const r = runMatch({ reg, seed, roundLimit: 10, A: { deck: decks.SHI, name: "a" }, B: { deck: decks.SAM, name: "b" } }); return JSON.stringify(r.battle.events); };
    expect(run(9)).toBe(run(9));
    expect(run(9)).not.toBe(run(10));
  });

  it("the AI summons from hand, paying tributes only when the card is worth more than what it spends", () => {
    const { ctrl } = setUpMatch({ reg, seed: 12, A: { deck: decks.SHI, name: "a" }, B: { deck: decks.SAM, name: "b" } });
    const b = ctrl.b;
    ctrl.commandPhase();
    const deck = b.decks.get("B")!;
    deck.hand = ["SAM_LEVY_ASHFIELD-CONSCRIPT", "SAM_FOOT_EMBERLINE-ASHIGARU"];
    const before = [...b.activeUnits("B")].length;
    aiPlayCards(ctrl, "B", DIFFICULTY.normal);
    expect([...b.activeUnits("B")].length).toBe(before + 1);
    expect(b.events.some((e) => e.type === "Summon")).toBe(true);
    // the army leader is never spent as a tribute
    expect(b.units.get(b.sides.get("B")!.leaderUid!)!.defeated).toBe(false);
  });

  it("spoils reward breaking the enemy, and a win pays more than a loss", () => {
    const { ctrl } = setUpMatch({ reg, seed: 3, A: { deck: decks.SHI, name: "a" }, B: { deck: decks.SAM, name: "b" } });
    const win = spoils(ctrl.b, "A", true, 30, 8), lose = spoils(ctrl.b, "A", false, 30, 8);
    expect(win.silver).toBeGreaterThan(lose.silver);
    expect(win.cards).toHaveLength(1);
    expect(lose.cards).toHaveLength(0);
    const k = newKingdom(reg, "SAM");
    const before = k.resources.silver;
    collectReward(k, win);
    expect(k.resources.silver).toBe(before + win.silver);
    expect(k.collection[win.cards[0]!]).toBe(1);
  });

  it("carries a holding into the match so its buildings show up in the battle", () => {
    const k = newKingdom(reg, "SAM");
    k.resources = { koku: 99999, iron: 99999, timber: 99999, silver: 99999 };
    startUpgrade(reg, k, "BARRACKS"); tick(reg, k, 1e6);
    const { ctrl } = setUpMatch({ reg, seed: 4, A: { deck: decks.SHI, name: "a" }, B: { deck: decks.SAM, name: "b", kingdom: k } });
    expect(ctrl.b.kingdomEffects.get("B")!.armyCapacity).toBe(12);
    expect(ctrl.b.events.some((e) => e.type === "KingdomApplied")).toBe(true);
  });
});

describe("saving and loading", () => {
  it("round-trips a battle mid-match without losing state, and keeps playing identically", () => {
    const { ctrl } = setUpMatch({ reg, seed: 21, A: { deck: decks.SHI, name: "a" }, B: { deck: decks.SAM, name: "b" } });
    const b = ctrl.b;
    ctrl.commandPhase(); aiPlayCards(ctrl, "A"); ctrl.objectivePhase(); ctrl.endPhase();
    const snap = saveBattle(b);
    const restored = loadBattle(reg, snap);
    expect(restored.round).toBe(b.round);
    expect([...restored.activeUnits()].length).toBe([...b.activeUnits()].length);
    expect(restored.decks.get("A")!.hand).toEqual(b.decks.get("A")!.hand);
    expect(restored.decks.get("A")!.drawPile.length).toBe(b.decks.get("A")!.drawPile.length);
    expect(restored.sides.get("A")!.leaderUid).toBe(b.sides.get("A")!.leaderUid);
    expect([...restored.occupancy.keys()].sort()).toEqual([...b.occupancy.keys()].sort());
    // a restored battle keeps handing out fresh unit ids rather than colliding with saved ones
    const fresh = restored.newUid("u");
    expect(restored.units.has(fresh)).toBe(false);
    expect(JSON.stringify(saveBattle(restored))).toBe(JSON.stringify(snap));
  });

  it("round-trips a holding and refuses a save from another version", () => {
    const k = newKingdom(reg, "KNI");
    k.resources = { koku: 99999, iron: 99999, timber: 99999, silver: 99999 };
    startUpgrade(reg, k, "FORGE"); tick(reg, k, 1e6);
    const save = saveGame(null, k);
    const back = loadGame(reg, save);
    expect(back.kingdom!.levels.FORGE).toBe(1);
    expect(back.kingdom).not.toBe(k);
    expect(() => loadGame(reg, { ...save, version: 1 })).toThrow(/cannot be read/);
  });
});
