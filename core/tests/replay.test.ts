import { describe, it, expect } from "vitest";
import { newBattle, reg } from "./helpers.js";
import { buildStarterDeck } from "../src/cards.js";
import { runMatch } from "../src/match.js";
import { Replay, describeEvent } from "../src/replay.js";
import type { GameEvent } from "../src/types.js";

const decks = { SAM: buildStarterDeck(reg, "SAM"), SHI: buildStarterDeck(reg, "SHI") };

function fullMatch(seed: number) {
  return runMatch({ reg, seed, roundLimit: 14, A: { deck: decks.SHI, name: "Veiled Moon" }, B: { deck: decks.SAM, name: "Ashfall" } });
}

describe("Replay cursor", () => {
  it("starts before the first event and steps forward and back one at a time", () => {
    const r = fullMatch(5);
    const replay = new Replay(r.battle);
    expect(replay.length).toBe(r.battle.events.length);
    expect(replay.atStart()).toBe(true);
    expect(replay.current()).toBeNull();

    const first = replay.next()!;
    expect(first.index).toBe(0);
    expect(first.event).toBe(r.battle.events[0]);
    expect(typeof first.text).toBe("string");
    expect(first.text.length).toBeGreaterThan(0);

    const second = replay.next()!;
    expect(second.index).toBe(1);
    const back = replay.prev()!;
    expect(back.index).toBe(0);
    expect(back.text).toBe(first.text);

    expect(replay.prev()).toBeNull(); // already back at the start position
    expect(replay.atStart()).toBe(true);
  });

  it("walks every event to the end and reports atEnd once there are no more", () => {
    const r = fullMatch(5);
    const replay = new Replay(r.battle);
    let steps = 0;
    while (replay.next()) steps++;
    expect(steps).toBe(r.battle.events.length);
    expect(replay.atEnd()).toBe(true);
    expect(replay.next()).toBeNull();
  });

  it("seeks directly to an index and rejects one out of range", () => {
    const r = fullMatch(5);
    const replay = new Replay(r.battle);
    const step = replay.seek(3)!;
    expect(step.index).toBe(3);
    expect(replay.position).toBe(3);
    expect(() => replay.seek(-2)).toThrow(RangeError);
    expect(() => replay.seek(r.battle.events.length)).toThrow(RangeError);
    replay.seek(-1);
    expect(replay.atStart()).toBe(true);
  });

  it("jumps to the first event of a round and reports rounds that never happened", () => {
    const r = fullMatch(5);
    const replay = new Replay(r.battle);
    const rounds = replay.rounds();
    expect(rounds[0]).toBe(1);
    expect(rounds).toEqual([...rounds].sort((a, b) => a - b));

    const targetRound = rounds[Math.floor(rounds.length / 2)]!;
    const jumped = replay.jumpToRound(targetRound)!;
    expect(jumped.event.round).toBe(targetRound);
    expect(replay.eventsInRound(targetRound).every((e) => e.round === targetRound)).toBe(true);

    expect(replay.jumpToRound(rounds[rounds.length - 1]! + 1000)).toBeNull();
  });

  it("filters steps by predicate without disturbing the cursor", () => {
    const r = fullMatch(5);
    const replay = new Replay(r.battle);
    replay.seek(2);
    const attacks = replay.filter((e) => e.type === "Attack");
    expect(attacks.length).toBeGreaterThan(0);
    for (const step of attacks) expect(step.event.type).toBe("Attack");
    expect(replay.position).toBe(2);
  });

  it("is reusable: reset returns the cursor to the start", () => {
    const r = fullMatch(5);
    const replay = new Replay(r.battle);
    replay.next(); replay.next(); replay.next();
    replay.reset();
    expect(replay.atStart()).toBe(true);
    expect(replay.current()).toBeNull();
  });
});

describe("describeEvent", () => {
  it("narrates the common events a real match produces with unit names, not bare ids", () => {
    const r = fullMatch(5);
    const byType = new Map<string, GameEvent>();
    for (const e of r.battle.events) if (!byType.has(e.type)) byType.set(e.type, e);

    const attack = byType.get("Attack")!;
    const attackText = describeEvent(r.battle, attack);
    expect(attackText).toContain("attacks");
    expect(attackText).toContain(String(attack.data.damage));
    expect(attackText).not.toContain(String(attack.data.attacker));

    const move = byType.get("Move");
    if (move) expect(describeEvent(r.battle, move)).toContain("moves from");

    const draw = byType.get("Draw")!;
    expect(describeEvent(r.battle, draw)).toContain("draws");

    const battleEnded = byType.get("BattleEnded")!;
    expect(describeEvent(r.battle, battleEnded)).toContain("wins by");

    const kingdomApplied = byType.get("KingdomApplied");
    if (kingdomApplied) expect(describeEvent(r.battle, kingdomApplied)).toContain("holding");
  });

  it("never throws on an unrecognized event type and says something instead of nothing", () => {
    const { b } = newBattle();
    const ev: GameEvent = { round: 1, phase: "Command", type: "SomeFutureEventType", data: { foo: "bar", n: 3 } };
    const text = describeEvent(b, ev);
    expect(text).toContain("SomeFutureEventType");
    expect(text).toContain("foo=");
  });

  it("resolves unit names for rarer events not exercised by a normal match", () => {
    const { b } = newBattle();
    const caster = b.spawn("RIT_LEADER_AFFILIATED-SUMMONER", "A", { q: 5, r: 5 });
    const target = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 6, r: 5 });

    b.log("ClonesSpawned", { uid: caster.uid, clones: 2, bodies: 3, share: "1/3", duration: 2 });
    expect(describeEvent(b, b.events.at(-1)!)).toContain(b.def(caster).name);

    b.log("Fusion", { recipe: "PAIRED_LINE", inputs: [caster.uid, target.uid], result: "u99", name: "Paired Line", hp: 500, atk: 200, def: 200 });
    expect(describeEvent(b, b.events.at(-1)!)).toContain(b.def(caster).name);
    expect(describeEvent(b, b.events.at(-1)!)).toContain(b.def(target).name);
    expect(describeEvent(b, b.events.at(-1)!)).toContain("Paired Line");

    b.log("PortalCaptured", { portal: "p1", newSide: "A" });
    expect(describeEvent(b, b.events.at(-1)!)).toContain("captured");

    b.log("DivineManifested", { uid: caster.uid, def: caster.defId, arrival: "reveal" });
    expect(describeEvent(b, b.events.at(-1)!)).toContain("manifests");

    b.log("RitualReleased", { ritual: "fast", synchronized: true, summon: target.uid });
    const released = describeEvent(b, b.events.at(-1)!);
    expect(released).toContain("synchronized");
    expect(released).toContain(b.def(target).name);
  });

  it("falls back to the raw id for a uid the battle never spawned", () => {
    const { b } = newBattle();
    b.log("Rally", { uid: "ghost-unit" });
    expect(describeEvent(b, b.events.at(-1)!)).toBe("ghost-unit rallies");
  });
});
