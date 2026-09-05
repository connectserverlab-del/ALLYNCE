import type { Battle } from "./state.js";
import type { UnitState } from "./types.js";
import type { Hex } from "./hex.js";
import { hexDistance } from "./hex.js";
import { applyDamage } from "./combat.js";
import { changeMorale } from "./morale.js";

export type RitualState = "Inactive" | "Preparing" | "Channeling" | "CompletedReleased" | "CompletedHeld" | "Disrupted" | "Collapsed";

export interface RitualCircle {
  id: string; side: string; center: Hex; radius: number;
  required: number; progress: number; state: RitualState;
  leaderUid: string | null; participantUids: string[];
  summonDefId: string | null; linkGroup: string | null;
  heldRounds: number; unstableStacks: number;
  damagedThisRound: Set<string>; disruption: number; assistBonus: number;
  lastCalc?: RitualCalc;
}
export interface RitualCalc { channeling: number; leaderKnowledge: number; leaderLanguage: number; teamAffinity: number; assist: number; holding: number; disruption: number; total: number; participants: string[] }

export function createRitual(b: Battle, r: Omit<RitualCircle, "progress" | "state" | "heldRounds" | "unstableStacks" | "damagedThisRound" | "disruption" | "assistBonus" | "participantUids">): RitualCircle {
  const circle: RitualCircle = { ...r, progress: 0, state: "Inactive", heldRounds: 0, unstableStacks: 0, damagedThisRound: new Set(), disruption: 0, assistBonus: 0, participantUids: [] };
  b.rituals.set(circle.id, circle);
  return circle;
}

/** Participants: ritualists of the owning side inside the circle radius, not Silenced, not clones, not Routed. */
export function ritualParticipants(b: Battle, r: RitualCircle): UnitState[] {
  const out: UnitState[] = [];
  for (const u of b.activeUnits(r.side)) {
    const d = b.def(u);
    if (!d.ritual || u.isClone || !u.pos) continue;
    if (hexDistance(u.pos, r.center) > r.radius) continue;
    if (b.hasStatus(u, "Silenced") || b.hasStatus(u, "Routed")) continue;
    if (d.flying) continue; // flying units cannot perform rituals while airborne
    out.push(u);
  }
  return out;
}

export function onRitualistDamaged(b: Battle, u: UnitState): void {
  for (const r of b.rituals.values()) if (r.side === u.side) r.damagedThisRound.add(u.uid);
}

/** Progress = Sum(Channeling) + LeaderKnowledge + LeaderLanguage + TeamAffinity + AssistBonuses + Holding - Disruption */
export function computeRitualProgress(b: Battle, r: RitualCircle): RitualCalc {
  const parts = ritualParticipants(b, r);
  const leader = parts.find((p) => p.uid === r.leaderUid) ?? parts.slice().sort((a, c) => (b.def(c).ritual!.knowledge + b.def(c).ritual!.language) - (b.def(a).ritual!.knowledge + b.def(a).ritual!.language))[0];
  let channeling = 0, teamAffinity = 0;
  for (const p of parts) {
    const rt = b.def(p).ritual!;
    // taking damage this round halves that ritualist's contribution
    channeling += r.damagedThisRound.has(p.uid) ? Math.floor(rt.channeling / 2) : rt.channeling;
    teamAffinity += rt.affinity;
  }
  teamAffinity = parts.length ? Math.floor(teamAffinity / parts.length) : 0;
  const leaderKnowledge = leader ? b.def(leader).ritual!.knowledge : 0;
  const leaderLanguage = leader ? b.def(leader).ritual!.language : 0;
  // the holding's completed research (RitualProgress effect) speeds channeling, same as any other named contribution
  const holding = parts.length ? (b.kingdomEffects.get(r.side)?.ritualProgress ?? 0) : 0;
  const disruption = r.disruption + r.unstableStacks; // instability raises the effect of enemy disruption
  const total = parts.length ? Math.max(0, channeling + leaderKnowledge + leaderLanguage + teamAffinity + r.assistBonus + holding - disruption) : 0;
  return { channeling, leaderKnowledge, leaderLanguage, teamAffinity, assist: r.assistBonus, holding, disruption, total, participants: parts.map((p) => p.uid) };
}

/** Objective Phase tick for one ritual. */
export function tickRitual(b: Battle, r: RitualCircle): void {
  if (r.state === "Collapsed" || r.state === "CompletedReleased") return;
  const calc = computeRitualProgress(b, r);
  r.lastCalc = calc;
  r.participantUids = calc.participants;

  if (r.state === "CompletedHeld") {
    // Holding adds a stack of Unstable each round; each stack deals increasing damage to participating ritualists.
    r.heldRounds++;
    r.unstableStacks++;
    const dmg = 100 * r.unstableStacks;
    for (const uid of calc.participants) { const u = b.unit(uid); b.addStatus(u, "Unstable", 1, r.id); applyDamage(b, u, dmg, `Unstable ritual ${r.id}`); }
    b.log("RitualHeld", { ritual: r.id, heldRounds: r.heldRounds, unstable: r.unstableStacks, damage: dmg });
    if (calc.participants.length === 0) collapse(b, r, "All ritualists lost while holding");
    r.damagedThisRound.clear(); r.disruption = 0; r.assistBonus = 0;
    return;
  }

  if (calc.participants.length === 0) {
    if (r.state === "Channeling" || r.state === "Preparing") { r.state = "Disrupted"; b.log("RitualDisrupted", { ritual: r.id }); }
    r.damagedThisRound.clear(); r.disruption = 0; r.assistBonus = 0;
    return;
  }
  if (r.state === "Inactive" || r.state === "Disrupted") r.state = "Preparing";
  if (r.state === "Preparing") { r.state = "Channeling"; }
  r.progress += calc.total;
  b.log("RitualProgress", { ritual: r.id, ...calc, progress: r.progress, required: r.required });
  if (r.progress >= r.required) {
    r.progress = r.required;
    r.state = "CompletedHeld"; // completion is always Held first; the owner decides to Release
    b.log("RitualCompleted", { ritual: r.id });
  }
  r.damagedThisRound.clear(); r.disruption = 0; r.assistBonus = 0;
}

export function collapse(b: Battle, r: RitualCircle, reason: string): void {
  r.state = "Collapsed"; r.progress = 0;
  b.log("RitualCollapsed", { ritual: r.id, reason });
  for (const u of b.activeUnits(r.side)) if (u.platoonId === null && b.def(u).ritual) changeMorale(b, u, -10, "Ritual collapsed");
  for (const u of b.activeUnits()) if (u.side !== r.side) changeMorale(b, u, 10, "Objective completed: ritual collapsed");
}

/** Enemy action: strike the circle (an attack on a participant already counts). Adds Disruption for the round. */
export function disruptRitual(b: Battle, r: RitualCircle, amount: number, by: string): void {
  r.disruption += amount;
  b.log("RitualDisruption", { ritual: r.id, amount, by });
  // A held, unstable ritual collapses when disruption reaches its instability
  if (r.state === "CompletedHeld" && r.unstableStacks >= 3 && r.disruption >= r.unstableStacks) collapse(b, r, "Disruption overwhelmed unstable hold");
}

/** Assist action by a non-ritualist adjacent ally: +1 progress this round. */
export function assistRitual(b: Battle, r: RitualCircle, u: UnitState): boolean {
  if (!u.pos || hexDistance(u.pos, r.center) > r.radius + 1 || u.side !== r.side) return false;
  r.assistBonus += 1;
  b.log("RitualAssist", { ritual: r.id, uid: u.uid });
  return true;
}

/**
 * Release: the owner releases a completed ritual. If it belongs to a link group, the synchronized result requires every linked
 * ritual to be released in the same Objective Phase; otherwise the summon is weaker (manifestation reduced).
 */
export function releaseRitual(b: Battle, r: RitualCircle, opts: { synchronized: boolean }): UnitState | null {
  if (r.state !== "CompletedHeld") return null;
  r.state = "CompletedReleased";
  let summon: UnitState | null = null;
  if (r.summonDefId) {
    // Only one copy of a named Divine Entity may exist
    const exists = [...b.units.values()].some((u) => u.defId === r.summonDefId && !u.defeated);
    if (!exists) {
      const spot = [r.center, ...Array.from({ length: 6 }, (_, i) => i).map((i) => ({ q: r.center.q + [1, 1, 0, -1, -1, 0][i]!, r: r.center.r + [0, -1, -1, 0, 1, 1][i]! }))].find((h) => b.isFree(h));
      if (spot) {
        summon = b.spawn(r.summonDefId, r.side, spot, { uidPrefix: "div" });
        if (!opts.synchronized && summon.divine) { summon.divine.manifestation = Math.max(1, summon.divine.manifestation - 1); summon.divine.anchors = Math.max(1, summon.divine.anchors - 1); }
        arrivalEffect(b, summon);
      }
    }
  }
  b.log("RitualReleased", { ritual: r.id, synchronized: opts.synchronized, summon: summon?.uid ?? null });
  for (const u of b.activeUnits(r.side)) changeMorale(b, u, 10, "Objective completed: ritual released");
  return summon;
}

/** A Divine Entity's arrival changes the battlefield rather than only adding a big number. */
function arrivalEffect(b: Battle, div: UnitState): void {
  const kind = b.def(div).divine?.arrival;
  switch (kind) {
    case "RevealHidden": for (const u of b.activeUnits()) if (u.side !== div.side) b.addStatus(u, "Revealed", 0, "Sovereign of Memory"); break;
    case "FearPulse": for (const u of b.activeUnits()) if (u.side !== div.side && b.distance(div, u) <= 6) changeMorale(b, u, -15, "Sovereign of Torment manifests"); break;
    case "ReturnFallen": {
      const fallen = [...b.units.values()].filter((u) => u.defeated && u.side === div.side && !u.isClone && !u.divine).slice(0, 2);
      for (const f of fallen) {
        const spot = b.adjacentUnits(div).length < 6 ? [...Array(6).keys()].map((i) => ({ q: div.pos!.q + [1, 1, 0, -1, -1, 0][i]!, r: div.pos!.r + [0, -1, -1, 0, 1, 1][i]! })).find((h) => b.isFree(h)) : undefined;
        if (spot) { f.defeated = false; f.hp = Math.floor(b.def(f).hp / 2); f.morale = 50; b.place(f, spot); b.log("Reincarnated", { uid: f.uid }); }
      }
      if (div.divine) div.divine.manifestation = Math.max(0, div.divine.manifestation - 1);
      break;
    }
  }
  b.log("DivineManifested", { uid: div.uid, def: div.defId, arrival: kind });
}

export function linkedGroup(b: Battle, group: string): RitualCircle[] { return [...b.rituals.values()].filter((r) => r.linkGroup === group); }
