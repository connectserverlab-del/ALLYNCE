import type { Battle } from "./state.js";
import type { UnitState, PlatoonState } from "./types.js";
import { commandRadiusOf, privileges } from "./ranks.js";

export type MoraleBand = "Steady" | "Shaken" | "Disordered" | "Routed" | "Broken";
export function moraleBand(m: number): MoraleBand {
  if (m >= 70) return "Steady";
  if (m >= 40) return "Shaken";
  if (m >= 20) return "Disordered";
  if (m >= 1) return "Routed";
  return "Broken";
}

export function changeMorale(b: Battle, u: UnitState, delta: number, reason: string): void {
  if (u.isClone || b.def(u).divine) return; // clones and divine entities have no morale
  const before = u.morale;
  u.morale = Math.max(0, Math.min(100, u.morale + delta));
  if (u.morale !== before) b.log("Morale", { uid: u.uid, delta, reason, morale: u.morale, band: moraleBand(u.morale) });
  syncRouted(b, u);
}

export function platoonMorale(b: Battle, p: PlatoonState, delta: number, reason: string): void {
  for (const uid of platoonMembers(p)) { const u = b.units.get(uid); if (u && !u.defeated) changeMorale(b, u, delta, reason); }
}
export function platoonMembers(p: PlatoonState): string[] {
  return [p.commanderUid, p.secondUid, p.eliteUid, ...p.footUids].filter((x): x is string => !!x);
}

/** Routed/Broken statuses follow the morale value unless an order prevents routing. */
function syncRouted(b: Battle, u: UnitState): void {
  const band = moraleBand(u.morale);
  const prevented = tempPreventRouted.has(u.uid);
  if ((band === "Routed" || band === "Broken") && !prevented) { if (!b.hasStatus(u, "Routed")) b.addStatus(u, "Routed", 99, "Morale"); }
  else b.removeStatus(u, "Routed");
}
export const tempPreventRouted = new Set<string>();

/** Morale recovery at round start: +5 inside a live commander's command radius. */
export function commandRadiusRecovery(b: Battle): void {
  for (const u of b.activeUnits()) {
    if (u.isClone || !u.platoonId) continue;
    const p = b.platoon(u.platoonId);
    const leader = p.commanderUid ? b.units.get(p.commanderUid) : undefined;
    if (leader && !leader.defeated && leader.pos && leader.uid !== u.uid) {
      const radius = commandRadiusOf(b, leader);
      if (b.distance(leader, u) <= radius) {
        changeMorale(b, u, 5, "Inside command radius");
        if (privileges(b, leader).banner) changeMorale(b, u, 5, "Rank: banner");
      }
    }
  }
}

/** Flanked/surrounded penalty each round: adjacent enemies on two or more distinct non-adjacent sides. */
export function surroundedPenalty(b: Battle): void {
  for (const u of b.activeUnits()) {
    if (u.isClone) continue;
    if (b.adjacentEnemies(u).filter((e) => !e.isClone).length >= 3) changeMorale(b, u, -5, "Flanked or surrounded");
  }
}
