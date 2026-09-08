/**
 * Power: one number for how strong a holding is.
 *
 * Every builder-and-battler shows the player a single figure that goes up when anything goes up,
 * and uses it to match them against opponents of roughly their size. It has to be *comparable* — two
 * holdings with the same power should be about as dangerous as each other — so it is computed from
 * durable state only: what is built, what is researched, and what is owned. Nothing about the
 * battle in progress, nothing about the clock, nothing random. Two clients given the same
 * `KingdomState` must agree on it exactly, the same way they must agree on a round hash, because a
 * server that ranks players on a number the client also computes has to be able to check it.
 *
 * The weights live in `data/kingdom/power.json`, not here. Power is a balance number.
 */
import type { Registry } from "./registry.js";
import type { KingdomState, BuildingId } from "./kingdom.js";
import { BUILDING_IDS } from "./kingdom.js";

export interface PowerWeights {
  /** Power per building level, squared-ish via `levelExponent` so late levels are worth more. */
  perBuildingLevel: number;
  levelExponent: number;
  /** The City Hall is the spine of a hold and counts for more per level than anything else. */
  cityHallMultiplier: number;
  /** Power per completed research. */
  perResearch: number;
  /** Power per owned card, by star rating: index 0 is one star. */
  perCardByStar: number[];
  /** Copies beyond the first are worth this share of the first. */
  duplicateShare: number;
}

/** One line of the breakdown, so the UI can show *why* a number moved. */
export interface PowerLine { source: string; value: number }
export interface PowerReport {
  total: number;
  buildings: number;
  research: number;
  collection: number;
  lines: PowerLine[];
}

const DEFAULTS: PowerWeights = {
  perBuildingLevel: 40, levelExponent: 1.35, cityHallMultiplier: 2.5,
  perResearch: 120,
  perCardByStar: [5, 12, 25, 50, 90, 160, 280, 480, 800, 1400],
  duplicateShare: 0.25,
};

export function powerWeights(reg: Registry): PowerWeights {
  return { ...DEFAULTS, ...(reg.kingdom.power ?? {}) };
}

/** Power contributed by one building at one level. Exported so a UI can price the next level. */
export function buildingPower(reg: Registry, building: BuildingId, level: number): number {
  if (level <= 0) return 0;
  const w = powerWeights(reg);
  const mult = building === "KEEP" ? w.cityHallMultiplier : 1;
  let total = 0;
  // Per level rather than on the final level, so raising the fifth level is worth its own step and
  // the number climbs smoothly instead of jumping when a tier band changes.
  for (let l = 1; l <= level; l++) total += w.perBuildingLevel * Math.pow(l, w.levelExponent) * mult;
  return Math.round(total);
}

/** Power contributed by owning `copies` of a unit at `stars`. */
export function cardPower(reg: Registry, stars: number, copies: number): number {
  if (copies <= 0) return 0;
  const w = powerWeights(reg);
  const base = w.perCardByStar[Math.max(0, Math.min(w.perCardByStar.length - 1, stars - 1))] ?? 0;
  return Math.round(base * (1 + (copies - 1) * w.duplicateShare));
}

/**
 * The holding's power, with a breakdown.
 *
 * `lines` is ordered largest first and is what the interface shows when the player taps the figure;
 * a power number nobody can account for is a number players assume is broken.
 */
export function power(reg: Registry, k: KingdomState): PowerReport {
  const lines: PowerLine[] = [];
  let buildings = 0;
  for (const b of BUILDING_IDS) {
    const p = buildingPower(reg, b, k.levels[b] ?? 0);
    if (p <= 0) continue;
    buildings += p;
    lines.push({ source: `${reg.kingdom.buildings[b].name} ${k.levels[b]}`, value: p });
  }
  const w = powerWeights(reg);
  const research = k.research.done.length * w.perResearch;
  if (research > 0) lines.push({ source: `Research ×${k.research.done.length}`, value: research });

  let collection = 0;
  for (const [id, copies] of Object.entries(k.collection)) {
    if (copies <= 0) continue;
    const u = reg.units.get(id);
    if (!u) continue;
    const p = cardPower(reg, u.stars ?? 1, copies);
    collection += p;
  }
  if (collection > 0) lines.push({ source: "Collection", value: collection });

  lines.sort((a, b) => b.value - a.value || a.source.localeCompare(b.source));
  return { total: buildings + research + collection, buildings, research, collection, lines };
}
