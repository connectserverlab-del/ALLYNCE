import { describe, it, expect, afterEach } from "vitest";
import { newBattle, deploy, SAM, KNI, blob } from "./helpers.js";
import { moraleBand, changeMorale, commandRadiusRecovery, surroundedPenalty, tempPreventRouted } from "../src/morale.js";

describe("moraleBand", () => {
  it("bands the 0-100 scale at 70/40/20/1", () => {
    expect(moraleBand(100)).toBe("Steady");
    expect(moraleBand(70)).toBe("Steady");
    expect(moraleBand(69)).toBe("Shaken");
    expect(moraleBand(40)).toBe("Shaken");
    expect(moraleBand(39)).toBe("Disordered");
    expect(moraleBand(20)).toBe("Disordered");
    expect(moraleBand(19)).toBe("Routed");
    expect(moraleBand(1)).toBe("Routed");
    expect(moraleBand(0)).toBe("Broken");
  });
});

describe("changeMorale", () => {
  it("clamps to 0-100 and logs a Morale event with reason, delta and band", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    u.morale = 95;
    changeMorale(b, u, 20, "test bonus");
    expect(u.morale).toBe(100);
    const events = b.events.filter((e) => e.type === "Morale");
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toMatchObject({ uid: u.uid, delta: 20, reason: "test bonus", morale: 100, band: "Steady" });

    u.morale = 5;
    changeMorale(b, u, -20, "test penalty");
    expect(u.morale).toBe(0);
  });

  it("does not log when the clamp absorbs the whole change", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    u.morale = 100;
    changeMorale(b, u, 10, "already full");
    expect(u.morale).toBe(100);
    expect(b.events.filter((e) => e.type === "Morale")).toHaveLength(0);
  });

  it("clones never gain or lose morale", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    u.isClone = true;
    const before = u.morale;
    changeMorale(b, u, -50, "test");
    expect(u.morale).toBe(before);
    expect(b.events.filter((e) => e.type === "Morale")).toHaveLength(0);
  });

  it("Divine Entities never gain or lose morale", () => {
    const { b } = newBattle();
    const u = b.spawn("DIV_BOSS_SOVEREIGN-OF-MEMORY", "A", { q: 5, r: 5 });
    const before = u.morale;
    changeMorale(b, u, -50, "test");
    expect(u.morale).toBe(before);
    expect(b.events.filter((e) => e.type === "Morale")).toHaveLength(0);
  });

  it("applies the Routed status once morale falls to the Routed or Broken band, and lifts it on recovery", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    u.morale = 25;
    changeMorale(b, u, -10, "test"); // 15: Routed
    expect(u.morale).toBe(15);
    expect(b.hasStatus(u, "Routed")).toBe(true);

    changeMorale(b, u, 10, "test"); // 25: Disordered, recovers
    expect(b.hasStatus(u, "Routed")).toBe(false);

    changeMorale(b, u, -25, "test"); // 0: Broken
    expect(b.hasStatus(u, "Routed")).toBe(true);
  });

  afterEach(() => tempPreventRouted.clear());

  it("tempPreventRouted keeps a unit off the Routed status even at Broken morale", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    u.morale = 10;
    tempPreventRouted.add(u.uid);
    changeMorale(b, u, -10, "test"); // 0: Broken, but prevented
    expect(u.morale).toBe(0);
    expect(b.hasStatus(u, "Routed")).toBe(false);
  });
});

describe("commandRadiusRecovery", () => {
  it("recovers +5 inside a live commander's radius", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", KNI, blob(5, 5)); // Knight ladder has no faction rank on this unit yet: no banner
    const foot = b.unit(p.footUids[0]!);
    foot.morale = 50;
    commandRadiusRecovery(b);
    expect(foot.morale).toBe(55);
  });

  it("stacks an additional +5 when the commander holds the banner privilege (Samurai Hatamoto)", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const foot = b.unit(p.footUids[0]!);
    foot.morale = 50;
    commandRadiusRecovery(b);
    expect(foot.morale).toBe(60); // +5 base, +5 banner
  });

  it("does not recover a unit outside the commander's radius", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const far = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 20, r: 15 }, { platoonId: p.id });
    far.morale = 50;
    commandRadiusRecovery(b);
    expect(far.morale).toBe(50);
  });

  it("never recovers the commander from their own aura", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!);
    cmdr.morale = 50;
    commandRadiusRecovery(b);
    expect(cmdr.morale).toBe(50);
  });

  it("skips clones and units with no platoon", () => {
    const { b } = newBattle();
    deploy(b, "P1", "A", SAM, blob(5, 5));
    const clone = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 10 }, { platoonId: "P1" });
    clone.isClone = true;
    clone.morale = 50;
    const loose = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 11 });
    loose.morale = 50;
    commandRadiusRecovery(b);
    expect(clone.morale).toBe(50);
    expect(loose.morale).toBe(50);
  });
});

describe("surroundedPenalty", () => {
  it("does not penalize two adjacent enemies", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    u.morale = 50;
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 4 });
    surroundedPenalty(b);
    expect(u.morale).toBe(50);
  });

  it("penalizes -5 once three distinct enemies stand adjacent", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    u.morale = 50;
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 4 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 4, r: 5 });
    surroundedPenalty(b);
    expect(u.morale).toBe(45);
  });

  it("does not count clone enemies toward the surround threshold", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    u.morale = 50;
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 4 });
    const clone = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 4, r: 5 });
    clone.isClone = true;
    surroundedPenalty(b);
    expect(u.morale).toBe(50);
  });

  it("never penalizes a clone unit itself", () => {
    const { b } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    u.isClone = true;
    u.morale = 50;
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 4 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 4, r: 5 });
    surroundedPenalty(b);
    expect(u.morale).toBe(50);
  });
});
