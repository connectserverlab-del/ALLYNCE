import type { Battle } from "./state.js";
import type { UnitState, Terrain } from "./types.js";
import { TERRAIN_RULES } from "./types.js";

export type Organization = "Patrol" | "Platoon" | "Company" | "Battalion" | "Army";
export interface RankPrivileges { twoSwords?: boolean; mounted?: "war" | "always"; commandRadiusBonus?: number; banner?: boolean; castle?: boolean; supreme?: boolean }
export interface RankDef { id: string; title: string; tier: number; description: string; koku?: [number, number | null]; privileges: RankPrivileges; canLead: Organization[]; movement?: MovementTraits }
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
  return (b.def(u).commandRadius ?? 0) + (privileges(b, u).commandRadiusBonus ?? 0) + (b.kingdomEffects.get(u.side)?.commandRadius ?? 0);
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

/** Movement cost of entering `t` for this unit: flying / cavalry / foot column of the terrain table, then rank traits. */
export function terrainCostFor(b: Battle, u: UnitState, t: Terrain): number | null {
  const d = b.def(u); const rule = TERRAIN_RULES[t];
  let cost = d.flying ? rule.costFlying : d.roles.includes("Cavalry") ? rule.costCavalry : rule.costFoot;
  const traits = movementTraits(b, u);
  if (t === "Forest" && traits.canopy && cost !== null) cost = 1;               // tree to tree
  if (t === "Mud" && traits.surefoot && cost !== null) cost = Math.min(cost, 1);
  if ((t === "Water" || t === "Ford") && traits.waterwalk) cost = 1;
  if (t === "Mountain" && traits.climber && cost !== null) cost = Math.min(cost, 3);
  return cost;
}

export interface MovementTraits { canopy?: boolean; surefoot?: boolean; waterwalk?: boolean; climber?: boolean; ignoreZoc?: boolean; passAllies?: boolean; hideOnForestStop?: boolean; bonusMov?: number; shadowStep?: number }
export function movementTraits(b: Battle, u: UnitState): MovementTraits { return (rankOf(b, u)?.movement ?? {}) as MovementTraits; }
