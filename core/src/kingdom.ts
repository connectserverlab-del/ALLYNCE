import type { Registry } from "./data.js";
import type { Role, Modifier, UnitDef } from "./types.js";
import type { Battle } from "./state.js";
import { Rng } from "./rng.js";
import { newWantedState, type WantedState } from "./wanted.js";
import { changeMorale } from "./morale.js";

/**
 * Grain, ore, timber and silver are produced by buildings and stockpiled against the City Hall's
 * storage. Gold and ruby are not: gold is what the summoning bell and the shop want, ruby is rarer
 * still and no building makes it. `KingdomData.uncappedResources` says which ignore the cap.
 */
export type ResourceId = "koku" | "iron" | "timber" | "silver" | "gold" | "ruby";
export type Resources = Partial<Record<ResourceId, number>>;
export type BuildingId =
  | "KEEP" | "GRANARY" | "MINE" | "SAWPIT" | "BARRACKS" | "RESEARCH_HALL"
  | "RECRUITMENT_HALL" | "FORGE" | "STABLE" | "WALL" | "SHRINE" | "SHOP" | "ARMORY";

/** A plot on the hold's grid. The player may move any building to any free plot. */
export interface Plot { x: number; y: number }

export interface BuildingDef {
  name: string; maxLevel: number; text: string;
  cost: Resources; costGrowth: number; buildSeconds: number; timeGrowth: number;
  produces?: Resources;
  /** Other buildings that must already be at a level before this one may be raised at all. */
  requires?: Array<{ building: BuildingId; level: number }>;
  /** Where this building sits when a hold is founded, before the player moves it. */
  plot?: [number, number];
  art?: Array<string | null>;
  effect?: { armyCapacity?: number; researchSpeed?: number; researchTier?: number; drawFloor?: number; atk?: number; cavalryAtk?: number; def?: number; fusionChargesPer?: number; ritualProgress?: number };
}
export interface TierBand { tier: number; fromLevel: number; toLevel: number; text: string }
export interface KingdomData {
  tierBands: TierBand[];
  resources: Record<ResourceId, { name: string; text: string; kind?: string }>;
  buildings: Record<BuildingId, BuildingDef>;
  startingResources: Required<Resources>;
  storagePerKeepLevel: number;
  /** Resources the City Hall's storage does not cap. */
  uncappedResources?: ResourceId[];
  /** Every distinct ten-star unit owned raises production of these resources by `bonusPerUnit`. */
  tenStarProduction?: { bonusPerUnit: number; resources: ResourceId[]; text?: string };
  layout?: { cols: number; rows: number; text?: string };
  /** Weights for `core/src/power.ts`. Balance, so it lives in data. */
  power?: Partial<import("./power.js").PowerWeights>;
  /** Buyable card borders. Display only, and priced in gold and ruby. */
  borders?: import("./cosmetics.js").BorderDef[];
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
  /** Which plot each building stands on. The player may move any of them; see `moveBuilding`. */
  layout: Record<BuildingId, Plot>;
  collection: Record<string, number>;   // unit id -> copies owned
  /** Bought borders and earned shine, by unit id. Display only; see `core/src/cosmetics.ts`. */
  cosmetics?: import("./cosmetics.js").Cosmetics;
  pity: Record<string, number>;         // banner id -> draws since a high-star result
  wanted: WantedState;                  // warrants posted, in hand and settled
  seed: number;
  elapsed: number;
  draws: number;                        // total cards ever drawn from any banner; keeps each draw's roll unique
}

/** Every resource at zero. The single place a full bag is spelled out, so adding a currency is one
 *  edit rather than a hunt through every literal that happened to list them all. */
export const NO_RESOURCES: Required<Resources> = { koku: 0, iron: 0, timber: 0, silver: 0, gold: 0, ruby: 0 };

/** `NO_RESOURCES` as a fresh object, safe to call from a module that this one imports. `wanted.ts`
 *  is loaded by this file, so a module-scope `{ ...NO_RESOURCES }` there reads the binding before it
 *  is initialised; calling a function defers that read until the cycle has settled. */
export function emptyResources(): Required<Resources> {
  return { koku: 0, iron: 0, timber: 0, silver: 0, gold: 0, ruby: 0 };
}

/** All resource ids, in the order the data declares them. */
export const RESOURCE_IDS: ResourceId[] = ["koku", "iron", "timber", "silver", "gold", "ruby"];

export const BUILDING_IDS: BuildingId[] = ["KEEP", "GRANARY", "MINE", "SAWPIT", "BARRACKS", "RESEARCH_HALL", "RECRUITMENT_HALL", "FORGE", "STABLE", "WALL", "SHRINE", "SHOP", "ARMORY"];

export function newKingdom(reg: Registry, faction: string, opts: { name?: string; seed?: number } = {}): KingdomState {
  const levels = Object.fromEntries(BUILDING_IDS.map((b) => [b, b === "KEEP" ? 1 : 0])) as Record<BuildingId, number>;
  return {
    name: opts.name ?? "Ashfall Hold", faction,
    resources: { ...reg.kingdom.startingResources },
    levels, buildQueue: [], research: { done: [], active: null },
    layout: defaultLayout(reg),
    cosmetics: {},
    collection: {}, pity: {}, wanted: newWantedState(), seed: opts.seed ?? 1, elapsed: 0, draws: 0,
  };
}

/** The plots a hold is founded on, straight from the data. */
export function defaultLayout(reg: Registry): Record<BuildingId, Plot> {
  const out = {} as Record<BuildingId, Plot>;
  for (const b of BUILDING_IDS) {
    const p = reg.kingdom.buildings[b].plot;
    out[b] = p ? { x: p[0], y: p[1] } : { x: 0, y: 0 };
  }
  return out;
}

/** The hold's grid, or a sane default if the data does not say. */
export function layoutSize(reg: Registry): { cols: number; rows: number } {
  return { cols: reg.kingdom.layout?.cols ?? 12, rows: reg.kingdom.layout?.rows ?? 8 };
}

/**
 * Move a building to a free plot.
 *
 * A hold the player cannot arrange is a list, not a place. The rules are only that a plot is on the
 * grid and that two buildings never share one — the grid is cosmetic, so nothing here touches
 * production, cost or `kingdomEffects`. A build in progress does not pin a building down; you can
 * rearrange while the scaffolding is up.
 */
export function moveBuilding(reg: Registry, k: KingdomState, building: BuildingId, to: Plot): ActionResult {
  const { cols, rows } = layoutSize(reg);
  if (!Number.isInteger(to.x) || !Number.isInteger(to.y)) return { ok: false, reason: "A plot is a whole square" };
  if (to.x < 0 || to.y < 0 || to.x >= cols || to.y >= rows) return { ok: false, reason: "That plot is outside the hold" };
  const occupant = BUILDING_IDS.find((b) => b !== building && k.layout[b].x === to.x && k.layout[b].y === to.y);
  if (occupant) return { ok: false, reason: `${reg.kingdom.buildings[occupant].name} already stands there` };
  k.layout[building] = { x: to.x, y: to.y };
  return { ok: true };
}

/** Swap two buildings' plots. Dragging one onto another reads as a swap, not as an error. */
export function swapBuildings(k: KingdomState, a: BuildingId, b: BuildingId): ActionResult {
  if (a === b) return { ok: false, reason: "A building cannot swap with itself" };
  const pa = k.layout[a];
  k.layout[a] = k.layout[b];
  k.layout[b] = pa;
  return { ok: true };
}

/**
 * Repair a holding that was built by an older shape of this file.
 *
 * `saveGame` deep-clones the whole `KingdomState`, so nothing new is *dropped* on the way out. The
 * risk runs the other way: a holding written before a field existed comes back without it, and the
 * first thing to touch `k.layout[b].x` or `k.resources.gold` gets a crash or a NaN rather than an
 * error anyone can read. Every field added here since has a default, and this is where they are
 * applied. It is idempotent, so calling it on a current holding does nothing.
 */
export function normalizeKingdom(reg: Registry, k: KingdomState): KingdomState {
  for (const r of RESOURCE_IDS) if (typeof k.resources[r] !== "number") k.resources[r] = reg.kingdom.startingResources[r] ?? 0;
  k.layout ??= defaultLayout(reg);
  const fallback = defaultLayout(reg);
  for (const b of BUILDING_IDS) {
    if (typeof k.levels[b] !== "number") k.levels[b] = 0;
    const p = k.layout[b];
    if (!p || typeof p.x !== "number" || typeof p.y !== "number") k.layout[b] = fallback[b];
  }
  k.cosmetics ??= {};
  return k;
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
  if (building !== "KEEP" && level + 1 > k.levels.KEEP) return { ok: false, reason: `Raise the ${reg.kingdom.buildings.KEEP.name} past level ${k.levels.KEEP} before ${d.name} level ${level + 1}` };
  const unmet = unmetRequirements(reg, k, building);
  if (unmet.length) {
    const first = unmet[0]!;
    return { ok: false, reason: `${d.name} needs ${reg.kingdom.buildings[first.building].name} level ${first.level}` };
  }
  const cost = upgradeCost(reg, k, building);
  if (!canAfford(k, cost)) return { ok: false, reason: `Not enough ${(Object.entries(cost) as Array<[ResourceId, number]>).filter(([r, v]) => k.resources[r] < v).map(([r]) => reg.kingdom.resources[r].name).join(" and ")}` };
  pay(k, cost);
  k.buildQueue.push({ building, toLevel: level + 1, secondsLeft: upgradeSeconds(reg, k, building) });
  return { ok: true };
}

/**
 * The prerequisites a building has not met yet, in the order the data lists them.
 *
 * The City Hall's level gate is separate and applies to everything; these are the per-building
 * requirements that make a hold grow in a readable order — no forge before a mine, no stable before
 * a barracks. Exported because a UI wants to show the requirement on a row it has greyed out, and
 * recomputing it there would be a second copy of this rule.
 */
export function unmetRequirements(reg: Registry, k: KingdomState, building: BuildingId): Array<{ building: BuildingId; level: number }> {
  return (reg.kingdom.buildings[building].requires ?? []).filter((r) => k.levels[r.building] < r.level);
}

/** Whether the player could start this upgrade right now, ignoring cost. */
export function canUpgrade(reg: Registry, k: KingdomState, building: BuildingId): boolean {
  const d = reg.kingdom.buildings[building];
  if (k.levels[building] >= d.maxLevel) return false;
  if (building !== "KEEP" && k.levels[building] + 1 > k.levels.KEEP) return false;
  return unmetRequirements(reg, k, building).length === 0;
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

/** What the collection's ten-star units are worth to the hold's production. */
export interface TenStarBonus {
  /** Distinct ten-star units owned. Copies of the same unit count once. */
  units: string[];
  /** Added multiplier, e.g. 0.4 for two ten-stars at 20% each. */
  multiplier: number;
  resources: ResourceId[];
}

/**
 * Every distinct ten-star unit in the collection raises grain, ore and timber production.
 *
 * Distinct, not total: a second copy of the same ten-star is worth a card merge (see
 * `core/src/cosmetics.ts`), not a second 20%. Stacking copies would make the buff a pure function
 * of luck at the summoning bell, and a player who drew one of each would fall behind a player who
 * drew the same one four times.
 */
export function tenStarBonus(reg: Registry, k: KingdomState): TenStarBonus {
  const cfg = reg.kingdom.tenStarProduction;
  if (!cfg) return { units: [], multiplier: 0, resources: [] };
  const units: string[] = [];
  for (const [id, copies] of Object.entries(k.collection)) {
    if (copies <= 0) continue;
    const u = reg.units.get(id);
    if (u && u.stars === 10) units.push(id);
  }
  units.sort();
  return { units, multiplier: units.length * cfg.bonusPerUnit, resources: cfg.resources };
}

export interface TickReport { produced: Resources; finishedBuildings: BuildingId[]; finishedResearch: string[] }

/** Advance the holding by `seconds`: production, build queue and research all move together. */
export function tick(reg: Registry, k: KingdomState, seconds: number): TickReport {
  const report: TickReport = { produced: {}, finishedBuildings: [], finishedResearch: [] };
  const cap = storageCap(reg, k);
  const uncapped = new Set(reg.kingdom.uncappedResources ?? []);
  const hours = seconds / 3600;
  const buff = tenStarBonus(reg, k);
  for (const b of BUILDING_IDS) {
    const d = reg.kingdom.buildings[b];
    if (!d.produces || k.levels[b] === 0) continue;
    for (const [r, v] of Object.entries(d.produces) as Array<[ResourceId, number]>) {
      const gain = Math.floor(v * k.levels[b] * hours * (1 + (buff.resources.includes(r) ? buff.multiplier : 0)));
      if (gain <= 0) continue;
      const before = k.resources[r];
      // Gold and ruby are coin, not stores: the City Hall's granary does not bound them.
      k.resources[r] = uncapped.has(r) ? before + gain : Math.min(cap, before + gain);
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

/**
 * The starter box a new holding opens with.
 *
 * A card in a deck is a physical card you hold, so a fresh player needs enough of them to sleeve a
 * legal hundred. The box is generous with line soldiers and stingy upward: everything at three stars
 * and below arrives at its full rules allowance, the middle ranks arrive thinned, and anything at
 * eight stars or above arrives not at all. Those are won at the recruitment hall or taken off the
 * field on a wanted contract.
 */
export function grantStarterCollection(reg: Registry, k: KingdomState): void {
  const share = (stars: number, own: boolean): number => {
    if (own) return stars <= 7 ? 1 : 0;   // your own host arrives whole up to its champions
    if (stars <= 3) return 1;             // hired line soldiers are cheap and everywhere
    if (stars <= 6) return 0.5;
    if (stars === 7) return 1 / 3;
    return 0;
  };
  for (const d of reg.units.values()) {
    if (d.summonOnly || d.faction === "DIV") continue;
    const stars = d.stars ?? 1;
    const limit = reg.deckRules.copyLimitByStar[String(stars)] ?? 0;
    if (limit <= 0) continue;
    const own = d.faction === k.faction;
    // a named unique is one card in the world; you either hold it or you do not
    const n = d.unique ? (own || stars <= 6 ? 1 : 0) : Math.floor(limit * share(stars, own));
    if (n > 0) k.collection[d.id] = Math.max(k.collection[d.id] ?? 0, n);
  }
}

export interface DrawResult { unitId: string; stars: number; name: string; duplicate: boolean; pityTriggered: boolean }

/** Draw `n` cards from a banner. Pity guarantees the banner's floor star once the counter runs out. */
export function drawFromBanner(reg: Registry, k: KingdomState, bannerId: string, n = 1): { ok: boolean; reason?: string; cards: DrawResult[] } {
  const banner = reg.banners.get(bannerId);
  if (!banner) return { ok: false, reason: `Unknown banner ${bannerId}`, cards: [] };
  if (k.levels.RECRUITMENT_HALL < 1) return { ok: false, reason: "Raise a Recruitment Hall first", cards: [] };
  const cards: DrawResult[] = [];
  // `elapsed` and the collection's own size are not enough on their own: two draws called back to back,
  // with no time passing and both landing on a card already owned, would otherwise reseed identically and
  // repeat the exact same pull every time (verified: it can lock onto one card for dozens of draws in a
  // row once the easy stars are all duplicates). `draws` is a plain monotonic counter, so every call gets
  // a seed no earlier call ever used, while staying exactly reproducible for a given save.
  const rng = new Rng(k.seed + k.elapsed + Object.keys(k.collection).length * 7919 + k.draws * 104729);
  k.draws++;
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
    // Registry validation guarantees every rate.stars has a recruitable unit, so pool is never empty here;
    // this guards a payment already taken (see below) from being spent on nothing if that invariant ever slips.
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

// ---------------------------------------------------------------- reforge

/**
 * Same-faction cards exactly one star above `sourceId`. A duplicate copy has nowhere else to go once a deck
 * already runs the star's copy limit, so reforging is the sink: trade several of a card up for one of a rarer
 * one instead of leaving it dead weight in the collection.
 */
export function reforgeTargets(reg: Registry, sourceId: string): UnitDef[] {
  const source = reg.units.get(sourceId);
  if (!source) return [];
  const nextStar = (source.stars ?? 1) + 1;
  return [...reg.units.values()].filter((d) =>
    d.faction === source.faction && d.faction !== "DIV" && !d.summonOnly && (d.stars ?? 1) === nextStar);
}

/** Copies of `sourceId` a reforge consumes, keyed by the source card's own star. Zero means it cannot be spent. */
export function reforgeCost(reg: Registry, sourceId: string): number {
  const source = reg.units.get(sourceId);
  if (!source) return 0;
  return reg.deckRules.reforgeCostByStar[String(source.stars ?? 1)] ?? 0;
}

/** Spend `reforgeCost` copies of `sourceId` for one copy of `targetId`, a valid target from `reforgeTargets`. */
export function reforge(reg: Registry, k: KingdomState, sourceId: string, targetId: string): ActionResult {
  const source = reg.units.get(sourceId);
  if (!source) return { ok: false, reason: `Unknown card ${sourceId}` };
  const cost = reforgeCost(reg, sourceId);
  if (cost <= 0) return { ok: false, reason: `${source.name} cannot be reforged further` };
  const owned = k.collection[sourceId] ?? 0;
  if (owned < cost) return { ok: false, reason: `Reforging ${source.name} takes ${cost} cop${cost === 1 ? "y" : "ies"}; you hold ${owned}` };
  const target = reforgeTargets(reg, sourceId).find((d) => d.id === targetId);
  if (!target) return { ok: false, reason: `${targetId} is not a ${source.faction} card one star above ${source.name}` };
  k.collection[sourceId] = owned - cost;
  k.collection[targetId] = (k.collection[targetId] ?? 0) + 1;
  return { ok: true };
}

// ---------------------------------------------------------------- battle carry-over

export interface KingdomEffects {
  armyCapacity: number; fusionCharges: number; ritualProgress: number; continuityRounds: number;
  movement: number; commandRadius: number;
  moraleMods: Array<{ source: string; value: number }>;
  statMods: Array<{ source: string; stat: "ATK" | "DEF"; value: number; role?: Role }>;
}

/** Everything the holding contributes to a battle, each entry named so it shows up in the modifier breakdown. */
export function kingdomEffects(reg: Registry, k: KingdomState): KingdomEffects {
  const e: KingdomEffects = { armyCapacity: 0, fusionCharges: 1, ritualProgress: 0, continuityRounds: 0, movement: 0, commandRadius: 0, moraleMods: [], statMods: [] };
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
      case "Morale": e.moraleMods.push({ source: `Research: ${r.name}`, value: eff.value }); break;
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
  for (const u of b.activeUnits(side)) for (const m of e.moraleMods) changeMorale(b, u, m.value, m.source);
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
