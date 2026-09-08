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
