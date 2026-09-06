import type { Battle } from "./state.js";
import type { UnitState, Modifier, StatBreakdown, DoctrineState } from "./types.js";
import { themeCohesionBonus } from "./cohesion.js";
import { doctrineState } from "./composition.js";
import { commandBonus } from "./command.js";
import { moraleBand } from "./morale.js";
import { attackArc, type AttackArc } from "./hex.js";

export interface CombatContext { attacker?: UnitState; defender?: UnitState; arc?: AttackArc; ranged?: boolean }

/**
 * Modifier pipeline. Every contribution records its source so the UI can show the breakdown
 * instead of only the final number. Order: Base + ThemeCohesion + Composition + Command + Status + Terrain (+ ability conditionals).
 */
export function computeStat(b: Battle, u: UnitState, stat: "ATK" | "DEF", ctx: CombatContext = {}): StatBreakdown {
  const d = b.def(u);
  const mods: Modifier[] = [];
  const isDivine = !!d.divine;
  const base = stat === "ATK" ? (u.isClone ? (u.cloneAtk ?? 0) : d.atk) : d.def;

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

  // 6. Terrain
  if (u.pos && !d.flying) {
    const t = b.terrainAt(u.pos);
    if (stat === "DEF" && t === "Fortification") mods.push({ source: "Terrain: Fortification", stat, value: 200 });
    if (stat === "ATK" && t === "HighGround" && ctx.ranged) mods.push({ source: "Terrain: High Ground", stat, value: 100 });
  }

  // 7. Ability conditionals and platoon orders (data-driven)
  if (!u.isClone) mods.push(...abilityModifiers(b, u, stat, ctx));

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
  // Auras projected by nearby allies (Oathlight, Host Aloft, Stormbond, Two Schools)
  out.push(...auraModifiers(b, u, stat));

  // Platoon-level marked target (Coordinated Cut)
  if (stat === "ATK" && u.platoonId && target) {
    const p = b.platoon(u.platoonId);
    if (p.markedTarget && p.markedTarget.uid === target.uid) out.push({ source: "Order: Coordinated Cut", stat, value: p.markedTarget.atk });
  }
  // Per-unit temporary modifiers from orders / charges
  for (const m of tempMods(u)) if (m.stat === stat) out.push(m);
  return out;
}

/**
 * AuraStat passives. The aura is read from the projecting ally, never from the
 * receiver, so a unit never buffs itself twice and auras of the same name do not stack.
 */
function auraModifiers(b: Battle, u: UnitState, stat: "ATK" | "DEF"): Modifier[] {
  const d = b.def(u);
  const best = new Map<string, Modifier>();
  for (const ally of b.activeUnits(u.side)) {
    if (ally.uid === u.uid || ally.isClone) continue;
    const ad = b.def(ally);
    for (const id of ad.passives) {
      const a = b.reg.ability(id);
      const e = a.effect as Record<string, any>;
      if (e.kind !== "AuraStat" || e.stat !== stat) continue;
      if (b.distance(u, ally) > e.radius) continue;
      if (e.theme && !d.themes.includes(e.theme)) continue;
      if (e.sameFusion && !(d.fusion && ad.fusion)) continue;
      const prev = best.get(a.name);
      if (!prev || prev.value < e.value) best.set(a.name, { source: a.name, stat, value: e.value });
    }
  }
  return [...best.values()];
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
