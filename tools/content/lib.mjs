/**
 * Shared content model for the ALLYNCE roster expansion.
 *
 * Rosters are authored as compact rows; this module turns a row into a full UnitDef
 * so that hundreds of units stay readable and stat curves stay consistent.
 */

/** Star tier names. 10 is the godly tier and is deliberately far above 9. */
export const TIER_NAMES = {
  1: "Levy", 2: "Regular", 3: "Veteran", 4: "Chosen", 5: "Vanguard",
  6: "Exemplar", 7: "Paragon", 8: "Legend", 9: "Mythic", 10: "Ascendant",
};

/**
 * Power curve. 1-9 is a smooth 24% step; 10 breaks the curve by another 45%
 * so a ten-star reads as a different category of thing, not the next unit up.
 */
export function power(stars) {
  const nine = 600 * Math.pow(1.24, 8);
  return stars === 10 ? Math.round(nine * 1.45) : Math.round(600 * Math.pow(1.24, stars - 1));
}

/** Archetype profiles: how a unit spends its power budget. */
export const ARCHETYPES = {
  foot:       { atk: 1.00, def: 1.05, hp: 1.00, mov: 4, range: 1, init: 4, role: "FootSoldier", slot: "FootSoldier" },
  guardian:   { atk: 0.85, def: 1.35, hp: 1.30, mov: 3, range: 1, init: 3, role: "FootSoldier", slot: "FootSoldier" },
  bruiser:    { atk: 1.18, def: 1.00, hp: 1.15, mov: 4, range: 1, init: 5, role: "Elite", slot: "Elite" },
  skirmisher: { atk: 1.10, def: 0.85, hp: 0.90, mov: 6, range: 1, init: 7, role: "FootSoldier", slot: "FootSoldier" },
  assassin:   { atk: 1.32, def: 0.70, hp: 0.78, mov: 6, range: 1, init: 9, role: "Elite", slot: "Elite" },
  archer:     { atk: 1.05, def: 0.82, hp: 0.85, mov: 4, range: 3, init: 6, role: "Ranged", slot: "Specialist" },
  mage:       { atk: 1.22, def: 0.74, hp: 0.80, mov: 4, range: 3, init: 6, role: "Ritualist", slot: "Specialist" },
  support:    { atk: 0.78, def: 0.98, hp: 0.95, mov: 4, range: 2, init: 5, role: "Support", slot: "Specialist" },
  leader:     { atk: 1.02, def: 1.08, hp: 1.12, mov: 4, range: 1, init: 6, role: "Commander", slot: "Commander", command: 3 },
  second:     { atk: 0.94, def: 1.02, hp: 1.02, mov: 4, range: 2, init: 6, role: "Second", slot: "Second", command: 2 },
  cavalry:    { atk: 1.15, def: 0.95, hp: 1.10, mov: 7, range: 1, init: 7, role: "Cavalry", slot: "Specialist" },
  flier:      { atk: 1.12, def: 0.90, hp: 1.00, mov: 7, range: 1, init: 8, role: "Cavalry", slot: "Specialist", flying: true },
  skyleader:  { atk: 1.08, def: 1.05, hp: 1.15, mov: 7, range: 1, init: 8, role: "Commander", slot: "Commander", flying: true, command: 3 },
  skymage:    { atk: 1.20, def: 0.80, hp: 0.85, mov: 6, range: 3, init: 7, role: "Ritualist", slot: "Specialist", flying: true },
  colossus:   { atk: 1.28, def: 1.22, hp: 1.70, mov: 4, range: 1, init: 3, role: "Elite", slot: "Elite", size: "Large" },
  siege:      { atk: 1.30, def: 0.90, hp: 1.20, mov: 2, range: 4, init: 2, role: "Siege", slot: "Specialist" },
  portal:     { atk: 0.80, def: 0.95, hp: 0.92, mov: 4, range: 2, init: 5, role: "PortalKeeper", slot: "Specialist" },
};

const HP_BASE = 1.05;

/**
 * Ascendant Manifestation. Ten-stars get a flat term on top of the curve as well as the
 * curve break itself. The flat part is what makes the tier read as a different kind of
 * thing: it compresses the archetype spread, so even the frailest Ascendant outweighs
 * the heaviest nine-star instead of merely out-scaling its own archetype.
 */
const ASCENDANT = { hp: 2000, atk: 1200, def: 1200 };

/** Capacity cost tracks the star rating so ten-stars genuinely crowd out a roster. */
export function capacityCost(stars, arch) {
  const a = ARCHETYPES[arch];
  const bulk = (a.atk + a.def + a.hp) / 3;
  return Math.max(2, Math.round((2 + stars * 1.6) * bulk));
}

/** Morale scales gently; ten-stars are effectively unshakeable. */
function moraleFor(stars) {
  return stars === 10 ? 100 : Math.min(95, 55 + stars * 4);
}

/**
 * Build a UnitDef from a compact roster row.
 *
 * row = { id, name, faction, stars, arch, themes, lore, passives, actives,
 *         unique, uniqueLimit, keywords, ritual, divine, summonOnly, ai, art }
 */
export function makeUnit(row) {
  const a = ARCHETYPES[row.arch];
  if (!a) throw new Error(`${row.id}: unknown archetype ${row.arch}`);
  const p = power(row.stars);
  const scale = row.scale ?? 1;
  const unit = {
    id: row.id,
    name: row.name,
    faction: row.faction,
    stars: row.stars,
    tier: TIER_NAMES[row.stars],
    className: row.className,
    themes: row.themes,
    roles: row.roles ?? [a.role],
    rank: row.rank ?? rankFor(a.role),
    size: row.size ?? a.size ?? "Standard",
    hp: r50(p * a.hp * HP_BASE * scale) + (row.stars === 10 ? ASCENDANT.hp : 0),
    atk: r50(p * a.atk * scale) + (row.stars === 10 ? ASCENDANT.atk : 0),
    def: r50(p * a.def * scale) + (row.stars === 10 ? ASCENDANT.def : 0),
    mov: row.mov ?? a.mov,
    range: row.range ?? a.range,
    initiative: Math.min(12, a.init + Math.floor(row.stars / 4)),
    morale: moraleFor(row.stars),
    capacityCost: capacityCost(row.stars, row.arch),
    passives: row.passives ?? [],
    actives: row.actives ?? [],
    slots: row.slots ?? [a.slot],
    unique: row.unique ?? row.stars === 10,
    summonOnly: row.summonOnly ?? false,
    ai: row.ai ?? aiFor(row.arch),
    lore: row.lore,
    keywords: row.keywords ?? [],
  };
  if (a.command) unit.commandRadius = row.commandRadius ?? a.command + (row.stars >= 8 ? 1 : 0);
  if (a.flying || row.flying) unit.flying = true;
  if (row.uniqueLimit) unit.uniqueLimit = row.uniqueLimit;
  else if (unit.unique) unit.uniqueLimit = 1;
  if (row.ritual) unit.ritual = row.ritual;
  if (row.divine) unit.divine = row.divine;
  if (row.fusion) unit.fusion = row.fusion;
  if (row.art) unit.art = row.art;
  if (row.signature) unit.signature = row.signature;
  if (row.stars === 10) {
    unit.keywords = [...new Set([...unit.keywords, "Ascendant"])];
    unit.divine = row.divine ?? { manifestation: 2, anchors: 2, arrival: row.arrival ?? "Ascendant arrival: allied units within 3 recover 15 morale; enemy units within 3 lose 15." };
  }
  return unit;
}

function rankFor(role) {
  return { FootSoldier: "Foot", Commander: "Commander", Second: "Second", Elite: "Elite" }[role] ?? "Specialist";
}

function aiFor(arch) {
  return {
    foot: "formation_hold", guardian: "formation_hold", bruiser: "line_breaker",
    skirmisher: "raider", assassin: "assassin", archer: "skirmish_ranged", mage: "caster",
    support: "support", leader: "leader_hold", second: "leader_support", cavalry: "charger",
    flier: "air_raider", skyleader: "leader_flank", skymage: "caster", colossus: "line_breaker",
    siege: "siege", portal: "objective_holder",
  }[arch] ?? "formation_hold";
}

/** Round to the nearest 50 so the numbers read like the hand-authored core roster. */
function r50(n) { return Math.round(n / 50) * 50; }

/** Ability helper. */
export function ability(id, name, category, effect, text, extra = {}) {
  return { id, name, category, effect, text, ...extra };
}
