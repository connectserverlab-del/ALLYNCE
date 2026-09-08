import type { Battle } from "./state.js";
import type { UnitState, AbilityDef, PlatoonState, Modifier, Status, Terrain } from "./types.js";
import type { Hex } from "./hex.js";
import { hexNeighbors, hexKey, hexDistance } from "./hex.js";
import { platoonMorale, platoonMembers, tempPreventRouted, changeMorale } from "./morale.js";
import { addTempMod } from "./modifiers.js";
import { computeStat } from "./modifiers.js";
import { applyDamage } from "./combat.js";
import { commandRadiusOf } from "./ranks.js";

export interface EffectContext { platoon?: PlatoonState; target?: UnitState; targetHex?: { q: number; r: number } }

/** Rooted units cannot move; the counter ticks down in the End Phase. */
export const rooted = new Map<string, number>();
/** While set, that side ignores Hidden entirely for the remaining rounds. */
export const revealAllRounds = new Map<string, number>();

/** End-of-round upkeep for the expansion effect kinds. */
export function tickExpansionEffects(): void {
  for (const [uid, n] of rooted) { if (n <= 1) rooted.delete(uid); else rooted.set(uid, n - 1); }
  for (const [side, n] of revealAllRounds) { if (n <= 1) revealAllRounds.delete(side); else revealAllRounds.set(side, n - 1); }
}

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

    /* ---------------------------------------------- expansion effect kinds */
    case "Smite": {
      if (!ctx.target) return false;
      applyDamage(b, ctx.target, e.damage, ability.name);
      b.log("Ability", { ability: ability.id, uid: user.uid, target: ctx.target.uid, damage: e.damage });
      return true;
    }
    case "Execute": {
      if (!ctx.target) return false;
      const max = b.def(ctx.target).hp;
      const lethal = ctx.target.hp <= max * (e.threshold / 100);
      applyDamage(b, ctx.target, lethal ? ctx.target.hp + max : e.damage, ability.name);
      b.log("Ability", { ability: ability.id, uid: user.uid, target: ctx.target.uid, executed: lethal });
      return true;
    }
    case "MultiStrike": {
      const targets = b.adjacentEnemies(user).slice(0, e.strikes);
      if (!targets.length) return false;
      const atk = computeStat(b, user, "ATK", { attacker: user }).final;
      for (let i = 0; i < e.strikes; i++) {
        const t = targets[i % targets.length];
        if (!t || t.defeated) continue;
        const def = computeStat(b, t, "DEF", { attacker: user, defender: t }).final;
        applyDamage(b, t, Math.max(100, Math.round(atk * (e.atkPercent / 100)) - def), ability.name);
      }
      b.log("Ability", { ability: ability.id, uid: user.uid, strikes: e.strikes });
      return true;
    }
    case "ChainLightning": {
      if (!ctx.target) return false;
      let current = ctx.target;
      const hit = new Set<string>();
      applyDamage(b, current, e.damage, ability.name);
      hit.add(current.uid);
      for (let j = 0; j < e.jumps; j++) {
        const next = [...b.activeUnits()].find((x) => x.side !== user.side && !hit.has(x.uid) && b.distance(current, x) <= 2);
        if (!next) break;
        applyDamage(b, next, e.damage, ability.name);
        hit.add(next.uid);
        current = next;
      }
      b.log("Ability", { ability: ability.id, uid: user.uid, arcs: hit.size });
      return true;
    }
    case "ConeDamage": {
      if (!user.pos) return false;
      let n = 0;
      for (const en of b.activeUnits()) {
        if (en.side === user.side || !en.pos) continue;
        if (hexDistance(user.pos, en.pos) <= e.length) { applyDamage(b, en, e.damage, ability.name); n++; }
      }
      b.log("Ability", { ability: ability.id, uid: user.uid, hit: n });
      return n > 0;
    }
    case "Judgement": {
      if (!user.pos) return false;
      let n = 0;
      for (const en of [...b.activeUnits()]) {
        if (en.side === user.side || !en.pos) continue;
        if (hexDistance(user.pos, en.pos) > e.radius) continue;
        applyDamage(b, en, e.damage, ability.name);
        if (e.moraleShock) changeMorale(b, en, e.moraleShock, ability.name);
        if (!en.defeated && e.blind) b.addStatus(en, "Exposed", 1, ability.name);
        n++;
      }
      b.log("Ability", { ability: ability.id, uid: user.uid, hit: n });
      return n > 0;
    }
    case "Heal": {
      const t = ctx.target ?? user;
      t.hp = Math.min(b.def(t).hp, t.hp + e.amount);
      b.log("Healed", { uid: t.uid, by: user.uid, amount: e.amount });
      return true;
    }
    case "Resurrect": {
      const fallen = [...b.units.values()].filter((x) => x.defeated && x.side === user.side && !x.isClone).slice(0, e.count);
      if (!fallen.length || !user.pos) return false;
      const free = hexNeighbors(user.pos).filter((h) => b.isFree(h));
      let n = 0;
      for (const f of fallen) {
        const h = free[n];
        if (!h) break;
        f.defeated = false;
        f.hp = Math.round(b.def(f).hp * (e.hpPercent / 100));
        f.statuses = [];
        b.place(f, h);
        n++;
      }
      b.log("Resurrected", { by: user.uid, count: n });
      return n > 0;
    }
    case "Cleanse": {
      const bad: Status[] = ["Exposed", "Suppressed", "Silenced", "Routed", "Unstable", "Revealed"];
      let n = 0;
      for (const a of b.activeUnits(user.side)) {
        if (b.distance(user, a) > (e.radius ?? 0)) continue;
        for (const s of bad) b.removeStatus(a, s);
        n++;
      }
      b.log("Ability", { ability: ability.id, uid: user.uid, cleansed: n });
      return n > 0;
    }
    case "ApplyStatus": {
      const targets = e.radius
        ? [...b.activeUnits()].filter((x) => x.side !== user.side && b.distance(user, x) <= e.radius)
        : ctx.target ? [ctx.target] : [];
      for (const t of targets) b.addStatus(t, e.status as Status, e.rounds, ability.name);
      return targets.length > 0;
    }
    case "Ward": {
      const targets = e.radius
        ? [...b.activeUnits(user.side)].filter((x) => b.distance(user, x) <= e.radius)
        : [user];
      for (const t of targets) addTempMod(t, { source: ability.name, stat: "DEF", value: e.def });
      if (e.immovable) rooted.delete(user.uid);
      b.log("Ability", { ability: ability.id, uid: user.uid, warded: targets.length });
      return true;
    }
    case "Root": {
      const targets = e.radius
        ? [...b.activeUnits()].filter((x) => x.side !== user.side && b.distance(user, x) <= e.radius)
        : ctx.target ? [ctx.target] : [];
      for (const t of targets) { rooted.set(t.uid, e.rounds); changeMorale(b, t, -20, ability.name); }
      b.log("Ability", { ability: ability.id, uid: user.uid, rooted: targets.length });
      return targets.length > 0;
    }
    case "Teleport": {
      if (!ctx.targetHex || !b.isFree(ctx.targetHex)) return false;
      if (user.pos && hexDistance(user.pos, ctx.targetHex) > e.range) return false;
      b.place(user, ctx.targetHex);
      if (e.thenStatus) b.addStatus(user, e.thenStatus as Status, 2, ability.name);
      b.log("Ability", { ability: ability.id, uid: user.uid, to: hexKey(ctx.targetHex) });
      return true;
    }
    case "RevealAll": {
      for (const en of b.activeUnits()) if (en.side !== user.side) b.removeStatus(en, "Hidden");
      revealAllRounds.set(user.side, e.rounds);
      b.log("Ability", { ability: ability.id, uid: user.uid });
      return true;
    }
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

/**
 * Every effect.kind the interpreter above understands, plus the passive kinds it defers to other
 * systems (see the `default` case). The Unity port scaffold and the ability-data test both read
 * this list, so a kind added to the switch above and left out here is a drift bug, not a silent gap.
 */
export const EFFECT_KINDS = [
  "RallyPlatoon", "PlatoonAtkVsTarget", "PlatoonDef", "PlatoonMove", "PreventRouted", "SpawnClones",
  "SpawnTerrain", "ChargeBonus", "MoraleShock", "GrantHideAfterAttack", "GrantStatusAdjacent",
  "FormationStep", "PhaseMove", "SequencedMove", "Duel", "SiegeSetup", "SpawnTerrainAt", "AreaShock",
  "SelfSacrificeBuff", "BandAtk", "SelfHaste", "EnemyAtkDebuff", "EnemySlow", "Surrender",
  "RitualChannel", "PortalCall", "ShadowStep",
  // Expansion kinds, interpreted by the expansion effect layer rather than applyEffect's switch.
  "ApplyStatus", "AuraStat", "Bleed", "ChainLightning", "Cleanse", "ConeDamage", "DamageReduction",
  "Execute", "Heal", "ImmuneStatus", "Judgement", "Lifesteal", "MultiStrike", "Push", "Regen",
  "Resurrect", "RevealAll", "Riposte", "Root", "Smite", "Teleport", "Thorns", "Ward",
  // Passive kinds, evaluated where relevant rather than through applyEffect's switch.
  "ConditionalDef", "ConditionalAtk", "SharedVision", "Intercept", "DenyFlyingMovement",
  "StructureAtk", "FreeMoveAfterAttack",
] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

export const hideAfterAttack = new Set<string>();
/** Terrain placed by abilities (smoke) with a lifetime in rounds. */
export const timedTerrain: Array<{ key: string; rounds: number }> = [];
export const orderFlags = new Map<string, string>();
export const duels = new Map<string, string>();
export function clearRoundEffectFlags(): void { hideAfterAttack.clear(); orderFlags.clear(); duels.clear(); tempPreventRouted.clear(); }
export type { Modifier };
