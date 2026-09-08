/**
 * Deck / army validation for the UI.
 *
 * Mirrors core/src/composition.ts: the same slot table, the same unique rules and the
 * same one-Ascendant cap, so a deck that validates here is a legal army in the sim.
 */

export const CAPACITY = 60;

export function deckStats(deck, data) {
  const counts = new Map();
  for (const id of deck.units) counts.set(id, (counts.get(id) ?? 0) + 1);
  const units = deck.units.map((id) => data.unit(id)).filter(Boolean);
  return {
    counts,
    units,
    capacity: units.reduce((s, u) => s + u.capacityCost, 0),
    bySlot: (slot) => units.filter((u) => u.slots.includes(slot)),
  };
}

/** Returns { errors, warnings, ok }. Errors block battle; warnings are advice. */
export function validateDeck(deck, data) {
  const errors = [];
  const warnings = [];
  const s = deckStats(deck, data);
  const slotCount = (slot) => s.units.filter((u) => u.slots.includes(slot) && u.rank === RANK[slot]).length;

  if (s.units.length < 8) errors.push(`A muster needs at least 8 units; this one has ${s.units.length}.`);
  if (s.capacity > CAPACITY) errors.push(`Army Capacity ${s.capacity} exceeds the limit of ${CAPACITY}.`);

  const commanders = s.units.filter((u) => u.rank === "Commander" || u.rank === "Archangel" && u.slots.includes("Commander"));
  if (commanders.length === 0) errors.push("No Commander. A platoon without a leader is Broken from the first round.");

  const seconds = s.units.filter((u) => u.slots.includes("Second"));
  if (seconds.length === 0) warnings.push("No Second: nothing inherits the command aura when the Commander falls.");

  const elites = s.units.filter((u) => u.slots.includes("Elite"));
  if (elites.length === 0) errors.push("No Elite. Platoon Doctrine requires one Elite to reach Full.");

  const foot = s.units.filter((u) => u.slots.includes("FootSoldier"));
  if (foot.length < 5) errors.push(`Full Doctrine needs 5 foot soldiers; this muster has ${foot.length}.`);

  for (const [id, n] of s.counts) {
    const u = data.unit(id);
    if (u?.uniqueLimit !== undefined && n > u.uniqueLimit) {
      errors.push(`${u.name} is limited to ${u.uniqueLimit} copy per army (this deck has ${n}).`);
    }
  }

  const ascendants = s.units.filter((u) => u.stars === 10);
  if (ascendants.length > 1) {
    errors.push(`Only one Ascendant may be fielded at a time. This deck has ${ascendants.length}: ${ascendants.map((u) => u.name).join(", ")}.`);
  }

  const themes = new Map();
  for (const u of s.units) for (const t of u.themes) themes.set(t, (themes.get(t) ?? 0) + 1);
  const dominant = [...themes.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dominant && dominant[1] < s.units.length * 0.5 && s.units.length >= 8) {
    warnings.push(`Mixed themes: only ${dominant[1]} of ${s.units.length} units share the ${dominant[0]} theme, so Theme Cohesion will rarely trigger.`);
  }
  if (s.units.some((u) => u.flying) && !s.units.some((u) => u.range >= 3)) {
    warnings.push("Flying units and no ranged support: anti-air ground will be hard to answer.");
  }

  return { ok: errors.length === 0, errors, warnings, stats: s, dominantTheme: dominant?.[0] ?? null };
}

const RANK = { Commander: "Commander", Second: "Second", Elite: "Elite", FootSoldier: "Foot" };

/** Can this unit still be added? Enforces ownership, copy caps and the Ascendant cap. */
export function canAdd(unitId, deck, data, ownedCount) {
  const u = data.unit(unitId);
  if (!u) return "Unknown unit.";
  const inDeck = deck.units.filter((x) => x === unitId).length;
  if (inDeck >= ownedCount) return `You only own ${ownedCount} of ${u.name}.`;
  if (u.uniqueLimit !== undefined && inDeck >= u.uniqueLimit) return `${u.name} is limited to ${u.uniqueLimit} copy per army.`;
  if (u.stars === 10 && deck.units.some((x) => data.unit(x)?.stars === 10)) {
    return "Only one Ascendant may be fielded per army.";
  }
  const stats = deckStats(deck, data);
  if (stats.capacity + u.capacityCost > CAPACITY) return `Adding ${u.name} would exceed Army Capacity (${CAPACITY}).`;
  return null;
}

/** Fill a legal starting eight from what the player owns, best-first. */
export function autoFill(deck, data, inventory) {
  const pool = Object.entries(inventory).flatMap(([id, n]) => Array(n).fill(id))
    .map((id) => data.unit(id)).filter(Boolean);
  const pick = (test) => {
    const sorted = pool.filter(test).sort((a, b) => b.stars - a.stars);
    for (const u of sorted) if (!canAdd(u.id, deck, data, inventory[u.id] ?? 0)) return u.id;
    return null;
  };
  const want = [
    (u) => u.slots.includes("Commander"),
    (u) => u.slots.includes("Second"),
    (u) => u.slots.includes("Elite"),
    ...Array(5).fill((u) => u.slots.includes("FootSoldier")),
  ];
  for (const test of want) {
    const id = pick(test);
    if (id) deck.units.push(id);
  }
  return deck;
}
