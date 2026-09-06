import { Battle } from "./state.js";
import { BattleController } from "./battle.js";
import { loadRegistry, loadScenario, type Registry } from "./data.js";
import { validateArmy, type ArmyBlueprint } from "./composition.js";
import { deployPlatoon } from "./deploy.js";
import { createRitual } from "./rituals.js";
import { callPortal, queueReinforcement } from "./portals.js";
import { hexKey, hexRing, type Hex } from "./hex.js";
import { generateMap, applyMap, type MapSpec, type GeneratedMap } from "./mapgen.js";
import { resolvePlacement, type Placement } from "./scenario-roles.js";
import type { ObjectiveDef } from "./objectives.js";
import type { Terrain } from "./types.js";

export type { Placement, FieldRole } from "./scenario-roles.js";

/** A ritual circle's or an objective's hex, authored either as a literal or by role — see `Placement`. */
export type ScenarioObjectiveDef = Exclude<ObjectiveDef, { type: "CaptureHold" } | { type: "Escort" }>
  | { type: "CaptureHold"; side: string; hex: Placement; rounds: number }
  | { type: "Escort"; side: string; unitDefId: string; hex: Placement };

export interface ScenarioFile {
  id: string; title: string; seed: number; roundLimit: number; roundLimitWinner?: string; briefing: string;
  map: { width: number; height: number; terrain: Array<{ type: Terrain; hexes: [number, number][] }> } | { generate: Omit<MapSpec, "seed"> };
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

function resolveObjective(o: ScenarioObjectiveDef, at: (p: Placement) => Hex): ObjectiveDef {
  if (o.type === "CaptureHold" || o.type === "Escort") return { ...o, hex: at(o.hex) };
  return o;
}

export function buildScenario(name: string, reg: Registry = loadRegistry(), seedOverride?: number): { ctrl: BattleController; file: ScenarioFile } {
  const file = loadScenario<ScenarioFile>(name);
  const seed = seedOverride ?? file.seed;

  let map: GeneratedMap | null = null;
  let width: number, height: number;
  if ("generate" in file.map) { map = generateMap({ seed, ...file.map.generate }); width = map.width; height = map.height; }
  else { width = file.map.width; height = file.map.height; }

  const b = new Battle(reg, {
    seed, width, height,
    sides: Object.entries(file.sides).map(([id, s]) => ({ id, reservePoints: s.reservePoints, armyCapacity: s.armyCapacity, morale: 100 })),
  });
  if (map) applyMap(b, map);
  else for (const t of (file.map as { terrain: Array<{ type: Terrain; hexes: [number, number][] }> }).terrain) for (const [q, r] of t.hexes) b.terrain.set(hexKey({ q, r }), t.type);

  // A role can resolve to a hex another feature already occupies, especially on a small generated field;
  // spiral outward to the nearest free one rather than let two role-pinned features collide.
  const at = (p: Placement): Hex => {
    const h = resolvePlacement(map, p);
    if (b.isFree(h)) return h;
    for (let radius = 1; radius <= 6; radius++) for (const n of hexRing(h, radius)) if (b.isFree(n)) return n;
    return h;
  };

  for (const [sideId, s] of Object.entries(file.sides)) {
    const army: ArmyBlueprint = { side: sideId, capacity: s.armyCapacity, platoons: s.platoons.map((p) => ({ ...p, side: sideId })), specialists: s.specialists.map((x) => x.def) };
    const v = validateArmy(reg, army);
    if (!v.ok) throw new Error(`Illegal army for ${sideId}: ${v.errors.join("; ")}`);
    for (const p of s.platoons) deployPlatoon(b, { ...p, side: sideId }, p.deploy.map(at), (p.facing ?? 0) as 0);
    for (const sp of s.specialists) b.spawn(sp.def, sideId, at(sp.at));
  }
  for (const r of file.rituals) {
    const leaderUid = r.leader ? [...b.units.values()].find((u) => u.defId === r.leader && u.side === r.side)?.uid ?? null : null;
    createRitual(b, { id: r.id, side: r.side, center: at(r.center), radius: r.radius, required: r.required, leaderUid, summonDefId: r.summon, linkGroup: r.linkGroup });
  }
  for (const [sideId, s] of Object.entries(file.sides)) {
    for (const p of s.portals ?? []) callPortal(b, sideId, at(p.at), { id: p.id, capacity: p.capacity, cooldown: p.cooldown, telegraph: 0 });
    for (const q of s.reinforcementQueue ?? []) { const portal = b.portals.get(q.portal); if (portal) queueReinforcement(b, portal, q.def, q.platoon); }
  }
  for (const [sideId, s] of Object.entries(file.sides)) {
    const st = b.sides.get(sideId)!;
    st.fusionCharges = s.fusionCharges ?? 1;
    const leader = s.leader ? [...b.units.values()].find((u) => u.defId === s.leader && u.side === sideId) : [...b.activeUnits(sideId)].filter((u) => b.def(u).roles.includes("Commander")).sort((x, y) => b.def(y).capacityCost - b.def(x).capacityCost)[0];
    st.leaderUid = leader?.uid ?? null;
  }
  const ctrl = new BattleController(b, { sides: Object.fromEntries(Object.entries(file.sides).map(([id, s]) => [id, s.objectives.map((o) => resolveObjective(o, at))])), roundLimit: file.roundLimit, roundLimitWinner: file.roundLimitWinner });
  return { ctrl, file };
}
