import { Battle } from "./state.js";
import type { Hex } from "./hex.js";
import type { PlatoonBlueprint } from "./composition.js";
import type { PlatoonState } from "./types.js";

/** Deploy a legal platoon onto listed hexes (commander, second, elite, then foot soldiers in order). */
export function deployPlatoon(b: Battle, bp: PlatoonBlueprint, hexes: Hex[], facing: 0 | 1 | 2 | 3 | 4 | 5 = 0): PlatoonState {
  if (hexes.length < 8) throw new Error("Need 8 hexes for a standard platoon");
  const p: PlatoonState = { id: bp.id, side: bp.side, faction: bp.faction, commanderUid: null, secondUid: null, eliteUid: null, footUids: [], orderUsedThisRound: false, continuityRoundsLeft: 0, pendingSuccession: false, markedTarget: null };
  b.platoons.set(p.id, p);
  p.commanderUid = b.spawn(bp.commander, bp.side, hexes[0]!, { platoonId: p.id, facing }).uid;
  p.secondUid = b.spawn(bp.second, bp.side, hexes[1]!, { platoonId: p.id, facing }).uid;
  p.eliteUid = b.spawn(bp.elite, bp.side, hexes[2]!, { platoonId: p.id, facing }).uid;
  bp.foot.forEach((f, i) => p.footUids.push(b.spawn(f, bp.side, hexes[3 + i]!, { platoonId: p.id, facing }).uid));
  b.log("PlatoonDeployed", { platoon: p.id, side: bp.side });
  return p;
}
