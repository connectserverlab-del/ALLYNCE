import type { Registry } from "./data.js";
import type { Role, Modifier } from "./types.js";
import type { Battle } from "./state.js";
import { Rng } from "./rng.js";

export type ResourceId = "koku" | "iron" | "timber" | "silver";
export type Resources = Partial<Record<ResourceId, number>>;
export type BuildingId =
  | "KEEP" | "GRANARY" | "MINE" | "SAWPIT" | "BARRACKS" | "RESEARCH_HALL"
  | "RECRUITMENT_HALL" | "FORGE" | "STABLE" | "WALL" | "SHRINE";

export interface BuildingDef {
  name: string; maxLevel: number; text: string;
  cost: Resources; costGrowth: number; buildSeconds: number; timeGrowth: number;
  produces?: Resources;
  art?: Array<string | null>;
  effect?: { armyCapacity?: number; researchSpeed?: number; researchTier?: number; drawFloor?: number; atk?: number; cavalryAtk?: number; def?: number; fusionChargesPer?: number; ritualProgress?: number };
}
export interface TierBand { tier: number; fromLevel: number; toLevel: number; text: string }
export interface KingdomData {
  tierBands: TierBand[];
  resources: Record<ResourceId, { name: string; text: string }>;
  buildings: Record<BuildingId, BuildingDef>;
  startingResources: Required<Resources>;
  storagePerKeepLevel: number;
}
export interface ResearchDef {
  id: string; name: string; tier: number; text: string; cost: Resources; seconds: number; requires: string[];
  effect:
    | { kind: "StatAll"; stat: "ATK" | "DEF"; value: number }
    | { kind: "StatRole"; role: Role; stat: "ATK" | "DEF"; value: number }
    | { kind: "Movement"; value: number }
    | { kind: "CommandRadius"; value: number }
    | { kind: "ArmyCapacity"; value: number }
    | { kind: "ContinuityRounds"; value: number }
    | { kind: "RitualProgress"; value: number }
    | { kind: "FusionCharges"; value: number }
    | { kind: "Morale"; value: number };
}
export interface BannerDef { id: string; name: string; text: string; cost: Resources; pity: number; pityFloor?: number; rates: Array<{ stars: number; weight: number }> }

export interface BuildJob { building: BuildingId; toLevel: number; secondsLeft: number }
export interface ResearchJob { id: string; secondsLeft: number }

/** The player's permanent holding between battles. Fully serialisable. */
export interface KingdomState {
  name: string;
  faction: string;
  resources: Required<Resources>;
  levels: Record<BuildingId, number>;
  buildQueue: BuildJob[];
  research: { done: string[]; active: ResearchJob | null };
  collection: Record<string, number>;   // unit id -> copies owned
  pity: Record<string, number>;         // banner id -> draws since a high-star result
  seed: number;
  elapsed: number;
}

export const BUILDING_IDS: BuildingId[] = ["KEEP", "GRANARY", "MINE", "SAWPIT", "BARRACKS", "RESEARCH_HALL", "RECRUITMENT_HALL", "FORGE", "STABLE", "WALL", "SHRINE"];

export function newKingdom(reg: Registry, faction: string, opts: { name?: string; seed?: number } = {}): KingdomState {
  const levels = Object.fromEntries(BUILDING_IDS.map((b) => [b, b === "KEEP" ? 1 : 0])) as Record<BuildingId, number>;
  return {
    name: opts.name ?? "Ashfall Hold", faction,
    resources: { ...reg.kingdom.startingResources },
    levels, buildQueue: [], research: { done: [], active: null },
    collection: {}, pity: {}, seed: opts.seed ?? 1, elapsed: 0,
  };
}

const scale = (base: number, growth: number, level: number) => Math.round(base * Math.pow(growth, Math.max(0, level)));

/** Cost to raise `building` from its current level to the next. */
export function upgradeCost(reg: Registry, k: KingdomState, building: BuildingId): Resources {
  const d = reg.kingdom.buildings[building];
  const out: Resources = {};
  for (const [r, v] of Object.entries(d.cost) as Array<[ResourceId, number]>) out[r] = scale(v, d.costGrowth, k.levels[building]);
  return out;
}
export function upgradeSeconds(reg: Registry, k: KingdomState, building: BuildingId): number {
  const d = reg.kingdom.buildings[building];
  const raw = scale(d.buildSeconds, d.timeGrowth, k.levels[building]);
  return Math.max(30, Math.round(raw * (1 - researchSpeedBonus(reg, k))));
}
function researchSpeedBonus(reg: Registry, k: KingdomState): number {
  const per = reg.kingdom.buildings.RESEARCH_HALL.effect?.researchSpeed ?? 0;
  return Math.min(0.5, per * k.levels.RESEARCH_HALL);
}
export function storageCap(reg: Registry, k: KingdomState): number { return reg.kingdom.storagePerKeepLevel * Math.max(1, k.levels.KEEP); }

export function canAfford(k: KingdomState, cost: Resources): boolean {
  return (Object.entries(cost) as Array<[ResourceId, number]>).every(([r, v]) => k.resources[r] >= v);
}
function pay(k: KingdomState, cost: Resources): void {
  for (const [r, v] of Object.entries(cost) as Array<[ResourceId, number]>) k.resources[r] -= v;
}

export interface ActionResult { ok: boolean; reason?: string }

/** Queue a building upgrade. The Keep gates every other building, and only one build runs at a time per building. */
export function startUpgrade(reg: Registry, k: KingdomState, building: BuildingId): ActionResult {
  const d = reg.kingdom.buildings[building];
  const level = k.levels[building];
  if (level >= d.maxLevel) return { ok: false, reason: `${d.name} is already at its maximum level` };
  if (k.buildQueue.some((j) => j.building === building)) return { ok: false, reason: `${d.name} is already being raised` };
  if (building !== "KEEP" && level + 1 > k.levels.KEEP) return { ok: false, reason: `Raise the Keep past level ${k.levels.KEEP} before ${d.name} level ${level + 1}` };
  const cost = upgradeCost(reg, k, building);
  if (!canAfford(k, cost)) return { ok: false, reason: `Not enough ${(Object.entries(cost) as Array<[ResourceId, number]>).filter(([r, v]) => k.resources[r] < v).map(([r]) => reg.kingdom.resources[r].name).join(" and ")}` };
  pay(k, cost);
  k.buildQueue.push({ building, toLevel: level + 1, secondsLeft: upgradeSeconds(reg, k, building) });
  return { ok: true };
}

export function researchable(reg: Registry, k: KingdomState): ResearchDef[] {
  const tierCap = Math.ceil(k.levels.RESEARCH_HALL / 2); // a holding with no Research Hall studies nothing
  return [...reg.research.values()].filter((r) =>
    !k.research.done.includes(r.id) && r.tier <= tierCap && r.requires.every((q) => k.research.done.includes(q)));
}

export function startResearch(reg: Registry, k: KingdomState, id: string): ActionResult {
  const r = reg.research.get(id);
  if (!r) return { ok: false, reason: `Unknown research ${id}` };
  if (k.research.active) return { ok: false, reason: `${reg.research.get(k.research.active.id)!.name} is already under way` };
  if (k.research.done.includes(id)) return { ok: false, reason: `${r.name} is already complete` };
  if (!researchable(reg, k).some((x) => x.id === id)) return { ok: false, reason: `${r.name} needs a higher Research Hall or an earlier study` };
  if (!canAfford(k, r.cost)) return { ok: false, reason: "Not enough resources" };
  pay(k, r.cost);
  k.research.active = { id, secondsLeft: Math.round(r.seconds * (1 - researchSpeedBonus(reg, k))) };
  return { ok: true };
}

export interface TickReport { produced: Resources; finishedBuildings: BuildingId[]; finishedResearch: string[] }

/** Advance the holding by `seconds`: production, build queue and research all move together. */
export function tick(reg: Registry, k: KingdomState, seconds: number): TickReport {
  const report: TickReport = { produced: {}, finishedBuildings: [], finishedResearch: [] };
  const cap = storageCap(reg, k);
  const hours = seconds / 3600;
  for (const b of BUILDING_IDS) {
    const d = reg.kingdom.buildings[b];
    if (!d.produces || k.levels[b] === 0) continue;
    for (const [r, v] of Object.entries(d.produces) as Array<[ResourceId, number]>) {
      const gain = Math.floor(v * k.levels[b] * hours);
      if (gain <= 0) continue;
      const before = k.resources[r];
      k.resources[r] = Math.min(cap, before + gain);
      report.produced[r] = (report.produced[r] ?? 0) + (k.resources[r] - before);
    }
  }
  for (let i = k.buildQueue.length - 1; i >= 0; i--) {
    const job = k.buildQueue[i]!;
    job.secondsLeft -= seconds;
    if (job.secondsLeft <= 0) { k.levels[job.building] = job.toLevel; k.buildQueue.splice(i, 1); report.finishedBuildings.push(job.building); }
  }
  if (k.research.active) {
    k.research.active.secondsLeft -= seconds;
    if (k.research.active.secondsLeft <= 0) { k.research.done.push(k.research.active.id); report.finishedResearch.push(k.research.active.id); k.research.active = null; }
  }
  k.elapsed += seconds;
  return report;
}

// ---------------------------------------------------------------- recruitment

export interface DrawResult { unitId: string; stars: number; name: string; duplicate: boolean; pityTriggered: boolean }

/** Draw `n` cards from a banner. Pity guarantees the banner's floor star once the counter runs out. */
export function drawFromBanner(reg: Registry, k: KingdomState, bannerId: string, n = 1): { ok: boolean; reason?: string; cards: DrawResult[] } {
  const banner = reg.banners.get(bannerId);
  if (!banner) return { ok: false, reason: `Unknown banner ${bannerId}`, cards: [] };
  if (k.levels.RECRUITMENT_HALL < 1) return { ok: false, reason: "Raise a Recruitment Hall first", cards: [] };
  const cards: DrawResult[] = [];
  const rng = new Rng(k.seed + k.elapsed + Object.keys(k.collection).length * 7919);
  const floorBonus = (reg.kingdom.buildings.RECRUITMENT_HALL.effect?.drawFloor ?? 0) * k.levels.RECRUITMENT_HALL;
  for (let i = 0; i < n; i++) {
    if (!canAfford(k, banner.cost)) return { ok: cards.length > 0, reason: "Not enough resources for the next draw", cards };
    pay(k, banner.cost);
    const counter = (k.pity[bannerId] ?? 0) + 1;
    const pityHit = counter >= banner.pity;
    let stars = pickStars(rng, banner, floorBonus);
    if (pityHit && banner.pityFloor) stars = Math.max(stars, banner.pityFloor);
    const pool = [...reg.units.values()].filter((d) => (d.stars ?? 1) === stars && !d.summonOnly && d.faction !== "DIV");
    const themed = pool.filter((d) => d.faction === k.faction);
    const choose = (themed.length && rng.next() < 0.7 ? themed : pool.length ? pool : themed);
    if (!choose.length) { i--; continue; }
    const pick = choose[rng.int(choose.length)]!;
    const duplicate = (k.collection[pick.id] ?? 0) > 0;
    k.collection[pick.id] = (k.collection[pick.id] ?? 0) + 1;
    k.pity[bannerId] = stars >= (banner.pityFloor ?? 7) ? 0 : counter;
    cards.push({ unitId: pick.id, stars, name: pick.name, duplicate, pityTriggered: pityHit && stars === banner.pityFloor });
  }
  return { ok: true, cards };
}
function pickStars(rng: Rng, banner: BannerDef, floorBonus: number): number {
  const rates = banner.rates.map((r) => ({ stars: r.stars, weight: r.weight * (1 + floorBonus * (r.stars - 1) / 9) }));
  const total = rates.reduce((s, r) => s + r.weight, 0);
  let roll = rng.next() * total;
  for (const r of rates) { roll -= r.weight; if (roll <= 0) return r.stars; }
  return rates[rates.length - 1]!.stars;
}

// ---------------------------------------------------------------- battle carry-over

export interface KingdomEffects {
  armyCapacity: number; fusionCharges: number; ritualProgress: number; continuityRounds: number;
  movement: number; commandRadius: number; morale: number;
  statMods: Array<{ source: string; stat: "ATK" | "DEF"; value: number; role?: Role }>;
}

/** Everything the holding contributes to a battle, each entry named so it shows up in the modifier breakdown. */
export function kingdomEffects(reg: Registry, k: KingdomState): KingdomEffects {
  const e: KingdomEffects = { armyCapacity: 0, fusionCharges: 1, ritualProgress: 0, continuityRounds: 0, movement: 0, commandRadius: 0, morale: 0, statMods: [] };
  for (const b of BUILDING_IDS) {
    const lvl = k.levels[b]; if (!lvl) continue;
    const def = reg.kingdom.buildings[b]; const eff = def.effect; if (!eff) continue;
    if (eff.armyCapacity) e.armyCapacity += eff.armyCapacity * lvl;
    if (eff.atk) e.statMods.push({ source: `${def.name} ${lvl}`, stat: "ATK", value: eff.atk * lvl });
    if (eff.def) e.statMods.push({ source: `${def.name} ${lvl}`, stat: "DEF", value: eff.def * lvl });
    if (eff.cavalryAtk) e.statMods.push({ source: `${def.name} ${lvl}`, stat: "ATK", value: eff.cavalryAtk * lvl, role: "Cavalry" });
    if (eff.fusionChargesPer) e.fusionCharges += Math.floor(lvl / eff.fusionChargesPer);
    if (eff.ritualProgress) e.ritualProgress += eff.ritualProgress * Math.floor(lvl / 3);
  }
  for (const id of k.research.done) {
    const r = reg.research.get(id); if (!r) continue;
    const eff = r.effect;
    switch (eff.kind) {
      case "StatAll": e.statMods.push({ source: `Research: ${r.name}`, stat: eff.stat, value: eff.value }); break;
      case "StatRole": e.statMods.push({ source: `Research: ${r.name}`, stat: eff.stat, value: eff.value, role: eff.role }); break;
      case "Movement": e.movement += eff.value; break;
      case "CommandRadius": e.commandRadius += eff.value; break;
      case "ArmyCapacity": e.armyCapacity += eff.value; break;
      case "ContinuityRounds": e.continuityRounds += eff.value; break;
      case "RitualProgress": e.ritualProgress += eff.value; break;
      case "FusionCharges": e.fusionCharges += eff.value; break;
      case "Morale": e.morale += eff.value; break;
    }
  }
  return e;
}

/** Attach a holding's effects to one side of a battle. */
export function applyKingdom(b: Battle, side: string, k: KingdomState): KingdomEffects {
  const e = kingdomEffects(b.reg, k);
  b.kingdomEffects.set(side, e);
  const s = b.sides.get(side);
  if (s) { s.armyCapacity += e.armyCapacity; s.fusionCharges = e.fusionCharges; }
  for (const u of b.activeUnits(side)) u.morale = Math.min(100, u.morale + e.morale);
  b.log("KingdomApplied", { side, holding: k.name, armyCapacity: e.armyCapacity, fusionCharges: e.fusionCharges, research: k.research.done.length });
  return e;
}

/** Kingdom stat modifiers that apply to one unit, already filtered by role. */
export function kingdomMods(b: Battle, side: string, roles: Role[], stat: "ATK" | "DEF"): Modifier[] {
  const e = b.kingdomEffects.get(side);
  if (!e) return [];
  return e.statMods.filter((m) => m.stat === stat && (!m.role || roles.includes(m.role))).map((m) => ({ source: m.source, stat, value: m.value }));
}

/** Which visual tier a building shows at its current level, and the art for it. */
export function buildingTier(reg: Registry, level: number): TierBand {
  const bands = reg.kingdom.tierBands;
  return bands.find((t) => level >= t.fromLevel && level <= t.toLevel) ?? bands[0]!;
}
export function buildingArt(reg: Registry, building: BuildingId, level: number): string | null {
  if (level < 1) return null;
  const art = reg.kingdom.buildings[building].art;
  if (!art) return null;
  const t = buildingTier(reg, level).tier;
  // fall back to the nearest lower tier that has art, so a missing asset never blanks the map
  for (let i = t - 1; i >= 0; i--) if (art[i]) return art[i]!;
  return null;
}
/** The level at which a building next changes its look, if any. */
export function nextTierAt(reg: Registry, level: number): number | null {
  const next = reg.kingdom.tierBands.find((t) => t.fromLevel > level);
  return next ? next.fromLevel : null;
}
