import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, blob } from "./helpers.js";
import { runAiActivation, holdForSyncPolicy, nearestEnemy, DIFFICULTY } from "../src/ai.js";
import { createRitual } from "../src/rituals.js";
import { hexDistance, hexNeighbors } from "../src/hex.js";
import { duels } from "../src/effects.js";

describe("nearestEnemy", () => {
  it("returns null with no enemies on the field, otherwise the closest one", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 8 });
    expect(nearestEnemy(ctrl, u)).toBeNull();
    const far = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 10, r: 14 });
    const near = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 10, r: 10 });
    expect(nearestEnemy(ctrl, u)).toBe(near);
    expect(nearestEnemy(ctrl, u)).not.toBe(far);
  });
});

describe("runAiActivation", () => {
  it("defends rather than passing when there is nothing to fight or reach for", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 8 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(b.events.some((e) => e.type === "Defend" && e.data["uid"] === u.uid)).toBe(true);
  });

  it("picks the higher-value target: a ritualist outscores a plain foot soldier at equal range", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 8 });
    const [h1, h2] = hexNeighbors(u.pos!);
    const plain = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", h1!);
    const ritualist = b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "B", h2!);
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    const attack = b.events.find((e) => e.type === "Attack");
    expect(attack?.data["target"]).toBe(ritualist.uid);
    expect(plain.hp).toBe(1250);
  });

  it("will not waste an attack on a decoy clone when the real unit is an equally reachable target", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 8 });
    const [h1, h2] = hexNeighbors(u.pos!);
    const real = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", h1!);
    const clone = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", h2!);
    clone.isClone = true;
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    const attack = b.events.find((e) => e.type === "Attack");
    expect(attack?.data["target"]).toBe(real.uid);
    expect(clone.hp).toBe(1250);
  });

  it("with no enemy units on the field, marches on an enemy ritual circle as the only goal worth reaching", () => {
    const { b, ctrl } = newBattle();
    const u = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const center = { q: 5, r: 10 };
    const circle = createRitual(b, { id: "enemy-circle", side: "B", center, radius: 1, required: 30, leaderUid: null, summonDefId: null, linkGroup: null });
    circle.progress = 15;
    const startDist = hexDistance(u.pos!, center);
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(hexDistance(u.pos!, center)).toBeLessThan(startDist);
  });

  it("a platoon leader auto-issues its faction's order once an enemy comes within range", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 9 }); // 4 hexes from the commander at (5,5)
    ctrl.commandPhase();
    runAiActivation(ctrl, "S", DIFFICULTY.normal);
    expect(p.orderUsedThisRound).toBe(true);
    expect(b.events.some((e) => e.type === "AbilityUsed" && e.data["ability"] === "ORD_MEASURED_ADVANCE")).toBe(true);
  });

  it("spends a SpawnClones active on a nearby enemy when it has the room", () => {
    const { b, ctrl } = newBattle();
    const adept = b.spawn("SHI_ELITE_MIRROR-SHADE-ADEPT", "A", { q: 10, r: 8 }); // ABL_TWIN_ECHO
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 13, r: 8 }); // 3 hexes away
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    const spawned = b.events.find((e) => e.type === "ClonesSpawned");
    expect(spawned?.data["uid"]).toBe(adept.uid);
    expect((spawned?.data["clones"] as string[]).length).toBe(2);
  });

  it("challenges an adjacent enemy elite to a Duel rather than letting anyone else pile in", () => {
    const { b, ctrl } = newBattle();
    const champion = b.spawn("SAM_ELITE_ONI-GATE-CHAMPION", "A", { q: 10, r: 8 }); // ABL_FORMAL_DUEL
    const dragoon = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", hexNeighbors({ q: 10, r: 8 })[0]!);
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(duels.get(champion.uid)).toBe(dragoon.uid);
    expect(duels.get(dragoon.uid)).toBe(champion.uid);
  });
});

describe("holdForSyncPolicy", () => {
  it("holds every ritual in a link group until all of them are complete", () => {
    const { b, ctrl } = newBattle();
    const fast = createRitual(b, { id: "fast", side: "A", center: { q: 5, r: 5 }, radius: 1, required: 10, leaderUid: null, summonDefId: null, linkGroup: "g" });
    const slow = createRitual(b, { id: "slow", side: "A", center: { q: 5, r: 12 }, radius: 1, required: 10, leaderUid: null, summonDefId: null, linkGroup: "g" });
    fast.state = "CompletedHeld";
    slow.state = "Channeling";
    expect(holdForSyncPolicy(ctrl, "A")).toEqual({});
    slow.state = "CompletedHeld";
    expect(holdForSyncPolicy(ctrl, "A")).toEqual({ fast: true, slow: true });
  });

  it("releases a held ritual early once it crosses the danger threshold, without waiting on the rest of the group", () => {
    const { b, ctrl } = newBattle();
    const fast = createRitual(b, { id: "fast", side: "A", center: { q: 5, r: 5 }, radius: 1, required: 10, leaderUid: null, summonDefId: null, linkGroup: "g" });
    const slow = createRitual(b, { id: "slow", side: "A", center: { q: 5, r: 12 }, radius: 1, required: 10, leaderUid: null, summonDefId: null, linkGroup: "g" });
    fast.state = "CompletedHeld";
    fast.unstableStacks = 3;
    slow.state = "Channeling";
    expect(holdForSyncPolicy(ctrl, "A")).toEqual({ fast: true });
  });
});
