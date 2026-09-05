import { Battle } from "./state.js";
import { BattleController } from "./battle.js";
import { loadRegistry, loadScenario, type Registry } from "./data.js";
import { validateArmy, type ArmyBlueprint } from "./composition.js";
import { deployPlatoon } from "./deploy.js";
import { createRitual } from "./rituals.js";
import { callPortal, queueReinforcement } from "./portals.js";
import type { Hex } from "./hex.js";
import { hexKey, hexRing, DIRECTIONS, directionTo } from "./hex.js";
import { generateMap, applyMap, type MapSpec, type GeneratedMap, type MapHex } from "./mapgen.js";
import type { ObjectiveDef } from "./objectives.js";
import type { Terrain } from "./types.js";

/**
 * A position on a scenario's map, either a fixed hex or a role resolved against the generated field's
 * anchors and deployment zones. Roles only resolve when the scenario's map is `{ generate: ... }`: a fixed,
 * hand-authored map has no anchors or zones to point at.
 */
export type PositionSpec =
  | [number, number]
  | { role: "anchor"; side: string }
  | { role: "deployZone"; side: string; index: number }
  /** A point on the line between two positions, 0 = `from`, 1 = `to`, snapped to the nearest standable hex.
   *  `lateral` steps the point sideways, perpendicular to the line, by that many hexes. */
  | { role: "lerp"; from: PositionSpec; to: PositionSpec; frac: number; lateral?: number }
  /** The `index`-th standable hex (deterministic, wraps) on the ring at `ring` distance from `from`. */
  | { role: "near"; from: PositionSpec; ring: number; index: number }
  /** The already-resolved center of the ritual with this id. Rituals resolve their center before anything
   *  else, so this lets ritualists be placed relative to it without re-deriving (and drifting from) it. */
  | { role: "ritualCenter"; id: string };

/** How a platoon's eight hexes are chosen: either listed outright, or sliced from a generated deployment zone. */
export type DeploySpec = PositionSpec[] | { role: "deployZone"; side: string; offset?: number; count?: number };

export interface ScenarioFile {
  id: string; title: string; seed: number; roundLimit: number; roundLimitWinner?: string; briefing: string;
  map: { width: number; height: number; terrain: Array<{ type: Terrain; hexes: [number, number][] }> } | { generate: Omit<MapSpec, "seed"> };
  sides: Record<string, {
    name: string; reservePoints: number; armyCapacity: number; leader?: string; fusionCharges?: number;
    platoons: Array<{ id: string; faction: string; commander: string; second: string; elite: string; foot: string[]; deploy: DeploySpec; facing?: number }>;
    specialists: Array<{ def: string; at: PositionSpec }>;
    portals?: Array<{ id: string; at: PositionSpec; capacity: number; cooldown: number }>;
    reinforcementQueue?: Array<{ portal: string; def: string; platoon: string | null }>;
    objectives: ScenarioObjectiveDef[];
  }>;
  rituals: Array<{ id: string; side: string; center: PositionSpec; radius: number; required: number; leader: string | null; summon: string | null; linkGroup: string | null }>;
}

/** The two objective types that name a hex accept a role position; every other objective passes through unchanged. */
export type ScenarioObjectiveDef =
  | Exclude<ObjectiveDef, { type: "CaptureHold" } | { type: "Escort" }>
  | { type: "CaptureHold"; side: string; hexSpec: PositionSpec; rounds: number }
  | { type: "Escort"; side: string; unitDefId: string; hexSpec: PositionSpec };

export interface MapCtx { generated: GeneratedMap | null; index: Map<string, MapHex> | null; ritualCenters: Map<string, Hex> }

/** Build the position-resolution context for a generated map (or none, for a fixed hand-authored one). */
export function mapContext(generated: GeneratedMap | null): MapCtx {
  return { generated, index: generated ? new Map(generated.hexes.map((h) => [hexKey(h), h])) : null, ritualCenters: new Map() };
}

function isPlayable(ctx: MapCtx, h: Hex): boolean {
  const mh = ctx.index?.get(hexKey(h));
  return !!mh && mh.terrain !== "Mountain" && mh.terrain !== "Water";
}

/** Nearest standable, unclaimed hex to `target`; falls back to `target` itself if the search comes up empty. */
function nearestPlayable(ctx: MapCtx, target: Hex, used: Set<string>): Hex {
  if (isPlayable(ctx, target) && !used.has(hexKey(target))) return target;
  for (let ring = 1; ring <= 12; ring++) {
    const found = hexRing(target, ring).find((h) => isPlayable(ctx, h) && !used.has(hexKey(h)));
    if (found) return found;
  }
  return target;
}

/** Resolve a `PositionSpec` to a concrete hex against the scenario's map context. */
export function resolvePosition(ctx: MapCtx, used: Set<string>, spec: PositionSpec): Hex {
  if (Array.isArray(spec)) return { q: spec[0], r: spec[1] };
  const map = ctx.generated;
  if (!map) throw new Error(`Position role "${spec.role}" needs a generated map ("map": { "generate": ... })`);
  switch (spec.role) {
    case "anchor":
      return map.anchors[spec.side as "A" | "B"];
    case "deployZone": {
      const zone = map.deployZones[spec.side as "A" | "B"];
      if (!zone.length) throw new Error(`Deploy zone ${spec.side} is empty`);
      return zone[((spec.index % zone.length) + zone.length) % zone.length]!;
    }
    case "lerp": {
      const a = resolvePosition(ctx, used, spec.from), b = resolvePosition(ctx, used, spec.to);
      let point: Hex = { q: Math.round(a.q + (b.q - a.q) * spec.frac), r: Math.round(a.r + (b.r - a.r) * spec.frac) };
      if (spec.lateral) {
        const perp = DIRECTIONS[(directionTo(a, b) + 2) % 6]!;
        point = { q: point.q + perp.q * spec.lateral, r: point.r + perp.r * spec.lateral };
      }
      return nearestPlayable(ctx, point, used);
    }
    case "near": {
      const from = resolvePosition(ctx, used, spec.from);
      const ring = hexRing(from, spec.ring).filter((h) => isPlayable(ctx, h) && !used.has(hexKey(h)));
      if (!ring.length) return nearestPlayable(ctx, from, used);
      return ring[((spec.index % ring.length) + ring.length) % ring.length]!;
    }
    case "ritualCenter": {
      const c = ctx.ritualCenters.get(spec.id);
      if (!c) throw new Error(`Ritual "${spec.id}" has no resolved center yet (rituals resolve their center first)`);
      return c;
    }
  }
}

function resolveDeploy(ctx: MapCtx, used: Set<string>, spec: DeploySpec): Hex[] {
  if (Array.isArray(spec)) return spec.map((s) => resolvePosition(ctx, used, s));
  const map = ctx.generated;
  if (!map) throw new Error(`Deploy role "deployZone" needs a generated map`);
  const zone = map.deployZones[spec.side as "A" | "B"].filter((h) => !used.has(hexKey(h)));
  const offset = spec.offset ?? 0, count = spec.count ?? 8;
  const slice = zone.slice(offset, offset + count);
  if (slice.length < count) throw new Error(`Deploy zone ${spec.side} has only ${slice.length} free hexes left, needs ${count}`);
  return slice;
}

function resolveObjective(ctx: MapCtx, used: Set<string>, o: ScenarioObjectiveDef): ObjectiveDef {
  if (o.type === "CaptureHold" && "hexSpec" in o) return { type: "CaptureHold", side: o.side, hex: resolvePosition(ctx, used, o.hexSpec), rounds: o.rounds };
  if (o.type === "Escort" && "hexSpec" in o) return { type: "Escort", side: o.side, unitDefId: o.unitDefId, hex: resolvePosition(ctx, used, o.hexSpec) };
  return o as ObjectiveDef;
}

export function buildScenario(name: string, reg: Registry = loadRegistry(), seedOverride?: number): { ctrl: BattleController; file: ScenarioFile; map: GeneratedMap | null } {
  const file = loadScenario<ScenarioFile>(name);
  const seed = seedOverride ?? file.seed;
  const b = new Battle(reg, {
    seed, sides: Object.entries(file.sides).map(([id, s]) => ({ id, reservePoints: s.reservePoints, armyCapacity: s.armyCapacity, morale: 100 })),
  });

  let generated: GeneratedMap | null = null;
  if ("generate" in file.map) {
    generated = generateMap({ ...file.map.generate, seed });
    applyMap(b, generated);
  } else {
    b.width = file.map.width; b.height = file.map.height;
    for (const t of file.map.terrain) for (const [q, r] of t.hexes) b.terrain.set(hexKey({ q, r }), t.type);
  }
  const ctx: MapCtx = mapContext(generated);
  const used = new Set<string>();
  const reserve = (h: Hex): Hex => { used.add(hexKey(h)); return h; };

  // Ritual centers resolve first so specialists can be placed relative to a fixed point (role "ritualCenter")
  // instead of every position drifting independently off the same raw anchor math.
  for (const r of file.rituals) ctx.ritualCenters.set(r.id, reserve(resolvePosition(ctx, used, r.center)));

  for (const [sideId, s] of Object.entries(file.sides)) {
    const army: ArmyBlueprint = { side: sideId, capacity: s.armyCapacity, platoons: s.platoons.map((p) => ({ ...p, side: sideId })), specialists: s.specialists.map((x) => x.def) };
    const v = validateArmy(reg, army);
    if (!v.ok) throw new Error(`Illegal army for ${sideId}: ${v.errors.join("; ")}`);
    for (const p of s.platoons) {
      const hexes = resolveDeploy(ctx, used, p.deploy).map(reserve);
      deployPlatoon(b, { ...p, side: sideId }, hexes, (p.facing ?? 0) as 0);
    }
    for (const sp of s.specialists) b.spawn(sp.def, sideId, reserve(resolvePosition(ctx, used, sp.at)));
  }
  for (const r of file.rituals) {
    const leaderUid = r.leader ? [...b.units.values()].find((u) => u.defId === r.leader && u.side === r.side)?.uid ?? null : null;
    const center = ctx.ritualCenters.get(r.id)!;
    createRitual(b, { id: r.id, side: r.side, center, radius: r.radius, required: r.required, leaderUid, summonDefId: r.summon, linkGroup: r.linkGroup });
  }
  for (const [sideId, s] of Object.entries(file.sides)) {
    for (const p of s.portals ?? []) callPortal(b, sideId, reserve(resolvePosition(ctx, used, p.at)), { id: p.id, capacity: p.capacity, cooldown: p.cooldown, telegraph: 0 });
    for (const q of s.reinforcementQueue ?? []) { const portal = b.portals.get(q.portal); if (portal) queueReinforcement(b, portal, q.def, q.platoon); }
  }
  for (const [sideId, s] of Object.entries(file.sides)) {
    const st = b.sides.get(sideId)!;
    st.fusionCharges = s.fusionCharges ?? 1;
    const leader = s.leader ? [...b.units.values()].find((u) => u.defId === s.leader && u.side === sideId) : [...b.activeUnits(sideId)].filter((u) => b.def(u).roles.includes("Commander")).sort((x, y) => b.def(y).capacityCost - b.def(x).capacityCost)[0];
    st.leaderUid = leader?.uid ?? null;
  }
  const objectives = Object.fromEntries(Object.entries(file.sides).map(([id, s]) => [id, s.objectives.map((o) => resolveObjective(ctx, used, o))]));
  const ctrl = new BattleController(b, { sides: objectives, roundLimit: file.roundLimit, roundLimitWinner: file.roundLimitWinner });
  return { ctrl, file, map: generated };
}
