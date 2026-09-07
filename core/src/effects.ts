import type { Battle } from "./state.js";
import type { UnitState, AbilityDef, PlatoonState, Modifier } from "./types.js";
import { hexNeighbors, hexKey, hexDistance } from "./hex.js";
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
      for (const uid of platoonMembers(p)) { const m = b.units.get(uid); if (m && !m.defeated) addTempMod(m, { source: ability.name, stat: "DEF", value: e.def }); }
      return true;
    case "PlatoonMove":
      if (!p) return false;
      for (const uid of platoonMembers(p)) { const m = b.units.get(uid); if (m && !m.defeated) addTempMod(m, { source: ability.name, stat: "MOV", value: e.mov }); }
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
      const hexes = [center, ...hexNeighbors(center)].filter((h) => b.inBounds(h) && b.terrainAt(h) !== "Water" && b.terrainAt(h) !== "Mountain");
      for (const h of hexes) { if (!b.terrain.has(hexKey(h)) || b.terrainAt(h) === "Open") { b.terrain.set(hexKey(h), e.terrain); timedTerrain.push({ key: hexKey(h), rounds: e.duration }); } }
      b.log("TerrainSpawned", { terrain: e.terrain, count: hexes.length, uid: user.uid, center });
      return true;
    }
    case "AreaShock": {
      const center = ctx.targetHex ?? ctx.target?.pos; if (!center) return false;
      let hit = 0;
      for (const h of [center, ...hexNeighbors(center)]) { const v = b.unitAt(h); if (v && v.side !== user.side) { applyDamage(b, v, e.damage, ability.name); if (!v.defeated && e.status) b.addStatus(v, e.status, 1, ability.name); hit++; } }
      b.log("Ability", { ability: ability.id, uid: user.uid, hit });
      return hit > 0;
    }
    // ---- The six card skills every four-star and above carries ----
    //
    // All six are ordinary temporary modifiers, so they show up in the stat breakdown by name
    // rather than as a hidden number. Radius, where one is needed, is the ability's own range.

    case "SelfSacrificeBuff": {
      // Bleed yourself for reach. Never lethal: a unit that cannot pay the price simply cannot use it.
      const cost = Math.max(1, Math.floor(b.def(user).hp * e.hpCostShare));
      if (user.hp <= cost) return false;
      user.hp -= cost;
      addTempMod(user, { source: ability.name, stat: "ATK", value: e.atk });
      if (e.def) addTempMod(user, { source: ability.name, stat: "DEF", value: e.def });
      b.log("SelfSacrifice", { uid: user.uid, ability: ability.id, hp: cost, atk: e.atk });
      return true;
    }
    case "BandAtk": {
      // A team attack buff. The band is the platoon where there is one, and this unit plus the
      // allies standing beside it where there is not, so loose creatures get the same rule.
      const band = bandOf(b, user, p);
      for (const m of band) addTempMod(m, { source: ability.name, stat: "ATK", value: e.atk });
      b.log("Ability", { ability: ability.id, uid: user.uid, affected: band.length });
      return true;
    }
    case "SelfHaste": {
      const band = e.bandWide ? bandOf(b, user, p) : [user];
      for (const m of band) addTempMod(m, { source: ability.name, stat: "MOV", value: e.mov });
      b.log("Ability", { ability: ability.id, uid: user.uid, affected: band.length });
      return true;
    }
    case "EnemyAtkDebuff": {
      const hit = enemiesWithin(b, user, ability.range ?? 1);
      for (const t of hit) addTempMod(t, { source: ability.name, stat: "ATK", value: -Math.abs(e.atk) });
      b.log("Ability", { ability: ability.id, uid: user.uid, affected: hit.length });
      return hit.length > 0;
    }
    case "EnemySlow": {
      const hit = enemiesWithin(b, user, ability.range ?? 1);
      for (const t of hit) {
        addTempMod(t, { source: ability.name, stat: "MOV", value: -Math.abs(e.mov) });
        if (e.status) b.addStatus(t, e.status, 1, ability.name);
      }
      b.log("Ability", { ability: ability.id, uid: user.uid, affected: hit.length });
      return hit.length > 0;
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

/** The unit's fighting band: its platoon, or itself plus the allies beside it when it has none. */
export function bandOf(b: Battle, user: UnitState, p?: PlatoonState): UnitState[] {
  if (p) return platoonMembers(p).map((uid) => b.units.get(uid)).filter((m): m is UnitState => !!m && !m.defeated);
  return [user, ...b.adjacentAllies(user).filter((a) => !a.isClone)];
}

/** Live enemies within `radius` hexes of the user. */
export function enemiesWithin(b: Battle, user: UnitState, radius: number): UnitState[] {
  if (!user.pos) return [];
  return [...b.activeUnits()].filter((t) => t.side !== user.side && t.pos && hexDistance(user.pos!, t.pos) <= radius);
}

/** Reference implementation of the clone rules (Twin Echo). */
function spawnClones(b: Battle, user: UnitState, ability: AbilityDef, e: Record<string, any>): boolean {
  if (!user.pos) return false;
  if (user.isClone || (user.splitBodies ?? 1) > 1) return false;   // a copy cannot copy itself again
  const free = hexNeighbors(user.pos).filter((h) => b.isFree(h));
  if (free.length < e.count) return false;

  // The body divides. Attack and defence are shared evenly across the original and its copies, so
  // splitting buys you presence on more hexes and costs you weight on each of them. Kill the copies
  // and the original walks its share back up, which makes hunting them worth an activation.
  const bodies = e.count + 1;
  const made: string[] = [];
  for (let i = 0; i < e.count; i++) {
    const c = b.spawn(user.defId, user.side, null, { platoonId: null, facing: user.facing, uidPrefix: "clone" });
    c.isClone = true; c.cloneOf = user.uid; c.cloneRoundsLeft = e.duration; c.splitBodies = bodies; c.hp = e.hp; c.morale = 0;
    b.place(c, free[i]!);
    made.push(c.uid);
  }
  user.splitBodies = bodies;
  b.log("ClonesSpawned", { uid: user.uid, clones: made, bodies, share: `1/${bodies}`, duration: e.duration });
  return true;
}

export const hideAfterAttack = new Set<string>();
/** Terrain placed by abilities (smoke) with a lifetime in rounds. */
export const timedTerrain: Array<{ key: string; rounds: number }> = [];
export const orderFlags = new Map<string, string>();
export const duels = new Map<string, string>();
export function clearRoundEffectFlags(): void { hideAfterAttack.clear(); orderFlags.clear(); duels.clear(); tempPreventRouted.clear(); }
export type { Modifier };
