import type { Battle } from "./state.js";
import { linkedGroup } from "./rituals.js";

/** Composable, data-defined objectives. Each returns true when satisfied for its side. */
export type ObjectiveDef =
  | { type: "EliminateLeader"; side: string; targetDefId: string }
  | { type: "DefendForRounds"; side: string; rounds: number; uidOrPortal?: string }
  | { type: "CompleteRituals"; side: string; ritualIds: string[] }
  | { type: "SynchronizeRituals"; side: string; linkGroup: string }
  | { type: "CollapseRituals"; side: string; count: number }
  | { type: "DestroyPortals"; side: string; count: number }
  | { type: "MaintainPortals"; side: string; count: number; rounds: number }
  | { type: "SurviveRounds"; side: string; rounds: number }
  | { type: "MoraleBelow"; side: string; threshold: number }
  | { type: "CaptureHold"; side: string; hex: { q: number; r: number }; rounds: number }
  | { type: "Escort"; side: string; unitDefId: string; hex: { q: number; r: number } };

export interface ObjectiveProgress { def: ObjectiveDef; satisfied: boolean; detail: string }

interface HoldRecord { rounds: number; lastRound: number }
const holdCounters = new WeakMap<Battle, Map<string, HoldRecord>>();
function counters(b: Battle): Map<string, HoldRecord> { let m = holdCounters.get(b); if (!m) { m = new Map(); holdCounters.set(b, m); } return m; }

/** True while the named unit is undefeated, or the named portal is neither Destroyed nor Captured. */
function isDefended(b: Battle, uidOrPortal: string): boolean {
  const u = b.units.get(uidOrPortal);
  if (u) return !u.defeated;
  const p = b.portals.get(uidOrPortal);
  if (p) return p.state !== "Destroyed" && p.state !== "Captured";
  return false;
}

export function evaluateObjective(b: Battle, o: ObjectiveDef): ObjectiveProgress {
  switch (o.type) {
    case "EliminateLeader": {
      const t = [...b.units.values()].find((u) => u.defId === o.targetDefId && u.side !== o.side);
      return { def: o, satisfied: !!t && t.defeated, detail: t ? `${b.def(t).name} ${t.defeated ? "defeated" : `HP ${t.hp}`}` : "target not present" };
    }
    case "DefendForRounds": {
      const defended = !o.uidOrPortal || isDefended(b, o.uidOrPortal);
      return { def: o, satisfied: defended && b.round > o.rounds, detail: defended ? `Round ${b.round}/${o.rounds}` : "defended target lost" };
    }
    case "SurviveRounds":
      return { def: o, satisfied: b.round > o.rounds, detail: `Round ${b.round}/${o.rounds}` };
    case "CompleteRituals": {
      const done = o.ritualIds.filter((id) => b.rituals.get(id)?.state === "CompletedReleased").length;
      return { def: o, satisfied: done === o.ritualIds.length, detail: `${done}/${o.ritualIds.length} released` };
    }
    case "SynchronizeRituals": {
      const grp = linkedGroup(b, o.linkGroup);
      const synced = syncFlags.get(b)?.has(o.linkGroup) ?? false;
      return { def: o, satisfied: synced, detail: grp.map((r) => `${r.id}:${r.state}(${r.progress}/${r.required})`).join(" ") };
    }
    case "CollapseRituals": {
      const n = [...b.rituals.values()].filter((r) => r.side !== o.side && r.state === "Collapsed").length;
      return { def: o, satisfied: n >= o.count, detail: `${n}/${o.count} collapsed` };
    }
    case "DestroyPortals": {
      // A capture flips `side` to the new owner rather than ever setting state "Captured", so a portal
      // taken from the enemy is counted by current ownership, not by a state value nothing ever reaches.
      const n = [...b.portals.values()].filter((p) => p.originalSide !== o.side && (p.state === "Destroyed" || p.side === o.side)).length;
      return { def: o, satisfied: n >= o.count, detail: `${n}/${o.count} destroyed or captured` };
    }
    case "MaintainPortals": {
      const n = [...b.portals.values()].filter((p) => p.side === o.side && p.state === "Open").length;
      return { def: o, satisfied: n >= o.count && b.round > o.rounds, detail: `${n} open, round ${b.round}/${o.rounds}` };
    }
    case "MoraleBelow": {
      const enemies = [...b.activeUnits()].filter((u) => u.side !== o.side && !u.isClone);
      const avg = enemies.length ? Math.floor(enemies.reduce((s, u) => s + u.morale, 0) / enemies.length) : 0;
      return { def: o, satisfied: enemies.length > 0 && avg < o.threshold, detail: `enemy avg morale ${avg}` };
    }
    case "CaptureHold": {
      // Held rounds advance at most once per battle round no matter how many times a caller
      // (UI polling, AI planning, this same End Phase) evaluates the objective.
      const key = `hold:${o.side}:${o.hex.q},${o.hex.r}`;
      const occ = b.unitAt(o.hex);
      const c = counters(b);
      const rec = c.get(key) ?? { rounds: 0, lastRound: -1 };
      const holds = !!occ && occ.side === o.side && !occ.isClone && !b.def(occ).flying;
      if (holds) { if (rec.lastRound !== b.round) { rec.rounds += 1; rec.lastRound = b.round; } }
      else { rec.rounds = 0; rec.lastRound = -1; }
      c.set(key, rec);
      return { def: o, satisfied: rec.rounds >= o.rounds, detail: `held ${rec.rounds}/${o.rounds}` };
    }
    case "Escort": {
      const u = [...b.units.values()].find((x) => x.defId === o.unitDefId && x.side === o.side);
      const there = !!u && !u.defeated && !!u.pos && u.pos.q === o.hex.q && u.pos.r === o.hex.r;
      return { def: o, satisfied: there, detail: u ? (u.defeated ? "escort lost" : `escort at ${u.pos?.q},${u.pos?.r}`) : "no escort" };
    }
  }
}

/** Set by the battle loop when every ritual in a link group is released in the same Objective Phase. */
export const syncFlags = new WeakMap<Battle, Set<string>>();
export function markSynchronized(b: Battle, group: string): void { let s = syncFlags.get(b); if (!s) { s = new Set(); syncFlags.set(b, s); } s.add(group); }
