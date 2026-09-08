import type { Hex } from "./hex.js";
import { hexKey, hexNeighbors, hexDistance, hexesWithin } from "./hex.js";
import type { Terrain } from "./types.js";
import { Rng } from "./rng.js";

/**
 * Irregular battlefield generator. Real battlefields are not even rectangles: this carves an odd-shaped
 * playable area out of a rectangular grid and scatters rough terrain (mountains, mud, trenches, ruins,
 * fortifications) plus a river with fords and a road, all from one seed so the result is reproducible.
 */
export interface MapSpec {
  seed: number;
  width: number;
  height: number;
  /** 0..1: how much of the rectangle's edge is bitten away to break up the outline. 0 = plain rectangle. */
  irregularity?: number;
  /** 0..1 shares of the playable area given to each rough-terrain kind. */
  mountainDensity?: number;
  forestDensity?: number;
  mudDensity?: number;
  trenchDensity?: number;
  ruinsDensity?: number;
  fortificationCount?: number;
  riverCount?: number;
  fordsPerRiver?: number;
  roadCount?: number;
}

export interface GeneratedMap {
  width: number;
  height: number;
  /** Hex keys inside the irregular playable outline (excludes the carved-away edge). */
  playable: Set<string>;
  /** Hex key -> terrain, for every non-"Open" hex (both inside and outside the playable outline). */
  terrain: Map<string, Terrain>;
}

const DEFAULTS: Required<Omit<MapSpec, "seed" | "width" | "height">> = {
  irregularity: 0.35, mountainDensity: 0.08, forestDensity: 0.12, mudDensity: 0.05,
  trenchDensity: 0.03, ruinsDensity: 0.03, fortificationCount: 2, riverCount: 1, fordsPerRiver: 1, roadCount: 1,
};

export function generateBattlefield(spec: MapSpec): GeneratedMap {
  const s = { ...DEFAULTS, ...spec };
  const rng = new Rng(s.seed);
  const terrain = new Map<string, Terrain>();

  const rect: Hex[] = [];
  for (let q = 0; q < s.width; q++) for (let r = 0; r < s.height; r++) rect.push({ q, r });

  // A margin band stays reserved (never carved) so the interior always has a solid, connected core for
  // deployment and objectives; only the outer band is bitten into to break up the rectangle's outline.
  const margin = Math.max(2, Math.round(Math.min(s.width, s.height) * 0.15));
  const inCore = (h: Hex): boolean => h.q >= margin && h.q < s.width - margin && h.r >= margin && h.r < s.height - margin;

  const carved = new Set<string>();
  const numBites = Math.round(s.irregularity * 10);
  const edgeHexes = rect.filter((h) => !inCore(h));
  for (let i = 0; i < numBites && edgeHexes.length; i++) {
    const center = rng.pick(edgeHexes);
    const radius = 1 + rng.int(1 + Math.round(s.irregularity * 3));
    for (const h of hexesWithin(center, radius)) {
      if (h.q < 0 || h.q >= s.width || h.r < 0 || h.r >= s.height) continue;
      if (inCore(h)) continue;
      carved.add(hexKey(h));
    }
  }

  const playable = new Set<string>();
  for (const h of rect) {
    const k = hexKey(h);
    if (carved.has(k)) terrain.set(k, "Water"); // carved-away edge reads as impassable, off the playable field
    else playable.add(k);
  }

  const playableHexes = (): Hex[] => rect.filter((h) => playable.has(hexKey(h)));
  const isOpen = (h: Hex): boolean => playable.has(hexKey(h)) && !terrain.has(hexKey(h));

  function scatterBlobs(kind: Terrain, density: number, blobSizeMin: number, blobSizeMax: number): void {
    const pool = playableHexes();
    const avgBlob = (blobSizeMin + blobSizeMax) / 2;
    const numSeeds = Math.round((pool.length * density) / avgBlob);
    for (let i = 0; i < numSeeds; i++) {
      const openPool = pool.filter(isOpen);
      if (!openPool.length) break;
      let cur = rng.pick(openPool);
      const size = blobSizeMin + rng.int(blobSizeMax - blobSizeMin + 1);
      for (let step = 0; step < size; step++) {
        if (isOpen(cur)) terrain.set(hexKey(cur), kind);
        const neighbors = hexNeighbors(cur).filter(isOpen);
        if (!neighbors.length) break;
        cur = rng.pick(neighbors);
      }
    }
  }

  scatterBlobs("Mountain", s.mountainDensity, 3, 6);
  scatterBlobs("Forest", s.forestDensity, 2, 5);
  scatterBlobs("Mud", s.mudDensity, 2, 4);
  scatterBlobs("Trench", s.trenchDensity, 2, 5);
  scatterBlobs("Ruins", s.ruinsDensity, 1, 3);

  for (let i = 0; i < s.fortificationCount; i++) {
    const pool = playableHexes().filter(isOpen);
    if (!pool.length) break;
    terrain.set(hexKey(rng.pick(pool)), "Fortification");
  }

  /** Greedy walk from `from` toward `to`, staying inside the playable outline, with mild randomness for windiness. */
  function walkToward(from: Hex, to: Hex): Hex[] {
    const path: Hex[] = [from];
    let cur = from;
    let guard = s.width * s.height; // avoids any pathological infinite loop
    while (!(cur.q === to.q && cur.r === to.r) && guard-- > 0) {
      const candidates = hexNeighbors(cur)
        .filter((h) => h.q >= 0 && h.q < s.width && h.r >= 0 && h.r < s.height && playable.has(hexKey(h)))
        .sort((a, b) => hexDistance(a, to) - hexDistance(b, to));
      if (!candidates.length) break;
      const next = rng.next() < 0.75 ? candidates[0]! : candidates[Math.min(1, candidates.length - 1)]!;
      path.push(next);
      cur = next;
    }
    return path;
  }

  const nearestPlayableOnRow = (r: number, preferQ: number): Hex | null => {
    const row = playableHexes().filter((h) => h.r === r);
    if (!row.length) return null;
    return row.reduce((best, h) => (Math.abs(h.q - preferQ) < Math.abs(best.q - preferQ) ? h : best));
  };
  const nearestPlayableOnCol = (q: number, preferR: number): Hex | null => {
    const col = playableHexes().filter((h) => h.q === q);
    if (!col.length) return null;
    return col.reduce((best, h) => (Math.abs(h.r - preferR) < Math.abs(best.r - preferR) ? h : best));
  };

  const riverPaths: Hex[][] = [];
  for (let i = 0; i < s.riverCount; i++) {
    const entry = nearestPlayableOnRow(0, Math.round(s.width / 2));
    const exit = nearestPlayableOnRow(s.height - 1, Math.round(s.width / 2));
    if (!entry || !exit) continue;
    const path = walkToward(entry, exit);
    for (const h of path) terrain.set(hexKey(h), "Water");
    riverPaths.push(path);
  }
  for (const path of riverPaths) {
    const interior = path.slice(1, -1);
    for (let i = 0; i < s.fordsPerRiver && interior.length; i++) {
      const h = rng.pick(interior);
      terrain.set(hexKey(h), "Ford");
    }
  }

  for (let i = 0; i < s.roadCount; i++) {
    const entry = nearestPlayableOnCol(0, Math.round(s.height / 2));
    const exit = nearestPlayableOnCol(s.width - 1, Math.round(s.height / 2));
    if (!entry || !exit) continue;
    const path = walkToward(entry, exit);
    for (const h of path) {
      const k = hexKey(h);
      // A road bridges a river at a ford rather than plowing straight through the water.
      terrain.set(k, terrain.get(k) === "Water" ? "Ford" : "Road");
    }
  }

  return { width: s.width, height: s.height, playable, terrain };
}
