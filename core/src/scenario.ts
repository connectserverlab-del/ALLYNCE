import { Battle } from "./state.js";
import { BattleController } from "./battle.js";
import { loadRegistry, loadScenario, type Registry } from "./data.js";
import { validateArmy, type ArmyBlueprint } from "./composition.js";
import { deployPlatoon } from "./deploy.js";
import { createRitual } from "./rituals.js";
import { callPortal, queueReinforcement } from "./portals.js";
import { hexKey, hexNeighbors } from "./hex.js";
import type { ObjectiveDef } from "./objectives.js";
import type { Terrain } from "./types.js";
import { generateMap, applyMap, type MapSpec, type GeneratedMap } from "./mapgen.js";
import { resolvePlacement, resolveFreePlacement, type Placement } from "./placement.js";

/** `ObjectiveDef`, but the two objectives that carry a hex take a `Placement` instead: a scenario on
 * generated ground pins them to a role ("ruins", "fortification") rather than a fixed [q, r] pair. */
export type ScenarioObjectiveDef =
  | Exclude<ObjectiveDef, { type: "CaptureHold" } | { type: "Escort" }>
  | { type: "CaptureHold"; side: string; hex: Placement; rounds: number }
  | { type: "Escort"; side: string; unitDefId: string; hex: Placement };

export interface ScenarioFile {
  id: string; title: string; seed: number; roundLimit: number; roundLimitWinner?: string; briefing: string;
  /** A hand-authored fixed map. Mutually exclusive with `mapSpec`. */
  map?: { width: number; height: number; terrain: Array<{ type: Terrain; hexes: [number, number][] }> };
  /** Generate the ground instead of hand-authoring it; every position below may then be a role Placement. */
  mapSpec?: MapSpec;
  sides: Record<string, {
    name: string; reservePoints: number; armyCapacity: number; leader?: string; fusionCharges?: number;
    platoons: Array<{ id: string; faction: string; commander: string; second: string; elite: string; foot: string[]; deploy: Placement[]; facing?: number }>;
    specialists: Array<{ def: string; at: Placement }>;
    portals?: Array<{ id: string; at: Placement; capacity: number; cooldown: number }>;
    reinforcementQueue?: Array<{ portal: string; def: string; platoon: string | null }>;
    objectives: ScenarioObjectiveDef[];
  }>;
  rituals: Array<{ id: string; side: string; center: Placement; radius: number; required: number; leader: string | null; summon: string | null; linkGroup: string | null }>;
}

/** Resolve a `ScenarioObjectiveDef` into the concrete `ObjectiveDef` the engine evaluates. */
function resolveObjective(map: GeneratedMap | null, o: ScenarioObjectiveDef): ObjectiveDef {
  if (o.type === "CaptureHold" || o.type === "Escort") return { ...o, hex: resolvePlacement(map, o.hex) };
  return o;
}

export function buildScenario(name: string, reg: Registry = loadRegistry(), seedOverride?: number): { ctrl: BattleController; file: ScenarioFile } {
  const file = loadScenario<ScenarioFile>(name);
  if (!file.map === !file.mapSpec) throw new Error(`Scenario ${file.id} must set exactly one of map, mapSpec`);
  const seed = seedOverride ?? file.seed;

  let generated: GeneratedMap | null = null;
  const b = new Battle(reg, {
    seed, width: file.map?.width, height: file.map?.height,
    sides: Object.entries(file.sides).map(([id, s]) => ({ id, reservePoints: s.reservePoints, armyCapacity: s.armyCapacity, morale: 100 })),
  });
  if (file.mapSpec) { generated = generateMap({ ...file.mapSpec, seed }); applyMap(b, generated); }
  else for (const t of file.map!.terrain) for (const [q, r] of t.hexes) b.terrain.set(hexKey({ q, r }), t.type);

  for (const [sideId, s] of Object.entries(file.sides)) {
    const army: ArmyBlueprint = { side: sideId, capacity: s.armyCapacity, platoons: s.platoons.map((p) => ({ ...p, side: sideId })), specialists: s.specialists.map((x) => x.def) };
    const v = validateArmy(reg, army);
    if (!v.ok) throw new Error(`Illegal army for ${sideId}: ${v.errors.join("; ")}`);
    for (const p of s.platoons) deployPlatoon(b, { ...p, side: sideId }, p.deploy.map((pl) => resolvePlacement(generated, pl)), (p.facing ?? 0) as 0);
    // A role can land on ground a platoon already occupies (a compact map, an unlucky seed); nudge a
    // specialist off it rather than fail the whole build.
    for (const sp of s.specialists) b.spawn(sp.def, sideId, resolveFreePlacement(generated, sp.at, (h) => b.isFree(h)));
  }
  for (const r of file.rituals) {
    const leaderUid = r.leader ? [...b.units.values()].find((u) => u.defId === r.leader && u.side === r.side)?.uid ?? null : null;
    createRitual(b, { id: r.id, side: r.side, center: resolvePlacement(generated, r.center), radius: r.radius, required: r.required, leaderUid, summonDefId: r.summon, linkGroup: r.linkGroup });
  }
  for (const [sideId, s] of Object.entries(file.sides)) {
    // A portal needs an empty hex clear of enemy zone of control; units are already deployed, so nudge
    // off the role's exact hex if something is standing on it.
    const free = (p: Placement) => resolveFreePlacement(generated, p, (h) => b.isFree(h) && !hexNeighbors(h).some((n) => { const u = b.unitAt(n); return u && u.side !== sideId && !u.isClone; }));
    for (const p of s.portals ?? []) callPortal(b, sideId, free(p.at), { id: p.id, capacity: p.capacity, cooldown: p.cooldown, telegraph: 0 });
    for (const q of s.reinforcementQueue ?? []) { const portal = b.portals.get(q.portal); if (portal) queueReinforcement(b, portal, q.def, q.platoon); }
  }
  for (const [sideId, s] of Object.entries(file.sides)) {
    const st = b.sides.get(sideId)!;
    st.fusionCharges = s.fusionCharges ?? 1;
    const leader = s.leader ? [...b.units.values()].find((u) => u.defId === s.leader && u.side === sideId) : [...b.activeUnits(sideId)].filter((u) => b.def(u).roles.includes("Commander")).sort((x, y) => b.def(y).capacityCost - b.def(x).capacityCost)[0];
    st.leaderUid = leader?.uid ?? null;
  }
  const ctrl = new BattleController(b, {
    sides: Object.fromEntries(Object.entries(file.sides).map(([id, s]) => [id, s.objectives.map((o) => resolveObjective(generated, o))])),
    roundLimit: file.roundLimit, roundLimitWinner: file.roundLimitWinner,
  });
  return { ctrl, file };
}
