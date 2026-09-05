import { Battle } from "./state.js";
import { BattleController } from "./battle.js";
import type { Registry } from "./data.js";
import { generateMap, applyMap, type MapSpec, type GeneratedMap } from "./mapgen.js";
import { deployPlatoon } from "./deploy.js";
import { DeckState, type DeckList, summonFromHand, summonZone, tributeCost, starOf, playableSideCards, ritualSummon, fusionSummon } from "./cards.js";
import { runAiActivation, holdForSyncPolicy, DIFFICULTY, type AiProfile } from "./ai.js";
import { applyKingdom, type KingdomState, type ResourceId } from "./kingdom.js";
import { Rng } from "./rng.js";
import type { Hex } from "./hex.js";
import type { UnitState } from "./types.js";

export interface SideSetup { deck: DeckList; kingdom?: KingdomState; name: string; difficulty?: keyof typeof DIFFICULTY }
export interface MatchSpec {
  reg: Registry; seed: number; map?: MapSpec; roundLimit?: number;
  A: SideSetup; B: SideSetup;
}
export interface Reward { koku: number; iron: number; timber: number; silver: number; cards: string[] }
export interface MatchResult {
  winner: string | null; reason: string | null; rounds: number;
  survivors: Record<string, number>; starsLost: Record<string, number>;
  reward: Record<string, Reward>; map: GeneratedMap; battle: Battle;
}

/** Pick a legal opening force from a deck: the cheapest full platoon it can field, plus whatever capacity allows. */
export function openingForce(reg: Registry, deck: DeckList): { commander: string; second: string; elite: string; foot: string[]; extras: string[] } | null {
  const pool = [...new Set(deck.main)].map((id) => reg.unit(id));
  const own = pool.filter((d) => d.faction === deck.faction);
  const pick = (slot: string, from = own) => from.filter((d) => d.slots.includes(slot as never)).sort((a, b) => (a.stars ?? 1) - (b.stars ?? 1))[0];
  const commander = pick("Commander"), second = pick("Second"), elite = pick("Elite");
  const footDef = own.filter((d) => d.slots.includes("FootSoldier")).sort((a, b) => (b.stars ?? 1) - (a.stars ?? 1))[0];
  if (!commander || !second || !elite || !footDef) return null;
  const extras = pool.filter((d) => d.slots.includes("Specialist") && !d.summonOnly).sort((a, b) => (b.stars ?? 1) - (a.stars ?? 1)).slice(0, 3).map((d) => d.id);
  return { commander: commander.id, second: second.id, elite: elite.id, foot: Array(5).fill(footDef.id), extras };
}

/** Set up a battle from two decks on a generated field, ready for the first Command Phase. */
export function setUpMatch(spec: MatchSpec): { ctrl: BattleController; map: GeneratedMap } {
  const { reg } = spec;
  const map = generateMap({ seed: spec.seed, ...(spec.map ?? {}) });
  const b = new Battle(reg, { seed: spec.seed, sides: [
    { id: "A", reservePoints: 12, armyCapacity: 120, morale: 100, fusionCharges: 1 },
    { id: "B", reservePoints: 12, armyCapacity: 120, morale: 100, fusionCharges: 1 }] });
  applyMap(b, map);
  const ctrl = new BattleController(b, { sides: { A: [], B: [] }, roundLimit: spec.roundLimit ?? 20 });
  for (const side of ["A", "B"] as const) {
    const setup = spec[side];
    const force = openingForce(reg, setup.deck);
    if (!force) throw new Error(`${setup.name}'s deck cannot field a legal platoon`);
    const zone = map.deployZones[side].filter((h) => b.isFree(h));
    if (zone.length < 8) throw new Error("Deployment zone too small");
    deployPlatoon(b, { id: `${setup.deck.faction}-${side}`, side, faction: setup.deck.faction, commander: force.commander, second: force.second, elite: force.elite, foot: force.foot }, zone.slice(0, 8), side === "A" ? 0 : 3);
    for (const id of force.extras) { const h = map.deployZones[side].find((x) => b.isFree(x)); if (h) b.spawn(id, side, h); }
    const leader = [...b.activeUnits(side)].find((u) => b.def(u).roles.includes("Commander"));
    b.sides.get(side)!.leaderUid = leader?.uid ?? null;
    const deck = new DeckState(setup.deck, new Rng(spec.seed + (side === "A" ? 101 : 202)), reg.deckRules);
    deck.openingHand();
    b.decks.set(side, deck);
    if (setup.kingdom) applyKingdom(b, side, setup.kingdom);
  }
  return { ctrl, map };
}

/** The AI's card turn: summon the strongest card it can pay for, then play any rite that is ready. */
export function aiPlayCards(ctrl: BattleController, side: string, profile: AiProfile = DIFFICULTY.normal!): void {
  const b = ctrl.b;
  const deck = b.decks.get(side);
  if (!deck) return;
  const zone = summonZone(b, side);
  if (zone.length) {
    const leaderUid = b.sides.get(side)!.leaderUid;
    const spare = [...b.activeUnits(side)].filter((u) => !u.isClone && u.uid !== leaderUid && !b.def(u).roles.includes("Commander"))
      .sort((a, c) => starOf(b.reg, a.defId) - starOf(b.reg, c.defId));
    const options = [...new Set(deck.hand)]
      .map((id) => ({ id, cost: tributeCost(b.reg, id), stars: starOf(b.reg, id) }))
      .filter((o) => o.cost !== null && o.cost <= spare.length)
      // never tribute more value than the card is worth
      .filter((o) => o.cost === 0 || o.stars > spare.slice(0, o.cost!).reduce((s, u) => s + starOf(b.reg, u.defId), 0))
      .sort((x, y) => y.stars - x.stars);
    const best = options[0];
    if (best) {
      const at = zone[0]!;
      try { summonFromHand(b, side, best.id, at, { tributes: spare.slice(0, best.cost!) }); } catch { /* board changed */ }
    }
  }
  for (const play of playableSideCards(b, side)) {
    // hold the biggest rites until the fight is joined, so they are not spent on an empty field
    const contact = [...b.activeUnits(side)].some((u) => b.adjacentEnemies(u).length > 0);
    if (play.card.stars >= 9 && !contact && profile.objectiveWeight < 1.3) continue;
    try {
      if (play.card.kind === "ritual") ritualSummon(b, side, play.card.id, play.materials);
      else fusionSummon(b, side, play.card.id, play.materials);
      break;
    } catch { /* requirements moved */ }
  }
}

/** Play a whole match to a decision. Deterministic for a given seed. */
export function runMatch(spec: MatchSpec): MatchResult {
  const { ctrl, map } = setUpMatch(spec);
  const b = ctrl.b;
  const startStars: Record<string, number> = { A: 0, B: 0 };
  for (const s of ["A", "B"]) startStars[s] = [...b.activeUnits(s)].reduce((t, u) => t + starOf(b.reg, u.defId), 0);
  const limit = spec.roundLimit ?? 20;

  while (!b.winner && b.round <= limit) {
    ctrl.commandPhase();
    for (const s of ["A", "B"]) aiPlayCards(ctrl, s, DIFFICULTY[spec[s as "A" | "B"].difficulty ?? "normal"]!);
    let turn = b.round % 2 === 1 ? 0 : 1;
    const sides = ["A", "B"];
    for (let guard = 0; guard < 40; guard++) {
      const mine = ctrl.groupsFor(sides[turn]!), theirs = ctrl.groupsFor(sides[1 - turn]!);
      if (!mine.length && !theirs.length) break;
      if (mine.length) runAiActivation(ctrl, mine[0]!, DIFFICULTY[spec[sides[turn] as "A" | "B"].difficulty ?? "normal"]!);
      turn = 1 - turn;
    }
    ctrl.objectivePhase(holdForSyncPolicy(ctrl, "A"));
    ctrl.endPhase();
  }
  if (!b.winner) { b.winner = "draw"; b.winReason = "Round limit"; }

  const survivors: Record<string, number> = {}, starsLost: Record<string, number> = {};
  for (const s of ["A", "B"]) {
    survivors[s] = [...b.activeUnits(s)].filter((u) => !u.isClone).length;
    starsLost[s] = startStars[s]! - [...b.activeUnits(s)].reduce((t, u) => t + starOf(b.reg, u.defId), 0);
  }
  const reward: Record<string, Reward> = {};
  for (const s of ["A", "B"]) reward[s] = spoils(b, s, b.winner === s, starsLost[s === "A" ? "B" : "A"]!, b.round);
  return { winner: b.winner, reason: b.winReason, rounds: b.round, survivors, starsLost, reward, map, battle: b };
}

/** What a side carries home: a base purse for showing up, more for the enemy stars it broke, a bonus for winning. */
export function spoils(b: Battle, side: string, won: boolean, enemyStarsBroken: number, rounds: number): Reward {
  const rng = new Rng(b.seed + side.charCodeAt(0) + rounds);
  const base = won ? 260 : 90;
  const perStar = won ? 26 : 12;
  const amount = (mult: number) => Math.round((base + enemyStarsBroken * perStar) * mult);
  const cards: string[] = [];
  if (won) {
    const pool = [...b.reg.units.values()].filter((d) => !d.summonOnly && d.faction !== "DIV" && (d.stars ?? 1) <= (enemyStarsBroken >= 20 ? 7 : 5));
    if (pool.length) cards.push(pool[rng.int(pool.length)]!.id);
  }
  return { koku: amount(1.1), iron: amount(0.8), timber: amount(0.9), silver: amount(1.3), cards };
}

/** Pay a match reward into a holding. */
export function collectReward(k: KingdomState, reward: Reward): void {
  for (const r of ["koku", "iron", "timber", "silver"] as ResourceId[]) k.resources[r] += reward[r];
  for (const c of reward.cards) k.collection[c] = (k.collection[c] ?? 0) + 1;
}
export type { Hex, UnitState };
