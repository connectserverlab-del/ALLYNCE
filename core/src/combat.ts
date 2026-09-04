import type { Battle } from "./state.js";
import type { UnitState } from "./types.js";
import { computeStat, arcFor, clearTempMods } from "./modifiers.js";
import { onUnitDefeated } from "./command.js";
import { duels, hideAfterAttack } from "./effects.js";
import { onRitualistDamaged } from "./rituals.js";
import { changeMorale } from "./morale.js";

export interface AttackResult { damage: number; atk: number; def: number; arc: string; defeated: boolean; intercepted?: string; staggered?: boolean }

export const MIN_DAMAGE = 100;

/** Damage = max(100, FinalATK - FinalDEF). Integer math, deterministic. */
export function resolveAttack(b: Battle, attacker: UnitState, target: UnitState, opts: { ranged?: boolean } = {}): AttackResult {
  // Formal Duel: outsiders cannot attack a dueling pair
  const dueling = duels.get(target.uid);
  if (dueling && dueling !== attacker.uid) throw new Error("Target is in a Formal Duel; other units cannot interfere");

  // Oath of Intercession: a Knight adjacent to the target may take the melee hit once per round
  let defender = target;
  let intercepted: string | undefined;
  if (!opts.ranged) {
    const knight = b.adjacentAllies(target).find((k) => !k.isClone && b.def(k).themes.includes("Knight") && !interceptUsed.has(k.uid) && k.uid !== target.uid && b.def(k).roles.includes("FootSoldier") === false && b.hasStatus(k, "Guarded"));
    if (knight) { defender = knight; intercepted = knight.uid; interceptUsed.add(knight.uid); }
  }

  const arc = arcFor(b, attacker, defender);
  const atk = computeStat(b, attacker, "ATK", { attacker, defender, arc, ranged: opts.ranged }).final;
  const def = computeStat(b, defender, "DEF", { attacker, defender, arc, ranged: opts.ranged }).final;
  const damage = Math.max(MIN_DAMAGE, atk - def);
  const result = applyDamage(b, defender, damage, attacker.uid);
  attacker.attackedThisActivation = true;
  attacker.overwatch = false;
  // consume one-shot melee bonuses (Measured Advance / charges)
  clearTempMods(attacker, (m) => m.stat === "ATK" && (m.source === "Measured Advance" || m.source === "Diving Charge" || m.source === "Crushing Dive"));
  if (hideAfterAttack.has(attacker.uid)) { b.addStatus(attacker, "Hidden", 2, "Silent Directive"); hideAfterAttack.delete(attacker.uid); }
  if (b.hasStatus(attacker, "Hidden")) b.addStatus(attacker, "Revealed", 0, "Attacked");
  b.log("Attack", { attacker: attacker.uid, target: defender.uid, atk, def, arc, damage, defeated: result.defeated, intercepted });
  return { damage, atk, def, arc, ...result, intercepted };
}

export const interceptUsed = new Set<string>();

export function applyDamage(b: Battle, u: UnitState, damage: number, source: string): { defeated: boolean; staggered?: boolean } {
  u.hp -= damage;
  onRitualistDamaged(b, u);
  if (u.hp > 0) return { defeated: false };
  // Divine Entities stagger at 0 HP; permanent removal requires breaking every Anchor
  if (u.divine) {
    if (u.divine.anchors > 0) { u.hp = Math.floor(b.def(u).hp / 2); b.log("DivineStaggered", { uid: u.uid, anchorsLeft: u.divine.anchors }); return { defeated: false, staggered: true }; }
  }
  defeat(b, u, source);
  return { defeated: true };
}

export function defeat(b: Battle, u: UnitState, source: string): void {
  u.hp = 0; u.defeated = true;
  b.remove(u);
  b.log("Defeated", { uid: u.uid, def: u.defId, by: source, clone: u.isClone });
  onUnitDefeated(b, u);
}

/** Destroy one Anchor of a Divine Entity: reduces stats/abilities; at zero anchors and 0 HP it is banished. */
export function breakAnchor(b: Battle, u: UnitState, by: string): void {
  if (!u.divine) return;
  u.divine.anchors = Math.max(0, u.divine.anchors - 1);
  b.log("AnchorBroken", { uid: u.uid, anchorsLeft: u.divine.anchors, by });
  for (const en of b.activeUnits()) if (en.side !== u.side) changeMorale(b, en, 5, "Anchor broken");
  if (u.divine.anchors === 0 && u.hp <= 0) defeat(b, u, by);
}
