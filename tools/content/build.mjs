import { makeUnit, ARCHETYPES } from "./lib.mjs";

const RANK_CODE = {
  foot: "FOOT", guardian: "GUARD", bruiser: "ELITE", skirmisher: "SCOUT", assassin: "ELITE",
  archer: "RANGED", mage: "MAGE", support: "SUPPORT", leader: "COMMANDER", second: "SECOND",
  cavalry: "CAV", flier: "WING", skyleader: "COMMANDER", skymage: "MAGE", colossus: "COLOSSUS",
  siege: "SIEGE", portal: "KEEPER",
};

export function slug(name) {
  return name.toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Turn one roster row into a UnitDef.
 * row: [name, stars, archetype, lore, kit?]
 *   kit: { p: [passiveIds], a: [activeIds], ...overrides }
 */
export function roster(meta, rows) {
  return rows.map(([name, stars, arch, lore, kit = {}]) => {
    const { p = [], a = [], ...rest } = kit;
    const code = RANK_CODE[arch] ?? "UNIT";
    return makeUnit({
      id: rest.id ?? `${meta.faction}_${code}_${slug(name)}`,
      name, stars, arch, lore,
      faction: meta.faction,
      className: rest.className ?? meta.className,
      themes: rest.themes ?? meta.themes,
      passives: [...(meta.passives ?? []), ...p],
      actives: a,
      keywords: [...(meta.keywords ?? []), ...(rest.keywords ?? [])],
      ...rest,
    });
  });
}

export { ARCHETYPES };
