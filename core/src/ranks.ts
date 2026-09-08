import type { Battle } from "./state.js";
import type { Modifier, UnitState } from "./types.js";

export interface RankPrivileges {
  twoSwords?: boolean;
  mounted?: "war" | "always";
  commandRadiusBonus?: number;
  banner?: boolean;
  castle?: boolean;
  canopy?: boolean;
  hideOnForestStop?: boolean;
  ignoreZoc?: boolean;
  passAllies?: boolean;
  bonusMov?: number;
  shadowStep?: number;
}

export interface RankDef {
  id: string; title: string; tier: number; description: string;
  privileges: RankPrivileges; canLead: string[];
}

export interface RankLadder {
  faction: string; notes?: string; ranks: RankDef[]; privilegeRules: Record<string, string>;
}

export function rankOf(b: Battle, u: UnitState): RankDef | undefined {
  return b.reg.rankOf(b.def(u));
}

export function rankPrivileges(b: Battle, u: UnitState): RankPrivileges | undefined {
  return rankOf(b, u)?.privileges;
}

/** Base command radius plus any rank privilege bonus, used for auras, morale recovery and rank-granted effects. */
export function effectiveCommandRadius(b: Battle, u: UnitState): number {
  const d = b.def(u);
  return (d.commandRadius ?? 0) + (rankPrivileges(b, u)?.commandRadiusBonus ?? 0);
}

/** Extra Movement from a rank's `mounted` or `bonusMov` privilege. */
export function rankMovementBonus(b: Battle, u: UnitState): number {
  const priv = rankPrivileges(b, u);
  if (!priv) return 0;
  let bonus = priv.bonusMov ?? 0;
  if (priv.mounted === "always") bonus += 1;
  else if (priv.mounted === "war") {
    const enemySide = u.side === "A" ? "B" : "A";
    for (const e of b.activeUnits(enemySide)) if (b.distance(u, e) <= 6) { bonus += 1; break; }
  }
  return bonus;
}

/** A leader's `castle` privilege: allies within its command radius on a Fortification hex gain +100 DEF. */
export function castleDefBonus(b: Battle, u: UnitState): Modifier | null {
  if (!u.platoonId || !u.pos) return null;
  const p = b.platoon(u.platoonId);
  for (const leaderUid of [p.commanderUid, p.secondUid]) {
    if (!leaderUid || leaderUid === u.uid) continue;
    const leader = b.units.get(leaderUid);
    if (!leader || leader.defeated || !leader.pos) continue;
    const priv = rankPrivileges(b, leader);
    if (!priv?.castle) continue;
    if (b.distance(leader, u) <= effectiveCommandRadius(b, leader)) {
      return { source: `Rank: ${rankOf(b, leader)!.title} (castle)`, stat: "DEF", value: 100 };
    }
  }
  return null;
}
