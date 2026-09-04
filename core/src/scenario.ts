import { Battle } from "./state.js";
import { BattleController } from "./battle.js";
import { loadRegistry, loadScenario, type Registry } from "./data.js";
import { validateArmy, type ArmyBlueprint } from "./composition.js";
import { deployPlatoon } from "./deploy.js";
import { createRitual } from "./rituals.js";
import { callPortal, queueReinforcement } from "./portals.js";
import { hexKey } from "./hex.js";
import type { ObjectiveDef } from "./objectives.js";
import type { Terrain } from "./types.js";

export interface ScenarioFile {
  id: string; title: string; seed: number; roundLimit: number; roundLimitWinner?: string; briefing: string;
  map: { width: number; height: number; terrain: Array<{ type: Terrain; hexes: [number, number][] }> };
  sides: Record<string, {
    name: string; reservePoints: number; armyCapacity: number;
    platoons: Array<{ id: string; faction: string; commander: string; second: string; elite: string; foot: string[]; deploy: [number, number][]; facing?: number }>;
    specialists: Array<{ def: string; at: [number, number] }>;
    portals?: Array<{ id: string; at: [number, number]; capacity: number; cooldown: number }>;
    reinforcementQueue?: Array<{ portal: string; def: string; platoon: string | null }>;
    objectives: ObjectiveDef[];
  }>;
  rituals: Array<{ id: string; side: string; center: [number, number]; radius: number; required: number; leader: string | null; summon: string | null; linkGroup: string | null }>;
}

export function buildScenario(name: string, reg: Registry = loadRegistry(), seedOverride?: number): { ctrl: BattleController; file: ScenarioFile } {
  const file = loadScenario<ScenarioFile>(name);
  const b = new Battle(reg, {
    seed: seedOverride ?? file.seed, width: file.map.width, height: file.map.height,
    sides: Object.entries(file.sides).map(([id, s]) => ({ id, reservePoints: s.reservePoints, armyCapacity: s.armyCapacity, morale: 100 })),
  });
  for (const t of file.map.terrain) for (const [q, r] of t.hexes) b.terrain.set(hexKey({ q, r }), t.type);

  for (const [sideId, s] of Object.entries(file.sides)) {
    const army: ArmyBlueprint = { side: sideId, capacity: s.armyCapacity, platoons: s.platoons.map((p) => ({ ...p, side: sideId })), specialists: s.specialists.map((x) => x.def) };
    const v = validateArmy(reg, army);
    if (!v.ok) throw new Error(`Illegal army for ${sideId}: ${v.errors.join("; ")}`);
    for (const p of s.platoons) deployPlatoon(b, { ...p, side: sideId }, p.deploy.map(([q, r]) => ({ q, r })), (p.facing ?? 0) as 0);
    for (const sp of s.specialists) b.spawn(sp.def, sideId, { q: sp.at[0], r: sp.at[1] });
  }
  for (const r of file.rituals) {
    const leaderUid = r.leader ? [...b.units.values()].find((u) => u.defId === r.leader && u.side === r.side)?.uid ?? null : null;
    createRitual(b, { id: r.id, side: r.side, center: { q: r.center[0], r: r.center[1] }, radius: r.radius, required: r.required, leaderUid, summonDefId: r.summon, linkGroup: r.linkGroup });
  }
  for (const [sideId, s] of Object.entries(file.sides)) {
    for (const p of s.portals ?? []) callPortal(b, sideId, { q: p.at[0], r: p.at[1] }, { id: p.id, capacity: p.capacity, cooldown: p.cooldown, telegraph: 0 });
    for (const q of s.reinforcementQueue ?? []) { const portal = b.portals.get(q.portal); if (portal) queueReinforcement(b, portal, q.def, q.platoon); }
  }
  const ctrl = new BattleController(b, { sides: Object.fromEntries(Object.entries(file.sides).map(([id, s]) => [id, s.objectives])), roundLimit: file.roundLimit, roundLimitWinner: file.roundLimitWinner });
  return { ctrl, file };
}
