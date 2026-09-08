import type { Registry } from "./data.js";
import type { Battle, Capture } from "./state.js";
import type { UnitDef } from "./types.js";
import type { KingdomState, Resources, ResourceId } from "./kingdom.js";
import type { DeckList, Collection } from "./cards.js";
import { copyLimit, ownedCopies, starOf } from "./cards.js";
import { Rng } from "./rng.js";

/**
 * The wanted board.
 *
 * A card in a deck is a physical card the holding owns, so the only way to run four Emberline
 * Ashigaru is to hold four of them. Banner draws are one source. Warrants are the other, and the
 * deliberate one: the board names a specific unit, and the writ pays only for a living prisoner.
 * Kill the target and the warrant closes unpaid.
 */

export interface WantedTier {
  stars: number; title: string; copies: number; bounty: Required<Resources>;
  /** Roughly how many stars of escort stand between the player and the target. */
  escortStars: number;
  text: string;
}
export interface WantedRules {
  boardSize: number; rotationSeconds: number; acceptLimit: number;
  minStars: number; maxStars: number; captureThreshold: number; escortRoundLimit: number;
  tiers: WantedTier[];
  notes?: Record<string, string>;
}

export interface Contract {
  id: string;
  targetId: string; targetName: string; targetFaction: string;
  stars: number; title: string; text: string;
  copies: number; bounty: Required<Resources>;
  escortStars: number;
  /** The board cycle this warrant was posted in. It is withdrawn when the next cycle rolls. */
  cycle: number;
}
export interface ContractOutcome {
  ok: boolean; reason: string;
  copies: number; unitId: string;
  bounty: Required<Resources>;
}

/** A holding's warrant state. Kept small and serialisable, like the rest of KingdomState. */
export interface WantedState { cycle: number; accepted: string[]; completed: string[] }

const EMPTY: Required<Resources> = { koku: 0, iron: 0, timber: 0, silver: 0 };

/** Which board cycle a holding is in right now. Warrants rotate with the clock, not with play. */
export function boardCycle(reg: Registry, k: KingdomState): number {
  return Math.floor(k.elapsed / reg.wanted.rotationSeconds);
}

/** Every unit the board is allowed to name: two to seven stars, real cards, nothing divine. */
export function warrantPool(reg: Registry): UnitDef[] {
  const { minStars, maxStars } = reg.wanted;
  return [...reg.units.values()].filter((d) => {
    const s = d.stars ?? 1;
    return s >= minStars && s <= maxStars && !d.summonOnly && d.faction !== "DIV" && copyLimit(reg, d.id) > 0;
  });
}

/**
 * How badly the holding wants another copy of a card: the gap between what the rules would let it
 * run and what it actually holds, with cards it owns none of weighted hardest. The board reads this
 * so its warrants are worth taking rather than merely random.
 */
export function shortfall(reg: Registry, k: KingdomState, unitId: string, deck?: DeckList): number {
  const lim = copyLimit(reg, unitId);
  const owned = ownedCopies(k.collection, unitId);
  const wantedForDeck = deck ? deck.main.filter((x) => x === unitId).length : 0;
  const want = Math.max(wantedForDeck, Math.min(lim, reg.unit(unitId).faction === k.faction ? lim : Math.ceil(lim / 2)));
  const gap = Math.max(0, want - owned);
  return owned === 0 ? gap + 2 : gap;
}

/**
 * Roll the warrants on offer this cycle. Deterministic for a holding and a cycle, so the board a
 * player sees is the board they come back to until it rotates.
 */
export function rollBoard(reg: Registry, k: KingdomState, deck?: DeckList): Contract[] {
  const cycle = boardCycle(reg, k);
  const rng = new Rng(k.seed * 31 + cycle * 7717 + k.faction.charCodeAt(0));
  const tiers = new Map(reg.wanted.tiers.map((t) => [t.stars, t]));
  const pool = warrantPool(reg).filter((d) => tiers.has(d.stars ?? 1));

  // weight by how short the holding is, with a floor so nothing is ever unreachable
  const weighted = pool.map((d) => ({ d, w: 1 + shortfall(reg, k, d.id, deck) * 3 }));
  const out: Contract[] = [];
  const taken = new Set<string>();
  let guard = 0;
  while (out.length < reg.wanted.boardSize && guard++ < 500) {
    const live = weighted.filter((x) => !taken.has(x.d.id));
    if (!live.length) break;
    const total = live.reduce((s, x) => s + x.w, 0);
    let roll = rng.next() * total;
    let pick = live[live.length - 1]!;
    for (const x of live) { roll -= x.w; if (roll <= 0) { pick = x; break; } }
    taken.add(pick.d.id);
    const tier = tiers.get(pick.d.stars ?? 1)!;
    out.push({
      id: `WNT-${cycle}-${pick.d.id}`,
      targetId: pick.d.id, targetName: pick.d.name, targetFaction: pick.d.faction,
      stars: pick.d.stars ?? 1, title: tier.title, text: tier.text,
      // a named unique is one card in the world; a warrant for one pays exactly one
      copies: pick.d.unique ? 1 : tier.copies,
      bounty: { ...tier.bounty }, escortStars: tier.escortStars, cycle,
    });
  }
  return out.sort((a, b) => a.stars - b.stars);
}

/** Take a warrant. A holding may only carry so many at once, and only from the current board. */
export function acceptContract(reg: Registry, k: KingdomState, contractId: string, deck?: DeckList): { ok: boolean; reason?: string; contract?: Contract } {
  const w = k.wanted;
  if (w.accepted.includes(contractId)) return { ok: false, reason: "That warrant is already in hand" };
  if (w.accepted.length >= reg.wanted.acceptLimit) return { ok: false, reason: `A holding may carry ${reg.wanted.acceptLimit} warrants at a time` };
  const contract = rollBoard(reg, k, deck).find((c) => c.id === contractId);
  if (!contract) return { ok: false, reason: "No such warrant is posted" };
  w.cycle = contract.cycle;
  w.accepted.push(contractId);
  return { ok: true, contract };
}

/** Give a warrant back. Nothing is paid and nothing is lost but the trip. */
export function abandonContract(k: KingdomState, contractId: string): boolean {
  const i = k.wanted.accepted.indexOf(contractId);
  if (i < 0) return false;
  k.wanted.accepted.splice(i, 1);
  return true;
}

/** Tell a battle which definitions this side holds warrants for, so its AI tries to take them alive. */
export function markWanted(b: Battle, side: string, contracts: Contract[]): void {
  const set = b.wanted.get(side) ?? new Set<string>();
  for (const c of contracts) set.add(c.targetId);
  b.wanted.set(side, set);
}

/**
 * Settle a warrant against what actually came off the field. A prisoner pays the writ; a corpse
 * pays nothing, which is the whole point of the rule.
 */
export function resolveContract(reg: Registry, k: KingdomState, contract: Contract, captures: Capture[], side = "A"): ContractOutcome {
  const held = k.wanted.accepted.includes(contract.id);
  if (!held) return { ok: false, reason: "That warrant is not in hand", copies: 0, unitId: contract.targetId, bounty: { ...EMPTY } };
  const took = captures.filter((c) => c.defId === contract.targetId && c.by === side).length;
  if (took === 0) {
    return { ok: false, reason: `${contract.targetName} was not taken alive; the warrant pays for a prisoner, not a body`, copies: 0, unitId: contract.targetId, bounty: { ...EMPTY } };
  }
  // several of the same target on the field pays the writ once, plus one card for each extra taken
  const copies = contract.copies + (took - 1);
  k.collection[contract.targetId] = (k.collection[contract.targetId] ?? 0) + copies;
  for (const r of ["koku", "iron", "timber", "silver"] as ResourceId[]) k.resources[r] += contract.bounty[r];
  k.wanted.accepted = k.wanted.accepted.filter((x) => x !== contract.id);
  if (!k.wanted.completed.includes(contract.id)) k.wanted.completed.push(contract.id);
  return { ok: true, reason: `${contract.targetName} taken alive`, copies, unitId: contract.targetId, bounty: { ...contract.bounty } };
}

/** A fresh warrant ledger for a new holding. */
export function newWantedState(): WantedState { return { cycle: 0, accepted: [], completed: [] }; }

export interface DeckGap { unitId: string; name: string; stars: number; need: number; owned: number }
export interface ContractRelief { unitId: string; need: number; owned: number; pays: number; closesFully: boolean }

/**
 * Whether filling a warrant would actually help this deck, and by how much. The board posts by
 * shortfall already, but a player reading five warrants still has to work out which of them the
 * current deck is actually asking for; this answers that directly instead of making them cross-reference
 * the gap list themselves. `null` means the target is not one of this deck's gaps at all — the warrant
 * may still be worth taking for a future deck, but this one has enough copies already.
 */
export function contractRelief(contract: Pick<Contract, "targetId" | "copies">, gaps: DeckGap[]): ContractRelief | null {
  const gap = gaps.find((g) => g.unitId === contract.targetId);
  if (!gap) return null;
  return { unitId: gap.unitId, need: gap.need, owned: gap.owned, pays: contract.copies, closesFully: contract.copies >= gap.need };
}

/**
 * Everything the deck asks for that the collection cannot cover, worst gap first. The deck screen
 * uses this to tell a player what to go and capture.
 */
export function missingForDeck(reg: Registry, deck: DeckList, collection: Collection): Array<{ unitId: string; name: string; stars: number; need: number; owned: number }> {
  const counts = new Map<string, number>();
  for (const id of deck.main) counts.set(id, (counts.get(id) ?? 0) + 1);
  const out: Array<{ unitId: string; name: string; stars: number; need: number; owned: number }> = [];
  for (const [id, n] of counts) {
    if (!reg.units.has(id)) continue;
    const owned = ownedCopies(collection, id);
    if (n > owned) out.push({ unitId: id, name: reg.unit(id).name, stars: starOf(reg, id), need: n - owned, owned });
  }
  return out.sort((a, b) => b.need - a.need || b.stars - a.stars);
}
