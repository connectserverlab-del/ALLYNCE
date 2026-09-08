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
 * Hashes a battle's event log for equality comparison across runs. `GameEvent.data` is a plain,
 * JSON-serialisable record built the same way on every run of the same seed, so its key order is
 * stable; this is the same shape `Q-20`'s per-round `RoundHash` will hash a slice of.
 */
export function hashEvents(events: readonly GameEvent[]): string {
  return hashString(JSON.stringify(events));
}
