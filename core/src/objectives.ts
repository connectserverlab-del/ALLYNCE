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

const holdCounters = new WeakMap<Battle, Map<string, number>>();
function counters(b: Battle): Map<string, number> { let m = holdCounters.get(b); if (!m) { m = new Map(); holdCounters.set(b, m); } return m; }

export function evaluateObjective(b: Battle, o: ObjectiveDef): ObjectiveProgress {
  switch (o.type) {
    case "EliminateLeader": {
      const t = [...b.units.values()].find((u) => u.defId === o.targetDefId && u.side !== o.side);
      return { def: o, satisfied: !!t && t.defeated, detail: t ? `${b.def(t).name} ${t.defeated ? "defeated" : `HP ${t.hp}`}` : "target not present" };
    }
    case "DefendForRounds":
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
      const n = [...b.portals.values()].filter((p) => p.side !== o.side && (p.state === "Destroyed" || p.state === "Captured")).length;
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
      const key = `hold:${o.side}:${o.hex.q},${o.hex.r}`;
      const occ = b.unitAt(o.hex);
      const c = counters(b);
      const held = occ && occ.side === o.side && !occ.isClone && !b.def(occ).flying ? (c.get(key) ?? 0) + 1 : 0;
      c.set(key, held);
      return { def: o, satisfied: held >= o.rounds, detail: `held ${held}/${o.rounds}` };
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
