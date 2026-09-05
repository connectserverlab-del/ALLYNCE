import type { Registry } from "./data.js";
import type { MapSpec } from "./mapgen.js";
import { storageCap, type KingdomState, type Resources, type ResourceId } from "./kingdom.js";

/** One battle-sized patch of the province map. Its `map` bias feeds `setUpMatch`/`runMatch` directly, so a
 *  region replays as a different, still-legal battlefield every time it is fought over rather than standing
 *  in for a single fixed painting. */
export interface CampaignRegionDef {
  id: string; name: string; text: string;
  neighbors: string[];
  startingOwner: string | null;
  map: Omit<MapSpec, "seed">;
  /** Resources per hour this region pays its owner while held, on top of the holding's own buildings. */
  production: Resources;
}
export interface CampaignMapDef {
  id: string; name: string; text: string;
  regions: CampaignRegionDef[];
}

/** Which side holds which region. Fully serialisable. */
export interface CampaignState {
  mapId: string;
  owner: Record<string, string | null>;
}

export function newCampaign(map: CampaignMapDef): CampaignState {
  const owner: Record<string, string | null> = {};
  for (const r of map.regions) owner[r.id] = r.startingOwner;
  return { mapId: map.id, owner };
}

export function region(map: CampaignMapDef, id: string): CampaignRegionDef {
  const r = map.regions.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown region ${id}`);
  return r;
}

export function ownedRegions(map: CampaignMapDef, state: CampaignState, side: string): CampaignRegionDef[] {
  return map.regions.filter((r) => state.owner[r.id] === side);
}

/** A side may only contest ground that borders territory it already holds, so the front stays one contiguous
 *  line instead of jumping to an unconnected region. */
export function contestableRegions(map: CampaignMapDef, state: CampaignState, side: string): CampaignRegionDef[] {
  const held = new Set(ownedRegions(map, state, side).map((r) => r.id));
  return map.regions.filter((r) => state.owner[r.id] !== side && r.neighbors.some((n) => held.has(n)));
}

/** The seeded field a region's battle plays on: its own biome bias, given a match seed. */
export function battleMapSpec(r: CampaignRegionDef, seed: number): MapSpec {
  return { ...r.map, seed };
}

/** Record a region battle's outcome. A draw or an unresolved siege (`winnerSide` null) leaves ownership as is. */
export function resolveRegionBattle(state: CampaignState, regionId: string, winnerSide: string | null): void {
  if (winnerSide) state.owner[regionId] = winnerSide;
}

export interface RegionProduction { source: string; resource: ResourceId; perHour: number }

/** Every region a side holds, named so it shows up in the same breakdown as a building or a research bonus. */
export function regionProduction(map: CampaignMapDef, state: CampaignState, side: string): RegionProduction[] {
  const out: RegionProduction[] = [];
  for (const r of ownedRegions(map, state, side)) {
    for (const [resource, perHour] of Object.entries(r.production) as Array<[ResourceId, number]>) {
      out.push({ source: `Region: ${r.name}`, resource, perHour });
    }
  }
  return out;
}

export interface CampaignTickReport { produced: Resources; sources: RegionProduction[] }

/** Feed `seconds` of held-region production into a holding, capped by its storage like any other income. */
export function applyCampaignProduction(reg: Registry, map: CampaignMapDef, state: CampaignState, side: string, k: KingdomState, seconds: number): CampaignTickReport {
  const sources = regionProduction(map, state, side);
  const hours = seconds / 3600;
  const cap = storageCap(reg, k);
  const produced: Resources = {};
  for (const s of sources) {
    const gain = Math.floor(s.perHour * hours);
    if (gain <= 0) continue;
    const before = k.resources[s.resource];
    k.resources[s.resource] = Math.min(cap, before + gain);
    produced[s.resource] = (produced[s.resource] ?? 0) + (k.resources[s.resource] - before);
  }
  return { produced, sources };
}
