import { describe, it, expect } from "vitest";
import type { Battle } from "../src/state.js";
import { newBattle, deploy, reg, SAM, KNI, blob } from "./helpers.js";
import { BattleController, CAPTURE_THRESHOLD, type VictoryRules } from "../src/battle.js";
import { applyCommand, type Command } from "../src/commands.js";
import { saveBattle, loadBattle } from "../src/save.js";
import { hashEvents } from "../src/determinism.js";
import { createRitual } from "../src/rituals.js";
import { callPortal } from "../src/portals.js";
import { DeckState, buildStarterDeck, summonZone, summonFromHand, ritualSummon, fusionSummon, playStratagem } from "../src/cards.js";
import { Rng } from "../src/rng.js";

/**
 * Fork a battle into an identical, independent copy with its own controller — exactly what a
 * lockstep client does with the same command stream. `saveBattle`/`loadBattle` already round-trip
 * a battle exactly (proven by `save.test.ts`), so it's also the cheapest way to get two battles
 * that started identical without duplicating a scenario's setup code.
 */
function fork(b: Battle, victory: VictoryRules): { b: Battle; ctrl: BattleController } {
  const nb = loadBattle(reg, saveBattle(b));
  return { b: nb, ctrl: new BattleController(nb, victory) };
}

describe("applyCommand: a scripted round applied directly matches the same round applied through commands", () => {
  it("CommandPhase, BeginActivation, Move, Attack, EndActivation, ObjectivePhase and EndPhase reach the same event log and round hash", () => {
    const { b, ctrl } = newBattle();
    const mover = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const attacker = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 10 });
    const target = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 11, r: 10 });
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);

    ctrl.commandPhase();
    ctrl.beginActivation("ind:A");
    ctrl.move(mover, { q: 6, r: 5 });
    ctrl.attack(attacker, target);
    ctrl.endActivation("ind:A");
    ctrl.beginActivation("ind:B");
    ctrl.endActivation("ind:B");
    ctrl.objectivePhase();
    ctrl.endPhase();

    const script: Command[] = [
      { kind: "CommandPhase" },
      { kind: "BeginActivation", groupId: "ind:A" },
      { kind: "Move", uid: mover.uid, to: { q: 6, r: 5 } },
      { kind: "Attack", uid: attacker.uid, targetUid: target.uid },
      { kind: "EndActivation", groupId: "ind:A" },
      { kind: "BeginActivation", groupId: "ind:B" },
      { kind: "EndActivation", groupId: "ind:B" },
      { kind: "ObjectivePhase" },
      { kind: "EndPhase" },
    ];
    for (const cmd of script) applyCommand(ctrl2, cmd);

    expect(b2.events.length).toBeGreaterThan(0);
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    expect(b2.round).toBe(b.round);
    expect(b2.commands).toEqual(script);
    // a JSON round trip is exactly what a network hop or a save does to a command
    expect(JSON.parse(JSON.stringify(b2.commands))).toEqual(script);
  });

  it("UseAbility (a platoon Order) matches ctrl.useAbility()", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(2, 2));
    const commander = b.unit(p.commanderUid!);
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);

    ctrl.commandPhase();
    ctrl.beginActivation("K");
    ctrl.useAbility(commander, "ORD_BASTION_FORMATION");

    applyCommand(ctrl2, { kind: "CommandPhase" });
    applyCommand(ctrl2, { kind: "BeginActivation", groupId: "K" });
    applyCommand(ctrl2, { kind: "UseAbility", uid: commander.uid, abilityId: "ORD_BASTION_FORMATION" });

    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
  });

  it("Channel matches ctrl.channel()", () => {
    const { b, ctrl } = newBattle();
    const ritualist = b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "A", { q: 10, r: 5 });
    ritualist.ap = 2;
    const r = createRitual(b, { id: "r1", side: "A", center: { q: 10, r: 5 }, radius: 1, required: 999, leaderUid: null, summonDefId: null, linkGroup: null });
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);

    ctrl.channel(ritualist, r);
    applyCommand(ctrl2, { kind: "Channel", uid: ritualist.uid, ritualId: "r1" });

    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
  });

  it("Surrender matches ctrl.surrender()", () => {
    const { b, ctrl } = newBattle();
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);

    ctrl.surrender("A");
    applyCommand(ctrl2, { kind: "Surrender", side: "A" });

    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    expect(b2.sides.get("A")!.surrendered).toBe(true);
  });

  it("card plays — SummonFromHand, RitualSummon, FusionSummon and PlayStratagem — match their direct functions", () => {
    // SummonFromHand
    {
      const { b, ctrl } = newBattle();
      deploy(b, "K", "A", KNI, blob(5, 5));
      const deck = new DeckState(buildStarterDeck(reg, "KNI"), new Rng(3), reg.deckRules);
      b.decks.set("A", deck);
      deck.hand.push("KNI_LEVY_BASTION-SQUIRE");
      const spot = summonZone(b, "A")[0]!;
      const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
      summonFromHand(b, "A", "KNI_LEVY_BASTION-SQUIRE", spot);
      applyCommand(ctrl2, { kind: "SummonFromHand", side: "A", unitId: "KNI_LEVY_BASTION-SQUIRE", at: spot });
      expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    }

    // RitualSummon
    {
      const { b, ctrl } = newBattle();
      const p = deploy(b, "S", "A", SAM, blob(5, 5));
      const deck = new DeckState(buildStarterDeck(reg, "SAM"), new Rng(3), reg.deckRules);
      b.decks.set("A", deck);
      if (!deck.side.includes("SIDE_RIT_IRON-TIDE")) deck.side.push("SIDE_RIT_IRON-TIDE");
      const sacrificeUids = [p.commanderUid!, p.eliteUid!];
      const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
      ritualSummon(b, "A", "SIDE_RIT_IRON-TIDE", sacrificeUids.map((u) => b.unit(u)));
      applyCommand(ctrl2, { kind: "RitualSummon", side: "A", cardId: "SIDE_RIT_IRON-TIDE", sacrificeUids });
      expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    }

    // FusionSummon
    {
      const { b, ctrl } = newBattle();
      const p = deploy(b, "S", "A", SAM, blob(5, 5));
      b.sides.get("A")!.fusionCharges = 1;
      const deck = new DeckState(buildStarterDeck(reg, "SAM"), new Rng(3), reg.deckRules);
      b.decks.set("A", deck);
      ctrl.commandPhase();
      ctrl.beginActivation("S");
      const materialUids = [p.footUids[0]!, p.footUids[1]!];
      const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
      fusionSummon(b, "A", "SIDE_FUS_PAIRED-LINE", materialUids.map((u) => b.unit(u)));
      applyCommand(ctrl2, { kind: "FusionSummon", side: "A", cardId: "SIDE_FUS_PAIRED-LINE", materialUids });
      expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    }

    // PlayStratagem
    {
      const { b, ctrl } = newBattle();
      const p = deploy(b, "K", "A", KNI, blob(5, 5));
      const deck = new DeckState({ ...buildStarterDeck(reg, "KNI"), side: ["SIDE_STRAT_FORCED-MARCH"] }, new Rng(3), reg.deckRules);
      b.decks.set("A", deck);
      const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
      playStratagem(b, "A", "SIDE_STRAT_FORCED-MARCH", { platoon: p });
      applyCommand(ctrl2, { kind: "PlayStratagem", side: "A", cardId: "SIDE_STRAT_FORCED-MARCH", platoonId: p.id });
      expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    }
  });
});

describe("applyCommand: the rest of the controller surface, one command at a time", () => {
  it("Face matches ctrl.face()", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.face(u, 3);
    applyCommand(ctrl2, { kind: "Face", uid: u.uid, facing: 3 });
    expect(b2.unit(u.uid).facing).toBe(u.facing);
  });

  it("Defend and Overwatch match their direct calls", () => {
    const { b, ctrl } = newBattle();
    const defender = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const watcher = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 8, r: 8 });
    defender.ap = 2; watcher.ap = 2;
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.defend(defender);
    ctrl.overwatch(watcher);
    applyCommand(ctrl2, { kind: "Defend", uid: defender.uid });
    applyCommand(ctrl2, { kind: "Overwatch", uid: watcher.uid });
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
  });

  it("Rally matches ctrl.rally()", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const commander = b.unit(p.commanderUid!);
    ctrl.commandPhase();
    ctrl.beginActivation(p.id);
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.rally(commander);
    applyCommand(ctrl2, { kind: "Rally", uid: commander.uid });
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
  });

  it("Subdue matches ctrl.subdue()", () => {
    const { b, ctrl } = newBattle();
    const mine = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const theirs = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    theirs.hp = Math.ceil(b.def(theirs).hp * CAPTURE_THRESHOLD); // broken, so it can be taken
    mine.ap = 2;
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.subdue(mine, theirs);
    applyCommand(ctrl2, { kind: "Subdue", uid: mine.uid, targetUid: theirs.uid });
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    expect(b2.captures).toEqual(b.captures);
  });

  it("AttackStructure matches ctrl.attackStructure()", () => {
    const { b, ctrl } = newBattle();
    const wyrm = b.spawn("DRG_SIEGE_CINDERTHROAT-SIEGEWYRM", "A", { q: 5, r: 5 });
    const portal = callPortal(b, "B", { q: 7, r: 5 }, { telegraph: 0, hp: 5000, def: 1200 })!;
    ctrl.commandPhase();
    ctrl.beginActivation("ind:A");
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.attackStructure(wyrm, portal);
    applyCommand(ctrl2, { kind: "AttackStructure", uid: wyrm.uid, portalId: portal.id });
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    expect(b2.portals.get(portal.id)!.hp).toBe(portal.hp);
  });

  it("Assist matches ctrl.assist()", () => {
    const { b, ctrl } = newBattle();
    const r = createRitual(b, { id: "r1", side: "A", center: { q: 10, r: 5 }, radius: 1, required: 999, leaderUid: null, summonDefId: null, linkGroup: null });
    const helper = b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "A", { q: 11, r: 5 });
    helper.ap = 2;
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.assist(helper, r);
    applyCommand(ctrl2, { kind: "Assist", uid: helper.uid, ritualId: "r1" });
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    expect(b2.rituals.get("r1")!.assistBonus).toBe(r.assistBonus);
  });

  it("Capture matches ctrl.capture()", () => {
    const { b, ctrl } = newBattle();
    const portal = callPortal(b, "B", { q: 5, r: 5 }, { telegraph: 0 })!;
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "A", { q: 6, r: 5 });
    keeper.ap = 2;
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.capture(keeper, portal);
    applyCommand(ctrl2, { kind: "Capture", uid: keeper.uid, portalId: portal.id });
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    expect(b2.portals.get(portal.id)!.captureProgress).toBe(portal.captureProgress);
  });

  it("OpenPortal matches ctrl.openPortal()", () => {
    const { b, ctrl } = newBattle();
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "B", { q: 5, r: 5 });
    ctrl.commandPhase();
    ctrl.beginActivation("ind:B");
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.openPortal(keeper, { q: 6, r: 5 });
    applyCommand(ctrl2, { kind: "OpenPortal", uid: keeper.uid, pos: { q: 6, r: 5 } });
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
  });

  it("QueueReinforcement matches ctrl.queueReinforcement()", () => {
    const { b, ctrl } = newBattle();
    b.sides.get("B")!.reservePoints = 10;
    const portal = callPortal(b, "B", { q: 5, r: 5 }, { telegraph: 0 })!;
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "B", { q: 6, r: 5 });
    keeper.ap = 2;
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.queueReinforcement(keeper, portal, "KNI_FOOT_BASTION-MAN-AT-ARMS");
    applyCommand(ctrl2, { kind: "QueueReinforcement", uid: keeper.uid, portalId: portal.id, defId: "KNI_FOOT_BASTION-MAN-AT-ARMS" });
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    expect(b2.sides.get("B")!.reservePoints).toBe(b.sides.get("B")!.reservePoints);
  });

  it("ShadowStep matches ctrl.shadowStep()", () => {
    const { b, ctrl } = newBattle();
    const kage = b.spawn("SHI_COMMANDER_VEILED-MOON-JONIN", "A", { q: 5, r: 5 });
    b.reg.units.get("SHI_COMMANDER_VEILED-MOON-JONIN")!.factionRank = "KAGE";
    b.terrain.set("8,5", "Forest");
    ctrl.commandPhase();
    ctrl.beginActivation("ind:A");
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.shadowStep(kage, { q: 8, r: 5 });
    applyCommand(ctrl2, { kind: "ShadowStep", uid: kage.uid, to: { q: 8, r: 5 } });
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
    b.reg.units.get("SHI_COMMANDER_VEILED-MOON-JONIN")!.factionRank = undefined;
  });

  it("Fuse matches ctrl.fuse()", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    b.sides.get("A")!.fusionCharges = 1;
    ctrl.commandPhase();
    ctrl.beginActivation("S");
    const uids = [p.footUids[0]!, p.footUids[1]!];
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.fuse(uids.map((u) => b.unit(u)), "FUS_PAIRED_LINE");
    applyCommand(ctrl2, { kind: "Fuse", uids, recipeId: "FUS_PAIRED_LINE" });
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
  });

  it("UseCompanyOrder matches ctrl.useCompanyOrder()", () => {
    const { b, ctrl } = newBattle();
    const p1 = deploy(b, "P1", "A", SAM, [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 4, r: 1 }]);
    deploy(b, "P2", "A", SAM, [{ q: 0, r: 4 }, { q: 1, r: 4 }, { q: 2, r: 4 }, { q: 0, r: 5 }, { q: 1, r: 5 }, { q: 2, r: 5 }, { q: 3, r: 5 }, { q: 4, r: 5 }]);
    deploy(b, "P3", "A", SAM, [{ q: 0, r: 8 }, { q: 1, r: 8 }, { q: 2, r: 8 }, { q: 0, r: 9 }, { q: 1, r: 9 }, { q: 2, r: 9 }, { q: 3, r: 9 }, { q: 4, r: 9 }]);
    ctrl.commandPhase();
    ctrl.beginActivation("P1");
    const cmdr = b.unit(p1.commanderUid!);
    const { b: b2, ctrl: ctrl2 } = fork(b, ctrl.victory);
    ctrl.useCompanyOrder(cmdr);
    applyCommand(ctrl2, { kind: "UseCompanyOrder", uid: cmdr.uid });
    expect(hashEvents(b2.events)).toBe(hashEvents(b.events));
  });
});

describe("applyCommand: the funnel's own guarantees", () => {
  it("does not append a command that throws — it never mutated the battle", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 }); // ap 0, out of activation
    expect(() => applyCommand(ctrl, { kind: "Move", uid: u.uid, to: { q: 6, r: 5 } })).toThrow();
    expect(b.commands).toHaveLength(0);
    expect(() => applyCommand(ctrl, { kind: "Attack", uid: u.uid, targetUid: u.uid })).toThrow();
    expect(b.commands).toHaveLength(0);
  });

  it("rejects a reference to a uid, portal or ritual that does not exist, the same way the direct call would", () => {
    const { ctrl } = newBattle();
    expect(() => applyCommand(ctrl, { kind: "Move", uid: "no-such-unit", to: { q: 1, r: 1 } })).toThrow(/No unit/);
    expect(() => applyCommand(ctrl, { kind: "AttackStructure", uid: "no-such-unit", portalId: "no-such-portal" })).toThrow(/No unit/);
    expect(() => applyCommand(ctrl, { kind: "Channel", uid: "no-such-unit", ritualId: "no-such-ritual" })).toThrow(/No unit/);
  });
});
