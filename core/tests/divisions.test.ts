import { describe, it, expect } from "vitest";
import { reg, newBattle, blob } from "./helpers.js";
import { deployPlatoon } from "../src/deploy.js";
import { validateArmy, doctrineState } from "../src/composition.js";
import { computeStat } from "../src/modifiers.js";
import type { ArmyBlueprint } from "../src/composition.js";

/**
 * The seven themed divisions used to be hired flavour: they could join a host's platoon but never
 * lead one, because none of them could fill every slot a platoon needs, and none carried a faction
 * order or doctrine the way the four host armies do. This gives each one both.
 */
const DIVISIONS = ["ANG", "DEM", "CHR", "DMG", "WEN", "SAS", "FMC"] as const;

/**
 * The blueprint a division fields when it leads its own platoon, built from its own four cards.
 * Formic Swarm has one card that can fill both Second and Elite (a second physical copy stands
 * in each slot), so the two are allowed to name the same unit id.
 */
function divisionBlueprint(faction: string) {
  const units = [...reg.units.values()].filter((u) => u.faction === faction);
  const commander = units.find((u) => u.slots.includes("Commander"))!.id;
  const second = units.find((u) => u.slots.includes("Second") && u.id !== commander)!.id;
  const elite = units.find((u) => u.slots.includes("Elite"))!.id;
  const foot = units.find((u) => u.slots.includes("FootSoldier"))!.id;
  return { faction, commander, second, elite, foot };
}

describe("a division can lead a deck instead of only joining one", () => {
  it("every division names a platoon order and a doctrine, both real abilities of its own faction", () => {
    for (const f of DIVISIONS) {
      const faction = reg.factions.get(f)!;
      expect(faction.platoonOrder, f).toBeTruthy();
      expect(faction.passiveDoctrine, f).toBeTruthy();
      const order = reg.ability(faction.platoonOrder!);
      const doctrine = reg.ability(faction.passiveDoctrine!);
      expect(order.category, f).toBe("Order");
      expect(order.faction, f).toBe(f);
      expect(doctrine.category, f).toBe("Passive");
      expect(doctrine.faction, f).toBe(f);
    }
  });

  it("every division can fill a standard eight-body platoon from its own four cards", () => {
    for (const f of DIVISIONS) {
      const bp = divisionBlueprint(f);
      const army: ArmyBlueprint = {
        side: "A", capacity: 999,
        platoons: [{ id: `${f}-1`, side: "A", faction: f, commander: bp.commander, second: bp.second, elite: bp.elite, foot: Array(5).fill(bp.foot) }],
        specialists: [],
      };
      const v = validateArmy(reg, army);
      expect(v.errors, f).toEqual([]);
      expect(v.ok, f).toBe(true);
    }
  });

  it("a full division platoon reaches Full doctrine, not Broken, and can issue its order", () => {
    for (const f of DIVISIONS) {
      const bp = divisionBlueprint(f);
      const { b, ctrl } = newBattle(11);
      const p = deployPlatoon(b, { id: `${f}-1`, side: "A", faction: f, commander: bp.commander, second: bp.second, elite: bp.elite, foot: Array(5).fill(bp.foot) }, blob(5, 5));
      expect(doctrineState(b, p), f).toBe("Full");
      ctrl.commandPhase();
      ctrl.beginActivation(`${f}-1`);
      const commanderUnit = b.units.get(p.commanderUid!)!;
      // Close enough to sit inside every order's own range (the tightest is 3 hexes) without landing on the platoon's own ground.
      const enemy = b.spawn(bp.foot, "B", { q: 5, r: 2 });
      const faction = reg.factions.get(f)!;
      ctrl.useAbility(commanderUnit, faction.platoonOrder!, { target: enemy });
      expect(p.orderUsedThisRound, f).toBe(true);
    }
  });

  it("each division's passive doctrine shows up as a named, source-tracked modifier under its condition", () => {
    // Angelic Ward: +45 DEF standing beside another Celestial.
    {
      const { b } = newBattle(1);
      const lone = b.spawn("ANG_FOOT_LAMPBEARER-CHORISTER", "A", { q: 5, r: 5 });
      const alone = computeStat(b, lone, "DEF");
      expect(alone.modifiers.map((m) => m.source)).not.toContain("Angelic Ward");
      const friend = b.spawn("ANG_SECOND_WARDING-SERAPH", "A", { q: 6, r: 5 });
      const warded = computeStat(b, lone, "DEF");
      const ward = warded.modifiers.find((m) => m.source === "Angelic Ward");
      // A same-theme neighbour also trips Theme Cohesion, so isolate this doctrine's own line rather
      // than compare final totals across the two calls.
      expect(ward?.value).toBe(45);
      void friend;
    }
    // Ashen Toll: +90 ATK against enemy leaders and elites specifically.
    {
      const { b } = newBattle(2);
      const dem = b.spawn("DEM_FOOT_CINDER-IMP", "A", { q: 5, r: 5 });
      const grunt = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
      const elite = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 5, r: 6 });
      const vsGrunt = computeStat(b, dem, "ATK", { attacker: dem, defender: grunt });
      const vsElite = computeStat(b, dem, "ATK", { attacker: dem, defender: elite });
      expect(vsGrunt.modifiers.map((m) => m.source)).not.toContain("Ashen Toll");
      expect(vsElite.modifiers.map((m) => m.source)).toContain("Ashen Toll");
      expect(vsElite.final).toBe(vsGrunt.final + 90);
    }
    // No Second Plan: unconditional +70 ATK on the attack.
    {
      const { b } = newBattle(3);
      const raider = b.spawn("CHR_FOOT_BROKEN-BANNER-OUTRIDER", "A", { q: 5, r: 5 });
      const foe = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
      const atk = computeStat(b, raider, "ATK", { attacker: raider, defender: foe });
      expect(atk.modifiers.map((m) => m.source)).toContain("No Second Plan");
    }
    // Mortal Weight: unconditional +50 DEF, no attack context required.
    {
      const { b } = newBattle(4);
      const scion = b.spawn("DMG_FOOT_GODTOUCHED-SCION", "A", { q: 5, r: 5 });
      expect(computeStat(b, scion, "DEF").modifiers.map((m) => m.source)).toContain("Mortal Weight");
    }
    // Starveling Bite: +90 ATK against foot soldiers, none against an elite.
    {
      const { b } = newBattle(5);
      const wen = b.spawn("WEN_FOOT_STARVELING", "A", { q: 5, r: 5 });
      const foot = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
      const elite = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 5, r: 6 });
      expect(computeStat(b, wen, "ATK", { attacker: wen, defender: foot }).modifiers.map((m) => m.source)).toContain("Starveling Bite");
      expect(computeStat(b, wen, "ATK", { attacker: wen, defender: elite }).modifiers.map((m) => m.source)).not.toContain("Starveling Bite");
    }
    // Lone Hunt: +80 ATK against an isolated target only.
    {
      const { b } = newBattle(6);
      const sas = b.spawn("SAS_FOOT_PINE-SHADOW", "A", { q: 5, r: 5 });
      const isolated = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 9, r: 9 });
      const escorted = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
      b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 7, r: 5 });
      expect(computeStat(b, sas, "ATK", { attacker: sas, defender: isolated }).modifiers.map((m) => m.source)).toContain("Lone Hunt");
      expect(computeStat(b, sas, "ATK", { attacker: sas, defender: escorted }).modifiers.map((m) => m.source)).not.toContain("Lone Hunt");
    }
    // One Will: +40 DEF once two Swarm allies stand adjacent, not before.
    {
      const { b } = newBattle(7);
      const drone = b.spawn("FMC_FOOT_SOLDIER-DRONE", "A", { q: 5, r: 5 });
      b.spawn("FMC_LEVY_WORKER-DRONE", "A", { q: 6, r: 5 });
      const withOne = computeStat(b, drone, "DEF");
      expect(withOne.modifiers.map((m) => m.source)).not.toContain("One Will");
      b.spawn("FMC_LEVY_WORKER-DRONE", "A", { q: 5, r: 6 });
      const withTwo = computeStat(b, drone, "DEF");
      const oneWill = withTwo.modifiers.find((m) => m.source === "One Will");
      // A second Swarm neighbour also deepens Theme Cohesion, so isolate this doctrine's own line.
      expect(oneWill?.value).toBe(40);
    }
  });

  it("Judgement Hymn rallies the whole platoon's morale, not just the caller's", () => {
    const bp = divisionBlueprint("ANG");
    const { b, ctrl } = newBattle(20);
    const p = deployPlatoon(b, { id: "ANG-1", side: "A", faction: "ANG", commander: bp.commander, second: bp.second, elite: bp.elite, foot: Array(5).fill(bp.foot) }, blob(5, 5));
    ctrl.commandPhase();
    ctrl.beginActivation("ANG-1");
    const commander = b.units.get(p.commanderUid!)!;
    const footUnit = b.units.get(p.footUids[0]!)!;
    commander.morale = 40; footUnit.morale = 40;
    ctrl.useAbility(commander, "ORD_JUDGEMENT_HYMN");
    expect(commander.morale).toBe(70);
    expect(footUnit.morale).toBe(70);
  });

  it("Crawling Cold slows every enemy near the caller and leaves distant ones alone", () => {
    const bp = divisionBlueprint("WEN");
    const { b, ctrl } = newBattle(21);
    const p = deployPlatoon(b, { id: "WEN-1", side: "A", faction: "WEN", commander: bp.commander, second: bp.second, elite: bp.elite, foot: Array(5).fill(bp.foot) }, blob(5, 5));
    ctrl.commandPhase();
    ctrl.beginActivation("WEN-1");
    const commander = b.units.get(p.commanderUid!)!;
    const near = b.spawn(bp.foot, "B", { q: 5, r: 2 });
    const far = b.spawn(bp.foot, "B", { q: 20, r: 15 });
    const nearBefore = ctrl.movementAllowance(near), farBefore = ctrl.movementAllowance(far);
    ctrl.useAbility(commander, "ORD_CRAWLING_COLD", { target: near });
    expect(ctrl.movementAllowance(near)).toBe(nearBefore - 2);
    expect(ctrl.movementAllowance(far)).toBe(farBefore);
  });

  it("a broken division platoon cannot issue its order until it is whole again", () => {
    const bp = divisionBlueprint("FMC");
    const { b, ctrl } = newBattle(22);
    const p = deployPlatoon(b, { id: "FMC-1", side: "A", faction: "FMC", commander: bp.commander, second: bp.second, elite: bp.elite, foot: Array(5).fill(bp.foot) }, blob(5, 5));
    for (const uid of p.footUids) b.units.get(uid)!.defeated = true;
    b.units.get(p.eliteUid!)!.defeated = true;
    expect(doctrineState(b, p)).toBe("Broken");
    ctrl.commandPhase();
    ctrl.beginActivation("FMC-1");
    const commander = b.units.get(p.commanderUid!)!;
    const enemy = b.spawn(bp.foot, "B", { q: 9, r: 5 });
    expect(() => ctrl.useAbility(commander, "ORD_SWARM_CONVERGENCE", { target: enemy })).toThrow(/Platoon Order requires Platoon Doctrine/);
  });
});
