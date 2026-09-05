import type { BattleController } from "./battle.js";
import { isBroken, canBeTaken, canBeSubdued, CAPTURE_THRESHOLD } from "./battle.js";
import type { UnitState } from "./types.js";
import type { Hex } from "./hex.js";
import { hexDistance } from "./hex.js";
import { computeStat } from "./modifiers.js";
import { cohesionConnections } from "./cohesion.js";
import type { RitualCircle } from "./rituals.js";

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
    if (goal) return moveToward(ctrl, u, goal, profile);
  }
  // Otherwise Defend
  if (u.ap > 0 && !u.defending) { ctrl.defend(u); return true; }
  return false;
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
  const enemy = nearestEnemy(ctrl, u);
  if (enemy) {
    const dist = b.distance(u, enemy);
    const myAtk = computeStat(b, u, "ATK").final, theirDef = computeStat(b, enemy, "DEF").final;
    const favorable = (myAtk - theirDef) / 400;
    candidates.push({ hex: enemy.pos!, score: (250 + 200 * favorable * profile.risk) / (1 + dist / 6) });
  }
  // Commanders hold formation rather than charge
  if (d.roles.includes("Commander") && u.platoonId) {
    for (const c of candidates) c.score *= 0.4;
  }
  if (!candidates.length) return null;
  return candidates.sort((a, c) => c.score - a.score)[0]!.hex;
}

/** Move to the reachable hex closest to the goal that best preserves theme cohesion and avoids isolation. */
function moveToward(ctrl: BattleController, u: UnitState, goal: Hex, profile: AiProfile = DIFFICULTY.normal!): boolean {
  const b = ctrl.b;
  if (u.ap <= 0 || !u.pos) return false;
  const reach = [...ctrl.reachable(u).values()];
  if (!reach.length) return false;
  const currentDist = hexDistance(u.pos, goal);
  const before = cohesionConnections(b, u).length;
  let best: { hex: Hex; score: number } | null = null;
  for (const r of reach) {
    const dist = hexDistance(r.hex, goal);
    if (dist >= currentDist) continue;
    // simulate cohesion at destination
    const theme = b.def(u).themes[0];
    const after = theme ? b.adjacentUnits({ ...u, pos: r.hex } as UnitState).filter((a) => a.side === u.side && !a.isClone && b.def(a).themes[0] === theme && a.uid !== u.uid).length : 0;
    const enemiesAdj = b.adjacentUnits({ ...u, pos: r.hex } as UnitState).filter((a) => a.side !== u.side).length;
    let score = (currentDist - dist) * 100;
    score += (after - before) * 60 * (1 - profile.risk);
    if (after === 0 && before > 0) score -= 120 * (1 - profile.risk);   // isolation risk
    if (enemiesAdj >= 2) score -= 80 * (1 - profile.risk);
    if (b.terrainAt(r.hex) === "Fortification") score += 40;
    if (!best || score > best.score) best = { hex: r.hex, score };
  }
  if (!best) return false;
  const disengage = b.adjacentEnemies(u).length > 0 && u.ap >= 2;
  try { ctrl.move(u, best.hex, { disengage }); return true; } catch { return false; }
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
