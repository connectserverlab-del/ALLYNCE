import type { Battle } from "./state.js";
import type { UnitState, UnitDef, Role } from "./types.js";
import type { Hex } from "./hex.js";
import { hexDistance, hexNeighbors } from "./hex.js";
import type { Registry } from "./data.js";
import { Rng } from "./rng.js";
import { fuse, eligibleRecipes } from "./fusion.js";

export interface DeckRules {
  mainDeckSize: number; sideDeckSize: number; openingHand: number; drawPerRound: number; maxHandSize: number;
  copyLimitByStar: Record<string, number>;
  primaryFactionMin: number;
  tributeByStar: Record<string, number | null>;
}
export interface SideCard {
  id: string; name: string; kind: "ritual" | "fusion"; stars: number; text: string; copyLimit: number;
  result?: string; starCost?: number; theme?: string; needsRitualist?: boolean; needsRole?: Role; recipe?: string;
}
/** A deck list: main is unit ids (one entry per physical card), side is side-card ids. */
export interface DeckList { id: string; name: string; faction: string; main: string[]; side: string[] }
export interface DeckValidation {
  ok: boolean; errors: string[]; mainCount: number; sideCount: number;
  starCurve: Record<number, number>;
  /** Card id -> copies the deck runs beyond what the collection holds. Empty when no collection was checked. */
  missing: Record<string, number>;
}

export const starOf = (reg: Registry, unitId: string): number => reg.unit(unitId).stars ?? 1;

/** How many of your own deployed units must be sacrificed to summon this card. `null` means it cannot be summoned from the main deck. */
export function tributeCost(reg: Registry, unitId: string): number | null {
  const rules = reg.deckRules;
  const s = starOf(reg, unitId);
  const v = rules.tributeByStar[String(s)];
  return v === undefined ? 0 : v;
}

/** Copy limit for a card in the main deck: by star, then narrowed to 1 for named unique units, 0 for summon-only. */
export function copyLimit(reg: Registry, unitId: string): number {
  const d = reg.unit(unitId);
  if (d.summonOnly) return 0;
  const byStar = reg.deckRules.copyLimitByStar[String(d.stars ?? 1)] ?? 0;
  return d.unique ? Math.min(1, byStar) : byStar;
}

/** Card id -> physical copies the player actually holds. This is `KingdomState.collection`. */
export type Collection = Record<string, number>;

/** How many copies of a card the player owns. Nothing owned means nothing to sleeve. */
export function ownedCopies(collection: Collection | undefined, unitId: string): number {
  return collection ? collection[unitId] ?? 0 : 0;
}

/**
 * How many copies of a card may go in a deck.
 *
 * Without a collection this is the rules limit alone, which is what preset and sandbox decks use.
 * With one it is also capped by the copies actually owned: holding a single Ember Banner Daimyo
 * lets you sleeve one, not the three the star limit would otherwise allow.
 */
export function effectiveCopyLimit(reg: Registry, unitId: string, collection?: Collection): number {
  const lim = copyLimit(reg, unitId);
  return collection ? Math.min(lim, ownedCopies(collection, unitId)) : lim;
}

/**
 * Check a deck list against the rules, and — when a collection is supplied — against what the
 * player actually owns. Owning one copy of a card never entitles you to run several.
 */
export function validateDeck(reg: Registry, deck: DeckList, opts: { collection?: Collection } = {}): DeckValidation {
  const rules = reg.deckRules;
  const { collection } = opts;
  const errors: string[] = [];
  const starCurve: Record<number, number> = {};
  const counts = new Map<string, number>();
  for (const id of deck.main) {
    if (!reg.units.has(id)) { errors.push(`Main deck holds an unknown card: ${id}`); continue; }
    counts.set(id, (counts.get(id) ?? 0) + 1);
    const s = starOf(reg, id);
    starCurve[s] = (starCurve[s] ?? 0) + 1;
  }
  if (deck.main.length !== rules.mainDeckSize) errors.push(`Main deck holds ${deck.main.length} cards; it must hold exactly ${rules.mainDeckSize}`);
  const primary = deck.main.filter((id) => reg.units.get(id)?.faction === deck.faction).length;
  if (primary < rules.primaryFactionMin) errors.push(`Only ${primary} cards belong to ${deck.faction}; a deck led by that faction needs at least ${rules.primaryFactionMin}`);
  const missing: Record<string, number> = {};
  for (const [id, n] of counts) {
    const lim = copyLimit(reg, id);
    const d = reg.unit(id);
    if (lim === 0) { errors.push(`${d.name} cannot sit in the main deck (${d.summonOnly ? "summon-only" : `${d.stars}-star`}); it belongs to a ritual or fusion card`); continue; }
    if (n > lim) errors.push(`${d.name} appears ${n} times; a ${d.stars}-star card is limited to ${lim}`);
    if (collection) {
      const owned = ownedCopies(collection, id);
      if (n > owned) {
        missing[id] = n - owned;
        errors.push(owned === 0
          ? `You hold no copies of ${d.name}; capture one before sleeving it`
          : `${d.name} appears ${n} times but you hold only ${owned} cop${owned === 1 ? "y" : "ies"}`);
      }
    }
  }
  const sideCounts = new Map<string, number>();
  for (const id of deck.side) {
    const c = reg.sideCards.get(id);
    if (!c) { errors.push(`Side deck holds an unknown card: ${id}`); continue; }
    sideCounts.set(id, (sideCounts.get(id) ?? 0) + 1);
  }
  if (deck.side.length !== rules.sideDeckSize) errors.push(`Side deck holds ${deck.side.length} cards; it must hold exactly ${rules.sideDeckSize}`);
  for (const [id, n] of sideCounts) {
    const c = reg.sideCards.get(id)!;
    if (n > c.copyLimit) errors.push(`${c.name} appears ${n} times; it is limited to ${c.copyLimit}`);
  }
  return { ok: errors.length === 0, errors, mainCount: deck.main.length, sideCount: deck.side.length, starCurve, missing };
}

/** Runtime deck for one side: draw pile, hand, graveyard and the side deck. */
export class DeckState {
  drawPile: string[] = [];
  hand: string[] = [];
  graveyard: string[] = [];
  side: string[] = [];
  usedSide: string[] = [];
  constructor(public readonly list: DeckList, private rng: Rng, private rules: DeckRules) {
    this.drawPile = [...list.main];
    this.side = [...list.side];
    this.shuffle();
  }
  shuffle(): void {
    for (let i = this.drawPile.length - 1; i > 0; i--) { const j = this.rng.int(i + 1); [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j]!, this.drawPile[i]!]; }
  }
  draw(n = 1): string[] {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const c = this.drawPile.shift();
      if (c === undefined) break;               // decking out is not an instant loss; you simply stop drawing
      if (this.hand.length >= this.rules.maxHandSize) { this.graveyard.push(c); continue; }
      this.hand.push(c); out.push(c);
    }
    return out;
  }
  openingHand(): string[] { return this.draw(this.rules.openingHand); }
  discardFromHand(unitId: string): void {
    const i = this.hand.indexOf(unitId);
    if (i < 0) throw new Error(`${unitId} is not in hand`);
    this.hand.splice(i, 1); this.graveyard.push(unitId);
  }
  spendSide(cardId: string): void {
    const i = this.side.indexOf(cardId);
    if (i < 0) throw new Error(`${cardId} is not in the side deck`);
    this.side.splice(i, 1); this.usedSide.push(cardId);
  }
}

export interface SummonOptions { tributes?: UnitState[]; platoonId?: string | null }

/** Where a card may be placed: a free hex within 2 of one of your commanders. */
export function summonZone(b: Battle, side: string): Hex[] {
  const out: Hex[] = [];
  const seen = new Set<string>();
  for (const u of b.activeUnits(side)) {
    if (!b.def(u).roles.includes("Commander") || !u.pos) continue;
    for (const h of [u.pos, ...hexNeighbors(u.pos), ...hexNeighbors(u.pos).flatMap(hexNeighbors)]) {
      const k = `${h.q},${h.r}`;
      if (!seen.has(k) && b.isFree(h) && hexDistance(h, u.pos) <= 2) { seen.add(k); out.push(h); }
    }
  }
  return out;
}

function removeAsTribute(b: Battle, u: UnitState, reason: string): void {
  b.remove(u); u.defeated = true; u.hp = 0;
  if (u.platoonId) {
    const p = b.platoon(u.platoonId);
    if (p.commanderUid === u.uid) p.commanderUid = null;
    if (p.secondUid === u.uid) p.secondUid = null;
    if (p.eliteUid === u.uid) p.eliteUid = null;
    p.footUids = p.footUids.filter((x) => x !== u.uid);
  }
  b.log("Tributed", { uid: u.uid, def: u.defId, reason });
}

/** Summon a unit card from hand onto the field, paying its tribute cost with your own deployed units. */
export function summonFromHand(b: Battle, side: string, unitId: string, at: Hex, opts: SummonOptions = {}): UnitState {
  const deck = b.decks.get(side);
  if (!deck) throw new Error(`Side ${side} has no deck`);
  if (!deck.hand.includes(unitId)) throw new Error(`${unitId} is not in hand`);
  const cost = tributeCost(b.reg, unitId);
  if (cost === null) throw new Error(`${b.reg.unit(unitId).name} cannot be summoned from the main deck; it needs a ritual or fusion card`);
  const tributes = opts.tributes ?? [];
  if (tributes.length !== cost) throw new Error(`${b.reg.unit(unitId).name} needs exactly ${cost} tribute${cost === 1 ? "" : "s"}, got ${tributes.length}`);
  const leaderUid = b.sides.get(side)!.leaderUid;
  for (const t of tributes) {
    if (t.side !== side) throw new Error("You may only tribute your own units");
    if (t.defeated || !t.pos) throw new Error("You may only tribute deployed units");
    if (t.isClone) throw new Error("Clones cannot be tributed");
    if (t.uid === leaderUid) throw new Error("The army leader cannot be tributed");
  }
  if (!b.isFree(at)) throw new Error("That hex is not free");
  if (!summonZone(b, side).some((h) => h.q === at.q && h.r === at.r)) throw new Error("Summon within two hexes of one of your commanders");
  for (const t of tributes) removeAsTribute(b, t, `tribute for ${unitId}`);
  deck.discardFromHand(unitId);
  const u = b.spawn(unitId, side, at, { platoonId: opts.platoonId ?? null, uidPrefix: "card" });
  b.log("Summon", { side, defId: unitId, uid: u.uid, stars: starOf(b.reg, unitId), tributes: tributes.map((t) => t.uid), at });
  return u;
}

export interface SideCardCheck { ok: boolean; reason?: string; starsOffered?: number; starsRequired?: number }

/** Can this ritual card be played right now with these sacrifices? */
export function checkRitual(b: Battle, side: string, card: SideCard, sacrifices: UnitState[]): SideCardCheck {
  if (card.kind !== "ritual") return { ok: false, reason: "Not a ritual card" };
  const leaderUid = b.sides.get(side)!.leaderUid;
  let stars = 0;
  for (const s of sacrifices) {
    if (s.side !== side) return { ok: false, reason: "You may only sacrifice your own units" };
    if (s.defeated || !s.pos) return { ok: false, reason: "You may only sacrifice deployed units" };
    if (s.isClone) return { ok: false, reason: "Clones cannot be sacrificed" };
    if (s.uid === leaderUid) return { ok: false, reason: "The army leader cannot be sacrificed" };
    if (card.theme && !b.def(s).themes.includes(card.theme)) return { ok: false, reason: `${card.name} accepts only ${card.theme} sacrifices` };
    stars += starOf(b.reg, s.defId);
  }
  const need = card.starCost ?? 0;
  if (stars < need) return { ok: false, reason: `Sacrifices total ${stars} stars; ${need} are required`, starsOffered: stars, starsRequired: need };
  if (card.needsRole && !sacrifices.some((s) => b.def(s).roles.includes(card.needsRole!))) return { ok: false, reason: `${card.name} requires a ${card.needsRole} among the sacrifices` };
  if (card.needsRitualist) {
    const channeller = [...b.activeUnits(side)].some((u) => b.def(u).ritual && !sacrifices.includes(u) && !b.hasStatus(u, "Silenced"));
    if (!channeller) return { ok: false, reason: "A ritualist must remain on the field to channel" };
  }
  const exists = [...b.units.values()].some((u) => u.defId === card.result && !u.defeated);
  if (exists) return { ok: false, reason: `${b.reg.unit(card.result!).name} is already on the field` };
  return { ok: true, starsOffered: stars, starsRequired: need };
}

/** Play a ritual card: sacrifice the named units and summon the result at the first sacrifice's hex. */
export function ritualSummon(b: Battle, side: string, cardId: string, sacrifices: UnitState[]): UnitState {
  const deck = b.decks.get(side);
  if (!deck) throw new Error(`Side ${side} has no deck`);
  if (!deck.side.includes(cardId)) throw new Error(`${cardId} is not in the side deck`);
  const card = b.reg.sideCards.get(cardId);
  if (!card) throw new Error(`Unknown side card ${cardId}`);
  const check = checkRitual(b, side, card, sacrifices);
  if (!check.ok) throw new Error(check.reason);
  const anchor = sacrifices[0]!;
  const pos = anchor.pos!;
  const platoonId = anchor.platoonId;
  for (const s of sacrifices) removeAsTribute(b, s, `ritual ${cardId}`);
  deck.spendSide(cardId);
  const u = b.spawn(card.result!, side, pos, { platoonId, uidPrefix: "rit" });
  b.log("RitualSummon", { side, card: cardId, result: card.result, uid: u.uid, stars: check.starsOffered, sacrifices: sacrifices.map((s) => s.uid) });
  return u;
}

/** Play a fusion card: run its recipe through the fusion engine and spend the card. */
export function fusionSummon(b: Battle, side: string, cardId: string, materials: UnitState[]): UnitState {
  const deck = b.decks.get(side);
  if (!deck) throw new Error(`Side ${side} has no deck`);
  if (!deck.side.includes(cardId)) throw new Error(`${cardId} is not in the side deck`);
  const card = b.reg.sideCards.get(cardId);
  if (!card || card.kind !== "fusion") throw new Error(`${cardId} is not a fusion card`);
  const u = fuse(b, materials, card.recipe!);
  deck.spendSide(cardId);
  b.log("FusionSummon", { side, card: cardId, uid: u.uid });
  return u;
}

/** Every side card that could legally be played this instant, with the materials that would satisfy it. */
export function playableSideCards(b: Battle, side: string): Array<{ card: SideCard; materials: UnitState[] }> {
  const deck = b.decks.get(side);
  if (!deck) return [];
  const out: Array<{ card: SideCard; materials: UnitState[] }> = [];
  const mine = [...b.activeUnits(side)].filter((u) => !u.isClone && u.uid !== b.sides.get(side)!.leaderUid);
  for (const id of new Set(deck.side)) {
    const card = b.reg.sideCards.get(id)!;
    if (card.kind === "ritual") {
      const pool = mine.filter((u) => !card.theme || b.def(u).themes.includes(card.theme)).sort((a, c) => starOf(b.reg, c.defId) - starOf(b.reg, a.defId));
      const picked: UnitState[] = [];
      let stars = 0;
      for (const u of pool) { if (stars >= (card.starCost ?? 0) && (!card.needsRole || picked.some((p) => b.def(p).roles.includes(card.needsRole!)))) break; picked.push(u); stars += starOf(b.reg, u.defId); }
      if (checkRitual(b, side, card, picked).ok) out.push({ card, materials: picked });
    } else {
      const recipe = b.reg.fusions.get(card.recipe!);
      if (!recipe) continue;
      const combo = findFusionMaterials(b, mine, recipe.inputs.length, card.recipe!);
      if (combo) out.push({ card, materials: combo });
    }
  }
  return out;
}

function findFusionMaterials(b: Battle, pool: UnitState[], size: number, recipeId: string): UnitState[] | null {
  const combos = (arr: UnitState[], k: number): UnitState[][] => k === 0 ? [[]] : arr.flatMap((x, i) => combos(arr.slice(i + 1), k - 1).map((c) => [x, ...c]));
  for (const c of combos(pool, size)) {
    if (c.some((u) => !u.pos)) continue;
    if (c.slice(1).some((u) => b.distance(u, c[0]!) !== 1)) continue;
    if (eligibleRecipes(b, c).some((r) => r.id === recipeId)) return c;
  }
  return null;
}

/** A hundred-card deck is mostly line soldiers, but it still needs a curve rather than a wall of levy. */
export const STARTER_CURVE: Record<number, number> = { 1: 18, 2: 20, 3: 16, 4: 14, 5: 12, 6: 8, 7: 6, 8: 4, 9: 2 };

/** Build a legal starter deck: fill each star tier toward the curve, own faction first, then sworn allies. */
export function buildStarterDeck(reg: Registry, faction: string, name = `${faction} starter`, opts: { collection?: Collection } = {}): DeckList {
  const { collection } = opts;
  const usable = (d: UnitDef) => !d.summonOnly && (d.stars ?? 1) <= 9 && d.faction !== "DIV" && effectiveCopyLimit(reg, d.id, collection) > 0;
  const pool = [...reg.units.values()].filter(usable);
  const main: string[] = [];
  const have = (id: string) => main.filter((x) => x === id).length;
  const room = (d: UnitDef) => effectiveCopyLimit(reg, d.id, collection) - have(d.id);

  const fillTier = (star: number, target: number) => {
    let placed = main.filter((id) => (reg.unit(id).stars ?? 1) === star).length;
    for (const group of [pool.filter((d) => d.faction === faction), pool.filter((d) => d.faction !== faction && !d.unique)]) {
      const tier = group.filter((d) => (d.stars ?? 1) === star);
      // spread evenly across the cards in the tier rather than maxing one out
      let progress = true;
      while (placed < target && progress) {
        progress = false;
        for (const d of tier) {
          if (placed >= target) break;
          if (room(d) <= 0) continue;
          main.push(d.id); placed++; progress = true;
        }
      }
    }
  };
  for (const [s, n] of Object.entries(STARTER_CURVE)) fillTier(Number(s), n);
  // top up anything short, cheapest first, then trim
  for (const s of [2, 3, 1, 4, 5]) {
    for (const d of [...pool.filter((d) => d.faction === faction), ...pool.filter((d) => d.faction !== faction && !d.unique)]) {
      if (main.length >= reg.deckRules.mainDeckSize) break;
      if ((d.stars ?? 1) !== s) continue;
      while (room(d) > 0 && main.length < reg.deckRules.mainDeckSize) main.push(d.id);
    }
  }
  while (main.length > reg.deckRules.mainDeckSize) main.pop();

  const side: string[] = [];
  const cards = [...reg.sideCards.values()];
  const themed = reg.factions.get(faction)?.primaryTheme;
  for (const c of cards.filter((c) => c.theme && c.theme === themed)) for (let n = 0; n < c.copyLimit && side.length < reg.deckRules.sideDeckSize; n++) side.push(c.id);
  for (const c of cards.filter((c) => !c.theme)) for (let n = 0; n < c.copyLimit && side.length < reg.deckRules.sideDeckSize; n++) side.push(c.id);
  for (const c of cards) { while (side.length < reg.deckRules.sideDeckSize && side.filter((x) => x === c.id).length < c.copyLimit) side.push(c.id); }
  return { id: `${faction}-starter`, name, faction, main, side };
}

export { Rng };
