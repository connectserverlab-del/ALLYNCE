/**
 * Loads the same JSON the rules engine loads, and builds the indexes the UI needs.
 * There is one source of truth for content: data/.
 */

const base = new URL("../../data/", import.meta.url);

async function json(path) {
  const r = await fetch(new URL(path, base));
  if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
  return r.json();
}

export const TIER_LABEL = {
  1: "Levy", 2: "Regular", 3: "Veteran", 4: "Chosen", 5: "Vanguard",
  6: "Exemplar", 7: "Paragon", 8: "Legend", 9: "Mythic", 10: "Ascendant",
};

export async function loadGameData() {
  const [core, expansion, coreAbil, expAbil, factions, rules] = await Promise.all([
    json("units/units.json"),
    json("units/expansion.json").catch(() => []),
    json("abilities/abilities.json"),
    json("abilities/expansion.json").catch(() => []),
    json("factions/factions.json"),
    json("compositions/platoon.json"),
  ]);

  const units = [...core, ...expansion].map(normalise);
  const abilities = new Map([...coreAbil, ...expAbil].map((a) => [a.id, a]));
  const byId = new Map(units.map((u) => [u.id, u]));

  const classes = new Map();
  for (const u of units) {
    const key = u.className;
    if (!classes.has(key)) classes.set(key, { name: key, faction: u.faction, units: [] });
    classes.get(key).units.push(u);
  }

  return {
    units, byId, abilities, factions, rules, classes,
    unit: (id) => byId.get(id),
    ability: (id) => abilities.get(id),
    faction: (id) => factions[id] ?? { id, name: id, palette: [], weakness: "" },
  };
}

/** Give the hand-authored core roster the same shape as the generated expansion. */
function normalise(u) {
  const stars = u.stars ?? inferStars(u);
  return {
    ...u,
    stars,
    tier: u.tier ?? TIER_LABEL[stars],
    className: u.className ?? CORE_CLASS[u.faction] ?? u.faction,
    lore: u.lore ?? "",
    keywords: u.keywords ?? [],
    uniqueLimit: u.uniqueLimit ?? (u.unique ? 1 : undefined),
  };
}

const CORE_CLASS = {
  SAM: "Samurai", SHI: "Shinobi", KNI: "Knight", DRG: "Dragon Host",
  RIT: "Ritual Cult", DIV: "Divine Entities",
};

/** The original 22 predate star ratings; place them on the curve by stat budget. */
function inferStars(u) {
  const budget = u.hp + u.atk + u.def;
  const cuts = [2600, 3300, 4100, 5000, 6000, 7200, 8600, 10400, 12600];
  let s = 1;
  for (const c of cuts) if (budget > c) s++;
  return Math.min(10, s);
}
