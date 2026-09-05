import type { Battle } from "./state.js";
import type { UnitState, AbilityDef, PlatoonState, Modifier, Terrain } from "./types.js";
import type { Hex } from "./hex.js";
import { hexNeighbors, hexKey } from "./hex.js";
import { platoonMorale, platoonMembers, tempPreventRouted, changeMorale } from "./morale.js";
import { addTempMod } from "./modifiers.js";
import { computeStat } from "./modifiers.js";
import { applyDamage } from "./combat.js";
import { commandRadiusOf } from "./ranks.js";

export interface EffectContext { platoon?: PlatoonState; target?: UnitState; targetHex?: { q: number; r: number } }

/**
 * Generic effect interpreter. Abilities are data; each `effect.kind` maps to one handler here.
 * Magic, orders and physical abilities all flow through this same framework.
 */
export function applyEffect(b: Battle, user: UnitState, ability: AbilityDef, ctx: EffectContext = {}): boolean {
  const e = ability.effect as Record<string, any>;
  const p = ctx.platoon ?? (user.platoonId ? b.platoon(user.platoonId) : undefined);
  switch (e.kind) {
    case "RallyPlatoon":
      if (p) platoonMorale(b, p, e.morale, ability.name);
      return true;
    case "PlatoonAtkVsTarget":
      if (!p || !ctx.target) return false;
      p.markedTarget = { uid: ctx.target.uid, atk: e.atk };
      b.log("Ability", { ability: ability.id, uid: user.uid, target: ctx.target.uid });
      return true;
    case "PlatoonDef":
      if (!p) return false;
      applyPlatoonTempMod(b, p, "DEF", e.def, ability.name);
      return true;
    case "PlatoonMove":
      if (!p) return false;
      applyPlatoonTempMod(b, p, "MOV", e.mov, ability.name);
      return true;
    case "PreventRouted": {
      const radius = commandRadiusOf(b, user);
      for (const a of b.activeUnits(user.side)) if (b.distance(user, a) <= radius) { tempPreventRouted.add(a.uid); b.removeStatus(a, "Routed"); }
      b.log("Ability", { ability: ability.id, uid: user.uid });
      return true;
    }
    case "SpawnClones": return spawnClones(b, user, ability, e);
    case "SpawnTerrain": {
      if (!user.pos) return false;
      let n = 0;
      for (const h of hexNeighbors(user.pos)) { if (n >= e.hexes) break; if (b.inBounds(h) && b.terrainAt(h) === "Open") { b.terrain.set(hexKey(h), e.terrain); n++; } }
      b.log("TerrainSpawned", { terrain: e.terrain, count: n, uid: user.uid });
      return n > 0;
    }
    case "ChargeBonus": {
      if (user.chargeMoved < e.minHexesMoved || user.usedChargeLastRound) return false;
      addTempMod(user, { source: ability.name, stat: "ATK", value: e.atk });
      user.usedChargeLastRound = true;
      if (e.thenStatus) b.addStatus(user, e.thenStatus, 1, ability.name);
      b.log("Ability", { ability: ability.id, uid: user.uid });
      return true;
    }
    case "MoraleShock":
      for (const en of b.adjacentEnemies(user)) changeMorale(b, en, e.morale, ability.name);
      return true;
    case "GrantHideAfterAttack":
      if (!ctx.target) return false;
      addTempMod(ctx.target, { source: ability.name, stat: "RANGE", value: 0 }); // marker; consumed by combat
      hideAfterAttack.add(ctx.target.uid);
      return true;
    case "GrantStatusAdjacent": {
      const theme = b.reg.factions.get(b.def(user).faction)?.primaryTheme;
      for (const a of [user, ...b.adjacentAllies(user)]) if (!a.isClone && (!theme || b.def(a).themes.includes(theme))) b.addStatus(a, e.status, 1, ability.name);
      return true;
    }
    case "FormationStep": {
      if (!p) return false;
      for (const uid of platoonMembers(p)) { const m = b.units.get(uid); if (m && !m.defeated) addTempMod(m, { source: ability.name, stat: "ATK", value: e.atkNextMelee }); }
      b.log("Ability", { ability: ability.id, uid: user.uid });
      return true;
    }
    case "PhaseMove":
    case "SequencedMove":
      if (!p) return false;
      for (const uid of platoonMembers(p)) { const m = b.units.get(uid); if (m && !m.defeated) orderFlags.set(m.uid, e.kind); }
      if (e.atkVsIsolatedGround) for (const uid of platoonMembers(p)) { const m = b.units.get(uid); if (m && !m.defeated) addTempMod(m, { source: ability.name, stat: "ATK", value: e.atkVsIsolatedGround }); }
      b.log("Ability", { ability: ability.id, uid: user.uid });
      return true;
    case "Duel":
      if (!ctx.target) return false;
      duels.set(user.uid, ctx.target.uid); duels.set(ctx.target.uid, user.uid);
      b.log("Ability", { ability: ability.id, uid: user.uid, target: ctx.target.uid });
      return true;
    case "SiegeSetup":
      user.setUp = true; b.log("SiegeSetup", { uid: user.uid }); return true;
    case "SpawnTerrainAt": {
      const center = ctx.targetHex ?? ctx.target?.pos; if (!center) return false;
      const count = spawnTerrainArea(b, center, e.terrain, e.duration);
      b.log("TerrainSpawned", { terrain: e.terrain, count, uid: user.uid, center });
      return true;
    }
    case "AreaShock": {
      const center = ctx.targetHex ?? ctx.target?.pos; if (!center) return false;
      let hit = 0;
      for (const h of [center, ...hexNeighbors(center)]) { const v = b.unitAt(h); if (v && v.side !== user.side) { applyDamage(b, v, e.damage, ability.name); if (!v.defeated && e.status) b.addStatus(v, e.status, 1, ability.name); hit++; } }
      b.log("Ability", { ability: ability.id, uid: user.uid, hit });
      return hit > 0;
    }
    case "Surrender": {
      const side = b.sides.get(user.side)!; side.surrendered = true; b.log("Surrender", { side: user.side, by: user.uid }); return true;
    }
    case "RitualChannel":
    case "PortalCall":
    case "ShadowStep":
      return true; // handled by ritual / portal managers through the action layer
    default:
      // Passive kinds (ConditionalDef/Atk, SharedVision, Intercept, DenyFlyingMovement) are evaluated where relevant.
      return true;
  }
}

/** Reference implementation of the clone rules (Twin Echo). */
function spawnClones(b: Battle, user: UnitState, ability: AbilityDef, e: Record<string, any>): boolean {
  if (!user.pos) return false;
  const free = hexNeighbors(user.pos).filter((h) => b.isFree(h));
  if (free.length < e.count) return false;
  const atk = Math.floor(computeStat(b, user, "ATK").final * (e.atkPercent / 100));
  const made: string[] = [];
  for (let i = 0; i < e.count; i++) {
    const c = b.spawn(user.defId, user.side, null, { platoonId: null, facing: user.facing, uidPrefix: "clone" });
    c.isClone = true; c.cloneOf = user.uid; c.cloneRoundsLeft = e.duration; c.cloneAtk = atk; c.hp = e.hp; c.morale = 0;
    b.place(c, free[i]!);
    made.push(c.uid);
  }
  b.log("ClonesSpawned", { uid: user.uid, clones: made, atk, duration: e.duration });
  return true;
}

/** Apply the same temporary modifier to every living member of a platoon. Cleared at the next Command Phase. */
export function applyPlatoonTempMod(b: Battle, p: PlatoonState, stat: "ATK" | "DEF" | "MOV", value: number, source: string): void {
  for (const uid of platoonMembers(p)) { const m = b.units.get(uid); if (m && !m.defeated) addTempMod(m, { source, stat, value }); }
}

/** Turn a hex and its neighbors into the named terrain for a number of rounds, skipping Water and Mountain. */
export function spawnTerrainArea(b: Battle, center: Hex, terrain: Terrain, duration: number): number {
  const hexes = [center, ...hexNeighbors(center)].filter((h) => b.inBounds(h) && b.terrainAt(h) !== "Water" && b.terrainAt(h) !== "Mountain");
  let n = 0;
  for (const h of hexes) { if (!b.terrain.has(hexKey(h)) || b.terrainAt(h) === "Open") { b.terrain.set(hexKey(h), terrain); timedTerrain.push({ key: hexKey(h), rounds: duration }); n++; } }
  return n;
}

export const hideAfterAttack = new Set<string>();
/** Terrain placed by abilities (smoke) with a lifetime in rounds. */
export const timedTerrain: Array<{ key: string; rounds: number }> = [];
export const orderFlags = new Map<string, string>();
export const duels = new Map<string, string>();
export function clearRoundEffectFlags(): void { hideAfterAttack.clear(); orderFlags.clear(); duels.clear(); tempPreventRouted.clear(); }
export type { Modifier };
