import type { Hex } from "./hex.js";
import { hexAdd, hexKey } from "./hex.js";
import type { GeneratedMap } from "./mapgen.js";

/**
 * Named ground on a generated field: an anchor, a deployment zone, or a `Landmarks` entry. A scenario
 * pins its rituals, portals and objectives to a role instead of a fixed [q, r] pair, so it still makes
 * sense after the field is regenerated with a different seed.
 */
export type PlacementRole =
  | "anchorA" | "anchorB" | "deployZoneA" | "deployZoneB"
  | "midpoint" | "trenchA" | "trenchB" | "ruins" | "fortification" | "ford" | "road";

/** A literal [q, r] pair, or a role on the generated map with an optional pick index and axial offset. */
export type Placement = [number, number] | { role: PlacementRole; index?: number; offset?: [number, number] };

function roleHexes(map: GeneratedMap, role: PlacementRole): Hex[] {
  switch (role) {
    case "anchorA": return [map.anchors.A];
    case "anchorB": return [map.anchors.B];
    case "deployZoneA": return map.deployZones.A;
    case "deployZoneB": return map.deployZones.B;
    case "midpoint": return [map.landmarks.midpoint];
    case "trenchA": return map.landmarks.trenchA;
    case "trenchB": return map.landmarks.trenchB;
    case "ruins": return map.landmarks.ruins;
    case "fortification": return map.landmarks.fortification;
    case "ford": return map.landmarks.ford;
    case "road": return map.landmarks.road;
  }
}

/**
 * Resolve a `Placement` against a generated map. A role whose feature did not generate on this seed
 * (an empty array, e.g. no ruins) falls back to the map's midpoint, which always resolves, rather than
 * throwing: a scenario built for one seed should still build, if less precisely, on another. A scenario
 * with a hand-authored fixed map (no `GeneratedMap`) may only use literal [q, r] placements.
 */
export function resolvePlacement(map: GeneratedMap | null, p: Placement): Hex {
  if (Array.isArray(p)) return { q: p[0], r: p[1] };
  if (!map) throw new Error(`Role-based placement "${p.role}" needs a generated map; this scenario has a fixed one`);
  const hexes = roleHexes(map, p.role);
  const base = hexes.length ? hexes[Math.min(p.index ?? 0, hexes.length - 1)]! : map.landmarks.midpoint;
  return p.offset ? hexAdd(base, { q: p.offset[0], r: p.offset[1] }) : base;
}

/** `resolvePlacement`, but nudged to the nearest hex the predicate accepts (an empty hex, e.g.), searching outward. */
export function resolveFreePlacement(map: GeneratedMap | null, p: Placement, accept: (h: Hex) => boolean, maxRadius = 4): Hex {
  const start = resolvePlacement(map, p);
  if (accept(start)) return start;
  const seen = new Set([hexKey(start)]);
  let ring = [start];
  for (let radius = 1; radius <= maxRadius; radius++) {
    const next: Hex[] = [];
    for (const h of ring) for (const d of [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }]) {
      const n = hexAdd(h, d), k = hexKey(n);
      if (seen.has(k)) continue;
      seen.add(k);
      next.push(n);
      if (accept(n)) return n;
    }
    ring = next;
  }
  return start;
}
