/**
 * What a card looks like once a player has spent on it.
 *
 * Two separate things, deliberately kept apart:
 *
 *   - a **border**, bought outright with currency. Gold, then rainbow. It is pure display and buys
 *     no advantage of any kind — nothing in `kingdomEffects`, `computeStat` or `power` reads it.
 *     A cosmetic that is also a stat is a cosmetic nobody can decline.
 *   - a **shine**, which cannot be bought at all. It is earned by merging duplicate copies of the
 *     same card, which consumes them. That is what a second copy of a card you already own is
 *     otherwise worth very little for.
 *
 * Both live on `KingdomState.cosmetics` and are saved with the holding.
 */
import type { Registry } from "./registry.js";
import type { KingdomState, Resources, ActionResult } from "./kingdom.js";
import { canAfford } from "./kingdom.js";

export type BorderId = "gold" | "rainbow";

export interface BorderDef {
  id: BorderId;
  name: string;
  text: string;
  cost: Resources;
  /** A border may require the one below it, so rainbow is a second purchase and not a shortcut. */
  requires?: BorderId;
}

/** What the player has done to one card. Absent means a plain card. */
export interface CardCosmetic {
  border?: BorderId;
  /** How many merges deep the shine is. Each merge consumes one duplicate copy. */
  shine?: number;
}

export type Cosmetics = Record<string, CardCosmetic>;

/** The most merges a single card will take, so a whale cannot make one card infinitely shiny. */
export const MAX_SHINE = 5;

export function borders(reg: Registry): BorderDef[] {
  return reg.kingdom.borders ?? [];
}

export function borderDef(reg: Registry, id: BorderId): BorderDef | undefined {
  return borders(reg).find((b) => b.id === id);
}

function slot(k: KingdomState, unitId: string): CardCosmetic {
  k.cosmetics ??= {};
  return (k.cosmetics[unitId] ??= {});
}

/** What the player has done to this card, or an empty record. Never mutates. */
export function cosmeticOf(k: KingdomState, unitId: string): CardCosmetic {
  return k.cosmetics?.[unitId] ?? {};
}

/**
 * Buy a border for one card.
 *
 * The card must be owned — a border on a card you do not hold is a receipt for nothing — and the
 * tiers are bought in order, so rainbow costs the gold border plus the rainbow price rather than
 * letting a player skip the first purchase.
 */
export function buyBorder(reg: Registry, k: KingdomState, unitId: string, id: BorderId): ActionResult {
  const def = borderDef(reg, id);
  if (!def) return { ok: false, reason: `No such border: ${id}` };
  if (!reg.units.get(unitId)) return { ok: false, reason: `No such card: ${unitId}` };
  if ((k.collection[unitId] ?? 0) < 1) return { ok: false, reason: "You do not own that card" };
  const have = cosmeticOf(k, unitId).border;
  if (have === id) return { ok: false, reason: `That card already has the ${def.name}` };
  if (def.requires && have !== def.requires) {
    const need = borderDef(reg, def.requires);
    return { ok: false, reason: `Buy the ${need?.name ?? def.requires} for that card first` };
  }
  if (!canAfford(k, def.cost)) {
    const short = (Object.entries(def.cost) as Array<[keyof Required<Resources>, number]>)
      .filter(([r, v]) => k.resources[r] < v)
      .map(([r]) => reg.kingdom.resources[r].name);
    return { ok: false, reason: `Not enough ${short.join(" and ")}` };
  }
  for (const [r, v] of Object.entries(def.cost) as Array<[keyof Required<Resources>, number]>) k.resources[r] -= v;
  slot(k, unitId).border = id;
  return { ok: true };
}

/** Whether a merge is possible right now, and why not when it is not. */
export function canMerge(reg: Registry, k: KingdomState, unitId: string): ActionResult {
  if (!reg.units.get(unitId)) return { ok: false, reason: `No such card: ${unitId}` };
  const copies = k.collection[unitId] ?? 0;
  // Two copies: one stays as the card you keep playing, one is consumed. Merging your only copy
  // would take the card out of the deck it is in, which is never what the player meant.
  if (copies < 2) return { ok: false, reason: "You need two copies to merge" };
  if ((cosmeticOf(k, unitId).shine ?? 0) >= MAX_SHINE) return { ok: false, reason: `That card is already at full shine` };
  return { ok: true };
}

/**
 * Merge a duplicate into a card, consuming the duplicate and deepening the shine.
 *
 * The copy is spent: `collection` drops by one. That is the cost, and it is the reason this is not
 * simply a purchase — a player with money and a player with luck arrive at a shiny card by
 * different routes.
 */
export function mergeDuplicate(reg: Registry, k: KingdomState, unitId: string): ActionResult {
  const ok = canMerge(reg, k, unitId);
  if (!ok.ok) return ok;
  k.collection[unitId] = (k.collection[unitId] ?? 0) - 1;
  const c = slot(k, unitId);
  c.shine = (c.shine ?? 0) + 1;
  return { ok: true };
}
