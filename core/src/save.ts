import { Battle } from "./state.js";
import type { Registry } from "./data.js";
import type { UnitState, PlatoonState, Terrain, GameEvent } from "./types.js";
import type { KingdomState } from "./kingdom.js";
import type { DeckList } from "./cards.js";
import { DeckState } from "./cards.js";
import { Rng } from "./rng.js";
import type { RitualCircle } from "./rituals.js";
import type { Portal } from "./portals.js";
import type { Capture } from "./state.js";

export const SAVE_VERSION = 5;

export interface BattleSave {
  version: number; seed: number; round: number; phase: string;
  width: number; height: number; mask: string[] | null;
  terrain: Array<[string, Terrain]>; elevation: Array<[string, number]>;
  units: UnitState[]; platoons: PlatoonState[];
  sides: Array<{ id: string; reservePoints: number; armyCapacity: number; morale: number; leaderUid?: string | null; surrendered?: boolean; fusionCharges?: number }>;
  rituals: Array<Omit<RitualCircle, "damagedThisRound"> & { damagedThisRound: string[] }>;
  portals: Portal[];
  decks: Array<{ side: string; list: DeckList; drawPile: string[]; hand: string[]; graveyard: string[]; sideDeck: string[]; usedSide: string[] }>;
  activatedGroups: string[]; activeSide: string;
  winner: string | null; winReason: string | null;
  events: GameEvent[];
  captures: Capture[];
  wanted: Array<[string, string[]]>;
}
export interface GameSave { version: number; battle: BattleSave | null; kingdom: KingdomState | null; savedAt: string }

/** A battle is a plain object graph plus a seeded RNG, so a save is a deep copy of that graph. */
export function saveBattle(b: Battle): BattleSave {
  return {
    version: SAVE_VERSION, seed: b.seed, round: b.round, phase: b.phase,
    width: b.width, height: b.height, mask: b.mask ? [...b.mask] : null,
    terrain: [...b.terrain.entries()], elevation: [...b.elevation.entries()],
    units: [...b.units.values()].map((u) => ({ ...u, statuses: u.statuses.map((s) => ({ ...s })), cooldowns: { ...u.cooldowns } })),
    platoons: [...b.platoons.values()].map((p) => ({ ...p, footUids: [...p.footUids] })),
    sides: [...b.sides.values()].map((s) => ({ ...s })),
    rituals: [...b.rituals.values()].map((r) => ({ ...r, damagedThisRound: [...r.damagedThisRound], participantUids: [...r.participantUids] })),
    portals: [...b.portals.values()].map((p) => ({ ...p, queue: p.queue.map((q) => ({ ...q })) })),
    decks: [...b.decks.entries()].map(([side, d]) => ({ side, list: d.list, drawPile: [...d.drawPile], hand: [...d.hand], graveyard: [...d.graveyard], sideDeck: [...d.side], usedSide: [...d.usedSide] })),
    activatedGroups: [...b.activatedGroupsThisRound], activeSide: b.activeSide,
    winner: b.winner, winReason: b.winReason, events: b.events.map((e) => ({ ...e })),
    captures: b.captures.map((c) => ({ ...c })),
    wanted: [...b.wanted.entries()].map(([side, ids]) => [side, [...ids]] as [string, string[]]),
  };
}

export function loadBattle(reg: Registry, save: BattleSave): Battle {
  if (save.version !== SAVE_VERSION) throw new Error(`Save version ${save.version} cannot be read by this build (expects ${SAVE_VERSION})`);
  const b = new Battle(reg, { seed: save.seed, width: save.width, height: save.height, sides: save.sides.map((s) => ({ ...s })) });
  b.round = save.round; b.phase = save.phase as Battle["phase"];
  b.mask = save.mask ? new Set(save.mask) : null;
  for (const [k, t] of save.terrain) b.terrain.set(k, t);
  for (const [k, e] of save.elevation) b.elevation.set(k, e);
  let maxUid = 0;
  for (const u of save.units) {
    const copy: UnitState = { ...u, statuses: u.statuses.map((s) => ({ ...s })), cooldowns: { ...u.cooldowns } };
    b.units.set(copy.uid, copy);
    if (copy.pos && !copy.defeated) b.occupancy.set(`${copy.pos.q},${copy.pos.r}`, copy.uid);
    const n = Number(copy.uid.replace(/\D+/g, ""));
    if (Number.isFinite(n)) maxUid = Math.max(maxUid, n);
  }
  b.setUidCounter(maxUid);
  for (const p of save.platoons) b.platoons.set(p.id, { ...p, footUids: [...p.footUids] });
  for (const r of save.rituals) b.rituals.set(r.id, { ...r, damagedThisRound: new Set(r.damagedThisRound) } as RitualCircle);
  for (const p of save.portals) b.portals.set(p.id, { ...p, queue: p.queue.map((q) => ({ ...q })) });
  for (const d of save.decks) {
    const deck = new DeckState(d.list, new Rng(save.seed), reg.deckRules);
    deck.drawPile = [...d.drawPile]; deck.hand = [...d.hand]; deck.graveyard = [...d.graveyard];
    deck.side = [...d.sideDeck]; deck.usedSide = [...d.usedSide];
    b.decks.set(d.side, deck);
  }
  for (const g of save.activatedGroups) b.activatedGroupsThisRound.add(g);
  b.activeSide = save.activeSide; b.winner = save.winner; b.winReason = save.winReason;
  b.events.push(...save.events);
  b.captures.push(...(save.captures ?? []).map((c) => ({ ...c })));
  for (const [side, ids] of save.wanted ?? []) b.wanted.set(side, new Set(ids));
  return b;
}

export function saveGame(b: Battle | null, k: KingdomState | null): GameSave {
  return { version: SAVE_VERSION, battle: b ? saveBattle(b) : null, kingdom: k ? JSON.parse(JSON.stringify(k)) : null, savedAt: new Date(0).toISOString() };
}
export function loadGame(reg: Registry, save: GameSave): { battle: Battle | null; kingdom: KingdomState | null } {
  if (save.version !== SAVE_VERSION) throw new Error(`Save version ${save.version} cannot be read by this build (expects ${SAVE_VERSION})`);
  return { battle: save.battle ? loadBattle(reg, save.battle) : null, kingdom: save.kingdom ?? null };
}
