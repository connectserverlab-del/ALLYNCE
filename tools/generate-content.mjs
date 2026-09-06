#!/usr/bin/env node
/**
 * Regenerates the expansion data files from the authored rosters in tools/content.
 *
 *   node tools/generate-content.mjs
 *
 * Writes data/units/expansion.json, data/abilities/expansion.json and the expansion
 * faction entries in data/factions/factions.json. The hand-authored core roster in
 * units.json is never touched: the loader merges both files.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { EXPANSION_ABILITIES } from "./content/abilities.mjs";
import * as classic from "./content/roster-classic.mjs";
import * as fresh from "./content/roster-new.mjs";
import { FUSIONS } from "./content/roster-fusion.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "data");

const NEW_FACTIONS = {
  THC: {
    id: "THC", name: "Thorn Coven", identity: "Attrition, entanglement and the patient garden",
    palette: ["bramble green", "dried blood", "bone ivory"], primaryTheme: "Thorn",
    platoonOrder: "ORD_CREEPING_BRIAR", passiveDoctrine: "DOC_THORN_TITHE",
    weakness: "Slow to reposition; loses its terrain advantage on open, burned or flooded ground.",
  },
  ANG: {
    id: "ANG", name: "Angelic Host", identity: "Airborne judgement in a fixed hierarchy",
    palette: ["bleached gold", "cold white", "deep vermilion"], primaryTheme: "Angelic",
    platoonOrder: "ORD_CHOIR_ASCENDANT", passiveDoctrine: "DOC_HOST_ALOFT",
    weakness: "Every unit flies, so anti-air ground and binding rituals hit the whole army at once. Archangels are one copy each.",
  },
  STM: {
    id: "STM", name: "Stormbound Clan", identity: "A bloodline of warriors and stormcallers",
    palette: ["storm violet", "wet slate", "fulgurite white"], primaryTheme: "Storm",
    platoonOrder: "ORD_STORMFRONT", passiveDoctrine: "DOC_GROUNDING_ROD",
    weakness: "Its own chains and rods ground allies too; clustered clan lines share incoming arc damage.",
  },
  MNK: {
    id: "MNK", name: "Monastic Orders", identity: "Few holders, immovable ground",
    palette: ["ink black", "unbleached linen", "temple copper"], primaryTheme: "Monastic",
    platoonOrder: "ORD_UNBROKEN_FORM", passiveDoctrine: "DOC_STILL_MIND",
    weakness: "Low unit count and several one-copy holders; loses badly to attrition it cannot answer.",
  },
  FUS: {
    id: "FUS", name: "Fused Orders", identity: "Two schools carried in one line",
    palette: ["split bronze", "muted indigo", "ash"], primaryTheme: "Fusion",
    platoonOrder: null, passiveDoctrine: "DOC_TWO_TRADITIONS",
    weakness: "Expensive, few, and never a full platoon on their own; fusion units support an army, they are not one.",
  },
};

const units = [
  ...classic.SAMURAI, ...classic.SHINOBI, ...classic.KNIGHTS,
  ...classic.DRAGONS, ...classic.RITUAL, ...classic.THORN_COVEN,
  ...fresh.ANGELS, ...fresh.STORMBOUND, ...fresh.MONKS,
  ...FUSIONS,
];

/* ------------------------------------------------------------------ checks */
const core = JSON.parse(readFileSync(resolve(DATA, "units/units.json"), "utf8"));
const coreAbilities = JSON.parse(readFileSync(resolve(DATA, "abilities/abilities.json"), "utf8"));
const factions = JSON.parse(readFileSync(resolve(DATA, "factions/factions.json"), "utf8"));

const abilityIds = new Set([...coreAbilities, ...EXPANSION_ABILITIES].map((a) => a.id));
const seen = new Set(core.map((u) => u.id));
const problems = [];

for (const u of units) {
  if (seen.has(u.id)) problems.push(`duplicate unit id ${u.id}`);
  seen.add(u.id);
  for (const id of [...u.passives, ...u.actives]) {
    if (!abilityIds.has(id)) problems.push(`${u.id} references missing ability ${id}`);
  }
  if (!factions[u.faction] && !NEW_FACTIONS[u.faction]) problems.push(`${u.id} references missing faction ${u.faction}`);
  if (u.stars < 1 || u.stars > 10) problems.push(`${u.id} has star rating ${u.stars}`);
}
const abilitySeen = new Set(coreAbilities.map((a) => a.id));
for (const a of EXPANSION_ABILITIES) {
  if (abilitySeen.has(a.id)) problems.push(`duplicate ability id ${a.id}`);
  abilitySeen.add(a.id);
}
if (problems.length) {
  for (const p of problems) console.error("  ✗", p);
  process.exit(1);
}

/* ------------------------------------------------------------------- write */
const merged = { ...factions, ...NEW_FACTIONS };
writeFileSync(resolve(DATA, "units/expansion.json"), JSON.stringify(units, null, 2) + "\n");
writeFileSync(resolve(DATA, "abilities/expansion.json"), JSON.stringify(EXPANSION_ABILITIES, null, 2) + "\n");
writeFileSync(resolve(DATA, "factions/factions.json"), JSON.stringify(merged, null, 2) + "\n");

/* ------------------------------------------------------------------ report */
const byFaction = {};
for (const u of [...core, ...units]) {
  const f = (byFaction[u.faction] ??= { total: 0, ten: 0, unique: 0 });
  f.total++;
  if (u.stars === 10) f.ten++;
  if (u.uniqueLimit) f.unique++;
}
console.log(`units: ${core.length} core + ${units.length} expansion = ${core.length + units.length}`);
console.log(`abilities: ${coreAbilities.length} core + ${EXPANSION_ABILITIES.length} expansion = ${abilityIds.size}`);
for (const [f, s] of Object.entries(byFaction)) {
  console.log(`  ${f.padEnd(4)} ${String(s.total).padStart(3)} units  ${s.ten} ten-star  ${s.unique} one-copy`);
}
