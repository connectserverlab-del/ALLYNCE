import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, blob } from "./helpers.js";
import { defeat } from "../src/combat.js";
import { resolveSuccession } from "../src/command.js";

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
