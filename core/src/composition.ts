import type { Battle } from "./state.js";
import type { PlatoonState, DoctrineState, UnitDef } from "./types.js";
import type { Registry } from "./data.js";
import { canLead } from "./ranks.js";

export interface PlatoonBlueprint { id: string; side: string; faction: string; commander: string; second: string; elite: string; foot: string[] }
export interface ArmyBlueprint { side: string; capacity: number; platoons: PlatoonBlueprint[]; specialists: string[] }
export interface ValidationResult { ok: boolean; errors: string[]; capacityUsed: number }

/** Validate an army before deployment against the composition and command-limit rules. */
export function validateArmy(reg: Registry, army: ArmyBlueprint): ValidationResult {
  const errors: string[] = [];
  const slots = reg.rules.standardPlatoon.slots;
  let capacity = 0;
  const uniqueSeen = new Map<string, number>();
  const count = (id: string) => { const d = reg.unit(id); capacity += d.capacityCost; if (d.unique) uniqueSeen.set(id, (uniqueSeen.get(id) ?? 0) + 1); return d; };
  const require = (d: UnitDef, slot: string, pid: string) => {
    if (!d.slots.includes(slot as any)) errors.push(`${pid}: ${d.id} cannot fill ${slot}`);
    if (d.summonOnly || d.roles.includes("Boss") || d.roles.includes("Deity")) errors.push(`${pid}: ${d.id} is summon-only/boss/deity and cannot start deployed`);
  };
  for (const p of army.platoons) {
    require(count(p.commander), "Commander", p.id);
    require(count(p.second), "Second", p.id);
    require(count(p.elite), "Elite", p.id);
    if (p.foot.length !== slots["FootSoldier"]) errors.push(`${p.id}: needs exactly ${slots["FootSoldier"]} foot soldiers, has ${p.foot.length}`);
    for (const f of p.foot) require(count(f), "FootSoldier", p.id);
    const cd = reg.unit(p.commander);
    if (!canLead(reg.ranks.get(cd.faction), cd.factionRank, "Platoon")) errors.push(`${p.id}: rank ${cd.factionRank ?? "none"} of ${cd.id} may not lead a Platoon`);
    const sd = reg.unit(p.second);
    if (!canLead(reg.ranks.get(sd.faction), sd.factionRank, "Platoon")) errors.push(`${p.id}: second ${sd.id} holds rank ${sd.factionRank ?? "none"} and could not assume platoon command`);
    const factions = new Set([p.commander, p.second, p.elite, ...p.foot].map((id) => reg.unit(id).faction));
    if (factions.size > 1) errors.push(`${p.id}: mixed factions ${[...factions].join(",")}`);
    const wizards = [p.commander, p.second, p.elite].filter((id) => reg.unit(id).rank === "Wizard").length;
    if (wizards > reg.rules.limits.wizardsPerPlatoon) errors.push(`${p.id}: too many Wizards`);
  }
  for (const s of army.specialists) {
    const d = count(s);
    if (d.roles.includes("Commander") || d.roles.includes("Elite")) errors.push(`Specialist teams cannot unlock extra commanders or elites: ${s}`);
    if (d.summonOnly) errors.push(`${s} is summon-only`);
  }
  for (const [id, n] of uniqueSeen) if (n > reg.rules.limits.uniqueCopiesPerArmy) errors.push(`Unique unit ${id} appears ${n} times`);
  if (capacity > army.capacity) errors.push(`Army Capacity ${capacity} exceeds ${army.capacity}`);
  return { ok: errors.length === 0, errors, capacityUsed: capacity };
}

/** Live members (not defeated, not clones). Clones never satisfy composition. */
function live(b: Battle, uid: string | null): boolean {
  if (!uid) return false;
  const u = b.units.get(uid);
  return !!u && !u.defeated && !u.isClone && !!u.pos;
}

export function activeLeader(b: Battle, p: PlatoonState): string | null {
  if (live(b, p.commanderUid)) return p.commanderUid;
  return null;
}

/**
 * Full: leader + elite + 5 foot. Reduced: leader + elite + 3-4 foot. Broken otherwise.
 * Continuity: after the commander falls, Doctrine stays active through the next Command Phase while succession occurs.
 */
export function doctrineState(b: Battle, p: PlatoonState): DoctrineState {
  const tbl = b.reg.rules.standardPlatoon.doctrine;
  const foot = p.footUids.filter((u) => live(b, u)).length;
  const elite = live(b, p.eliteUid);
  const leader = !!activeLeader(b, p) || p.continuityRoundsLeft > 0;
  if (!leader || !elite || foot < tbl.reduced.minFoot) return "Broken";
  return foot >= tbl.full.minFoot ? "Full" : "Reduced";
}

/** Organization detection for the whole side (Platoon / Company). */
export function organizationLevel(b: Battle, side: string): "None" | "Platoon" | "Company" {
  const full = [...b.platoons.values()].filter((p) => p.side === side && doctrineState(b, p) !== "Broken").length;
  if (full >= 3) return "Company";
  return full >= 1 ? "Platoon" : "None";
}
