import type { Battle } from "./state.js";
import type { UnitState } from "./types.js";

export type Organization = "Patrol" | "Platoon" | "Company" | "Battalion" | "Army";
export interface RankPrivileges { twoSwords?: boolean; mounted?: "war" | "always"; commandRadiusBonus?: number; banner?: boolean; castle?: boolean; supreme?: boolean }
export interface RankDef { id: string; title: string; tier: number; description: string; koku?: [number, number | null]; privileges: RankPrivileges; canLead: Organization[] }
export interface RankLadder { faction: string; notes?: string; ranks: RankDef[]; privilegeRules: Record<string, string> }

/** Faction rank of a unit, if the faction has a ladder and the unit declares one. */
export function rankOf(b: Battle, u: UnitState): RankDef | undefined {
  const d = b.def(u);
  if (!d.factionRank) return undefined;
  return b.reg.ranks.get(d.faction)?.ranks.find((r) => r.id === d.factionRank);
}

export function privileges(b: Battle, u: UnitState): RankPrivileges { return rankOf(b, u)?.privileges ?? {}; }

/** Command radius including rank bonus. Used by auras, morale recovery and Predatory Airspace. */
export function commandRadiusOf(b: Battle, u: UnitState): number {
  return (b.def(u).commandRadius ?? 0) + (privileges(b, u).commandRadiusBonus ?? 0);
}

/** Mounted privilege: +1 MOV always, or only while an enemy is within 6 hexes ("war"). */
export function mountedMoveBonus(b: Battle, u: UnitState): number {
  const m = privileges(b, u).mounted;
  if (!m) return 0;
  if (m === "always") return 1;
  for (const e of b.activeUnits()) if (e.side !== u.side && b.distance(u, e) <= 6) return 1;
  return 0;
}

/** Whether a unit's rank permits leading the given organization. Units without a ladder are unrestricted. */
export function canLead(ladder: RankLadder | undefined, factionRank: string | undefined, org: Organization): boolean {
  if (!ladder) return true;
  const r = ladder.ranks.find((x) => x.id === factionRank);
  return !!r && r.canLead.includes(org);
}
