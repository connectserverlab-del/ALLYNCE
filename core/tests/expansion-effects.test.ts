import { describe, it, expect, beforeEach } from "vitest";
import { newBattle } from "./helpers.js";
import { computeStat } from "../src/modifiers.js";
import { resolveAttack } from "../src/combat.js";
import { applyEffect, rooted, revealAllRounds } from "../src/effects.js";
import { reg } from "./helpers.js";

beforeEach(() => { rooted.clear(); revealAllRounds.clear(); });

describe("expansion effect kinds", () => {
  it("AuraStat is projected by the ally, does not stack with itself, and respects radius", () => {
    const { b } = newBattle();
    // Oathlight: allies within 2 gain +75 DEF.
    const source = b.spawn("KNI_GUARD_GRAND-WARDEN-OF-THE-IVORY-KEEP", "A", { q: 5, r: 5 });
    expect(reg.unit(source.defId).passives).toContain("ABL_X_SHIELD_LINE");
    const aura = b.spawn("KNI_COMMANDER_LORD-MARSHAL-OF-THE-BLUE-FIELD", "A", { q: 6, r: 5 });
    expect(reg.unit(aura.defId).passives).toContain("ABL_X_OATHLIGHT");

    const near = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 7, r: 5 });
    const withAura = computeStat(b, near, "DEF").modifiers.find((m) => m.source === "Oathlight");
    expect(withAura?.value).toBe(75);

    const far = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 15, r: 15 });
    expect(computeStat(b, far, "DEF").modifiers.find((m) => m.source === "Oathlight")).toBeUndefined();

    // A second Oathlight carrier in range must not stack.
    b.spawn("KNI_ELITE_THE-VOW-KEPT-PALADIN", "A", { q: 8, r: 5 });
    const stacked = computeStat(b, near, "DEF").modifiers.filter((m) => m.source === "Oathlight");
    expect(stacked.length).toBe(1);
  });

  it("Thornward returns damage to melee attackers and Scaled Hide reduces incoming damage", () => {
    const { b } = newBattle();
    const thorny = b.spawn("THC_GUARD_ROOT-CELLAR-WARDEN", "B", { q: 5, r: 5 });
    const attacker = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 6, r: 5 });
    const before = attacker.hp;
    resolveAttack(b, attacker, thorny);
    expect(before - attacker.hp).toBe(200);

    const { b: b2 } = newBattle();
    const scaled = b2.spawn("DRG_WING_SLATE-RIDGE-DRAKE", "B", { q: 5, r: 5 });
    const plain = b2.spawn("DRG_WING_SCREE-WYRMLING", "B", { q: 5, r: 6 });
    const hitter = b2.spawn("SAM_ELITE_ONI-GATE-CHAMPION", "A", { q: 6, r: 5 });
    const dmgScaled = resolveAttack(b2, hitter, scaled).damage;
    hitter.attackedThisActivation = false;
    const dmgPlain = resolveAttack(b2, hitter, plain).damage;
    // Same attacker; the difference is the drake's own DEF plus the flat 150 reduction.
    expect(dmgScaled).toBeLessThan(dmgPlain);
  });

  it("Root stops movement until it expires and Judgement damages every enemy in radius", () => {
    const { b, ctrl } = newBattle();
    const witch = b.spawn("THC_MAGE_SNARE-WITCH", "A", { q: 5, r: 5 });
    const victim = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 7, r: 5 });
    victim.ap = 2;
    applyEffect(b, witch, reg.ability("ABL_X_BRIAR_SNARE"), { target: victim });
    expect(rooted.has(victim.uid)).toBe(true);
    expect(() => ctrl.move(victim, { q: 8, r: 5 })).toThrow(/rooted/);

    const seraph = b.spawn("ANG_MAGE_THE-SERAPH-OF-SIX-WINGS", "A", { q: 6, r: 5 });
    const hpBefore = victim.hp;
    applyEffect(b, seraph, reg.ability("ABL_S_SIX_WINGS_ONE_VOICE"));
    expect(victim.hp).toBeLessThan(hpBefore);
  });

  it("an Ascendant staggers at zero hit points instead of dying", () => {
    const { b } = newBattle();
    const god = b.spawn("SAM_COMMANDER_THE-HUNDRED-PROVINCE-SHOGUN", "B", { q: 5, r: 5 });
    expect(god.divine?.anchors).toBeGreaterThan(0);
    god.hp = 1;
    const attacker = b.spawn("SAM_ELITE_ONI-GATE-CHAMPION", "A", { q: 6, r: 5 });
    const r = resolveAttack(b, attacker, god);
    expect(r.defeated).toBe(false);
    expect(r.staggered).toBe(true);
    expect(god.hp).toBeGreaterThan(0);
  });
});
