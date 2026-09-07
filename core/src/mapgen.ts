import type { Hex } from "./hex.js";
import { hexKey, hexNeighbors, hexDistance, hexesWithin } from "./hex.js";
import type { Terrain } from "./types.js";
import { TERRAIN_RULES } from "./types.js";
import { Rng } from "./rng.js";
import type { Battle } from "./state.js";

/**
 * Irregular battlefield generator. Real ground is uneven: the playable area is an odd blob carved from a canvas,
 * elevation comes from layered noise so mountains form ranges and valleys form floors, a river finds its own way
 * downhill, trenches are dug in front of each army, roads follow the cheapest route, mud gathers in the low wet ground.
 */
export interface MapSpec {
  seed: number; width?: number; height?: number;
  /** Target number of playable hexes. */
  size?: number;
  /** 0..1 how much of the area is forest. */
  forest?: number;
  /** 0..1 how rugged (mountain share). */
  rugged?: number;
  river?: boolean; trenches?: boolean; ruins?: boolean; name?: string;
}
export interface MapHex { q: number; r: number; terrain: Terrain; elevation: number }
export interface GeneratedMap {
  name: string; seed: number; width: number; height: number;
  hexes: MapHex[]; deployZones: { A: Hex[]; B: Hex[] }; anchors: { A: Hex; B: Hex };
  features: string[];
}

/** Axial -> pixel (pointy-top, size 1). */
export function hexToPixel(h: Hex): { x: number; y: number } { return { x: Math.sqrt(3) * (h.q + h.r / 2), y: 1.5 * h.r }; }

/** Seeded fractal value noise. */
class Noise {
  private grid: number[]; private n = 64;
  constructor(rng: Rng) { this.grid = Array.from({ length: this.n * this.n }, () => rng.next()); }
  private at(ix: number, iy: number): number { return this.grid[(((iy % this.n) + this.n) % this.n) * this.n + (((ix % this.n) + this.n) % this.n)]!; }
  value(x: number, y: number): number {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = this.at(x0, y0), b = this.at(x0 + 1, y0), c = this.at(x0, y0 + 1), d = this.at(x0 + 1, y0 + 1);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  }
  fractal(x: number, y: number, octaves = 3, lac = 2, gain = 0.5): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) { sum += amp * this.value(x * freq, y * freq); norm += amp; amp *= gain; freq *= lac; }
    return sum / norm;
  }
  /** Ridged noise: sharp crests for mountain ranges. */
  ridged(x: number, y: number): number { return 1 - Math.abs(this.fractal(x, y, 3) * 2 - 1); }
}

export function generateMap(spec: MapSpec): GeneratedMap {
  const rng = new Rng(spec.seed);
  const W = spec.width ?? 52, H = spec.height ?? 38;
  const target = spec.size ?? 950;
  const shapeN = new Noise(rng), elevN = new Noise(rng), ridgeN = new Noise(rng), forestN = new Noise(rng), wetN = new Noise(rng);
  const shapeOff = { x: rng.next() * 50, y: rng.next() * 50 }, elevOff = { x: rng.next() * 50, y: rng.next() * 50 };
  const ridgeOff = { x: rng.next() * 50, y: rng.next() * 50 }, forestOff = { x: rng.next() * 50, y: rng.next() * 50 };

  // --- 1. Odd-shaped playable mask: noise-warped blob, largest connected component, sized to target ---
  const all: Hex[] = [];
  for (let r = 0; r < H; r++) for (let q = -Math.floor(r / 2); q < W - Math.floor(r / 2); q++) all.push({ q, r });
  const center = hexToPixel({ q: Math.floor(W / 2) - Math.floor(H / 4), r: Math.floor(H / 2) });
  const radius = Math.min(W * Math.sqrt(3), H * 1.5) / 2;
  const score = (h: Hex) => {
    const p = hexToPixel(h);
    const dx = (p.x - center.x) / (radius * 1.15), dy = (p.y - center.y) / (radius * 0.95);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const n = shapeN.fractal(p.x * 0.09 + shapeOff.x, p.y * 0.09 + shapeOff.y, 3);
    return (1 - dist) * 0.65 + (n - 0.5) * 0.9;
  };
  let mask = new Set<string>();
  let lo = -1, hi = 1;
  for (let it = 0; it < 18; it++) {
    const th = (lo + hi) / 2;
    const cand = new Set(all.filter((h) => score(h) > th).map(hexKey));
    const comp = largestComponent(cand);
    if (comp.size > target) lo = th; else hi = th;
    mask = comp;
  }
  const hexes = all.filter((h) => mask.has(hexKey(h)));
  const inMask = (h: Hex) => mask.has(hexKey(h));

  // --- 2. Elevation: rolling base + ridged mountain term ---
  const elev = new Map<string, number>();
  const rugged = spec.rugged ?? 0.35;
  for (const h of hexes) {
    const p = hexToPixel(h);
    const base = elevN.fractal(p.x * 0.07 + elevOff.x, p.y * 0.07 + elevOff.y, 3);
    const ridge = ridgeN.ridged(p.x * 0.05 + ridgeOff.x, p.y * 0.05 + ridgeOff.y);
    elev.set(hexKey(h), base * (1 - rugged) + ridge * rugged * 1.2);
  }
  const sorted = [...elev.values()].sort((a, b) => a - b);
  const pct = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))]!;
  const mountainCut = pct(1 - 0.13 * (rugged / 0.35)), highCut = pct(0.78), valleyCut = pct(0.22);
  const terrain = new Map<string, Terrain>();
  const tier = new Map<string, number>();
  for (const h of hexes) {
    const e = elev.get(hexKey(h))!;
    let t: Terrain = "Open"; let z = 1;
    if (e >= mountainCut) { t = "Mountain"; z = 3; } else if (e >= highCut) { t = "HighGround"; z = 2; } else if (e <= valleyCut) { t = "Valley"; z = 0; }
    terrain.set(hexKey(h), t); tier.set(hexKey(h), z);
  }
  // Isolated single mountain hexes become high ground so ranges read as ranges
  for (const h of hexes) if (terrain.get(hexKey(h)) === "Mountain" && !hexNeighbors(h).some((n) => terrain.get(hexKey(n)) === "Mountain")) { terrain.set(hexKey(h), "HighGround"); tier.set(hexKey(h), 2); }

  const features: string[] = [];
  const passable = (h: Hex) => { const t = terrain.get(hexKey(h))!; return inMask(h) && TERRAIN_RULES[t].costFoot !== null && t !== "Mountain" && t !== "Water"; };

  // --- 3. Deployment anchors: two far-apart passable hexes, then zones around them ---
  const passHexes = hexes.filter(passable);
  // An army needs somewhere to form up, so an anchor is not just the farthest hex: it must have open room
  // around it. Narrow peninsulas and forest pockets are exactly where a deployed line walls itself in.
  const roomAround = (h: Hex) => hexesWithin(h, 3).filter((n: Hex) => passable(n) && standRankRaw(n) <= 2).length;
  const standRankRaw = (h: Hex) => { const t = terrain.get(hexKey(h)); return !t ? 9 : t === "Open" || t === "Road" ? 0 : t === "Valley" ? 1 : t === "HighGround" ? 2 : t === "Mud" ? 3 : 4; };
  let A = passHexes[0]!, B = passHexes[0]!, best = -1;
  const roomy = passHexes.filter((h) => roomAround(h) >= 18);
  const sample = (roomy.length > 20 ? roomy : passHexes).filter((_, i) => i % 3 === 0);
  for (const a of sample) for (const b of sample) { const d = hexDistance(a, b); if (d > best) { best = d; A = a; B = b; } }
  // A deployment zone should be ground an army can actually form up on: open first, woods last, and wide enough
  // that the units in the middle of it are not walled in by their own line.
  const standRank = standRankRaw;
  const zone = (anchor: Hex, other: Hex) => passHexes
    .filter((h) => hexDistance(h, anchor) <= 7 && hexDistance(h, other) > hexDistance(anchor, other) - 5)
    .sort((x, y) => standRank(x) - standRank(y) || hexDistance(x, anchor) - hexDistance(y, anchor))
    .slice(0, 30);
  const deployZones = { A: zone(A, B), B: zone(B, A) };

  // --- 4. River: from the highest passable source, greedy descent with a little wander; stops at the edge once long enough ---
  if (spec.river !== false) {
    const sources = passHexes.filter((h) => hexDistance(h, A) > 4 && hexDistance(h, B) > 4).sort((x, y) => elev.get(hexKey(y))! - elev.get(hexKey(x))!).slice(0, 12);
    if (sources.length) {
      let cur = sources[rng.int(sources.length)]!;
      const path: Hex[] = [cur]; const seen = new Set([hexKey(cur)]);
      for (let i = 0; i < 80; i++) {
        const ns = hexNeighbors(cur).filter((n) => inMask(n) && !seen.has(hexKey(n)) && terrain.get(hexKey(n)) !== "Mountain");
        if (!ns.length) break;
        ns.sort((x, y) => (elev.get(hexKey(x))! + rng.next() * 0.08) - (elev.get(hexKey(y))! + rng.next() * 0.08));
        cur = ns[0]!; seen.add(hexKey(cur)); path.push(cur);
        if (path.length >= 8 && hexNeighbors(cur).some((n) => !inMask(n))) break;
      }
      if (path.length >= 6) {
        const inZone = (h: Hex) => deployZones.A.some((z) => hexKey(z) === hexKey(h)) || deployZones.B.some((z) => hexKey(z) === hexKey(h));
        for (const h of path) if (!inZone(h)) terrain.set(hexKey(h), "Water");
        for (const h of path) for (const n of hexNeighbors(h)) {
          const k = hexKey(n);
          if (inMask(n) && (terrain.get(k) === "Valley" || terrain.get(k) === "Open") && tier.get(k)! <= 1 && wetN.value(n.q * 0.7, n.r * 0.7) > 0.4) terrain.set(k, "Mud");
        }
        features.push(`river of ${path.length} hexes`);
      }
    }
  }
  // Low wet ground away from the river is mud too
  let mud = 0;
  for (const h of hexes) { const k = hexKey(h); if (terrain.get(k) === "Valley" && wetN.fractal(h.q * 0.35, h.r * 0.35, 2) > 0.62) { terrain.set(k, "Mud"); mud++; } }
  features.push(`${mud} marsh mud hexes`);

  // --- 5. Forest: noise clusters on non-mountain, non-water ground ---
  const forestShare = spec.forest ?? 0.18;
  const forestVals = hexes.map((h) => { const p = hexToPixel(h); return forestN.fractal(p.x * 0.12 + forestOff.x, p.y * 0.12 + forestOff.y, 2); }).sort((a, b) => a - b);
  const forestCut = forestVals[Math.floor((1 - forestShare) * forestVals.length)]!;
  let forests = 0;
  for (const h of hexes) {
    const k = hexKey(h); const p = hexToPixel(h);
    if (["Open", "Valley", "HighGround"].includes(terrain.get(k)!) && forestN.fractal(p.x * 0.12 + forestOff.x, p.y * 0.12 + forestOff.y, 2) >= forestCut) { terrain.set(k, "Forest"); forests++; }
  }
  features.push(`${forests} forest hexes`);

  // --- 6. Road: cheapest path between anchors; crossing water becomes a ford ---
  const road = cheapestPath(A, B, (h) => inMask(h) && terrain.get(hexKey(h)) !== "Mountain", (h) => { const t = terrain.get(hexKey(h))!; return t === "Water" ? 6 : t === "Forest" ? 3 : t === "Mud" ? 3 : t === "HighGround" ? 2 : 1; });
  for (const h of road) {
    const k = hexKey(h); const t = terrain.get(k)!;
    if (t === "Water") terrain.set(k, "Ford");
    else if (t === "Open" || t === "Valley" || t === "Mud") terrain.set(k, "Road");
  }
  if (road.length) features.push(`road of ${road.length} hexes`);

  // --- 7. Trenches dug in front of each deployment zone, facing the enemy ---
  if (spec.trenches !== false) {
    for (const [mine, theirs] of [[A, B], [B, A]] as Array<[Hex, Hex]>) {
      const front = passHexes.filter((h) => hexDistance(h, mine) >= 7 && hexDistance(h, mine) <= 9 && hexDistance(h, theirs) < hexDistance(mine, theirs) && ["Open", "Valley", "Mud"].includes(terrain.get(hexKey(h))!));
      front.sort((x, y) => hexDistance(x, theirs) - hexDistance(y, theirs));
      let n = 0;
      for (const h of front) { if (n >= 7) break; if (!road.some((rd) => hexKey(rd) === hexKey(h))) { terrain.set(hexKey(h), "Trench"); n++; } }
      if (n) features.push(`${n} trench hexes near ${hexKey(mine)}`);
    }
  }

  // --- 8. Ruins on a mid-map rise; a fortification near the defender ---
  if (spec.ruins !== false) {
    const mid = passHexes.filter((h) => Math.abs(hexDistance(h, A) - hexDistance(h, B)) <= 2 && terrain.get(hexKey(h)) === "HighGround");
    if (mid.length) { const c = mid[rng.int(mid.length)]!; for (const h of [c, ...hexNeighbors(c)]) if (inMask(h) && ["HighGround", "Open", "Forest"].includes(terrain.get(hexKey(h))!)) terrain.set(hexKey(h), "Ruins"); features.push(`ruins at ${hexKey(c)}`); }
  }
  const fortSpots = passHexes.filter((h) => hexDistance(h, B) >= 2 && hexDistance(h, B) <= 3 && ["Open", "HighGround"].includes(terrain.get(hexKey(h))!));
  for (const h of fortSpots.slice(0, 2)) terrain.set(hexKey(h), "Fortification");

  // Deployment zones must stay standable
  for (const z of [...deployZones.A, ...deployZones.B]) { const k = hexKey(z); if (["Water", "Mountain", "Trench"].includes(terrain.get(k)!)) terrain.set(k, "Open"); }

  return {
    name: spec.name ?? `Field ${spec.seed}`, seed: spec.seed, width: W, height: H,
    hexes: hexes.map((h) => ({ q: h.q, r: h.r, terrain: terrain.get(hexKey(h))!, elevation: tier.get(hexKey(h))! })),
    deployZones, anchors: { A, B }, features,
  };
}

function largestComponent(cells: Set<string>): Set<string> {
  const seen = new Set<string>(); let best = new Set<string>();
  for (const start of cells) {
    if (seen.has(start)) continue;
    const comp = new Set<string>(); const stack = [start]; seen.add(start);
    while (stack.length) {
      const k = stack.pop()!; comp.add(k);
      const [q, r] = k.split(",").map(Number) as [number, number];
      for (const n of hexNeighbors({ q, r })) { const nk = hexKey(n); if (cells.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); } }
    }
    if (comp.size > best.size) best = comp;
  }
  return best;
}

/** Dijkstra over hexes. */
export function cheapestPath(from: Hex, to: Hex, allowed: (h: Hex) => boolean, cost: (h: Hex) => number): Hex[] {
  const dist = new Map<string, number>([[hexKey(from), 0]]);
  const prev = new Map<string, Hex>();
  const open: Hex[] = [from];
  while (open.length) {
    open.sort((a, b) => dist.get(hexKey(a))! - dist.get(hexKey(b))!);
    const cur = open.shift()!;
    if (hexKey(cur) === hexKey(to)) break;
    for (const n of hexNeighbors(cur)) {
      if (!allowed(n)) continue;
      const nd = dist.get(hexKey(cur))! + cost(n);
      if (nd < (dist.get(hexKey(n)) ?? Infinity)) { dist.set(hexKey(n), nd); prev.set(hexKey(n), cur); if (!open.some((o) => hexKey(o) === hexKey(n))) open.push(n); }
    }
  }
  if (!prev.has(hexKey(to))) return [];
  const path: Hex[] = []; let cur: Hex | undefined = to;
  while (cur && hexKey(cur) !== hexKey(from)) { path.push(cur); cur = prev.get(hexKey(cur)); }
  return path.reverse();
}

/** Load a generated map into a battle: canvas size, mask, terrain and elevation. */
export function applyMap(b: Battle, map: GeneratedMap): void {
  b.width = map.width + Math.ceil(map.height / 2); b.height = map.height;
  b.mask = new Set(map.hexes.map((h) => hexKey(h)));
  b.terrain.clear(); b.elevation.clear();
  for (const h of map.hexes) { if (h.terrain !== "Open") b.terrain.set(hexKey(h), h.terrain); b.elevation.set(hexKey(h), h.elevation); }
}

/** Terrain histogram for logs and tests. */
export function terrainCounts(map: GeneratedMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of map.hexes) out[h.terrain] = (out[h.terrain] ?? 0) + 1;
  return out;
}
