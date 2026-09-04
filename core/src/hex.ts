/** Axial hex coordinates (pointy-top). The grid is invisible under terrain; this is pure math. */
export interface Hex { q: number; r: number }

export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export const hexKey = (h: Hex): string => `${h.q},${h.r}`;
export const hexEq = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;
export const hexAdd = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export const hexNeighbors = (h: Hex): Hex[] => DIRECTIONS.map((d) => hexAdd(h, d));

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q, dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}
export const isAdjacent = (a: Hex, b: Hex): boolean => hexDistance(a, b) === 1;

/** Facing is a direction index 0..5. */
export type Facing = 0 | 1 | 2 | 3 | 4 | 5;

/** Direction index from `from` toward `to` (nearest of the six, by screen-space angle). */
export function directionTo(from: Hex, to: Hex): Facing {
  const dq = to.q - from.q, dr = to.r - from.r;
  const x = Math.sqrt(3) * (dq + dr / 2), y = 1.5 * dr;
  const ang = Math.atan2(y, x);
  let best = 0, bestDiff = Infinity;
  for (let i = 0; i < 6; i++) {
    const d = DIRECTIONS[i]!;
    const dx = Math.sqrt(3) * (d.q + d.r / 2), dy = 1.5 * d.r;
    let diff = Math.abs(Math.atan2(dy, dx) - ang);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best as Facing;
}

export type AttackArc = "front" | "flank" | "rear";

/** Given a defender facing and attacker position, classify the arc. */
export function attackArc(defenderPos: Hex, defenderFacing: Facing, attackerPos: Hex): AttackArc {
  const incoming = directionTo(defenderPos, attackerPos);
  const diff = Math.min((incoming - defenderFacing + 6) % 6, (defenderFacing - incoming + 6) % 6);
  if (diff === 0) return "front";
  if (diff === 3) return "rear";
  if (diff === 1) return "front"; // the two front-adjacent hexes count as front
  return "flank";
}

export function hexRing(center: Hex, radius: number): Hex[] {
  if (radius === 0) return [center];
  const out: Hex[] = [];
  let h = hexAdd(center, { q: DIRECTIONS[4]!.q * radius, r: DIRECTIONS[4]!.r * radius });
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      out.push(h);
      h = hexAdd(h, DIRECTIONS[side]!);
    }
  }
  return out;
}
export function hexesWithin(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let r = 0; r <= radius; r++) out.push(...hexRing(center, r));
  return out;
}
