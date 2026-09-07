import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, blob } from "./helpers.js";
import { eligibleRecipes } from "../src/fusion.js";
import { doctrineState } from "../src/composition.js";
import { hexNeighbors, hexKey } from "../src/hex.js";

describe("fusion", () => {
  it("pairs two foot soldiers into one stronger unit that still fills one slot and costs a Fusion charge", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    b.sides.get("A")!.fusionCharges = 1;
    ctrl.commandPhase(); ctrl.beginActivation("S");
    const a = b.unit(p.footUids[0]!), c = b.unit(p.footUids[1]!);
    expect(b.distance(a, c)).toBe(1);
    const recipes = eligibleRecipes(b, [a, c]).map((r) => r.id);
    expect(recipes).toContain("FUS_PAIRED_LINE");
    const fused = ctrl.fuse([a, c], "FUS_PAIRED_LINE");
    const d = b.def(fused);
    expect(fused.hp).toBe(2200);
    expect(d.atk).toBe(Math.round(1400 + 1400 * 0.2));
    expect(p.footUids).toContain(fused.uid);
    expect(p.footUids).toHaveLength(4);
    expect(doctrineState(b, p)).toBe("Reduced"); // the trade-off: one fewer soldier
    expect(b.sides.get("A")!.fusionCharges).toBe(0);
    expect(() => ctrl.fuse([b.unit(p.footUids[1]!), b.unit(p.footUids[2]!)], "FUS_PAIRED_LINE")).toThrow(/Fusion charge/);
  });
  it("the Calamity Form needs all three Sovereigns adjacent and dissolves after three rounds", () => {
    const { b, ctrl } = newBattle();
    b.sides.get("A")!.fusionCharges = 2;
    const m = b.spawn("DIV_BOSS_SOVEREIGN-OF-MEMORY", "A", { q: 8, r: 8 });
    const t = b.spawn("DIV_BOSS_SOVEREIGN-OF-TORMENT", "A", { q: 9, r: 8 });
    const r = b.spawn("DIV_BOSS_SOVEREIGN-OF-REINCARNATION", "A", { q: 8, r: 9 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 1, r: 1 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(() => ctrl.fuse([m, t], "FUS_CALAMITY")).toThrow();
    const cal = ctrl.fuse([m, t, r], "FUS_CALAMITY");
    expect(b.def(cal).name).toBe("The Calamity Form");
    expect(cal.fusionRoundsLeft).toBe(3);
    ctrl.endActivation("ind:A");
    for (let i = 0; i < 3; i++) { ctrl.objectivePhase(); ctrl.endPhase(); if (!b.winner) ctrl.commandPhase(); }
    expect(cal.defeated).toBe(true);
    expect(b.events.some((e) => e.type === "FusionDissolved")).toBe(true);
  });
});

describe("siege pieces and cavalry", () => {
  it("cannons must set up, respect minimum range, lose emplacement when moving, and breach fortifications", () => {
    const { b, ctrl } = newBattle();
    const gun = b.spawn("KNI_SIEGE_BASTION-BOMBARD", "A", { q: 5, r: 5 });
    const near = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 6, r: 5 });
    const far = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 8, r: 5 });
    b.terrain.set("8,5", "Fortification");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(() => ctrl.attack(gun, far)).toThrow(/Set Up/);
    ctrl.useAbility(gun, "ABL_SIEGE_SETUP");
    expect(() => ctrl.attack(gun, near)).toThrow(/minimum range/);
    const hp = far.hp;
    ctrl.attack(gun, far);
    const atkEvent = b.events.filter((e) => e.type === "Attack").pop()!;
    expect(far.hp).toBeLessThan(hp);
    expect(atkEvent.data["atk"]).toBe(2100 + 400); // Breaching Shot against Fortification
    gun.ap = 2; ctrl.move(gun, { q: 4, r: 5 });
    expect(gun.setUp).toBe(false);
  });
  it("smoke shells lay timed Smoke and the Siegewyrm's blast suppresses a cluster", () => {
    const { b, ctrl } = newBattle();
    const mortar = b.spawn("SHI_SIEGE_REED-SMOKE-MORTAR", "A", { q: 2, r: 2 });
    const wyrm = b.spawn("DRG_SIEGE_CINDERTHROAT-SIEGEWYRM", "A", { q: 10, r: 10 });
    const e1 = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 12, r: 10 });
    const e2 = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 13, r: 10 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    ctrl.useAbility(mortar, "ABL_SMOKE_SHELL", { targetHex: { q: 5, r: 4 } });
    expect(b.terrainAt({ q: 5, r: 4 })).toBe("Smoke");
    expect(hexNeighbors({ q: 5, r: 4 }).every((h) => b.terrainAt(h) === "Smoke")).toBe(true);
    ctrl.useAbility(wyrm, "ABL_CONCUSSIVE_BLAST", { targetHex: { q: 12, r: 10 } });
    expect(e1.hp).toBe(1250 - 300); expect(e2.hp).toBe(1250 - 300);
    expect(b.hasStatus(e1, "Suppressed")).toBe(true);
    ctrl.endActivation("ind:A"); ctrl.objectivePhase(); ctrl.endPhase(); ctrl.commandPhase(); ctrl.objectivePhase(); ctrl.endPhase();
    expect(b.terrain.has(hexKey({ q: 5, r: 4 }))).toBe(false); // smoke cleared after two rounds
  });
  it("Night Courier Riders hit and fade without reaction attacks", () => {
    const { b, ctrl } = newBattle();
    const rider = b.spawn("SHI_CAVALRY_NIGHT-COURIER-RIDER", "A", { q: 5, r: 5 });
    const target = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    ctrl.attack(rider, target);
    expect(rider.freeMoveHexes).toBe(2);
    const hp = rider.hp; const ap = rider.ap;
    ctrl.move(rider, { q: 3, r: 5 });
    expect(rider.hp).toBe(hp); expect(rider.ap).toBe(ap);
  });
});
