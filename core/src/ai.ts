import type { BattleController } from "./battle.js";
import { isBroken, canBeTaken, canBeSubdued, CAPTURE_THRESHOLD } from "./battle.js";
import type { UnitState, UnitDef } from "./types.js";
import { TERRAIN_RULES } from "./types.js";
import type { Hex } from "./hex.js";
import { hexDistance, hexNeighbors, attackArc } from "./hex.js";
import { computeStat } from "./modifiers.js";
import { cohesionConnections } from "./cohesion.js";
import { bandOf, enemiesWithin } from "./effects.js";
import { moraleBand } from "./morale.js";
import type { RitualCircle } from "./rituals.js";
import { eligibleRecipes } from "./fusion.js";

/**
 * Goal-oriented utility AI. Each unit scores candidate actions with weighted considerations:
 * objective urgency, expected damage dealt/received, formation gain/loss, commander survival, isolation risk.
 * Difficulty changes planning depth and risk tolerance, never hidden stat bonuses.
 */
export interface AiProfile { name: string; risk: number; lookahead: number; objectiveWeight: number }
export const DIFFICULTY: Record<string, AiProfile> = {
  easy: { name: "easy", risk: 0.3, lookahead: 0, objectiveWeight: 0.6 },
  normal: { name: "normal", risk: 0.5, lookahead: 1, objectiveWeight: 1.0 },
  hard: { name: "hard", risk: 0.7, lookahead: 1, objectiveWeight: 1.3 },
};

/**
 * Weights the mover trades against ground. One hex of progress toward its goal is worth 100, so every
 * number here says how many hexes of advance the AI will give up for something else. The terrain values
 * themselves are never written down twice: they are read out of `TERRAIN_RULES`, so retuning a terrain
 * retunes the AI with it.
 */
const TERRAIN_STAT_WEIGHT = 0.4;      // a point of terrain DEF, or of ranged ATK for a shooter, against a hex of ground
const ELEVATION_WEIGHT = 20;          // per tier of height: the +50 ATK of attacking downhill, priced at the same rate
const CONCEALMENT_BONUS = 30;         // cover worth disappearing into, for a unit that would rather not be shot at
const BROKEN_CHARGE_PENALTY = 120;    // ground that kills momentum, for a horse that is only dangerous with it
const SIEGE_EXPOSURE_PENALTY = 300;   // a gun in the front rank is a gun about to be lost
const SIEGE_SCREEN_BONUS = 80;        // ... and a gun with friends in front of it is a gun that keeps firing
const FLANK_ARC_WEIGHT = 100;         // per arc step around a target: rear is worth two, flank one
const APPROACH_STEP_WEIGHT = 10;      // tie-break between equally exposed approaches: take the near one
const FUSION_ENEMY_RANGE = 6;         // a clash close enough to be worth trading bodies for weight over

/**
 * When a card skill is worth an action. All six are setup for something else, so the tests they have to
 * pass are about whether the thing they set up is actually going to happen this round.
 */
const AREA_SKILL_MIN_TARGETS = 2;     // a radius debuff earns its action once it catches a second enemy
const BAND_SWING_MIN = 2;             // a team buff wants a band about to swing, not one soldier in the open
const SACRIFICE_HP_FLOOR = 0.5;       // never bleed past half: the trade is reach, not a funeral

export interface ReleasePolicy { (ctrl: BattleController, side: string): Record<string, boolean> }

/** Attacker policy: release only when every linked ritual is complete, or when holding has become too dangerous. */
export const holdForSyncPolicy: ReleasePolicy = (ctrl, side) => {
  const out: Record<string, boolean> = {};
  const groups = new Map<string, RitualCircle[]>();
  for (const r of ctrl.b.rituals.values()) if (r.side === side && r.linkGroup) { const a = groups.get(r.linkGroup) ?? []; a.push(r); groups.set(r.linkGroup, a); }
  for (const rs of groups.values()) {
    const live = rs.filter((r) => r.state !== "Collapsed");
    const allHeld = live.every((r) => r.state === "CompletedHeld");
    const danger = live.some((r) => r.state === "CompletedHeld" && r.unstableStacks >= 3);
    for (const r of live) if (r.state === "CompletedHeld" && (allHeld || danger)) out[r.id] = true;
  }
  return out;
};

export function runAiActivation(ctrl: BattleController, groupId: string, profile: AiProfile = DIFFICULTY.normal!): void {
  const b = ctrl.b;
  const members = ctrl.beginActivation(groupId);
  const side = members[0]?.side;
  if (!side) { ctrl.endActivation(groupId); return; }
  if (shouldSurrender(ctrl, side)) {
    try { ctrl.surrender(side); } catch { /* someone senior is still standing after all */ }
    ctrl.endActivation(groupId);
    return;
  }
  // leader orders first
  for (const u of members) {
    if (!ctrl.canIssueOrder(u) || u.ap <= 0) continue;
    const faction = b.reg.factions.get(b.def(u).faction);
    const p = b.platoon(u.platoonId!);
    const enemyNear = nearestEnemy(ctrl, u);
    if (enemyNear && b.distance(u, enemyNear) <= 4 && faction?.platoonOrder && !p.orderUsedThisRound) {
      try { ctrl.useAbility(u, faction.platoonOrder, { target: enemyNear }); } catch { /* conditions not met */ }
    }
    for (const id of b.def(u).actives) {
      const a = b.reg.ability(id);
      if (a.category !== "Order" || p.orderUsedThisRound || u.ap <= 0) continue;
      try { ctrl.useAbility(u, id, { target: enemyNear ?? undefined }); } catch { /* skip */ }
    }
  }
  for (const u of members.sort((a, c) => b.def(c).initiative - b.def(a).initiative)) {
    if (u.defeated || !u.pos) continue;
    let guard = 0;
    while (u.ap > 0 && !u.defeated && guard++ < 4) {
      const acted = actOnce(ctrl, u, profile);
      if (!acted) break;
    }
  }
  ctrl.endActivation(groupId);
}

function actOnce(ctrl: BattleController, u: UnitState, profile: AiProfile): boolean {
  const b = ctrl.b; const d = b.def(u);
  // Ritualists: stay in circle and channel
  if (d.ritual) {
    const circle = [...b.rituals.values()].find((r) => r.side === u.side && u.pos && hexDistance(u.pos, r.center) <= r.radius && r.state !== "Collapsed" && r.state !== "CompletedReleased");
    if (circle) { try { ctrl.channel(u, circle); return true; } catch { return false; } }
    const target = [...b.rituals.values()].filter((r) => r.side === u.side && r.state !== "Collapsed").sort((x, y) => hexDistance(u.pos!, x.center) - hexDistance(u.pos!, y.center))[0];
    if (target) return moveToward(ctrl, u, target.center);
    return false;
  }
  // Portal keepers: open a portal if reserve allows, else defend
  // Abilities with immediate value
  for (const id of d.actives) {
    const a = b.reg.ability(id);
    if (a.category !== "Active" || (u.cooldowns[id] ?? 0) > 0) continue;
    const enemy = nearestEnemy(ctrl, u);
    if (a.effect.kind === "SpawnClones" && enemy && b.distance(u, enemy) <= 3) { try { ctrl.useAbility(u, id); return true; } catch { /* no room */ } }
    if (a.effect.kind === "ChargeBonus" && u.movedThisActivation >= (a.effect as any).minHexesMoved && enemy && b.distance(u, enemy) <= d.range) { try { ctrl.useAbility(u, id); } catch { /* skip */ } }
    if (a.effect.kind === "Duel" && enemy && b.distance(u, enemy) === 1 && b.def(enemy).roles.some((r) => r === "Elite" || r === "Commander")) { try { ctrl.useAbility(u, id, { target: enemy }); } catch { /* skip */ } }
    // A gun that has not been emplaced cannot fire, so set up the moment something walks into the sights.
    if (a.effect.kind === "SiegeSetup" && !u.setUp && enemy && inFiringBand(b.def(u), b.distance(u, enemy))) { try { ctrl.useAbility(u, id); return true; } catch { /* skip */ } }

    // The six card skills. Each of them buys a better version of some other action, so none of them is
    // worth the last point of an activation: spend one only while there is still an attack or a move to
    // spend it on. The same rule is what keeps the whole hand from being emptied on an untouched field.
    if (u.ap < 2) continue;
    if (a.effect.kind === "SelfSacrificeBuff" && enemy && !u.attackedThisActivation && b.distance(u, enemy) <= d.range
      && u.hp - Math.floor(d.hp * (a.effect as any).hpCostShare) >= d.hp * SACRIFICE_HP_FLOOR) { try { ctrl.useAbility(u, id); return true; } catch { /* skip */ } }
    // Haste is for the gap between wanting a fight and being able to reach one, and only when the extra
    // ground actually closes it. Hexes and movement points are the same thing over open ground.
    if (a.effect.kind === "SelfHaste" && enemy) {
      const gap = b.distance(u, enemy) - d.range, allowance = ctrl.movementAllowance(u);
      if (gap > allowance && gap <= allowance + (a.effect as any).mov) { try { ctrl.useAbility(u, id); return true; } catch { /* skip */ } }
    }
    if (a.effect.kind === "BandAtk" && bandAboutToSwing(ctrl, u) >= BAND_SWING_MIN) { try { ctrl.useAbility(u, id); return true; } catch { /* skip */ } }
    if ((a.effect.kind === "EnemyAtkDebuff" || a.effect.kind === "EnemySlow") && enemiesWithin(b, u, a.range ?? 1).length >= AREA_SKILL_MIN_TARGETS) { try { ctrl.useAbility(u, id); return true; } catch { /* skip */ } }
  }
  // A warrant target that is already broken is worth more alive than dead: take it now
  const warrants = b.wanted.get(u.side);
  if (warrants?.size) {
    const prisoner = b.adjacentEnemies(u).find((e) => warrants.has(e.defId) && ctrl.canSubdue(u, e));
    if (prisoner) { try { ctrl.subdue(u, prisoner); return true; } catch { /* someone else took it */ } }
  }
  // Attack if a target is in range: prefer ritualists / exposed elites / isolated commanders
  const targets = [...b.activeUnits()].filter((e) => e.side !== u.side && e.pos && hexDistance(u.pos!, e.pos) <= d.range && !(b.hasStatus(e, "Hidden") && hexDistance(u.pos!, e.pos) > 1));
  if (targets.length && !u.attackedThisActivation) {
    const best = targets.map((t) => ({ t, s: targetScore(ctrl, u, t, profile) })).sort((a, c) => c.s - a.s)[0]!;
    try { ctrl.attack(u, best.t); return true; } catch { /* duel or other block */ }
  }
  // Enemy portal adjacent? hit it
  for (const p of b.portals.values()) if (p.side !== u.side && p.state !== "Destroyed" && hexDistance(u.pos!, p.pos) <= d.range && !u.attackedThisActivation) { try { ctrl.attackStructure(u, p); return true; } catch { /* skip */ } }

  // Movement toward the highest-utility goal
  if (u.movedThisActivation === 0 || u.ap > 1) {
    const goal = chooseGoal(ctrl, u, profile);
    if (goal && moveToward(ctrl, u, goal, profile)) return true;
  }
  // Fusion never outbids an attack or a move: it only spends an AP that would otherwise buy nothing,
  // once a fight is close enough that the stronger single body is worth the platoon depth it costs.
  // (A goal with no reachable hex toward it falls through to here rather than stopping the unit cold.)
  if (tryFusion(ctrl, u)) return true;
  // Otherwise Defend
  if (u.ap > 0 && !u.defending) { ctrl.defend(u); return true; }
  return false;
}

/**
 * Attempt to fuse this unit with one or more adjacent, same-side allies by any recipe the roster
 * satisfies. Only considered once nothing more urgent (an attack, a move) is on offer, and only when
 * an enemy is close enough that the trade — fewer bodies for one heavier one — is actually worth
 * making now rather than a detour taken for its own sake.
 */
export function tryFusion(ctrl: BattleController, u: UnitState): boolean {
  const b = ctrl.b;
  if (u.isClone || u.ap < 1 || !u.pos) return false;
  const side = b.sides.get(u.side);
  if (!side) return false;
  const enemy = nearestEnemy(ctrl, u);
  if (!enemy || !enemy.pos || hexDistance(u.pos, enemy.pos) > FUSION_ENEMY_RANGE) return false;
  const allies = b.adjacentAllies(u).filter((a) => !a.isClone && a.ap >= 1);
  for (const r of b.reg.fusions.values()) {
    const need = r.inputs.length - 1;
    if (need < 1 || need > allies.length || (side.fusionCharges ?? 0) < (r.charges ?? 1)) continue;
    for (const combo of combinations(allies, need)) {
      const units = [u, ...combo];
      if (!eligibleRecipes(b, units).some((x) => x.id === r.id)) continue;
      try { ctrl.fuse(units, r.id); return true; } catch { /* another condition failed after all */ }
    }
  }
  return false;
}
/** Every way to choose `size` distinct items out of `items`, order ignored. */
function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [...combinations(rest, size - 1).map((c) => [first!, ...c]), ...combinations(rest, size)];
}

function targetScore(ctrl: BattleController, u: UnitState, t: UnitState, profile: AiProfile): number {
  const b = ctrl.b; const td = b.def(t);
  const atk = computeStat(b, u, "ATK", { attacker: u, defender: t }).final;
  const def = computeStat(b, t, "DEF", { attacker: u, defender: t }).final;
  const dmg = Math.max(100, atk - def);
  let s = dmg / Math.max(1, t.hp) * 1000; // kill potential
  if (td.ritual) s += 400 * profile.objectiveWeight;
  if (td.roles.includes("Commander")) s += 300;
  if (td.roles.includes("Elite") && b.hasStatus(t, "Exposed")) s += 250;
  if (b.isIsolated(t)) s += 150;
  if (t.isClone) s -= 500; // clones are decoys
  // A warrant pays for a prisoner, so a warrant target is not something to shoot at. Leave it
  // alone while anyone of ours is close enough to lay hands on it; only once nobody can reach it
  // does killing it beat letting it walk away.
  if (b.wanted.get(u.side)?.has(t.defId) && canBeSubdued(b, t)) {
    const threshold = Math.ceil(td.hp * CAPTURE_THRESHOLD);
    const closingIn = [...b.activeUnits(u.side)].some((a) => !a.isClone && a.pos && t.pos && hexDistance(a.pos, t.pos) <= 6);
    if (closingIn || canBeTaken(b, t, u.side) || t.hp - dmg <= threshold) s -= 4000;
  }
  return s;
}

function chooseGoal(ctrl: BattleController, u: UnitState, profile: AiProfile): Hex | null {
  const b = ctrl.b; const d = b.def(u);
  const enemy = nearestEnemy(ctrl, u);
  // A siege piece is a range weapon on a carriage: once anything stands in its firing band there is
  // nothing left to walk toward, and walking would only break the emplacement and hand it to the line.
  if (isSiege(d) && enemy && inFiringBand(d, b.distance(u, enemy))) return null;
  const enemyRituals = [...b.rituals.values()].filter((r) => r.side !== u.side && r.state !== "Collapsed" && r.state !== "CompletedReleased");
  const enemyPortals = [...b.portals.values()].filter((p) => p.side !== u.side && p.state !== "Destroyed");
  const candidates: Array<{ hex: Hex; score: number }> = [];
  for (const r of enemyRituals) {
    const urgency = (r.progress / r.required) + (r.state === "CompletedHeld" ? 1 : 0);
    const dist = hexDistance(u.pos!, r.center);
    const mobile = d.flying || d.roles.includes("Cavalry") ? 1.5 : 1;
    candidates.push({ hex: r.center, score: (600 * urgency * profile.objectiveWeight * mobile) / (1 + dist / 4) });
  }
  for (const p of enemyPortals) { const dist = hexDistance(u.pos!, p.pos); candidates.push({ hex: p.pos, score: 300 / (1 + dist / 4) }); }
  // A warrant target is the most valuable thing on the field. Converge on it: two bodies on it and
  // its friends cleared away is a prisoner, and a prisoner is the only thing the writ pays for.
  const warrants = b.wanted.get(u.side);
  if (warrants?.size) {
    for (const e of b.activeUnits()) {
      if (e.side === u.side || !e.pos || !warrants.has(e.defId) || !canBeSubdued(b, e)) continue;
      const ready = canBeTaken(b, e, u.side) ? 3 : 1;
      candidates.push({ hex: e.pos, score: (900 * ready) / (1 + hexDistance(u.pos!, e.pos) / 4) });
    }
  }
  if (enemy) {
    const dist = b.distance(u, enemy);
    const myAtk = computeStat(b, u, "ATK").final, theirDef = computeStat(b, enemy, "DEF").final;
    const favorable = (myAtk - theirDef) / 400;
    // Horse does not ride into a braced shield. Aim a cavalry approach at the ground the target's facing
    // does not cover, where the same lance is worth a quarter more.
    const approach = d.roles.includes("Cavalry") ? flankHex(ctrl, u, enemy) : enemy.pos!;
    candidates.push({ hex: approach, score: (250 + 200 * favorable * profile.risk) / (1 + dist / 6) });
  }
  // Commanders hold formation rather than charge
  if (d.roles.includes("Commander") && u.platoonId) {
    for (const c of candidates) c.score *= 0.4;
  }
  if (!candidates.length) return null;
  return candidates.sort((a, c) => c.score - a.score)[0]!.hex;
}

/**
 * Move to the reachable hex closest to the goal that best preserves theme cohesion, avoids isolation and
 * stands on the best ground going. When nothing brings the unit closer at all it will still take a step
 * sideways onto better ground rather than wait out the round in the open.
 */
function moveToward(ctrl: BattleController, u: UnitState, goal: Hex, profile: AiProfile = DIFFICULTY.normal!): boolean {
  const b = ctrl.b; const d = b.def(u);
  if (u.ap <= 0 || !u.pos) return false;
  const reach = [...ctrl.reachable(u).values()];
  if (!reach.length) return false;
  const currentDist = hexDistance(u.pos, goal);
  const before = cohesionConnections(b, u).length;
  const here = groundScore(ctrl, u, u.pos);
  const enemy = nearestEnemy(ctrl, u);
  let best: { hex: Hex; score: number } | null = null;
  let hold: { hex: Hex; score: number } | null = null;
  for (const r of reach) {
    const dist = hexDistance(r.hex, goal);
    if (dist > currentDist) continue;
    // simulate cohesion at destination
    const theme = b.def(u).themes[0];
    const after = theme ? b.adjacentUnits({ ...u, pos: r.hex } as UnitState).filter((a) => a.side === u.side && !a.isClone && b.def(a).themes[0] === theme && a.uid !== u.uid).length : 0;
    const enemiesAdj = b.adjacentUnits({ ...u, pos: r.hex } as UnitState).filter((a) => a.side !== u.side).length;
    const ground = groundScore(ctrl, u, r.hex);
    let score = (currentDist - dist) * 100 + ground;
    score += (after - before) * 60 * (1 - profile.risk);
    if (after === 0 && before > 0) score -= 120 * (1 - profile.risk);   // isolation risk
    if (enemiesAdj >= 2) score -= 80 * (1 - profile.risk);
    if (isSiege(d)) {
      score -= enemiesAdj * SIEGE_EXPOSURE_PENALTY;
      if (enemy && screened(ctrl, u, r.hex, enemy)) score += SIEGE_SCREEN_BONUS;
    }
    if (dist < currentDist) { if (!best || score > best.score) best = { hex: r.hex, score }; }
    else if (ground > here && (!hold || score > hold.score)) hold = { hex: r.hex, score };
  }
  const chosen = best ?? hold;
  if (!chosen) return false;
  const disengage = b.adjacentEnemies(u).length > 0 && u.ap >= 2;
  try { ctrl.move(u, chosen.hex, { disengage }); return true; } catch { return false; }
}

/**
 * What the ground under a hex is worth to this unit, in the same currency as a hex of progress. Every
 * term comes out of `TERRAIN_RULES` or the elevation map, so the AI wants exactly what the rules pay for:
 * cover it can shoot from, height it can shoot down from, and — for cavalry — ground a charge survives.
 * A flier is carrying none of this, and the modifier pipeline agrees, so its ground is worth nothing.
 */
function groundScore(ctrl: BattleController, u: UnitState, h: Hex): number {
  const b = ctrl.b; const d = b.def(u);
  if (d.flying) return 0;
  const rule = TERRAIN_RULES[b.terrainAt(h)];
  let s = rule.def * TERRAIN_STAT_WEIGHT + b.elevationAt(h) * ELEVATION_WEIGHT;
  if (d.range > 1) s += rule.ranged.atk * TERRAIN_STAT_WEIGHT;
  if (rule.concealment) s += CONCEALMENT_BONUS;
  if (d.roles.includes("Cavalry") && rule.chargeBreaks) s -= BROKEN_CHARGE_PENALTY;
  return s;
}

/** Is somebody of ours standing closer to that enemy than this hex is: a body between the gun and the line. */
function screened(ctrl: BattleController, u: UnitState, h: Hex, enemy: UnitState): boolean {
  const b = ctrl.b;
  const gap = hexDistance(h, enemy.pos!);
  return [...b.activeUnits(u.side)].some((a) => a.uid !== u.uid && !a.isClone && a.pos && hexDistance(a.pos, enemy.pos!) < gap);
}

/** The hex beside a target that its facing covers least, preferring ground a horse can arrive on intact. */
function flankHex(ctrl: BattleController, u: UnitState, enemy: UnitState): Hex {
  const b = ctrl.b;
  let best: { hex: Hex; score: number } | null = null;
  for (const h of hexNeighbors(enemy.pos!)) {
    if (!b.inBounds(h)) continue;
    const occ = b.unitAt(h);
    if (occ && occ.uid !== u.uid) continue;
    const arc = attackArc(enemy.pos!, enemy.facing, h);
    const s = (arc === "rear" ? 2 : arc === "flank" ? 1 : 0) * FLANK_ARC_WEIGHT
      + groundScore(ctrl, u, h) - hexDistance(u.pos!, h) * APPROACH_STEP_WEIGHT;
    if (!best || s > best.score) best = { hex: h, score: s };
  }
  return best?.hex ?? enemy.pos!;
}

/** Siege pieces are the units that fight from behind their own line rather than in it. */
function isSiege(d: UnitDef): boolean { return !!d.siege || d.roles.includes("Siege"); }

/** Between the minimum range a piece cannot shoot inside of and the range it cannot shoot past. */
function inFiringBand(d: UnitDef, distance: number): boolean { return distance <= d.range && distance >= (d.minRange ?? 0); }

/**
 * How many of a unit's band already have something in reach: a team buff is only worth an action when
 * the band is about to swing. The band itself is `bandOf` from the effects layer rather than a second
 * definition here, so what the AI thinks it is buffing is what the ability actually buffs.
 */
function bandAboutToSwing(ctrl: BattleController, u: UnitState): number {
  const b = ctrl.b;
  const band = bandOf(b, u, u.platoonId ? b.platoon(u.platoonId) : undefined);
  return band.filter((m) => m.pos && [...b.activeUnits()].some((t) => t.side !== m.side && t.pos && hexDistance(m.pos!, t.pos) <= b.def(m).range)).length;
}

/**
 * An army yields when there is nobody left to give the order and nobody left willing to take it: the
 * army leader is dead, no commander has stepped into the gap, and average morale has fallen into the
 * routing bands. Past that point every further round only feeds the other side's spoils.
 */
function shouldSurrender(ctrl: BattleController, side: string): boolean {
  const b = ctrl.b;
  const state = b.sides.get(side);
  if (!state || state.surrendered || b.winner) return false;
  const leader = state.leaderUid ? b.units.get(state.leaderUid) : undefined;
  if (leader && !leader.defeated) return false;
  if ([...b.activeUnits(side)].some((u) => !u.isClone && b.def(u).roles.includes("Commander"))) return false;
  const band = moraleBand(ctrl.moraleSummary(side).average);
  return band === "Routed" || band === "Broken";
}

export function nearestEnemy(ctrl: BattleController, u: UnitState): UnitState | null {
  const b = ctrl.b;
  let best: UnitState | null = null, bd = Infinity;
  for (const e of b.activeUnits()) {
    if (e.side === u.side || !e.pos) continue;
    const dd = b.distance(u, e);
    if (dd < bd) { bd = dd; best = e; }
  }
  return best;
}
