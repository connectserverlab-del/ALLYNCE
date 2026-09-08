import type { Battle } from "./state.js";
import type { GameEvent } from "./types.js";

/**
 * Dependency-free 32-bit FNV-1a hash, hex-encoded. No cryptographic properties are needed here —
 * this exists to catch accidental nondeterminism (a stray `Math.random()`, wall-clock read, or
 * object-identity-order iteration), not to resist a deliberate collision.
 */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Every value an event may carry. `JSON.stringify` renders anything outside this set as `{}` — a
 * `Set`, a `Map`, a class instance — which would make the hash silently blind to the field rather
 * than fail. Since the whole point of the hash is to catch what nobody meant to change, being blind
 * is worse than being strict.
 */
function assertPlain(value: unknown, where: string): void {
  if (value === null || value === undefined) return;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertPlain(v, `${where}[${i}]`));
    return;
  }
  if (t === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) assertPlain(v, `${where}.${k}`);
    return;
  }
  throw new Error(
    `Event field ${where} is a ${Object.prototype.toString.call(value)}, which JSON.stringify flattens to "{}". ` +
    `Log a plain value instead (spread a Set or Map into an array first), or the determinism hash cannot see it.`,
  );
}

/**
 * Hashes a battle's event log for equality comparison across runs. `GameEvent.data` is a plain,
 * JSON-serialisable record built the same way on every run of the same seed, so its key order is
 * stable; this is the same shape `Q-20`'s per-round `RoundHash` will hash a slice of.
 *
 * Throws if any event carries a value the hash could not actually see.
 */
export function hashEvents(events: readonly GameEvent[]): string {
  for (const e of events) assertPlain(e.data, `${e.type}.data`);
  return hashString(JSON.stringify(events));
}

/**
 * Every `RoundHash` entry a battle logged (see `BattleController.endPhase`), keyed by round. `Q-24`'s
 * lockstep simulation and any future netcode client compare these round by round instead of re-deriving
 * them from the full event log each time.
 */
export function roundHashes(events: readonly GameEvent[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const e of events) if (e.type === "RoundHash" && typeof e.data.hash === "string") out.set(e.round, e.data.hash as string);
  return out;
}

/**
 * A canonical digest of everything a battle materially *is* at this moment: every unit's position,
 * body, morale, statuses, cooldowns and per-activation flags, plus side, ritual, portal and terrain
 * state. Sorted by id throughout, so two clients that inserted the same units in a different order
 * still agree.
 *
 * This exists because hashing a round's *events* is not the same as hashing its outcome. Anything
 * that changes without being logged — action points, cooldowns ticking, a charge counter, a set-up
 * flag, a stat modifier expiring — diverges silently under an event-only hash, and only surfaces
 * rounds later when it finally changes what someone does. A desync detector that names the wrong
 * round is barely better than none.
 */
export function stateDigest(b: Battle): string {
  const units = [...b.units.values()]
    .map((u) => ({
      uid: u.uid, defId: u.defId, side: u.side, platoonId: u.platoonId,
      pos: u.pos ? [u.pos.q, u.pos.r] : null, facing: u.facing,
      hp: u.hp, morale: u.morale, ap: u.ap, defeated: u.defeated,
      statuses: u.statuses.map((st) => ({ status: st.status, roundsLeft: st.roundsLeft, stacks: st.stacks ?? null, source: st.source }))
        .sort((x, y) => (x.status + x.source).localeCompare(y.status + y.source)),
      cooldowns: Object.fromEntries(Object.entries(u.cooldowns).sort(([x], [y]) => x.localeCompare(y))),
      tempMods: u.tempMods.map((m) => ({ source: m.source, stat: m.stat, value: m.value }))
        .sort((x, y) => (x.source + x.stat).localeCompare(y.source + y.stat)),
      isClone: u.isClone, cloneOf: u.cloneOf ?? null, cloneRoundsLeft: u.cloneRoundsLeft ?? null,
      splitBodies: u.splitBodies ?? null, promotedFromSecond: u.promotedFromSecond,
      movedThisActivation: u.movedThisActivation, chargeMoved: u.chargeMoved,
      altitudeDropped: u.altitudeDropped, attackedThisActivation: u.attackedThisActivation,
      overwatch: u.overwatch, defending: u.defending, setUp: u.setUp,
    }))
    .sort((x, y) => x.uid.localeCompare(y.uid));

  const sides = [...b.sides.values()]
    .map((s) => ({
      id: s.id, reservePoints: s.reservePoints, armyCapacity: s.armyCapacity, morale: s.morale,
      leaderUid: s.leaderUid ?? null, surrendered: !!s.surrendered,
      fusionCharges: s.fusionCharges ?? null, companyOrderUsedThisRound: !!s.companyOrderUsedThisRound,
    }))
    .sort((x, y) => x.id.localeCompare(y.id));

  const rituals = [...b.rituals.values()]
    .map((r) => ({ id: r.id, side: r.side, state: r.state, progress: r.progress, disruption: r.disruption, unstableStacks: r.unstableStacks }))
    .sort((x, y) => x.id.localeCompare(y.id));

  const portals = [...b.portals.values()]
    .map((p) => ({ id: p.id, side: p.side, state: p.state, pos: [p.pos.q, p.pos.r] }))
    .sort((x, y) => x.id.localeCompare(y.id));

  return hashString(JSON.stringify({
    round: b.round, phase: b.phase, winner: b.winner ?? null, winReason: b.winReason ?? null,
    units, sides, rituals, portals,
    terrain: [...b.terrain.entries()].sort(([x], [y]) => x.localeCompare(y)),
    timedTerrain: [...b.timedTerrain].map((t) => ({ ...t })).sort((x, y) => x.key.localeCompare(y.key)),
    duels: [...b.duels.entries()].sort(([x], [y]) => x.localeCompare(y)),
    orderFlags: [...b.orderFlags.entries()].sort(([x], [y]) => x.localeCompare(y)),
  }));
}

/**
 * The per-round desync hash: this round's events *and* the state they left behind. Events alone miss
 * unlogged drift; state alone misses two paths that happen to land on the same board. Both together
 * name the round a divergence actually started on.
 */
export function roundHash(b: Battle): string {
  const slice = b.events.filter((e) => e.round === b.round && e.type !== "RoundHash");
  return hashString(`${hashEvents(slice)}:${stateDigest(b)}`);
}
