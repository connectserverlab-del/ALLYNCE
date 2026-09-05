import type { Hex, Facing } from "./hex.js";
import { hexKey, hexNeighbors, hexDistance } from "./hex.js";
import type { UnitState, PlatoonState, UnitDef, Terrain, GameEvent, Status, StatusInstance } from "./types.js";
import type { Registry } from "./data.js";
import { Rng } from "./rng.js";
import type { RitualCircle } from "./rituals.js";
import type { Portal } from "./portals.js";
import type { DeckState } from "./cards.js";
import type { KingdomEffects } from "./kingdom.js";
import type { WeatherId, TimeOfDayId } from "./weather.js";

export type Phase = "Command" | "Activation" | "Objective" | "End" | "Ended";

export interface SideState { id: string; reservePoints: number; armyCapacity: number; morale: number; leaderUid?: string | null; surrendered?: boolean; fusionCharges?: number }

/** Simulation state. No presentation concerns live here. */
export class Battle {
  round = 1;
  phase: Phase = "Command";
  readonly units = new Map<string, UnitState>();
  readonly platoons = new Map<string, PlatoonState>();
  readonly terrain = new Map<string, Terrain>();
  readonly elevation = new Map<string, number>();
  /** Irregular playable area. When set, only these hexes exist; the bounding box is just a canvas. */
  mask: Set<string> | null = null;
  readonly occupancy = new Map<string, string>(); // hexKey -> uid
  readonly rituals = new Map<string, RitualCircle>();
  readonly portals = new Map<string, Portal>();
  readonly sides = new Map<string, SideState>();
  readonly decks = new Map<string, DeckState>();
  readonly kingdomEffects = new Map<string, KingdomEffects>();
  readonly events: GameEvent[] = [];
  readonly rng: Rng;
  width: number; height: number;
  activeSide = "A";
  activatedGroupsThisRound = new Set<string>();
  winner: string | null = null;
  winReason: string | null = null;
  /** Round modifiers, rolled once per battle at setup (see `weather.ts`). */
  weather: WeatherId = "Clear";
  timeOfDay: TimeOfDayId = "Day";
  private uidCounter = 0;
  readonly seed: number;

  constructor(public readonly reg: Registry, opts: { seed: number; width?: number; height?: number; sides?: SideState[]; weather?: WeatherId; timeOfDay?: TimeOfDayId }) {
    this.rng = new Rng(opts.seed);
    this.seed = opts.seed;
    this.width = opts.width ?? 24; this.height = opts.height ?? 18;
    if (opts.weather) this.weather = opts.weather;
    if (opts.timeOfDay) this.timeOfDay = opts.timeOfDay;
    for (const s of opts.sides ?? [{ id: "A", reservePoints: 0, armyCapacity: 100, morale: 100 }, { id: "B", reservePoints: 0, armyCapacity: 100, morale: 100 }]) this.sides.set(s.id, s);
  }

  log(type: string, data: Record<string, unknown> = {}): void {
    this.events.push({ round: this.round, phase: this.phase, type, data });
  }

  newUid(prefix = "u"): string { return `${prefix}${++this.uidCounter}`; }
  /** Restoring a save must not hand out a uid that already exists. */
  setUidCounter(n: number): void { this.uidCounter = Math.max(this.uidCounter, n); }

  inBounds(h: Hex): boolean { if (this.mask) return this.mask.has(hexKey(h)); return h.q >= 0 && h.q < this.width && h.r >= 0 && h.r < this.height; }
  elevationAt(h: Hex): number { return this.elevation.get(hexKey(h)) ?? 0; }
  terrainAt(h: Hex): Terrain { return this.terrain.get(hexKey(h)) ?? "Open"; }
  unitAt(h: Hex): UnitState | undefined { const uid = this.occupancy.get(hexKey(h)); return uid ? this.units.get(uid) : undefined; }
  isFree(h: Hex): boolean { return this.inBounds(h) && !this.occupancy.has(hexKey(h)) && this.terrainAt(h) !== "Water"; }

  def(u: UnitState): UnitDef { return this.reg.unit(u.defId); }
  unit(uid: string): UnitState { const u = this.units.get(uid); if (!u) throw new Error(`No unit ${uid}`); return u; }
  platoon(id: string): PlatoonState { const p = this.platoons.get(id); if (!p) throw new Error(`No platoon ${id}`); return p; }

  *activeUnits(side?: string): IterableIterator<UnitState> {
    for (const u of this.units.values()) if (!u.defeated && u.pos && (!side || u.side === side)) yield u;
  }

  adjacentUnits(u: UnitState): UnitState[] {
    if (!u.pos) return [];
    return hexNeighbors(u.pos).map((h) => this.unitAt(h)).filter((x): x is UnitState => !!x && !x.defeated);
  }
  adjacentAllies(u: UnitState): UnitState[] { return this.adjacentUnits(u).filter((x) => x.side === u.side); }
  adjacentEnemies(u: UnitState): UnitState[] { return this.adjacentUnits(u).filter((x) => x.side !== u.side); }
  isIsolated(u: UnitState): boolean { return this.adjacentAllies(u).filter((a) => !a.isClone).length === 0; }

  hasStatus(u: UnitState, s: Status): boolean { return u.statuses.some((x) => x.status === s); }
  addStatus(u: UnitState, s: Status, rounds: number, source: string): void {
    if (s === "Revealed") { u.statuses = u.statuses.filter((x) => x.status !== "Hidden"); return; }
    const existing = u.statuses.find((x) => x.status === s);
    if (existing) { existing.roundsLeft = Math.max(existing.roundsLeft, rounds); if (s === "Unstable") existing.stacks = (existing.stacks ?? 1) + 1; }
    else u.statuses.push({ status: s, roundsLeft: rounds, source, stacks: s === "Unstable" ? 1 : undefined } as StatusInstance);
    this.log("StatusApplied", { uid: u.uid, status: s, source });
  }
  removeStatus(u: UnitState, s: Status): void { u.statuses = u.statuses.filter((x) => x.status !== s); }

  /** Spawn a unit instance from a definition. Deployment legality is validated by the composition module. */
  spawn(defId: string, side: string, pos: Hex | null, opts: { platoonId?: string | null; facing?: Facing; uidPrefix?: string } = {}): UnitState {
    const d = this.reg.unit(defId);
    const u: UnitState = {
      uid: this.newUid(opts.uidPrefix), defId, side, platoonId: opts.platoonId ?? null, pos: null, facing: opts.facing ?? 0,
      hp: d.hp, morale: d.morale, ap: 0, statuses: [], cooldowns: {}, isClone: false, defeated: false, promotedFromSecond: false,
      movedThisActivation: 0, chargeMoved: 0, attackedThisActivation: false, setUp: false, shadowStepped: false, freeMoveHexes: 0, overwatch: false, defending: false, usedChargeLastRound: false,
      divine: d.divine ? { manifestation: d.divine.manifestation, anchors: d.divine.anchors } : undefined,
    };
    this.units.set(u.uid, u);
    if (pos) this.place(u, pos);
    return u;
  }

  place(u: UnitState, pos: Hex): void {
    if (!this.isFree(pos)) throw new Error(`Hex ${hexKey(pos)} not free`);
    if (u.pos) this.occupancy.delete(hexKey(u.pos));
    u.pos = pos; this.occupancy.set(hexKey(pos), u.uid);
  }
  remove(u: UnitState): void {
    if (u.pos) this.occupancy.delete(hexKey(u.pos));
    u.pos = null;
  }

  distance(a: UnitState, b: UnitState): number { return a.pos && b.pos ? hexDistance(a.pos, b.pos) : Infinity; }
}
