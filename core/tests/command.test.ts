import { describe, expect, it } from "vitest";
import { blob, deploy, newBattle, SAM } from "./helpers.js";
import { defeat } from "../src/combat.js";
import { resolveSuccession } from "../src/command.js";
import { computeStat } from "../src/modifiers.js";

describe("command.ts: rally action", () => {
  it("heals allies within 2 hexes and spends 1 AP, but leaves units out of range untouched", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const commander = b.unit(p.commanderUid!);
    const near = b.unit(p.footUids[0]!); // distance 1 from the commander in this layout
    const far = b.unit(p.footUids[2]!); // distance 3, outside Rally's 2-hex radius
    ctrl.commandPhase();
    ctrl.beginActivation(p.id);
    const nearBefore = near.morale;
    const farBefore = far.morale;
    const apBefore = commander.ap;
    ctrl.rally(commander);
    expect(near.morale).toBe(Math.min(100, nearBefore + 10));
    expect(far.morale).toBe(farBefore);
    expect(commander.ap).toBe(apBefore - 1);
    expect(b.events.some((e) => e.type === "Rally" && e.data.uid === commander.uid)).toBe(true);
  });

  it("refuses to fire and refunds the AP when the unit holds no eligible role", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const foot = b.unit(p.footUids[0]!); // FootSoldier only: not Commander/Second/Support, never promoted
    ctrl.commandPhase();
    ctrl.beginActivation(p.id);
    const apBefore = foot.ap;
    expect(() => ctrl.rally(foot)).toThrow("Unit cannot Rally");
    expect(foot.ap).toBe(apBefore);
  });
});

describe("command.ts: onUnitDefeated", () => {
  it("costs 10 morale when the second falls before the commander, without triggering succession", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const commander = b.unit(p.commanderUid!);
    const before = commander.morale;
    defeat(b, b.unit(p.secondUid!), "test");
    expect(commander.morale).toBe(before - 10);
    expect(p.pendingSuccession).toBe(false);
    expect(b.events.some((e) => e.type === "Morale" && e.data.reason === "Second defeated before commander")).toBe(true);
  });

  it("costs 10 morale when the elite falls", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const commander = b.unit(p.commanderUid!);
    const before = commander.morale;
    defeat(b, b.unit(p.eliteUid!), "test");
    expect(commander.morale).toBe(before - 10);
    expect(b.events.some((e) => e.type === "Morale" && e.data.reason === "Elite defeated")).toBe(true);
  });

  it("adds a further 15-morale penalty the moment the platoon drops below half strength", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const commander = b.unit(p.commanderUid!);
    const before = commander.morale;
    // Bring the platoon from 8 living members to 3: second, elite and two foot cost -10 each (32 total)
    // but carry no below-half penalty on their own since alive stays at or above half throughout.
    defeat(b, b.unit(p.secondUid!), "test");
    defeat(b, b.unit(p.eliteUid!), "test");
    defeat(b, b.unit(p.footUids[0]!), "test");
    defeat(b, b.unit(p.footUids[1]!), "test");
    const beforeLastCut = commander.morale;
    // The fifth defeat (a plain foot soldier, no direct penalty of its own) tips alive count to 3 of 8.
    defeat(b, b.unit(p.footUids[2]!), "test");
    expect(beforeLastCut).toBe(before - 20);
    expect(commander.morale).toBe(beforeLastCut - 15);
    expect(b.events.some((e) => e.type === "Morale" && e.data.reason === "Platoon below half strength")).toBe(true);
  });
});

describe("command.ts: resolveSuccession", () => {
  it("clears a stray continuity timer instead of promoting when the commander never actually fell", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    p.continuityRoundsLeft = 2;
    const ran = resolveSuccession(b, p);
    expect(ran).toBe(false);
    expect(p.continuityRoundsLeft).toBe(0);
    expect(p.commanderUid).toBe(p.commanderUid);
  });
});

describe("command: rally and morale on loss", () => {
  it("only a Commander, Second or Support may Rally, and it heals allies within 2 hexes but not itself", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!);
    const foot0 = b.unit(p.footUids[0]!); // distance 1 from the commander
    const foot4 = b.unit(p.footUids[4]!); // distance 5 from the commander, out of Rally range too
    foot0.morale = 50; foot4.morale = 50; cmdr.morale = 50;

    const plainFoot = b.unit(p.footUids[1]!);
    plainFoot.ap = 2;
    expect(() => ctrl.rally(plainFoot)).toThrow("Unit cannot Rally");
    expect(plainFoot.ap).toBe(2); // the spent AP is refunded on a failed order

    cmdr.ap = 2;
    ctrl.rally(cmdr);
    expect(cmdr.ap).toBe(1);
    expect(cmdr.morale).toBe(50); // Rally does not heal the caster
    expect(foot0.morale).toBe(60);
    expect(foot4.morale).toBe(50); // out of the 2-hex radius
    expect(b.events.some((e) => e.type === "Rally" && e.data.uid === cmdr.uid)).toBe(true);
  });

  it("Second defeated before the commander costs the platoon 10 morale, with no succession pending", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const before = b.unit(p.footUids[0]!).morale;
    defeat(b, b.unit(p.secondUid!), "test");
    expect(b.unit(p.footUids[0]!).morale).toBe(before - 10);
    expect(p.pendingSuccession).toBe(false);
  });

  it("Elite defeated costs the platoon 10 morale", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const before = b.unit(p.footUids[0]!).morale;
    defeat(b, b.unit(p.eliteUid!), "test");
    expect(b.unit(p.footUids[0]!).morale).toBe(before - 10);
    expect(p.pendingSuccession).toBe(false);
  });

  it("falling to three of eight survivors costs an extra 15 morale, exactly once", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!);
    for (let i = 0; i < 4; i++) defeat(b, b.unit(p.footUids[i]!), "test");
    const before = cmdr.morale;
    defeat(b, b.unit(p.footUids[4]!), "test"); // fifth foot down: 3 of 8 remain
    expect(cmdr.morale).toBe(before - 15);
    // one Morale event per surviving member (commander, second, elite)
    expect(b.events.filter((e) => e.type === "Morale" && e.data.reason === "Platoon below half strength")).toHaveLength(3);
  });

  it("the Second's aura takes over once the Commander is defeated, before succession runs", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const foot0 = b.unit(p.footUids[0]!); // within both leaders' radius while both stand
    const before = computeStat(b, foot0, "ATK").modifiers.find((m) => m.source.includes("aura"));
    expect(before?.source).toContain("Commander aura");
    expect(before?.value).toBe(100);

    defeat(b, b.unit(p.commanderUid!), "test");
    const after = computeStat(b, foot0, "ATK").modifiers.find((m) => m.source.includes("aura"));
    expect(after?.source).toContain("Second aura");
    expect(after?.value).toBe(50);
  });

  it("no aura at all outside both leaders' command radius", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const farFoot = b.unit(p.footUids[4]!);
    const auras = computeStat(b, farFoot, "ATK").modifiers.filter((m) => m.source.includes("aura"));
    expect(auras).toHaveLength(0);
  });
});
