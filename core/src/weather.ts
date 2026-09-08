import type { Battle } from "./state.js";
import type { UnitState } from "./types.js";
import { hexKey, hexesWithin, type Hex } from "./hex.js";
import { Rng } from "./rng.js";

export type WeatherId = "Clear" | "Rain" | "Fog";
export type TimeOfDayId = "Day" | "Night";

export interface WeatherCondition { weight: number; mudRadius?: number; rangedRangeMod?: number; text: string }
export interface TimeOfDayCondition { weight: number; rangedAtkMod?: number; text: string }
export interface WeatherRules {
  weather: Record<WeatherId, WeatherCondition>;
  timeOfDay: Record<TimeOfDayId, TimeOfDayCondition>;
}

function weightedPick<K extends string>(rng: Rng, table: Record<K, { weight: number }>): K {
  const entries = Object.entries(table) as Array<[K, { weight: number }]>;
  const total = entries.reduce((sum, [, v]) => sum + v.weight, 0);
  let roll = rng.next() * total;
  for (const [id, v] of entries) {
    if (roll < v.weight) return id;
    roll -= v.weight;
  }
  return entries[entries.length - 1]![0];
}

/** Rolled once per battle at setup, from the same seed as the rest of the field, so a replay reproduces it. */
export function rollWeather(rng: Rng, rules: WeatherRules): WeatherId { return weightedPick(rng, rules.weather); }
export function rollTimeOfDay(rng: Rng, rules: WeatherRules): TimeOfDayId { return weightedPick(rng, rules.timeOfDay); }

/**
 * Rain floods the low ground beside standing water: every Open hex within `mudRadius` of a Water or Ford hex
 * turns to Mud for the rest of the battle. A no-op for any weather without a `mudRadius` (Clear, Fog).
 * Returns the number of hexes changed, so callers can log it.
 */
export function applyWeatherTerrain(b: Battle): number {
  const cond = b.reg.weather.weather[b.weather];
  if (!cond.mudRadius) return 0;
  const wet: Hex[] = [];
  for (const [key, t] of b.terrain) {
    if (t !== "Water" && t !== "Ford") continue;
    const [q, r] = key.split(",").map(Number);
    wet.push({ q: q!, r: r! });
  }
  let changed = 0;
  for (const source of wet) {
    for (const h of hexesWithin(source, cond.mudRadius)) {
      const k = hexKey(h);
      if (!b.inBounds(h) || b.terrainAt(h) !== "Open") continue;
      b.terrain.set(k, "Mud");
      changed++;
    }
  }
  if (changed) b.log("WeatherApplied", { weather: b.weather, terrainChanged: changed });
  return changed;
}

/** A ranged unit's attack range after weather (Fog cuts it, never below one hex). Melee reach never changes. */
export function effectiveRange(b: Battle, u: UnitState): number {
  const base = b.def(u).range;
  if (base <= 1) return base;
  const mod = b.reg.weather.weather[b.weather].rangedRangeMod ?? 0;
  return Math.max(1, base + mod);
}

/** Time of day's ranged ATK penalty (Night), zero otherwise. Folded into the modifier pipeline as a named source. */
export function weatherRangedAtkMod(b: Battle): number {
  return b.reg.weather.timeOfDay[b.timeOfDay].rangedAtkMod ?? 0;
}
