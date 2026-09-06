import type { Hex } from "./hex.js";
import { hexAlong } from "./hex.js";
import type { GeneratedMap } from "./mapgen.js";
import { nearestOpenHex } from "./mapgen.js";

/**
 * Where a scenario feature sits on the field. A literal `[q, r]` pins it to a fixed hand-authored map, exactly
 * as before. A role pins it relative to the field's own landmarks instead, so the same scenario file plays out
 * on any regeneration of that field: the deployment anchors move, but "five hexes toward the enemy from ours"
 * still means the same thing.
 */
export type FieldRole =
  | { role: "anchor"; side: string }
  | { role: "deployZone"; side: string; index: number }
  | { role: "along"; from: string; to: string; distance: number; lateral?: number };
export type Placement = [number, number] | FieldRole;

/** Resolve a placement to a concrete hex. Role placements need a generated map; literal hexes never do. */
export function resolvePlacement(map: GeneratedMap | null, placement: Placement): Hex {
  if (Array.isArray(placement)) return { q: placement[0], r: placement[1] };
  if (!map) throw new Error(`Role placement "${placement.role}" needs a generated field; this scenario's map is fixed`);
  const anchor = (side: string): Hex => {
    const a = (map.anchors as Record<string, Hex>)[side];
    if (!a) throw new Error(`No anchor for side "${side}"`);
    return a;
  };
  switch (placement.role) {
    case "anchor":
      return anchor(placement.side);
    case "deployZone": {
      const zone = (map.deployZones as Record<string, Hex[]>)[placement.side];
      if (!zone?.length) throw new Error(`No deploy zone for side "${placement.side}"`);
      return zone[((placement.index % zone.length) + zone.length) % zone.length]!;
    }
    case "along":
      return nearestOpenHex(map, hexAlong(anchor(placement.from), anchor(placement.to), placement.distance, placement.lateral ?? 0));
  }
}
