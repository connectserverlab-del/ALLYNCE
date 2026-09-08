import { describe, it, expect } from "vitest";
import { newBattle, deploy, KNI, SAM, blob, reg } from "./helpers.js";
import { validateDeck, buildStarterDeck, DeckState, tributeCost, copyLimit, summonFromHand, ritualSummon, fusionSummon, checkRitual, playableSideCards, summonZone, starOf, moveCard } from "../src/cards.js";
import { Rng } from "../src/rng.js";

const deckState = (list = buildStarterDeck(reg, "KNI"), seed = 3) => new DeckState(list, new Rng(seed), reg.deckRules);

describe("star scale", () => {
  it("runs 1 to 10 with levy at the bottom and deities, Kage, shoguns and kings at the top", () => {
    expect(starOf(reg, "KNI_LEVY_BASTION-SQUIRE")).toBe(1);
    expect(starOf(reg, "KNI_FOOT_BASTION-MAN-AT-ARMS")).toBe(2);
    expect(starOf(reg, "KNI_COMMANDER_SOLAR-BASTION-MARSHAL")).toBe(6);
    expect(starOf(reg, "KNI_ELITE_SKY-LANCE-DRAGOON")).toBe(7);
    for (const id of ["SHI_KAGE_VOID-CROWN-KAGE", "SAM_SHOGUN_IRON-TIDE-SHOGUN", "KNI_KING_OATHBREAKER-KING", "DIV_BOSS_SOVEREIGN-OF-MEMORY", "DIV_BOSS_CALAMITY-FORM"])
      expect(starOf(reg, id), id).toBe(10);
  });
  it("tribute cost rises with stars, and 10-star cards cannot be summoned from the main deck at all", () => {
    expect(tributeCost(reg, "KNI_LEVY_BASTION-SQUIRE")).toBe(0);
    expect(tributeCost(reg, "KNI_COMMANDER_SOLAR-BASTION-MARSHAL")).toBe(1);
    expect(tributeCost(reg, "KNI_ELITE_SKY-LANCE-DRAGOON")).toBe(2);
    expect(tributeCost(reg, "SAM_LORD_ASHFALL-DAIMYO")).toBe(3);
    expect(tributeCost(reg, "SHI_KAGE_VOID-CROWN-KAGE")).toBeNull();
    expect(copyLimit(reg, "SHI_KAGE_VOID-CROWN-KAGE")).toBe(0);
    expect(copyLimit(reg, "KNI_LEVY_BASTION-SQUIRE")).toBe(20);
    expect(copyLimit(reg, "SAM_LORD_ASHFALL-DAIMYO")).toBe(1);
  });
});

describe("deck construction", () => {
  it("a starter deck is exactly 100 main and 20 side cards and validates", () => {
    for (const f of ["SAM", "SHI", "KNI", "DRG"]) {
      const d = buildStarterDeck(reg, f);
      const v = validateDeck(reg, d);
      expect(v.mainCount, f).toBe(100);
      expect(v.sideCount, f).toBe(20);
      expect(v.errors, f).toEqual([]);
      expect(v.ok).toBe(true);
    }
  });
  it("rejects wrong sizes, over-limit copies and 10-star cards in the main deck", () => {
    const base = buildStarterDeck(reg, "KNI");
    expect(validateDeck(reg, { ...base, main: base.main.slice(0, 99) }).errors.join()).toMatch(/must hold exactly 100/);
    const flooded = { ...base, main: [...Array(100)].map(() => "KNI_FOOT_BASTION-MAN-AT-ARMS") };
    expect(validateDeck(reg, flooded).errors.join()).toMatch(/limited to 16/);
    const illegal = { ...base, main: [...base.main.slice(0, 99), "KNI_KING_OATHBREAKER-KING"] };
    expect(validateDeck(reg, illegal).errors.join()).toMatch(/cannot sit in the main deck/);
    expect(validateDeck(reg, { ...base, side: base.side.slice(0, 19) }).errors.join()).toMatch(/must hold exactly 20/);
    const foreign = { ...base, main: [...Array(100)].map(() => "SAM_FOOT_EMBERLINE-ASHIGARU") };
    expect(validateDeck(reg, foreign).errors.join()).toMatch(/needs at least 40/);
  });
  it("shuffles deterministically, deals an opening hand and caps the hand at seven", () => {
    const a = deckState(), b = deckState();
    expect(a.drawPile).toEqual(b.drawPile);
    expect(deckState(buildStarterDeck(reg, "KNI"), 99).drawPile).not.toEqual(a.drawPile);
    expect(a.openingHand()).toHaveLength(5);
    expect(a.hand).toHaveLength(5);
    a.draw(10);
    expect(a.hand).toHaveLength(7);
    expect(a.graveyard.length).toBeGreaterThan(0);
  });
});

describe("editing a deck list card by card", () => {
  it("adds and removes one copy at a time, capped by the star limit", () => {
    const base = buildStarterDeck(reg, "KNI");
    const trimmed = { ...base, main: base.main.filter((id) => id !== "KNI_LEVY_BASTION-SQUIRE") };
    const before = trimmed.main.filter((id) => id === "KNI_LEVY_BASTION-SQUIRE").length;
    const added = moveCard(reg, trimmed, "main", "KNI_LEVY_BASTION-SQUIRE", 1);
    expect(added.main.filter((id) => id === "KNI_LEVY_BASTION-SQUIRE").length).toBe(before + 1);
    const removed = moveCard(reg, added, "main", "KNI_LEVY_BASTION-SQUIRE", -1);
    expect(removed.main).toEqual(trimmed.main);
    // KNI_LEVY_BASTION-SQUIRE is a 1-star card, limited to 20 copies; an empty deck has room to prove it
    const empty = { ...base, main: [] as string[] };
    let flooded = empty;
    for (let i = 0; i < 25; i++) flooded = moveCard(reg, flooded, "main", "KNI_LEVY_BASTION-SQUIRE", 1);
    expect(flooded.main).toHaveLength(20);
  });
  it("never adds past a full main or side deck, and never removes a card that is not there", () => {
    const base = buildStarterDeck(reg, "KNI");
    expect(moveCard(reg, base, "main", "KNI_FOOT_BASTION-MAN-AT-ARMS", 1).main).toHaveLength(100);
    expect(moveCard(reg, base, "side", "SIDE_FUS_PAIRED-LINE", 1).side).toHaveLength(20);
    expect(moveCard(reg, base, "main", "SAM_LORD_ASHFALL-DAIMYO", -1)).toBe(base);
  });
  it("never adds more copies than the collection holds", () => {
    const base = buildStarterDeck(reg, "KNI");
    const trimmed = { ...base, main: base.main.filter((id) => id !== "KNI_LEVY_BASTION-SQUIRE") };
    const collection = { "KNI_LEVY_BASTION-SQUIRE": 1 };
    const added = moveCard(reg, trimmed, "main", "KNI_LEVY_BASTION-SQUIRE", 1, { collection });
    expect(added.main.filter((id) => id === "KNI_LEVY_BASTION-SQUIRE").length).toBe(1);
    expect(moveCard(reg, added, "main", "KNI_LEVY_BASTION-SQUIRE", 1, { collection })).toBe(added);
  });
  it("respects the side card's own copy limit", () => {
    const base = buildStarterDeck(reg, "SAM");
    const trimmed = { ...base, side: base.side.filter((id) => id !== "SIDE_RIT_IRON-TIDE") };
    const limit = reg.sideCards.get("SIDE_RIT_IRON-TIDE")!.copyLimit;
    let flooded = trimmed;
    for (let i = 0; i < limit + 5; i++) flooded = moveCard(reg, flooded, "side", "SIDE_RIT_IRON-TIDE", 1);
    expect(flooded.side.filter((id) => id === "SIDE_RIT_IRON-TIDE").length).toBe(limit);
  });
});

describe("summoning from hand", () => {
  it("plays a low-star card free, demands tributes for higher stars, and refuses 10-star cards", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(5, 5));
    b.sides.get("A")!.leaderUid = p.commanderUid;
    const deck = deckState();
    b.decks.set("A", deck);
    deck.hand.push("KNI_LEVY_BASTION-SQUIRE", "KNI_ELITE_SKY-LANCE-DRAGOON", "KNI_KING_OATHBREAKER-KING");
    const spot = summonZone(b, "A")[0]!;
    const squire = summonFromHand(b, "A", "KNI_LEVY_BASTION-SQUIRE", spot);
    expect(squire.pos).toEqual(spot);
    expect(deck.hand).not.toContain("KNI_LEVY_BASTION-SQUIRE");
    expect(() => summonFromHand(b, "A", "KNI_ELITE_SKY-LANCE-DRAGOON", summonZone(b, "A")[0]!)).toThrow(/exactly 2 tributes/);
    expect(() => summonFromHand(b, "A", "KNI_KING_OATHBREAKER-KING", summonZone(b, "A")[0]!, { tributes: [] })).toThrow(/ritual or fusion card/);
    const t1 = b.unit(p.footUids[0]!), t2 = b.unit(p.footUids[1]!);
    const dragoon = summonFromHand(b, "A", "KNI_ELITE_SKY-LANCE-DRAGOON", summonZone(b, "A")[0]!, { tributes: [t1, t2] });
    expect(dragoon.defId).toBe("KNI_ELITE_SKY-LANCE-DRAGOON");
    expect(t1.defeated && t2.defeated).toBe(true);
    expect(b.events.filter((e) => e.type === "Tributed")).toHaveLength(2);
    void ctrl;
  });
  it("never lets the army leader be tributed and only summons near a commander", () => {
    const { b } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(5, 5));
    b.sides.get("A")!.leaderUid = p.commanderUid;
    const deck = deckState(); b.decks.set("A", deck);
    deck.hand.push("KNI_COMMANDER_SOLAR-BASTION-MARSHAL", "KNI_LEVY_BASTION-SQUIRE");
    expect(() => summonFromHand(b, "A", "KNI_COMMANDER_SOLAR-BASTION-MARSHAL", summonZone(b, "A")[0]!, { tributes: [b.unit(p.commanderUid!)] })).toThrow(/army leader/);
    expect(() => summonFromHand(b, "A", "KNI_LEVY_BASTION-SQUIRE", { q: 20, r: 15 })).toThrow(/two hexes of one of your commanders/);
  });
  it("draws one card at the start of every round", () => {
    const { b, ctrl } = newBattle();
    deploy(b, "K", "A", KNI, blob(5, 5));
    const deck = deckState(); b.decks.set("A", deck);
    ctrl.commandPhase();
    expect(deck.hand).toHaveLength(1);
    expect(b.events.some((e) => e.type === "Draw")).toBe(true);
  });
});

describe("side deck: ritual and fusion cards", () => {
  it("a ritual card needs its star total and a commander among the sacrifices", () => {
    const { b } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    b.sides.get("A")!.leaderUid = null;
    const deck = deckState(buildStarterDeck(reg, "SAM"));
    b.decks.set("A", deck);
    if (!deck.side.includes("SIDE_RIT_IRON-TIDE")) deck.side.push("SIDE_RIT_IRON-TIDE");
    const card = reg.sideCards.get("SIDE_RIT_IRON-TIDE")!;
    expect(card.stars).toBe(10);
    const foot = p.footUids.slice(0, 3).map((u) => b.unit(u));       // 3 x 2 stars = 6, no commander
    expect(checkRitual(b, "A", card, foot).ok).toBe(false);
    expect(checkRitual(b, "A", card, foot).reason).toMatch(/6 stars; 10 are required/);
    const withLeader = [b.unit(p.commanderUid!), b.unit(p.eliteUid!)];  // 6 + 7 = 13, includes a Commander
    expect(checkRitual(b, "A", card, withLeader).ok).toBe(true);
    const shogun = ritualSummon(b, "A", "SIDE_RIT_IRON-TIDE", withLeader);
    expect(b.def(shogun).name).toBe("Iron Tide Shogun");
    expect(starOf(reg, shogun.defId)).toBe(10);
    expect(deck.side).not.toContain("SIDE_RIT_IRON-TIDE");
    expect(deck.usedSide).toContain("SIDE_RIT_IRON-TIDE");
  });
  it("a ritual for a Sovereign needs a ritualist left on the field to channel", () => {
    const { b } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    const deck = deckState(buildStarterDeck(reg, "SAM")); b.decks.set("A", deck);
    if (!deck.side.includes("SIDE_RIT_SOVEREIGN-MEMORY")) deck.side.push("SIDE_RIT_SOVEREIGN-MEMORY");
    const card = reg.sideCards.get("SIDE_RIT_SOVEREIGN-MEMORY")!;
    const fodder = [b.unit(p.commanderUid!), b.unit(p.eliteUid!)];
    expect(checkRitual(b, "A", card, fodder).reason).toMatch(/ritualist must remain/);
    b.spawn("RIT_LEADER_AFFILIATED-SUMMONER", "A", { q: 12, r: 12 });
    expect(checkRitual(b, "A", card, fodder).ok).toBe(true);
    const sov = ritualSummon(b, "A", "SIDE_RIT_SOVEREIGN-MEMORY", fodder);
    expect(sov.defId).toBe("DIV_BOSS_SOVEREIGN-OF-MEMORY");
  });
  it("a fusion card runs its recipe and is spent", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    b.sides.get("A")!.fusionCharges = 1;
    const deck = deckState(buildStarterDeck(reg, "SAM")); b.decks.set("A", deck);
    ctrl.commandPhase(); ctrl.beginActivation("S");
    const mats = [b.unit(p.footUids[0]!), b.unit(p.footUids[1]!)];
    const fused = fusionSummon(b, "A", "SIDE_FUS_PAIRED-LINE", mats);
    expect(b.def(fused).name).toMatch(/Pair/);
    expect(deck.usedSide).toContain("SIDE_FUS_PAIRED-LINE");
  });
  it("lists exactly the side cards that are playable right now", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    b.sides.get("A")!.fusionCharges = 1;
    b.decks.set("A", deckState(buildStarterDeck(reg, "SAM")));
    ctrl.commandPhase(); ctrl.beginActivation("S");
    const playable = playableSideCards(b, "A").map((x) => x.card.id);
    expect(playable).toContain("SIDE_FUS_PAIRED-LINE");
    expect(playable).toContain("SIDE_RIT_IRON-TIDE");
    expect(playable).not.toContain("SIDE_RIT_SOVEREIGN-MEMORY"); // no ritualist on the field
    void p;
  });
});
