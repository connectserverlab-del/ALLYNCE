import { describe, it, expect } from "vitest";
import { reg, newBattle } from "./helpers.js";
import { computeStat } from "../src/modifiers.js";

/** Two facing units with AP in hand, no platoon geometry in the way. */
function facingOff(mineId: string, theirsId = "KNI_FOOT_BASTION-MAN-AT-ARMS", seed = 7) {
  const { b, ctrl } = newBattle(seed);
  const mine = b.spawn(mineId, "A", { q: 5, r: 5 });
  const theirs = b.spawn(theirsId, "B", { q: 6, r: 5 });
  ctrl.commandPhase();
  ctrl.beginActivation("ind:A");
  return { b, ctrl, mine, theirs };
}

describe("every card that can carry a skill does", () => {
  it("gives every four-star and above an ability it can actually spend an action on", () => {
    const naked: string[] = [];
    for (const d of reg.units.values()) {
      if ((d.stars ?? 1) < 4) continue;
      const usable = d.actives.filter((id) => reg.ability(id).apCost !== undefined);
      if (!usable.length) naked.push(d.id);
    }
    expect(naked).toEqual([]);
  });

  it("covers all six skill kinds across the roster", () => {
    const kinds = new Set<string>();
    for (const d of reg.units.values()) for (const id of d.actives) kinds.add(reg.ability(id).effect.kind);
    for (const k of ["SelfSacrificeBuff", "SelfHaste", "BandAtk", "EnemyAtkDebuff", "EnemySlow", "SpawnClones"])
      expect(kinds, k).toContain(k);
  });
});

describe("the six skills", () => {
  it("self-damage buff pays health for reach, and never pays a price it cannot afford", () => {
    const { b, ctrl, mine } = facingOff("DEM_SECOND_FLENSING-TORMENTOR");
    const before = computeStat(b, mine, "ATK").final;
    const maxHp = b.def(mine).hp;
    ctrl.useAbility(mine, "ABL_BLOOD_OFFERING");
    expect(mine.hp).toBe(maxHp - Math.floor(maxHp * 0.15));
    expect(computeStat(b, mine, "ATK").final).toBe(before + 450);
    // the breakdown names the source rather than hiding the number
    expect(computeStat(b, mine, "ATK").modifiers.map((m) => m.source)).toContain("Blood Offering");

    mine.hp = 1;
    mine.cooldowns = {};
    expect(() => ctrl.useAbility(mine, "ABL_BLOOD_OFFERING")).toThrow();
    expect(mine.hp).toBe(1);
  });

  it("haste raises this unit's movement allowance", () => {
    const { ctrl, mine } = facingOff("DMG_FOOT_GODTOUCHED-SCION");
    const before = ctrl.movementAllowance(mine);
    ctrl.useAbility(mine, "ABL_SECOND_WIND");
    expect(ctrl.movementAllowance(mine)).toBe(before + 3);
  });

  it("a band-wide haste carries the allies standing beside it", () => {
    const { b, ctrl, mine } = facingOff("SAS_SECOND_RIDGE-WALKER");
    const friend = b.spawn("SAS_FOOT_PINE-SHADOW", "A", { q: 5, r: 4 });
    const far = b.spawn("SAS_FOOT_PINE-SHADOW", "A", { q: 1, r: 1 });
    const friendBefore = ctrl.movementAllowance(friend), farBefore = ctrl.movementAllowance(far);
    ctrl.useAbility(mine, "ABL_RIDGE_PACE");
    expect(ctrl.movementAllowance(friend)).toBe(friendBefore + 3);
    expect(ctrl.movementAllowance(far)).toBe(farBefore);
  });

  it("a team attack buff lifts the whole band and nobody else", () => {
    const { b, ctrl, mine } = facingOff("ANG_SECOND_WARDING-SERAPH");
    const friend = b.spawn("ANG_FOOT_LAMPBEARER-CHORISTER", "A", { q: 5, r: 4 });
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 4 });
    const f0 = computeStat(b, friend, "ATK").final, e0 = computeStat(b, enemy, "ATK").final;
    ctrl.useAbility(mine, "ABL_CHOIR_OF_EDGES");
    expect(computeStat(b, friend, "ATK").final).toBe(f0 + 220);
    expect(computeStat(b, enemy, "ATK").final).toBe(e0);
  });

  it("a damage debuff drops enemy attack inside its radius only", () => {
    const { b, ctrl, mine, theirs } = facingOff("ANG_ELITE_SWORD-OF-THE-SEVENTH-GATE");
    const far = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 12, r: 5 });
    const near0 = computeStat(b, theirs, "ATK").final, far0 = computeStat(b, far, "ATK").final;
    ctrl.useAbility(mine, "ABL_JUDGEMENT_WEIGHT");   // range 2
    expect(computeStat(b, theirs, "ATK").final).toBe(near0 - 300);
    expect(computeStat(b, far, "ATK").final).toBe(far0);
  });

  it("a slow cuts enemy movement and leaves allies alone", () => {
    const { b, ctrl, mine, theirs } = facingOff("DEM_ELITE_PIT-COLONEL");
    const ally = b.spawn("DEM_FOOT_CINDER-IMP", "A", { q: 5, r: 4 });
    const t0 = ctrl.movementAllowance(theirs), a0 = ctrl.movementAllowance(ally);
    ctrl.useAbility(mine, "ABL_TAR_THE_GROUND");
    expect(ctrl.movementAllowance(theirs)).toBe(t0 - 3);
    expect(ctrl.movementAllowance(ally)).toBe(a0);
  });

  it("clone jutsu puts copies on the board at a share of the original's attack", () => {
    const { b, ctrl, mine } = facingOff("CHR_ELITE_WARP-HERALD");
    const real = computeStat(b, mine, "ATK").final;
    ctrl.useAbility(mine, "ABL_SPLIT_THE_SELF");
    const clones = [...b.activeUnits("A")].filter((u) => u.isClone);
    expect(clones).toHaveLength(2);
    for (const c of clones) {
      expect(c.cloneOf).toBe(mine.uid);
      expect(c.hp).toBe(1);
      expect(computeStat(b, c, "ATK").final).toBe(Math.floor(real * 0.5));
    }
  });

  it("the swarm splits three ways at two fifths force", () => {
    const { b, ctrl, mine } = facingOff("FMC_ELITE_MYRMIDON-VANGUARD");
    ctrl.useAbility(mine, "ABL_SWARM_SPLIT");
    expect([...b.activeUnits("A")].filter((u) => u.isClone)).toHaveLength(3);
  });
});
