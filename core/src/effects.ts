import type { Battle } from "./state.js";
import type { UnitState, AbilityDef, PlatoonState, Modifier, Status } from "./types.js";
import { hexNeighbors, hexKey, hexDistance } from "./hex.js";
import { applyDamage } from "./combat.js";
import { platoonMorale, platoonMembers, tempPreventRouted, changeMorale } from "./morale.js";
import { addTempMod } from "./modifiers.js";
import { computeStat } from "./modifiers.js";

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
      for (const uid of platoonMembers(p)) { const m = b.units.get(uid); if (m && !m.defeated) addTempMod(m, { source: ability.name, stat: "DEF", value: e.def }); }
      return true;
    case "PlatoonMove":
      if (!p) return false;
      for (const uid of platoonMembers(p)) { const m = b.units.get(uid); if (m && !m.defeated) addTempMod(m, { source: ability.name, stat: "MOV", value: e.mov }); }
      return true;
    case "PreventRouted": {
      const radius = b.def(user).commandRadius ?? 0;
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
      if (user.movedThisActivation < e.minHexesMoved || user.usedChargeLastRound) return false;
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
    case "RitualChannel":
    case "PortalCall":
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

export const hideAfterAttack = new Set<string>();
export const orderFlags = new Map<string, string>();
export const duels = new Map<string, string>();
export function clearRoundEffectFlags(): void { hideAfterAttack.clear(); orderFlags.clear(); duels.clear(); tempPreventRouted.clear(); }
export type { Modifier };
