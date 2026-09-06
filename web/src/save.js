/**
 * Save state. One JSON blob in localStorage; every view reads and writes through here
 * so the village, the inventory and the deck can never drift apart.
 */
const KEY = "allynce.save.v1";

const EMPTY = () => ({
  version: 1,
  created: Date.now(),
  resources: { steel: 1200, grain: 900, relics: 3 },
  village: {},              // buildingId -> level
  inventory: {},            // unitId -> owned count
  decks: {},                // deckId -> { name, units: [unitId] }
  activeDeck: "deck1",
  campaign: { cleared: [], current: null },
  guide: { seen: false },
  log: [],
});

let state = null;
const listeners = new Set();

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...EMPTY(), ...JSON.parse(raw) } : EMPTY();
  } catch {
    state = EMPTY();
  }
  return state;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: run in memory */ }
  for (const fn of listeners) fn(state);
}

export function update(fn) { fn(load()); save(); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function reset() { state = EMPTY(); save(); return state; }

/* ------------------------------------------------------------- convenience */
export function owned(unitId) { return load().inventory[unitId] ?? 0; }
export function addUnit(unitId, n = 1) { update((s) => { s.inventory[unitId] = (s.inventory[unitId] ?? 0) + n; }); }

export function deck(id = load().activeDeck) {
  const s = load();
  s.decks[id] ??= { name: "First Muster", units: [] };
  return s.decks[id];
}

export function canAfford(cost) {
  const r = load().resources;
  return Object.entries(cost).every(([k, v]) => (r[k] ?? 0) >= v);
}
export function spend(cost) {
  if (!canAfford(cost)) return false;
  update((s) => { for (const [k, v] of Object.entries(cost)) s.resources[k] -= v; });
  return true;
}
export function grant(gain) {
  update((s) => { for (const [k, v] of Object.entries(gain)) s.resources[k] = (s.resources[k] ?? 0) + v; });
}
