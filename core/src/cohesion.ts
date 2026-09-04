import type { Battle } from "./state.js";
import type { UnitState } from "./types.js";

/** Primary theme is the first theme tag. */
export function primaryTheme(b: Battle, u: UnitState): string | undefined { return b.def(u).themes[0]; }

/** Allies adjacent to `u` that share its primary theme. Clones neither grant nor receive cohesion. */
export function cohesionConnections(b: Battle, u: UnitState): UnitState[] {
  if (u.isClone) return [];
  const theme = primaryTheme(b, u);
  if (!theme) return [];
  return b.adjacentAllies(u).filter((a) => !a.isClone && !b.def(a).divine && primaryTheme(b, a) === theme);
}

/** ThemeBonus = min(4, AdjacentMatchingAllies) x 50, optionally capped (Disordered morale). */
export function themeCohesionBonus(b: Battle, u: UnitState, cap?: number): number {
  const r = b.reg.rules.themeCohesion;
  const n = Math.min(r.maxConnections, cohesionConnections(b, u).length);
  const v = n * r.perAdjacentAlly;
  return cap !== undefined ? Math.min(v, cap) : v;
}

/** Graph edges for UI overlay: pairs of uids that are cohesion-connected. */
export function cohesionEdges(b: Battle, side?: string): Array<[string, string]> {
  const seen = new Set<string>(); const out: Array<[string, string]> = [];
  for (const u of b.activeUnits(side)) for (const v of cohesionConnections(b, u)) {
    const k = [u.uid, v.uid].sort().join("|");
    if (!seen.has(k)) { seen.add(k); out.push([u.uid, v.uid]); }
  }
  return out;
}
