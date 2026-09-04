import { Battle } from "../src/state.js";
import { BattleController } from "../src/battle.js";
import { loadRegistry } from "../src/data.js";
import { deployPlatoon } from "../src/deploy.js";
import type { PlatoonBlueprint } from "../src/composition.js";
import type { Hex } from "../src/hex.js";

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

/** A compact 8-hex blob around (q,r): leader row + foot line. */
export function blob(q: number, r: number): Hex[] {
  return [{ q, r }, { q: q + 1, r }, { q: q + 2, r }, { q, r: r + 1 }, { q: q + 1, r: r + 1 }, { q: q + 2, r: r + 1 }, { q: q + 3, r: r + 1 }, { q: q + 4, r: r + 1 }];
}

export function deploy(b: Battle, id: string, side: string, bp: Omit<PlatoonBlueprint, "id" | "side">, hexes: Hex[], facing: 0 | 1 | 2 | 3 | 4 | 5 = 0) {
  return deployPlatoon(b, { id, side, ...bp }, hexes, facing);
}
