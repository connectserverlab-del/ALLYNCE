import { writeFileSync } from "node:fs";
import { Battle } from "../../core/src/state.js";
import { BattleController } from "../../core/src/battle.js";
import { loadRegistry } from "../../core/src/data.js";
import { generateMap, applyMap } from "../../core/src/mapgen.js";
import { deployPlatoon } from "../../core/src/deploy.js";
import { computeStat } from "../../core/src/modifiers.js";
import { rankOf, commandRadiusOf } from "../../core/src/ranks.js";
import { cohesionEdges } from "../../core/src/cohesion.js";
import { hexDistance } from "../../core/src/hex.js";
import { TERRAIN_RULES } from "../../core/src/types.js";
import { buildStarterDeck, validateDeck, DeckState, tributeCost, copyLimit, starOf, playableSideCards, summonZone, STARTER_CURVE } from "../../core/src/cards.js";
import { newKingdom, grantStarterCollection, startUpgrade, tick, startResearch, researchable, upgradeCost, upgradeSeconds, kingdomEffects, applyKingdom, storageCap, BUILDING_IDS, buildingTier, buildingArt, nextTierAt } from "../../core/src/kingdom.js";
import { rollBoard, acceptContract, missingForDeck } from "../../core/src/wanted.js";
import { Rng } from "../../core/src/rng.js";

const reg = loadRegistry();

// ---------------- holding ----------------
const k = newKingdom(reg, "SAM", { name: "Ashfall Hold", seed: 7 });
grantStarterCollection(reg, k);   // the starter box: enough cards to sleeve a legal hundred, and no more
k.resources = { koku: 99999, iron: 99999, timber: 99999, silver: 99999 };
const levelUp = (b: any, times: number) => { for (let i = 0; i < times; i++) { startUpgrade(reg, k, b); tick(reg, k, 1e6); } };
levelUp("KEEP", 3); levelUp("GRANARY", 3); levelUp("MINE", 2); levelUp("SAWPIT", 2);
levelUp("BARRACKS", 2); levelUp("RESEARCH_HALL", 3); levelUp("RECRUITMENT_HALL", 2);
levelUp("FORGE", 2); levelUp("STABLE", 1); levelUp("WALL", 2);
startResearch(reg, k, "RES_FORGED_EDGE"); tick(reg, k, 1e6);
startResearch(reg, k, "RES_DRILL_YARD"); tick(reg, k, 1e6);
startResearch(reg, k, "RES_LAYERED_PLATE"); tick(reg, k, 200);
startUpgrade(reg, k, "SHRINE");
k.resources = { koku: 3480, iron: 1920, timber: 2760, silver: 4150 };
const kEff = kingdomEffects(reg, k);

// ---------------- battle ----------------
const map = generateMap({ seed: 42, name: "Ashfall Crossing" });
const b = new Battle(reg, { seed: 42, sides: [
  { id: "A", reservePoints: 12, armyCapacity: 140, morale: 100, fusionCharges: 1 },
  { id: "B", reservePoints: 24, armyCapacity: 140, morale: 100, fusionCharges: 1 }] });
applyMap(b, map);
const ctrl = new BattleController(b, { sides: { A: [], B: [] }, roundLimit: 12 });
const free = (zone: any[], n: number) => zone.filter((h) => b.isFree(h)).slice(0, n);
deployPlatoon(b, { id: "SHI-1", side: "A", faction: "SHI", commander: "SHI_COMMANDER_VEILED-MOON-JONIN", second: "SHI_SECOND_REED-SIGNAL-LIEUTENANT", elite: "SHI_ELITE_MIRROR-SHADE-ADEPT", foot: Array(5).fill("SHI_FOOT_NIGHT-THREAD-OPERATIVE") }, free(map.deployZones.A, 8), 0);
for (const id of ["SHI_CAVALRY_NIGHT-COURIER-RIDER", "SHI_SIEGE_REED-SMOKE-MORTAR", "SHI_LEVY_THREAD-APPRENTICE"]) { const h = free(map.deployZones.A, 1)[0]; if (h) b.spawn(id, "A", h); }
deployPlatoon(b, { id: "SAM-1", side: "B", faction: "SAM", commander: "SAM_COMMANDER_EMBER-BANNER-DAIMYO", second: "SAM_SECOND_WHITE-CRANE-RETAINER", elite: "SAM_ELITE_ONI-GATE-CHAMPION", foot: Array(5).fill("SAM_FOOT_EMBERLINE-ASHIGARU") }, free(map.deployZones.B, 8), 3);
for (const id of ["SAM_CAVALRY_CRIMSON-UMAMAWARI-LANCER", "SAM_SIEGE_EMBER-OZUTSU-BATTERY", "SAM_LEVY_ASHFIELD-CONSCRIPT", "SAM_LEVY_ASHFIELD-CONSCRIPT"]) { const h = free(map.deployZones.B, 1)[0]; if (h) b.spawn(id, "B", h); }
b.sides.get("A")!.leaderUid = b.platoon("SHI-1").commanderUid;
b.sides.get("B")!.leaderUid = b.platoon("SAM-1").commanderUid;
applyKingdom(b, "B", k);

const deckList = buildStarterDeck(reg, "SAM", "Ashfall Muster", { collection: k.collection });
const shiList = buildStarterDeck(reg, "SHI", "Veiled Moon Cell");
const deck = new DeckState(deckList, new Rng(11), reg.deckRules);
b.decks.set("B", deck);
b.decks.set("A", new DeckState(shiList, new Rng(12), reg.deckRules));
deck.openingHand();
b.round = 4; b.phase = "Activation";
ctrl.beginActivation("SAM-1");
const mine = [...b.activeUnits("B")].filter((u) => u.platoonId === "SAM-1");
const sel = mine.map((u) => ({ u, n: ctrl.reachable(u).size })).sort((x, y) => y.n - x.n)[0]!.u;
const enemy = [...b.activeUnits("A")].sort((x, y) => b.distance(sel, x) - b.distance(sel, y))[0]!;
const atk = computeStat(b, sel, "ATK", { attacker: sel, defender: enemy });
const def = computeStat(b, sel, "DEF");

const unitCard = (id: string) => {
  const d = reg.unit(id);
  return { id, name: d.name, faction: d.faction, stars: d.stars ?? 1, roles: d.roles, rank: d.rank, factionRank: d.factionRank ?? null,
    hp: d.hp, atk: d.atk, def: d.def, mov: d.mov, range: d.range, capacityCost: d.capacityCost, flying: !!d.flying,
    tribute: tributeCost(reg, id), limit: copyLimit(reg, id), unique: d.unique, summonOnly: d.summonOnly,
    abilities: [...d.passives, ...d.actives].map((a) => ({ id: a, name: reg.ability(a).name, text: reg.ability(a).text, category: reg.ability(a).category })),
    art: d.art ?? null, themes: d.themes };
};
const group = (ids: string[]) => { const m = new Map<string, number>(); for (const i of ids) m.set(i, (m.get(i) ?? 0) + 1); return [...m].map(([id, n]) => ({ ...unitCard(id), count: n })).sort((a, c) => a.stars - c.stars || a.name.localeCompare(c.name)); };
/**
 * What a side card should put on its face. A ritual names the unit it brings out, so that unit's
 * portrait and stats are the answer. A fusion mostly does not: three of the four recipes derive the
 * new body from whatever fed them, so there is no painting of the result and there never will be.
 * Those show the first named material instead — the thing it is made of — and the formula rather
 * than invented numbers.
 */
const sideFace = (c: any, recipe: any) => {
  if (c.result) return { face: unitCard(c.result), stats: unitCard(c.result), formula: null };
  if (!recipe) return { face: null, stats: null, formula: null };
  if (recipe.result?.defId) { const u = unitCard(recipe.result.defId); return { face: u, stats: u, formula: null }; }
  const named = recipe.inputs.find((i: any) => i.defId);
  const r = recipe.result ?? {};
  return {
    face: named ? unitCard(named.defId) : null,
    stats: null,
    formula: { hp: String(r.hp ?? "—"), atk: String(r.atk ?? "—"), def: String(r.def ?? "—") },
  };
};
const sideGroup = (ids: string[]) => { const m = new Map<string, number>(); for (const i of ids) m.set(i, (m.get(i) ?? 0) + 1); return [...m].map(([id, n]) => { const c = reg.sideCards.get(id)!; const recipe = c.recipe ? reg.fusions.get(c.recipe) : null; const f = sideFace(c, recipe); return { ...c, count: n, resultCard: c.result ? unitCard(c.result) : null, faceCard: f.face, faceStats: f.stats, resultFormula: f.formula, materials: recipe ? recipe.inputs.map((i: any) => i.defId ? reg.unit(i.defId).name : (i.roles ?? []).join("+")) : null, recipeText: recipe?.text ?? null }; }).sort((a, c) => c.stars - a.stars); };

// Seed one warrant as already in hand, so the Writs screen opens mid-use rather than empty. The
// board itself is not baked into the page: `web/sample/writs-boot.mts` bundles the real
// `core/src/wanted.ts` into the page so taking and giving back a warrant runs the actual rules
// instead of a snapshot of them, the same way the March screen runs the real march engine.
const initialBoard = rollBoard(reg, k, deckList);
acceptContract(reg, k, initialBoard.find((c) => c.stars >= 5)?.id ?? initialBoard[0]!.id, deckList);

const out = {
  map, terrainRules: TERRAIN_RULES,
  battle: {
    round: b.round, phase: b.phase, activeGroup: "SAM-1",
    sideName: { A: "Veiled Moon Cell", B: "Ashfall Muster" },
    units: [...b.activeUnits()].map((u) => { const d = b.def(u); return { uid: u.uid, defId: d.id, name: d.name, side: u.side, q: u.pos!.q, r: u.pos!.r, hp: u.hp, maxHp: d.hp, morale: u.morale, roles: d.roles, faction: d.faction, stars: d.stars ?? 1, rank: rankOf(b, u)?.title ?? null, platoonId: u.platoonId, flying: !!d.flying, leader: b.sides.get(u.side)!.leaderUid === u.uid, ap: u.ap }; }),
    cohesion: cohesionEdges(b),
    reachable: [...ctrl.reachable(sel).values()].map((r) => ({ q: r.hex.q, r: r.hex.r, cost: r.cost })),
    summonZone: summonZone(b, "B").map((h) => ({ q: h.q, r: h.r })),
    selected: { uid: sel.uid, ...unitCard(sel.defId), morale: sel.morale, hpNow: sel.hp, ap: sel.ap, mov: ctrl.movementAllowance(sel), commandRadius: commandRadiusOf(b, sel), atk, def, enemyName: b.def(enemy).name,
      predicted: Math.max(100, atk.final - computeStat(b, enemy, "DEF", { attacker: sel, defender: enemy }).final) },
    hand: deck.hand.map(unitCard),
    deckCounts: { draw: deck.drawPile.length, hand: deck.hand.length, grave: deck.graveyard.length, side: deck.side.length },
    playableSide: playableSideCards(b, "B").map((x) => ({ id: x.card.id, name: x.card.name, materials: x.materials.map((m) => b.def(m).name) })),
    morale: { A: ctrl.moraleSummary("A"), B: ctrl.moraleSummary("B") },
  },
  deck: { ...deckList, cards: group(deckList.main), side: sideGroup(deckList.side), validation: validateDeck(reg, deckList, { collection: k.collection }), curve: STARTER_CURVE,
    owned: Object.fromEntries(deckList.main.map((id) => [id, k.collection[id] ?? 0])),
    missing: missingForDeck(reg, deckList, k.collection) },
  rules: { ...reg.deckRules },
  factions: Object.fromEntries([...reg.factions.values()].map((f) => [f.id, { name: f.name, identity: f.identity, palette: f.palette }])),
  kingdom: {
    state: k, effects: kEff, storage: storageCap(reg, k),
    buildings: BUILDING_IDS.map((id) => ({ id, ...reg.kingdom.buildings[id], level: k.levels[id], nextCost: upgradeCost(reg, k, id), nextSeconds: upgradeSeconds(reg, k, id), building: k.buildQueue.find((j) => j.building === id) ?? null, tier: buildingTier(reg, k.levels[id]), art: buildingArt(reg, id, k.levels[id]), nextTierAt: nextTierAt(reg, k.levels[id]) })),
    tierBands: reg.kingdom.tierBands,
    resources: reg.kingdom.resources,
    research: [...reg.research.values()].map((r) => ({ ...r, done: k.research.done.includes(r.id), active: k.research.active?.id === r.id, available: researchable(reg, k).some((x) => x.id === r.id), activeLeft: k.research.active?.id === r.id ? k.research.active.secondsLeft : null })),
    banners: [...reg.banners.values()],
  },
};
writeFileSync(process.argv[2]!, JSON.stringify(out));
console.log("warrants in hand", k.wanted.accepted.length, "deck gaps", out.deck.missing.length, "collection", Object.keys(k.collection).length, "\nunits", out.battle.units.length, "hand", out.battle.hand.length, "deck cards", out.deck.cards.length, "side", out.deck.side.length, "sel", out.battle.selected.name, atk.final, "reach", out.battle.reachable.length, "playable", out.battle.playableSide.length, "kingdom cap+", kEff.armyCapacity);
