import type { Battle } from "./state.js";
import type { UnitState, PlatoonState, Modifier } from "./types.js";
import { platoonMorale, platoonMembers, changeMorale } from "./morale.js";
import { applyEffect } from "./effects.js";

/** Aura value by rank: commanders +100, seconds +50 (smaller aura while commander is active). Strongest eligible aura only. */
export function commandBonus(b: Battle, u: UnitState, stat: "ATK" | "DEF"): Modifier | null {
  if (!u.platoonId || u.isClone) return null;
  const p = b.platoon(u.platoonId);
  const candidates: Array<{ src: string; v: number }> = [];
  const consider = (uid: string | null, v: number, label: string) => {
    if (!uid || uid === u.uid) return;
    const l = b.units.get(uid);
    if (!l || l.defeated || !l.pos) return;
    const radius = b.def(l).commandRadius ?? 0;
    if (b.distance(l, u) <= radius) candidates.push({ src: `${label} aura (${b.def(l).name})`, v });
  };
  consider(p.commanderUid, 100, "Commander");
  consider(p.secondUid, 50, "Second");
  if (!candidates.length) return null;
  const best = candidates.reduce((a, c) => (c.v > a.v ? c : a));
  return { source: best.src, stat, value: best.v };
}

/** Called when any unit is defeated: morale effects and marks platoon for succession. */
export function onUnitDefeated(b: Battle, u: UnitState): void {
  if (!u.platoonId || u.isClone) return;
  const p = b.platoon(u.platoonId);
  const d = b.def(u);
  if (p.commanderUid === u.uid) {
    platoonMorale(b, p, -20, "Commander defeated");
    p.pendingSuccession = true;
    p.continuityRoundsLeft = b.reg.rules.standardPlatoon.continuityRounds;
    b.log("CommanderFallen", { platoon: p.id, uid: u.uid });
  } else if (p.secondUid === u.uid) {
    platoonMorale(b, p, -10, "Second defeated before commander");
  } else if (p.eliteUid === u.uid) {
    platoonMorale(b, p, -10, "Elite defeated");
  }
  void d;
  // below half strength check
  const total = platoonMembers(p).length;
  const alive = platoonMembers(p).filter((id) => { const x = b.units.get(id); return x && !x.defeated; }).length;
  if (alive * 2 < total && alive + 1 >= total / 2) platoonMorale(b, p, -15, "Platoon below half strength");
}

/**
 * Succession runs in the Command Phase. The assigned second promotes, receives the commander's basic order set
 * (represented by inheriting the Commander slot and aura), and retains its own unique ability. Succession abilities fire.
 */
export function resolveSuccession(b: Battle, p: PlatoonState): boolean {
  if (!p.pendingSuccession) { if (p.continuityRoundsLeft > 0 && p.commanderUid && !b.units.get(p.commanderUid)?.defeated) p.continuityRoundsLeft = 0; return false; }
  p.pendingSuccession = false;
  const second = p.secondUid ? b.units.get(p.secondUid) : undefined;
  if (!second || second.defeated || !second.pos) {
    p.continuityRoundsLeft = 0;
    b.log("SuccessionFailed", { platoon: p.id, reason: "No living second-in-command" });
    return false;
  }
  p.commanderUid = second.uid;
  p.secondUid = null;
  second.promotedFromSecond = true;
  p.continuityRoundsLeft = 0;
  b.log("Succession", { platoon: p.id, promoted: second.uid, name: b.def(second).name });
  // fire Succession-category abilities of the promoted unit
  for (const id of b.def(second).actives) {
    const a = b.reg.ability(id);
    if (a.category === "Succession") applyEffect(b, second, a, { platoon: p });
  }
  return true;
}

/** Promoted seconds gain the commander's radius for aura purposes. */
export function effectiveCommandRadius(b: Battle, u: UnitState): number {
  const d = b.def(u);
  return d.commandRadius ?? 0;
}

/** Rally action: +10 morale to allies within 2 hexes (requires Commander/Second/Support role). */
export function rally(b: Battle, u: UnitState): boolean {
  const d = b.def(u);
  if (!d.roles.some((r) => r === "Commander" || r === "Second" || r === "Support") && !u.promotedFromSecond) return false;
  for (const a of b.activeUnits(u.side)) if (a.uid !== u.uid && b.distance(u, a) <= 2) changeMorale(b, a, 10, "Rally");
  b.log("Rally", { uid: u.uid });
  return true;
}
