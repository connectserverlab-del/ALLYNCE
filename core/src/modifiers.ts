import type { Battle } from "./state.js";
import type { UnitState, Modifier, StatBreakdown, DoctrineState } from "./types.js";
import { TERRAIN_RULES } from "./types.js";
import { themeCohesionBonus } from "./cohesion.js";
import { doctrineState } from "./composition.js";
import { commandBonus } from "./command.js";
import { moraleBand, platoonMembers } from "./morale.js";
import { attackArc, hexDistance, type AttackArc } from "./hex.js";
import { privileges, commandRadiusOf } from "./ranks.js";
import { kingdomMods } from "./kingdom.js";

export interface CombatContext { attacker?: UnitState; defender?: UnitState; arc?: AttackArc; ranged?: boolean; reaction?: boolean }

/**
 * Modifier pipeline. Every contribution records its source so the UI can show the breakdown
 * instead of only the final number. Order: Base + ThemeCohesion + Composition + Command + Status + Terrain (+ ability conditionals).
 */
export function computeStat(b: Battle, u: UnitState, stat: "ATK" | "DEF", ctx: CombatContext = {}): StatBreakdown {
  const d = b.def(u);
  const mods: Modifier[] = [];
  const isDivine = !!d.divine;
  // Copies are not free strength. A body that has split shares its attack and defence out across
  // itself and every living copy, so three of a thing hit for what one of it used to.
  const base = Math.floor((stat === "ATK" ? d.atk : d.def) / Math.max(1, u.splitBodies ?? 1));

  if (!u.isClone && !isDivine) {
    // 1. Theme Cohesion (capped at +100 when Disordered)
    const band = moraleBand(u.morale);
    const cohesion = themeCohesionBonus(b, u, band === "Disordered" ? b.reg.rules.themeCohesion.disorderedCap : undefined);
    if (cohesion > 0) mods.push({ source: "Theme Cohesion", stat, value: cohesion });

    // 2. Composition (Platoon Doctrine)
    if (u.platoonId) {
      const ds: DoctrineState = doctrineState(b, b.platoon(u.platoonId));
      const tbl = b.reg.rules.standardPlatoon.doctrine;
      const v = ds === "Full" ? tbl.full : ds === "Reduced" ? tbl.reduced : tbl.broken;
      const val = stat === "ATK" ? v.atk : v.def;
      if (val) mods.push({ source: `Platoon Doctrine (${ds})`, stat, value: val });
    }

    // 3. Command aura (strongest eligible only, never stacked)
    const cmd = commandBonus(b, u, stat);
    if (cmd) mods.push(cmd);

    // 4. Morale band
    if (band === "Shaken") mods.push({ source: "Morale: Shaken", stat, value: -50 });
  }

  // 5. Statuses
  if (stat === "DEF") {
    if (b.hasStatus(u, "Guarded") || u.defending) mods.push({ source: u.defending ? "Defend action" : "Status: Guarded", stat, value: 150 });
    if (b.hasStatus(u, "Exposed")) mods.push({ source: "Status: Exposed", stat, value: -150 });
  }

  // 6. Terrain (from the rules table) and elevation
  if (u.pos && !d.flying) {
    const t = b.terrainAt(u.pos); const rule = TERRAIN_RULES[t];
    if (stat === "DEF" && rule.def) mods.push({ source: `Terrain: ${t}`, stat, value: rule.def });
    if (stat === "ATK" && ctx.ranged && rule.ranged.atk) mods.push({ source: `Terrain: ${t}`, stat, value: rule.ranged.atk });
  }
  if (stat === "ATK" && ctx.attacker === u && ctx.defender?.pos && u.pos && !d.flying && b.elevationAt(u.pos) > b.elevationAt(ctx.defender.pos)) mods.push({ source: "Elevation advantage", stat, value: 50 });

  // 7. Ability conditionals and platoon orders (data-driven)
  if (!u.isClone) mods.push(...abilityModifiers(b, u, stat, ctx));

  // 8. Siege: breaching shot against fortified targets
  if (stat === "ATK" && ctx.attacker === u && d.siege && ctx.defender?.pos && d.passives.includes("ABL_BREACHING_SHOT")) {
    const t = b.terrainAt(ctx.defender.pos);
    if (t === "Fortification" || t === "Ruins" || t === "Trench") mods.push({ source: "Breaching Shot", stat, value: d.siege.structureAtk });
  }

  // 9. Holding: buildings and completed research
  if (!u.isClone && !isDivine) mods.push(...kingdomMods(b, u.side, d.roles, stat));

  // 10. Faction rank privileges
  if (!u.isClone && !isDivine) {
    const pv = privileges(b, u);
    if (stat === "ATK" && ctx.reaction && pv.twoSwords) mods.push({ source: "Rank: two swords (reaction)", stat, value: 50 });
    if (stat === "DEF" && u.pos && b.terrainAt(u.pos) === "Fortification" && castleLordNearby(b, u)) mods.push({ source: "Rank: castle lord nearby", stat, value: 100 });
  }

  // Divine entities' stats scale down with lost anchors
  let final = base + mods.reduce((s, m) => s + m.value, 0);
  if (isDivine && u.divine) {
    const lost = d.divine!.anchors - u.divine.anchors;
    if (lost > 0) { const pen = -Math.round(base * 0.15 * lost); mods.push({ source: `Anchors broken x${lost}`, stat, value: pen }); final += pen; }
  }

  // Positional: flank/rear reduce defender's DEF as a percentage for that attack (applied after additive modifiers)
  if (stat === "DEF" && ctx.arc && ctx.arc !== "front") {
    const pct = ctx.arc === "flank" ? 0.10 : 0.25;
    const pen = -Math.round(final * pct);
    mods.push({ source: `Attacked from ${ctx.arc}`, stat, value: pen });
    final += pen;
  }
  return { base, modifiers: mods, final: Math.max(0, final) };
}

function abilityModifiers(b: Battle, u: UnitState, stat: "ATK" | "DEF", ctx: CombatContext): Modifier[] {
  const d = b.def(u);
  const out: Modifier[] = [];
  const faction = b.reg.factions.get(d.faction);
  const ids = [...d.passives, ...(faction?.passiveDoctrine ? [faction.passiveDoctrine] : [])];
  const target = ctx.attacker === u ? ctx.defender : ctx.attacker;
  for (const id of ids) {
    const a = b.reg.ability(id);
    const e = a.effect as Record<string, any>;
    if (e.kind === "ConditionalDef" && stat === "DEF") {
      if (e.role && !d.roles.includes(e.role)) continue;
      let ok = true;
      if (e.vsRole) ok = ok && !!target && b.def(target).roles.includes(e.vsRole);
      if (e.facing) ok = ok && ctx.arc === e.facing;
      if (e.requiresAdjacentUnit) ok = ok && b.adjacentAllies(u).some((x) => x.defId === e.requiresAdjacentUnit && !x.isClone);
      if (e.requiresAdjacentTheme) ok = ok && b.adjacentAllies(u).filter((x) => !x.isClone && b.def(x).themes.includes(e.requiresAdjacentTheme)).length >= (e.requiresAdjacentCount ?? 1);
      if (e.requiresAdjacentSameFacing) ok = ok && b.adjacentAllies(u).some((x) => !x.isClone && x.facing === u.facing && b.def(x).themes.some((t) => d.themes.includes(t)) && b.def(x).roles.includes("FootSoldier"));
      if (ok) out.push({ source: a.name, stat, value: e.def });
    }
    if (e.kind === "ConditionalAtk" && stat === "ATK" && target) {
      let ok = true;
      if (e.vsRoles) ok = ok && (e.vsRoles as string[]).some((r) => b.def(target).roles.includes(r as any));
      if (e.vsIsolated) ok = ok && b.isIsolated(target);
      if (ok) out.push({ source: a.name, stat, value: e.atk });
    }
  }
  // Platoon-level marked target (Coordinated Cut)
  if (stat === "ATK" && u.platoonId && target) {
    const p = b.platoon(u.platoonId);
    if (p.markedTarget && p.markedTarget.uid === target.uid) out.push({ source: "Order: Coordinated Cut", stat, value: p.markedTarget.atk });
  }
  // Per-unit temporary modifiers from orders / charges
  for (const m of tempMods(u)) if (m.stat === stat) out.push(m);
  return out;
}

const TEMP = new WeakMap<UnitState, Modifier[]>();
export function tempMods(u: UnitState): Modifier[] { return TEMP.get(u) ?? []; }
export function addTempMod(u: UnitState, m: Modifier): void { TEMP.set(u, [...tempMods(u), m]); }
export function clearTempMods(u: UnitState, predicate?: (m: Modifier) => boolean): void {
  if (!predicate) TEMP.delete(u); else TEMP.set(u, tempMods(u).filter((m) => !predicate(m)));
}

export function arcFor(b: Battle, attacker: UnitState, defender: UnitState): AttackArc {
  if (!attacker.pos || !defender.pos) return "front";
  return attackArc(defender.pos, defender.facing, attacker.pos);
}

/** Whether `u`'s own abilities or faction doctrine carry a passive of this effect kind. */
export function hasPassiveKind(b: Battle, u: UnitState, kind: string): boolean {
  const d = b.def(u);
  const faction = b.reg.factions.get(d.faction);
  const ids = [...d.passives, ...(faction?.passiveDoctrine ? [faction.passiveDoctrine] : [])];
  return ids.some((id) => b.reg.ability(id).effect.kind === kind);
}

/**
 * Unseen Network: a Hidden platoon-mate standing beside a Hidden enemy radios its position back, so
 * the platoon commander can strike it despite the range-1 rule that otherwise protects anything Hidden.
 * Only the unit actually holding the commander's slot benefits — which, after a succession, may be a
 * longer-ranged Second rather than the platoon's original melee leader.
 */
export function revealsHiddenTarget(b: Battle, attacker: UnitState, target: UnitState): boolean {
  if (!attacker.platoonId || !target.pos) return false;
  const p = b.platoon(attacker.platoonId);
  if (p.commanderUid !== attacker.uid || !hasPassiveKind(b, attacker, "SharedVision")) return false;
  return platoonMembers(p).some((uid) => {
    const m = b.units.get(uid);
    return !!m && m.uid !== attacker.uid && !m.defeated && m.pos && b.hasStatus(m, "Hidden") && hexDistance(m.pos, target.pos!) <= 1;
  });
}

/** A castle-holding rank on the same side whose command radius covers `u`. */
function castleLordNearby(b: Battle, u: UnitState): boolean {
  for (const l of b.activeUnits(u.side)) if (l.uid !== u.uid && privileges(b, l).castle && b.distance(l, u) <= commandRadiusOf(b, l)) return true;
  return false;
}
