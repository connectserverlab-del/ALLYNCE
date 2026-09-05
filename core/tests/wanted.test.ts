import { describe, it, expect } from "vitest";
import { reg, newBattle, deploy, SAM, KNI, blob } from "./helpers.js";
import { buildStarterDeck, validateDeck, effectiveCopyLimit, ownedCopies, copyLimit } from "../src/cards.js";
import { newKingdom, grantStarterCollection } from "../src/kingdom.js";
import { rollBoard, acceptContract, abandonContract, resolveContract, warrantPool, markWanted, missingForDeck, shortfall } from "../src/wanted.js";
import { isBroken, isCornered, canBeTaken, canBeSubdued, CAPTURE_THRESHOLD } from "../src/battle.js";
import { runWantedMission } from "../src/match.js";
import { saveBattle, loadBattle } from "../src/save.js";

const LEVY = "KNI_LEVY_BASTION-SQUIRE";

describe("owning your cards", () => {
  it("caps a deck at the copies actually held, not at the star limit", () => {
    const collection = { [LEVY]: 3 };
    expect(copyLimit(reg, LEVY)).toBe(20);
    expect(effectiveCopyLimit(reg, LEVY, collection)).toBe(3);
    // no collection at all is the preset/sandbox path: the rules limit stands alone
    expect(effectiveCopyLimit(reg, LEVY)).toBe(20);
    expect(ownedCopies(collection, "KNI_FOOT_BASTION-MAN-AT-ARMS")).toBe(0);
  });

  it("rejects a deck that runs more copies than the holding owns, and names the shortfall", () => {
    const deck = buildStarterDeck(reg, "KNI");
    expect(validateDeck(reg, deck).ok).toBe(true);          // legal by the rules alone

    const thin = { ...Object.fromEntries(deck.main.map((id) => [id, 99])), [LEVY]: 1 };
    const v = validateDeck(reg, deck, { collection: thin });
    const runs = deck.main.filter((id) => id === LEVY).length;
    expect(runs).toBeGreaterThan(1);
    expect(v.ok).toBe(false);
    expect(v.missing[LEVY]).toBe(runs - 1);
    expect(v.errors.join(" ")).toContain("but you hold only 1 copy");
  });

  it("refuses a card the holding owns none of", () => {
    const deck = buildStarterDeck(reg, "KNI");
    const none = Object.fromEntries(deck.main.map((id) => [id, id === LEVY ? 0 : 99]));
    const v = validateDeck(reg, deck, { collection: none });
    expect(v.ok).toBe(false);
    expect(v.errors.join(" ")).toContain("You hold no copies of");
  });

  it("lets every faction sleeve a legal hundred out of its starter box", () => {
    for (const f of ["SAM", "SHI", "KNI", "DRG"]) {
      const k = newKingdom(reg, f);
      grantStarterCollection(reg, k);
      const deck = buildStarterDeck(reg, f, `${f} starter`, { collection: k.collection });
      const v = validateDeck(reg, deck, { collection: k.collection });
      expect(v.mainCount, f).toBe(100);
      expect(v.errors, f).toEqual([]);
      expect(v.ok, f).toBe(true);
    }
  });

  it("reports what a deck still needs so the board knows what to post", () => {
    const deck = buildStarterDeck(reg, "SAM");
    const k = newKingdom(reg, "SAM");
    const gaps = missingForDeck(reg, deck, k.collection);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[0]!.owned).toBe(0);
    expect(gaps[0]!.need).toBeGreaterThanOrEqual(gaps[gaps.length - 1]!.need);
    grantStarterCollection(reg, k);
    expect(shortfall(reg, k, "SAM_FOOT_EMBERLINE-ASHIGARU")).toBe(0);
  });
});

describe("the wanted board", () => {
  it("never names a target above seven stars, nor a summon-only card", () => {
    for (const d of warrantPool(reg)) {
      expect(d.stars ?? 1, d.id).toBeLessThanOrEqual(7);
      expect(d.stars ?? 1, d.id).toBeGreaterThanOrEqual(2);
      expect(d.summonOnly, d.id).toBeFalsy();
      expect(d.faction, d.id).not.toBe("DIV");
    }
    expect(warrantPool(reg).some((d) => (d.stars ?? 1) === 7)).toBe(true);
    expect(warrantPool(reg).some((d) => d.id === "SHI_KAGE_VOID-CROWN-KAGE")).toBe(false);
  });

  it("posts the same board until the clock rotates it, then a different one", () => {
    const k = newKingdom(reg, "SAM", { seed: 12 });
    const first = rollBoard(reg, k);
    expect(first.length).toBe(reg.wanted.boardSize);
    expect(rollBoard(reg, k).map((c) => c.id)).toEqual(first.map((c) => c.id));
    k.elapsed += reg.wanted.rotationSeconds;
    expect(rollBoard(reg, k).map((c) => c.id)).not.toEqual(first.map((c) => c.id));
  });

  it("favours targets the holding is short of", () => {
    const k = newKingdom(reg, "SAM", { seed: 5 });
    const wantedIds = new Set(rollBoard(reg, k).map((c) => c.targetId));
    const full = newKingdom(reg, "SAM", { seed: 5 });
    grantStarterCollection(reg, full);
    // once the box is opened the holding is short of different things, so the board changes
    expect(new Set(rollBoard(reg, full).map((c) => c.targetId))).not.toEqual(wantedIds);
  });

  it("only carries so many warrants at once, and gives them back on request", () => {
    const k = newKingdom(reg, "KNI", { seed: 9 });
    const board = rollBoard(reg, k);
    for (let i = 0; i < reg.wanted.acceptLimit; i++) expect(acceptContract(reg, k, board[i]!.id).ok).toBe(true);
    const over = acceptContract(reg, k, board[reg.wanted.acceptLimit]!.id);
    expect(over.ok).toBe(false);
    expect(over.reason).toContain("at a time");
    expect(acceptContract(reg, k, board[0]!.id).ok).toBe(false); // already in hand
    expect(abandonContract(k, board[0]!.id)).toBe(true);
    expect(acceptContract(reg, k, board[reg.wanted.acceptLimit]!.id).ok).toBe(true);
  });
});

/** Two units toe to toe, with no platoon geometry in the way. */
function facingOff(seed = 4, mineId = "SAM_FOOT_EMBERLINE-ASHIGARU", theirsId = "KNI_FOOT_BASTION-MAN-AT-ARMS") {
  const { b, ctrl } = newBattle(seed);
  const mine = b.spawn(mineId, "A", { q: 5, r: 5 });
  const theirs = b.spawn(theirsId, "B", { q: 6, r: 5 });
  ctrl.commandPhase();
  ctrl.beginActivation("ind:A");   // loose units draw their AP when their side activates
  return { b, ctrl, mine, theirs };
}

describe("taking a target alive", () => {
  it("will not let you subdue a unit that is still fighting", () => {
    const { b, ctrl, mine, theirs } = facingOff();
    expect(b.adjacentEnemies(mine)).toContain(theirs);
    expect(isBroken(b, theirs)).toBe(false);
    expect(() => ctrl.subdue(mine, theirs)).toThrow(/still fighting/);
    expect(b.captures).toHaveLength(0);
  });

  it("will not let you subdue at spear's length", () => {
    const { b, ctrl, mine } = facingOff();
    const far = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 8, r: 5 });
    far.hp = 1;
    expect(() => ctrl.subdue(mine, far)).toThrow(/hand to hand/);
  });

  it("takes a broken adjacent enemy off the field as a prisoner, not a casualty", () => {
    const { b, ctrl, mine, theirs } = facingOff();
    theirs.hp = Math.ceil(b.def(theirs).hp * CAPTURE_THRESHOLD);
    expect(isBroken(b, theirs)).toBe(true);
    expect(canBeSubdued(b, theirs)).toBe(true);
    expect(ctrl.canSubdue(mine, theirs)).toBe(true);
    ctrl.subdue(mine, theirs);
    expect(theirs.captured).toBe(true);
    expect(theirs.defeated).toBe(true);
    expect(theirs.pos).toBeNull();
    expect(b.unitAt({ q: 6, r: 5 })).toBeUndefined();
    expect(b.captures).toHaveLength(1);
    expect(b.captures[0]).toMatchObject({ defId: theirs.defId, from: "B", by: "A", byUid: mine.uid });
  });

  it("takes a routed enemy even at full health, because it has already stopped fighting", () => {
    const { b, ctrl, mine, theirs } = facingOff();
    expect(isBroken(b, theirs)).toBe(false);
    b.addStatus(theirs, "Routed", 2, "test");
    expect(isBroken(b, theirs)).toBe(true);
    ctrl.subdue(mine, theirs);
    expect(b.captures).toHaveLength(1);
  });

  it("takes a cornered enemy at full health: more hands on it than friends beside it", () => {
    const { b, ctrl, mine, theirs } = facingOff();
    expect(isBroken(b, theirs)).toBe(false);
    expect(isCornered(b, theirs, "A")).toBe(false);          // one attacker is not a corner
    const second = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 6, r: 4 });
    expect(b.adjacentEnemies(theirs)).toContain(second);
    expect(isCornered(b, theirs, "A")).toBe(true);
    expect(canBeTaken(b, theirs, "A")).toBe(true);
    ctrl.subdue(mine, theirs);
    expect(b.captures).toHaveLength(1);
  });

  it("does not count a corner while the target still has its own line beside it", () => {
    const { b, theirs } = facingOff();
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 6, r: 4 });
    expect(isCornered(b, theirs, "A")).toBe(true);
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 7, r: 4 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 7, r: 5 });
    expect(b.adjacentAllies(theirs)).toHaveLength(2);
    expect(isCornered(b, theirs, "A")).toBe(false);
  });

  it("refuses the army leader and deities", () => {
    const { b, ctrl, mine } = facingOff();
    const leader = b.spawn("KNI_COMMANDER_SOLAR-BASTION-MARSHAL", "B", { q: 5, r: 6 });
    b.sides.get("B")!.leaderUid = leader.uid;
    leader.hp = 1;
    expect(canBeSubdued(b, leader)).toBe(false);
    expect(() => ctrl.subdue(mine, leader)).toThrow(/cannot be taken alive/);

    const god = b.spawn("DIV_BOSS_CALAMITY-FORM", "B", { q: 4, r: 5 });
    god.hp = 1;
    expect(canBeSubdued(b, god)).toBe(false);
  });

  it("carries prisoners and warrants through a save and back", () => {
    const { b, ctrl, mine, theirs } = facingOff();
    theirs.hp = 1;
    markWanted(b, "A", [{ targetId: theirs.defId } as never]);
    ctrl.subdue(mine, theirs);
    const back = loadBattle(reg, saveBattle(b));
    expect(back.captures).toEqual(b.captures);
    expect([...back.wanted.get("A")!]).toEqual([theirs.defId]);
    expect(back.unit(theirs.uid).captured).toBe(true);
  });
});

describe("settling a warrant", () => {
  it("pays cards and bounty for a prisoner", () => {
    const k = newKingdom(reg, "SAM", { seed: 3 });
    const before = { ...k.resources };
    const contract = rollBoard(reg, k)[0]!;
    expect(acceptContract(reg, k, contract.id).ok).toBe(true);
    const held = k.collection[contract.targetId] ?? 0;
    const out = resolveContract(reg, k, contract, [
      { defId: contract.targetId, uid: "u1", from: "B", by: "A", byUid: "a1", round: 3 },
    ]);
    expect(out.ok).toBe(true);
    expect(out.copies).toBe(contract.copies);
    expect(k.collection[contract.targetId]).toBe(held + contract.copies);
    expect(k.resources.koku).toBe(before.koku + contract.bounty.koku);
    expect(k.wanted.accepted).not.toContain(contract.id);
    expect(k.wanted.completed).toContain(contract.id);
  });

  it("pays nothing at all for a corpse", () => {
    const k = newKingdom(reg, "SAM", { seed: 3 });
    const before = { ...k.resources };
    const contract = rollBoard(reg, k)[0]!;
    acceptContract(reg, k, contract.id);
    const decoy = [...reg.units.keys()].find((id) => id !== contract.targetId)!;
    const out = resolveContract(reg, k, contract, [
      // an escort was taken; the target was not, because it was killed rather than subdued
      { defId: decoy, uid: "u9", from: "B", by: "A", byUid: "a1", round: 2 },
    ]);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("not taken alive");
    expect(out.copies).toBe(0);
    expect(k.collection[contract.targetId] ?? 0).toBe(0);
    expect(k.resources).toEqual(before);
    expect(k.wanted.accepted).toContain(contract.id); // still open
  });

  it("pays an extra card for each extra copy of the target taken alive", () => {
    const k = newKingdom(reg, "KNI", { seed: 8 });
    const contract = rollBoard(reg, k).find((c) => !reg.unit(c.targetId).unique)!;
    acceptContract(reg, k, contract.id);
    const take = (uid: string) => ({ defId: contract.targetId, uid, from: "B", by: "A", byUid: "a1", round: 4 });
    const out = resolveContract(reg, k, contract, [take("u1"), take("u2"), take("u3")]);
    expect(out.copies).toBe(contract.copies + 2);
  });

  it("will not settle a warrant that was never taken in hand", () => {
    const k = newKingdom(reg, "SAM", { seed: 3 });
    const contract = rollBoard(reg, k)[0]!;
    const out = resolveContract(reg, k, contract, [{ defId: contract.targetId, uid: "u1", from: "B", by: "A", byUid: "a1", round: 1 }]);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("not in hand");
  });
});

describe("running a warrant", () => {
  it("puts the named target on the field with an escort and plays to a decision", () => {
    const k = newKingdom(reg, "SAM", { seed: 21 });
    grantStarterCollection(reg, k);
    const deck = buildStarterDeck(reg, "SAM", "SAM starter", { collection: k.collection });
    const contract = rollBoard(reg, k).find((c) => c.stars >= 4)!;
    acceptContract(reg, k, contract.id, deck);
    const { result, outcome } = runWantedMission({ reg, seed: 21, kingdom: k, deck, contract, roundLimit: 12 });
    expect([...result.battle.units.values()].some((u) => u.defId === contract.targetId)).toBe(true);
    expect([...result.battle.wanted.get("A")!]).toContain(contract.targetId);
    expect(result.rounds).toBeGreaterThan(0);
    // whichever way the fight went, the writ pays only if the target came back alive
    expect(outcome.ok).toBe(result.battle.captures.some((c) => c.defId === contract.targetId && c.by === "A"));
  });

  it("can be filled: some seeds bring the target home alive and pay the writ", () => {
    let filled = 0, killed = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const k = newKingdom(reg, "SAM", { seed });
      grantStarterCollection(reg, k);
      const deck = buildStarterDeck(reg, "SAM", "SAM starter", { collection: k.collection });
      const contract = rollBoard(reg, k)[0]!;
      acceptContract(reg, k, contract.id, deck);
      const held = k.collection[contract.targetId] ?? 0;
      const { outcome } = runWantedMission({ reg, seed, kingdom: k, deck, contract });
      if (outcome.ok) {
        filled++;
        expect(k.collection[contract.targetId]).toBe(held + outcome.copies);
      } else {
        killed++;
        expect(k.collection[contract.targetId] ?? 0).toBe(held);
      }
    }
    // a warrant is winnable but never a formality: both outcomes have to be reachable
    expect(filled).toBeGreaterThan(0);
    expect(killed).toBeGreaterThan(0);
  });

  it("is deterministic for a seed", () => {
    const run = () => {
      const k = newKingdom(reg, "KNI", { seed: 33 });
      grantStarterCollection(reg, k);
      const deck = buildStarterDeck(reg, "KNI", "KNI starter", { collection: k.collection });
      const contract = rollBoard(reg, k)[0]!;
      acceptContract(reg, k, contract.id, deck);
      const r = runWantedMission({ reg, seed: 33, kingdom: k, deck, contract, roundLimit: 10 });
      return { winner: r.result.winner, rounds: r.result.rounds, took: r.captures.length, paid: r.outcome.copies };
    };
    expect(run()).toEqual(run());
  });
});
