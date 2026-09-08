import { Battle } from "../src/state.js";
import { BattleController } from "../src/battle.js";
import { loadRegistry } from "../src/data.js";
import { deployPlatoon } from "../src/deploy.js";
import type { PlatoonBlueprint } from "../src/composition.js";
import type { Hex } from "../src/hex.js";
import { newKingdom, startUpgrade, tick, startResearch, type KingdomState } from "../src/kingdom.js";

export const reg = loadRegistry();

export function newBattle(seed = 1): { b: Battle; ctrl: BattleController } {
  const b = new Battle(reg, { seed, width: 24, height: 18 });
  const ctrl = new BattleController(b, { sides: { A: [], B: [] }, roundLimit: 99 });
  return { b, ctrl };
}

export const SAM: Omit<PlatoonBlueprint, "id" | "side"> = {
  faction: "SAM", commander: "SAM_COMMANDER_EMBER-BANNER-DAIMYO", second: "SAM_SECOND_WHITE-CRANE-RETAINER", elite: "SAM_ELITE_ONI-GATE-CHAMPION",
  foot: Array(5).fill("SAM_FOOT_EMBERLINE-ASHIGARU"),
};
export const SHI: Omit<PlatoonBlueprint, "id" | "side"> = {
  faction: "SHI", commander: "SHI_COMMANDER_VEILED-MOON-JONIN", second: "SHI_SECOND_REED-SIGNAL-LIEUTENANT", elite: "SHI_ELITE_MIRROR-SHADE-ADEPT",
  foot: Array(5).fill("SHI_FOOT_NIGHT-THREAD-OPERATIVE"),
};
export const KNI: Omit<PlatoonBlueprint, "id" | "side"> = {
  faction: "KNI", commander: "KNI_COMMANDER_SOLAR-BASTION-MARSHAL", second: "KNI_SECOND_OATHBOUND-CASTELLAN", elite: "KNI_ELITE_SKY-LANCE-DRAGOON",
  foot: Array(5).fill("KNI_FOOT_BASTION-MAN-AT-ARMS"),
};
export const DRG: Omit<PlatoonBlueprint, "id" | "side"> = {
  faction: "DRG", commander: "DRG_COMMANDER_RIFTWING-DOMINANT", second: "DRG_SECOND_STORMCLAW-WINGSECOND", elite: "DRG_ELITE_OBSIDIAN-MAW",
  foot: Array(5).fill("DRG_FOOT_SLATEWING-DRAKE"),
};

/** A sworn company: no rank ladder (so no banner privilege) and no faction signature order. */
export const ARC: Omit<PlatoonBlueprint, "id" | "side"> = {
  faction: "ARC", commander: "ARC_COMMANDER_AZURE-SEAL-MAGISTER", second: "ARC_SECOND_WARD-CAPTAIN", elite: "ARC_ELITE_STORMGLASS-WIZARD",
  foot: Array(5).fill("ARC_FOOT_COBALT-LINE-MAGE"),
};

/** A division with no rank ladder and no faction signature order (`platoonOrder: null`). */
export const ANG: Omit<PlatoonBlueprint, "id" | "side"> = {
  faction: "ANG", commander: "ANG_COMMANDER_THRONE-ARCHON", second: "ANG_SECOND_WARDING-SERAPH", elite: "ANG_ELITE_SWORD-OF-THE-SEVENTH-GATE",
  foot: Array(5).fill("ANG_FOOT_LAMPBEARER-CHORISTER"),
};

/** A compact 8-hex blob around (q,r): leader row + foot line. */
export function blob(q: number, r: number): Hex[] {
  return [{ q, r }, { q: q + 1, r }, { q: q + 2, r }, { q, r: r + 1 }, { q: q + 1, r: r + 1 }, { q: q + 2, r: r + 1 }, { q: q + 3, r: r + 1 }, { q: q + 4, r: r + 1 }];
}

export function deploy(b: Battle, id: string, side: string, bp: Omit<PlatoonBlueprint, "id" | "side">, hexes: Hex[], facing: 0 | 1 | 2 | 3 | 4 | 5 = 0) {
  return deployPlatoon(b, { id, side, ...bp }, hexes, facing);
}

/** A holding with unlimited resources, a Research Hall tall enough for `researchIds`' highest tier, and every id in the chain completed in order. */
export function kingdomWithResearch(faction: string, researchIds: string[]): KingdomState {
  const k = newKingdom(reg, faction);
  k.resources = { koku: 9999999, iron: 9999999, timber: 9999999, silver: 9999999 };
  for (let i = 0; i < 7; i++) {
    startUpgrade(reg, k, "KEEP"); tick(reg, k, 1000000);
    startUpgrade(reg, k, "RESEARCH_HALL"); tick(reg, k, 1000000);
  }
  for (const id of researchIds) {
    const started = startResearch(reg, k, id);
    if (!started.ok) throw new Error(`${id}: ${started.reason}`);
    tick(reg, k, 1000000);
  }
  return k;
}
