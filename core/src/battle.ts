import { Battle } from "./state.js";
import type { UnitState, PlatoonState } from "./types.js";
import { TERRAIN_RULES } from "./types.js";
import { terrainCostFor } from "./ranks.js";
import type { Hex } from "./hex.js";
import { hexDistance as _hd } from "./hex.js";
import { hexDistance, hexNeighbors, hexKey, directionTo } from "./hex.js";
import { resolveAttack, interceptUsed, defeat } from "./combat.js";
import { computeStat, clearTempMods, tempMods } from "./modifiers.js";
import { resolveSuccession, rally as rallyAction } from "./command.js";
import { applyEffect, clearRoundEffectFlags, orderFlags } from "./effects.js";
import { tickRitual, releaseRitual, linkedGroup, assistRitual, disruptRitual, type RitualCircle } from "./rituals.js";
import { tickPortal, checkCaptureInterrupt, attackPortal, captureStep, type Portal } from "./portals.js";
import { commandRadiusRecovery, surroundedPenalty, moraleBand, changeMorale } from "./morale.js";
import { doctrineState } from "./composition.js";
import { evaluateObjective, markSynchronized, type ObjectiveDef, type ObjectiveProgress } from "./objectives.js";
import { mountedMoveBonus, commandRadiusOf, movementTraits } from "./ranks.js";
import { fuse as fuseUnits, tickFusions } from "./fusion.js";
import { timedTerrain } from "./effects.js";

export interface VictoryRules { sides: Record<string, ObjectiveDef[]>; roundLimit: number; roundLimitWinner?: string }

/**
 * Deterministic turn-state machine. Round = Command -> Alternating Activation -> Objective -> End.
 * All mutations go through named actions so every step produces a serializable event.
 */
export class BattleController {
  constructor(public readonly b: Battle, public victory: VictoryRules) {}

  // ---------- Command Phase ----------
  commandPhase(): void {
    const b = this.b;
    b.phase = "Command";
    b.log("PhaseStart", { phase: "Command" });
    clearRoundEffectFlags();
    interceptUsed.clear();
    for (const p of b.platoons.values()) {
      resolveSuccession(b, p);
      p.orderUsedThisRound = false;
      p.markedTarget = null;
      if (p.continuityRoundsLeft > 0) p.continuityRoundsLeft--;
    }
    for (const u of b.activeUnits()) {
      u.ap = 0; u.defending = false; u.overwatch = false;
      u.usedChargeLastRound = false;
      for (const k of Object.keys(u.cooldowns)) if (u.cooldowns[k]! > 0) u.cooldowns[k]!--;
      clearTempMods(u, (m) => m.stat === "DEF" && m.source === "Inherited Wall" ? false : true); // only Inherited Wall persists one round
      // Suppressed: -1 AP on next activation is applied at activation time
    }
    for (const [side, deck] of b.decks) { const drawn = deck.draw(b.reg.deckRules.drawPerRound); if (drawn.length) b.log("Draw", { side, cards: drawn, hand: deck.hand.length }); }
    commandRadiusRecovery(b);
    b.activatedGroupsThisRound.clear();
    b.activeSide = b.round % 2 === 1 ? "A" : "B";
  }

  // ---------- Activation Phase ----------
  beginActivation(groupId: string): UnitState[] {
    const b = this.b;
    b.phase = "Activation";
    if (b.activatedGroupsThisRound.has(groupId)) throw new Error(`${groupId} already activated this round`);
    const members = this.groupMembers(groupId);
    for (const u of members) {
      u.ap = 2; u.movedThisActivation = 0; u.chargeMoved = 0; u.attackedThisActivation = false; u.defending = false; u.shadowStepped = false; u.freeMoveHexes = 0;
      if (b.hasStatus(u, "Suppressed")) { u.ap -= 1; b.removeStatus(u, "Suppressed"); }
      if (b.hasStatus(u, "Routed")) { this.routedRetreat(u); u.ap = 0; }
    }
    b.activatedGroupsThisRound.add(groupId);
    b.log("ActivationStart", { group: groupId, units: members.map((m) => m.uid) });
    return members;
  }

  /** Groups: a platoon id, or "ind:<side>" for independent teams (specialists, clones, summons). */
  groupMembers(groupId: string): UnitState[] {
    const b = this.b;
    if (groupId.startsWith("ind:")) { const side = groupId.slice(4); return [...b.activeUnits(side)].filter((u) => !u.platoonId); }
    return [...b.activeUnits()].filter((u) => u.platoonId === groupId);
  }
  groupsFor(side: string): string[] {
    const out = [...this.b.platoons.values()].filter((p) => p.side === side && this.groupMembers(p.id).length > 0).map((p) => p.id);
    if (this.groupMembers(`ind:${side}`).length) out.push(`ind:${side}`);
    return out.filter((g) => !this.b.activatedGroupsThisRound.has(g));
  }

  endActivation(groupId: string): void {
    for (const u of this.groupMembers(groupId)) { u.ap = 0; orderFlags.delete(u.uid); }
    this.b.log("ActivationEnd", { group: groupId });
  }

  // ---------- Standard actions (1 AP unless noted) ----------
  private spend(u: UnitState, ap = 1): void { if (u.ap < ap) throw new Error(`${u.uid} lacks AP`); u.ap -= ap; }

  movementAllowance(u: UnitState): number {
    const d = this.b.def(u);
    return d.mov + mountedMoveBonus(this.b, u) + (movementTraits(this.b, u).bonusMov ?? 0) + (this.b.kingdomEffects.get(u.side)?.movement ?? 0) + tempMods(u).filter((m) => m.stat === "MOV").reduce((s, m) => s + m.value, 0);
  }

  /** BFS pathfinding with terrain costs, zone of control and flying rules. Returns reachable hexes with cost. */
  reachable(u: UnitState): Map<string, { hex: Hex; cost: number }> {
    const b = this.b; const d = b.def(u);
    const out = new Map<string, { hex: Hex; cost: number }>();
    if (!u.pos) return out;
    const budget = this.movementAllowance(u);
    const flag = orderFlags.get(u.uid);
    const traits = movementTraits(b, u);
    const ignoreZoc = flag === "PhaseMove" || !!traits.ignoreZoc;
    const passAllies = flag === "PhaseMove" || flag === "SequencedMove" || !!d.flying || !!traits.passAllies;
    const frontier: Array<{ hex: Hex; cost: number }> = [{ hex: u.pos, cost: 0 }];
    const best = new Map<string, number>([[hexKey(u.pos), 0]]);
    while (frontier.length) {
      frontier.sort((a, c) => a.cost - c.cost);
      const cur = frontier.shift()!;
      for (const n of hexNeighbors(cur.hex)) {
        if (!b.inBounds(n)) continue;
        const t = b.terrainAt(n);
        const occ = b.unitAt(n);
        if (occ && (occ.side !== u.side || !passAllies)) continue;
        const stepCost = terrainCostFor(b, u, t);
        if (stepCost === null) continue;
        let step = stepCost;
        // climbing one elevation tier costs one more point for ground units
        if (!d.flying && b.elevationAt(n) > b.elevationAt(cur.hex) && t !== "Road") step += 1;
        // Predatory Airspace: flying enemies cannot pass through a Dragon Flight commander's radius
        if (d.flying && this.inEnemyDragonAirspace(u, n)) step = 99;
        const cost = cur.cost + step;
        if (cost > budget) continue;
        if ((best.get(hexKey(n)) ?? Infinity) <= cost) continue;
        best.set(hexKey(n), cost);
        frontier.push({ hex: n, cost });
        if (!occ) out.set(hexKey(n), { hex: n, cost });
        // leaving a hex adjacent to an enemy costs the rest of movement unless Disengage / ignoreZoc (reaction handled in move())
        if (!ignoreZoc && this.adjacentEnemyAt(u, n)) { /* still allowed; reaction attack is triggered on leaving */ }
      }
    }
    return out;
  }

  private inEnemyDragonAirspace(u: UnitState, h: Hex): boolean {
    const b = this.b;
    for (const p of b.platoons.values()) {
      if (p.side === u.side || p.faction !== "DRG" || !p.commanderUid) continue;
      const c = b.units.get(p.commanderUid);
      if (c && !c.defeated && c.pos && hexDistance(c.pos, h) <= commandRadiusOf(b, c)) return true;
    }
    return false;
  }
  private adjacentEnemyAt(u: UnitState, h: Hex): boolean { return hexNeighbors(h).some((n) => { const o = this.b.unitAt(n); return !!o && o.side !== u.side; }); }

  /** Move. Leaving an enemy zone of control triggers a reaction attack unless `disengage` (costs its own AP). */
  move(u: UnitState, to: Hex, opts: { disengage?: boolean } = {}): void {
    const b = this.b;
    if (!u.pos) throw new Error("Unit not deployed");
    const r = this.reachable(u).get(hexKey(to));
    if (!r) throw new Error(`Hex ${hexKey(to)} not reachable`);
    const zocEnemies = b.adjacentEnemies(u).filter((e) => !b.hasStatus(e, "Routed"));
    const traits = movementTraits(b, u);
    const ignoreZoc = orderFlags.get(u.uid) === "PhaseMove" || !!traits.ignoreZoc || u.freeMoveHexes > 0;
    if (u.freeMoveHexes > 0) { if (r.cost > u.freeMoveHexes) throw new Error("Beyond free move"); u.freeMoveHexes = 0; }
    else { if (opts.disengage) this.spend(u, 1); this.spend(u, 1); }
    u.setUp = false; // a siege piece that moves must set up again
    const from = u.pos;
    if (zocEnemies.length && !opts.disengage && !ignoreZoc) {
      const reactor = zocEnemies[0]!;
      b.log("ReactionAttack", { by: reactor.uid, on: u.uid });
      resolveAttack(b, reactor, u, { reaction: true });
      if (u.defeated) return;
    }
    // Overwatch: first valid enemy entering range gets shot
    for (const e of b.activeUnits()) {
      if (e.side === u.side || !e.overwatch || !e.pos) continue;
      if (hexDistance(e.pos, to) <= b.def(e).range && hexDistance(e.pos, from) > b.def(e).range) { b.log("OverwatchTriggered", { by: e.uid, on: u.uid }); resolveAttack(b, e, u, { ranged: b.def(e).range > 1, reaction: true }); if (u.defeated) return; }
    }
    b.place(u, to);
    u.facing = directionTo(from, to);
    u.movedThisActivation += r.cost;
    // charge momentum: broken by rough ground, otherwise accumulates
    u.chargeMoved = TERRAIN_RULES[b.terrainAt(to)].chargeBreaks ? 0 : u.chargeMoved + r.cost;
    if (b.hasStatus(u, "Hidden") && b.terrainAt(to) !== "Forest" && b.terrainAt(to) !== "Smoke" && b.adjacentEnemies(u).length) b.addStatus(u, "Revealed", 0, "Moved into contact");
    if (traits.hideOnForestStop && b.terrainAt(to) === "Forest") b.addStatus(u, "Hidden", 2, "Canopy");
    b.log("Move", { uid: u.uid, from, to, cost: r.cost });
    // moving away from a ritual circle forfeits contribution (participants are recomputed each tick)
  }

  /** Rotation before movement is free. */
  face(u: UnitState, facing: number): void { u.facing = ((facing % 6) + 6) % 6 as 0 | 1 | 2 | 3 | 4 | 5; }

  attack(u: UnitState, target: UnitState): void {
    const b = this.b;
    if (u.attackedThisActivation) throw new Error("Already attacked this activation");
    if (!u.pos || !target.pos) throw new Error("Not deployed");
    const range = b.def(u).range + (b.def(u).range > 1 ? TERRAIN_RULES[b.terrainAt(u.pos)].ranged.range : 0);
    if (hexDistance(u.pos, target.pos) > range) throw new Error("Out of range");
    if (b.hasStatus(target, "Hidden") && hexDistance(u.pos, target.pos) > 1) throw new Error("Target is Hidden");
    if (u.isClone && u.attackedThisActivation) throw new Error("Clones make one basic attack");
    const d = b.def(u);
    if (d.minRange && hexDistance(u.pos, target.pos) < d.minRange) throw new Error("Inside minimum range");
    if (d.siege?.setupRequired && !u.setUp) throw new Error("Siege piece must Set Up before firing");
    this.spend(u, 1);
    u.facing = directionTo(u.pos, target.pos);
    resolveAttack(b, u, target, { ranged: range > 1 });
    const fade = d.passives.map((id) => b.reg.ability(id)).find((a) => a.effect.kind === "FreeMoveAfterAttack");
    if (fade) u.freeMoveHexes = (fade.effect as any).hexes;
    // attacking a ritual participant disrupts the circle
    for (const r of b.rituals.values()) if (r.side === target.side && r.participantUids.includes(target.uid)) disruptRitual(b, r, 1, u.uid);
  }

  attackStructure(u: UnitState, portal: Portal): void {
    const d = this.b.def(u);
    if (d.siege?.setupRequired && !u.setUp) throw new Error("Siege piece must Set Up before firing");
    this.spend(u, 1);
    const atk = computeStat(this.b, u, "ATK").final + (d.siege && d.passives.includes("ABL_BREACHING_SHOT") ? d.siege.structureAtk : 0);
    if (!attackPortal(this.b, u, portal, atk)) { u.ap += 1; throw new Error("Portal out of range"); }
  }

  defend(u: UnitState): void { this.spend(u, 1); u.defending = true; this.b.log("Defend", { uid: u.uid }); }
  overwatch(u: UnitState): void { this.spend(u, 1); u.overwatch = true; this.b.log("Overwatch", { uid: u.uid }); }
  rally(u: UnitState): void { this.spend(u, 1); if (!rallyAction(this.b, u)) { u.ap += 1; throw new Error("Unit cannot Rally"); } }
  assist(u: UnitState, ritual: RitualCircle): void { this.spend(u, 1); if (!assistRitual(this.b, ritual, u)) { u.ap += 1; throw new Error("Cannot assist"); } }
  capture(u: UnitState, portal: Portal): void { this.spend(u, 1); if (!captureStep(this.b, u, portal)) { u.ap += 1; throw new Error("Cannot capture"); } }
  channel(u: UnitState, ritual: RitualCircle): void {
    // Channeling is implicit for eligible participants inside the circle; the action spends AP to stay committed and marks intent.
    this.spend(u, 1);
    if (!this.b.def(u).ritual || !u.pos || hexDistance(u.pos, ritual.center) > ritual.radius) { u.ap += 1; throw new Error("Not a ritualist in the circle"); }
    this.b.log("Channel", { uid: u.uid, ritual: ritual.id });
  }

  /** Kage rank: relocate up to N hexes to a Forest, Smoke or Ruins hex, ignoring everything between. Once per activation. */
  shadowStep(u: UnitState, to: Hex): void {
    const b = this.b; const n = movementTraits(b, u).shadowStep ?? 0;
    if (!n) throw new Error("No Shadow Step");
    if (u.shadowStepped) throw new Error("Already shadow-stepped this activation");
    if (!u.pos || hexDistance(u.pos, to) > n || !b.isFree(to)) throw new Error("Invalid destination");
    const t = b.terrainAt(to);
    if (t !== "Forest" && t !== "Smoke" && t !== "Ruins") throw new Error("Shadow Step needs cover");
    this.spend(u, 1);
    const from = u.pos; b.place(u, to); u.shadowStepped = true; u.setUp = false;
    b.addStatus(u, "Hidden", 2, "Shadow Step");
    b.log("ShadowStep", { uid: u.uid, from, to });
  }

  /** Fusion function: merge adjacent units by recipe. Spends a Fusion charge; each input spends 1 AP. */
  fuse(units: UnitState[], recipeId: string): UnitState { return fuseUnits(this.b, units, recipeId); }

  /** Surrender: only the army leader (or any commander if the leader has fallen) may yield the field. */
  surrender(side: string, by?: UnitState): void {
    const b = this.b; const s = b.sides.get(side)!;
    const leader = s.leaderUid ? b.units.get(s.leaderUid) : undefined;
    if (leader && !leader.defeated && by && by.uid !== leader.uid) throw new Error("Only the army leader may surrender");
    s.surrendered = true; b.log("Surrender", { side, by: by?.uid ?? null });
    this.evaluateVictory();
  }

  /** Use an active/order ability. */
  useAbility(u: UnitState, abilityId: string, ctx: { target?: UnitState; targetHex?: Hex } = {}): void {
    const b = this.b; const d = b.def(u);
    const a = b.reg.ability(abilityId);
    const faction = b.reg.factions.get(d.faction);
    const isOrder = a.category === "Order";
    const isFactionOrder = faction?.platoonOrder === abilityId;
    if (!d.actives.includes(abilityId) && !(isFactionOrder && this.canIssueOrder(u))) throw new Error(`${u.uid} lacks ${abilityId}`);
    if (u.isClone) throw new Error("Clones cannot use abilities");
    if ((u.cooldowns[abilityId] ?? 0) > 0) throw new Error("On cooldown");
    if (b.hasStatus(u, "Silenced") && (a.effect.kind === "RitualChannel" || a.effect.kind === "PortalCall")) throw new Error("Silenced");
    if (a.range && ctx.target && b.distance(u, ctx.target) > a.range) throw new Error("Out of range");
    if (a.target === "enemyEliteOrLeader" && ctx.target && !b.def(ctx.target).roles.some((r) => r === "Elite" || r === "Commander" || r === "Second")) throw new Error("Invalid duel target");
    const p = u.platoonId ? b.platoon(u.platoonId) : undefined;
    if (isOrder) { if (!p || !this.canIssueOrder(u)) throw new Error("Only the active platoon leader can issue orders"); if (p.orderUsedThisRound) throw new Error("Order already used"); }
    if (isFactionOrder && p && doctrineState(b, p) === "Broken") throw new Error("Platoon Order requires Platoon Doctrine");
    this.spend(u, a.apCost ?? 1);
    const ok = applyEffect(b, u, a, { platoon: p, target: ctx.target, targetHex: ctx.targetHex });
    if (!ok) { u.ap += a.apCost ?? 1; throw new Error(`${a.name} conditions not met`); }
    if (a.cooldown) u.cooldowns[abilityId] = a.cooldown;
    if (isOrder && p) p.orderUsedThisRound = true;
    b.log("AbilityUsed", { uid: u.uid, ability: abilityId, target: ctx.target?.uid });
  }

  canIssueOrder(u: UnitState): boolean {
    if (!u.platoonId) return false;
    const p = this.b.platoon(u.platoonId);
    return p.commanderUid === u.uid; // a promoted second becomes commanderUid
  }

  private routedRetreat(u: UnitState): void {
    const b = this.b;
    const enemies = [...b.activeUnits()].filter((e) => e.side !== u.side);
    if (!u.pos || !enemies.length) return;
    const options = [...this.reachable(u).values()];
    if (!options.length) return;
    const score = (h: Hex) => Math.min(...enemies.map((e) => hexDistance(h, e.pos!)));
    const bestHex = options.reduce((a, c) => (score(c.hex) > score(a.hex) ? c : a));
    b.place(u, bestHex.hex);
    b.log("RoutedRetreat", { uid: u.uid, to: bestHex.hex });
  }

  // ---------- Objective Phase ----------
  objectivePhase(releaseDecisions: Record<string, boolean> = {}): void {
    const b = this.b;
    b.phase = "Objective";
    b.log("PhaseStart", { phase: "Objective" });
    for (const r of b.rituals.values()) tickRitual(b, r);
    // release decisions: owner releases held rituals; synchronized if every linked ritual releases together
    const groupsReleased = new Map<string, RitualCircle[]>();
    for (const r of b.rituals.values()) {
      if (r.state !== "CompletedHeld" || !releaseDecisions[r.id]) continue;
      if (r.linkGroup) { const arr = groupsReleased.get(r.linkGroup) ?? []; arr.push(r); groupsReleased.set(r.linkGroup, arr); }
      else releaseRitual(b, r, { synchronized: true });
    }
    for (const [group, rs] of groupsReleased) {
      const all = linkedGroup(b, group).filter((r) => r.state !== "Collapsed");
      const synchronized = rs.length === all.length && all.every((r) => r.state === "CompletedHeld");
      for (const r of rs) releaseRitual(b, r, { synchronized });
      if (synchronized) { markSynchronized(b, group); b.log("SynchronizedRelease", { group }); }
    }
    for (const p of b.portals.values()) tickPortal(b, p);
  }

  // ---------- End Phase ----------
  endPhase(): void {
    const b = this.b;
    b.phase = "End";
    b.log("PhaseStart", { phase: "End" });
    for (const u of [...b.activeUnits()]) {
      // damage over time from Unstable is applied by the ritual tick; here expire statuses
      u.statuses = u.statuses.map((s) => ({ ...s, roundsLeft: s.roundsLeft - 1 })).filter((s) => s.roundsLeft > 0 || s.status === "Routed");
      if (u.isClone) { u.cloneRoundsLeft = (u.cloneRoundsLeft ?? 1) - 1; if (u.cloneRoundsLeft <= 0) { b.log("CloneExpired", { uid: u.uid }); defeat(b, u, "expired"); } }
      if (u.divine && u.divine.manifestation <= 0 && u.divine.anchors <= 0) defeat(b, u, "Manifestation ended");
    }
    surroundedPenalty(b);
    for (const p of b.portals.values()) checkCaptureInterrupt(b, p);
    for (let i = timedTerrain.length - 1; i >= 0; i--) { const t = timedTerrain[i]!; t.rounds--; if (t.rounds <= 0) { b.terrain.delete(t.key); timedTerrain.splice(i, 1); } }
    tickFusions(b);
    this.evaluateVictory();
    if (!b.winner) { b.round++; b.phase = "Command"; }
    else b.phase = "Ended";
  }

  objectiveStatus(side: string): ObjectiveProgress[] { return (this.victory.sides[side] ?? []).map((o) => evaluateObjective(this.b, o)); }

  evaluateVictory(): void {
    const b = this.b;
    for (const side of Object.keys(this.victory.sides)) {
      const status = this.objectiveStatus(side);
      // all primary objectives satisfied -> win (objectives are ANDed; scenarios can encode OR by separate side entries later)
      if (status.length && status.some((s) => s.satisfied && (s.def.type !== "SurviveRounds" && s.def.type !== "DefendForRounds"))) { b.winner = side; b.winReason = status.filter((s) => s.satisfied).map((s) => s.def.type).join("+"); }
    }
    if (!b.winner && b.round >= this.victory.roundLimit) {
      b.winner = this.victory.roundLimitWinner ?? "draw";
      b.winReason = "Round limit";
    }
    // Universal win conditions, checked for every battle:
    // 1) the opponent has no units left, 2) the opponent's army leader is killed, 3) the opponent surrenders.
    if (!b.winner) for (const side of b.sides.keys()) {
      const other = [...b.sides.keys()].find((s) => s !== side) ?? "draw";
      const st = b.sides.get(side)!;
      const alive = [...b.activeUnits(side)].filter((u) => !u.isClone);
      if (alive.length === 0) { b.winner = other; b.winReason = "Wipeout"; break; }
      if (st.surrendered) { b.winner = other; b.winReason = "Surrender"; break; }
      const leader = st.leaderUid ? b.units.get(st.leaderUid) : undefined;
      if (leader && leader.defeated && !leader.fusedFrom) { b.winner = other; b.winReason = "Leader killed"; break; }
    }
    if (b.winner) b.log("BattleEnded", { winner: b.winner, reason: b.winReason });
  }

  /** Convenience: run the fixed phases; the caller drives activations between commandPhase() and objectivePhase(). */
  moraleSummary(side: string): { average: number; bands: Record<string, number> } {
    const us = [...this.b.activeUnits(side)].filter((u) => !u.isClone);
    const bands: Record<string, number> = {};
    for (const u of us) bands[moraleBand(u.morale)] = (bands[moraleBand(u.morale)] ?? 0) + 1;
    return { average: us.length ? Math.floor(us.reduce((s, u) => s + u.morale, 0) / us.length) : 0, bands };
  }
}

export { Battle, changeMorale };
export type { PlatoonState };
