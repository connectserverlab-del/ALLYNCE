import type { Battle } from "./state.js";
import type { UnitState } from "./types.js";
import type { Hex } from "./hex.js";
import { hexNeighbors, hexDistance } from "./hex.js";
import { changeMorale } from "./morale.js";
import { effectiveRange } from "./weather.js";

export type PortalState = "Telegraph" | "Open" | "Destroyed" | "Captured";
export interface QueuedReinforcement { defId: string; cost: number; platoonId: string | null }
export interface Portal {
  id: string; side: string; pos: Hex; hp: number; def: number; capacity: number; cooldown: number; cooldownLeft: number;
  state: PortalState; telegraphLeft: number; queue: QueuedReinforcement[]; captureProgress: number; captureBy: string | null;
}

export function callPortal(b: Battle, side: string, pos: Hex, opts: { id?: string; hp?: number; def?: number; capacity?: number; cooldown?: number; telegraph?: number; keeperUid?: string } = {}): Portal | null {
  if (!b.isFree(pos)) return null;
  // cannot open inside an enemy zone of control
  for (const h of hexNeighbors(pos)) { const u = b.unitAt(h); if (u && u.side !== side && !u.isClone) return null; }
  const keeperBonus = opts.keeperUid ? 1 : 0;
  const p: Portal = {
    id: opts.id ?? b.newUid("portal"), side, pos, hp: opts.hp ?? 1200, def: opts.def ?? 1200,
    capacity: (opts.capacity ?? 1) + keeperBonus, cooldown: Math.max(1, (opts.cooldown ?? 2) - keeperBonus), cooldownLeft: 0,
    state: opts.telegraph === 0 ? "Open" : "Telegraph", telegraphLeft: opts.telegraph ?? 1, queue: [], captureProgress: 0, captureBy: null,
  };
  b.portals.set(p.id, p);
  b.log("PortalCalled", { portal: p.id, side, pos });
  return p;
}

/** Queue a reinforcement, paying Reserve Points now. */
export function queueReinforcement(b: Battle, portal: Portal, defId: string, platoonId: string | null = null): boolean {
  const side = b.sides.get(portal.side)!;
  const cost = b.reg.unit(defId).capacityCost;
  if (portal.state === "Destroyed" || portal.state === "Captured" || side.reservePoints < cost) return false;
  side.reservePoints -= cost;
  portal.queue.push({ defId, cost, platoonId });
  b.log("ReinforcementQueued", { portal: portal.id, defId, cost });
  return true;
}

/** Objective Phase: telegraph -> open; then spawn up to `capacity` queued units into adjacent empty hexes. */
export function tickPortal(b: Battle, p: Portal): UnitState[] {
  const arrived: UnitState[] = [];
  if (p.state === "Telegraph") { p.telegraphLeft--; if (p.telegraphLeft <= 0) { p.state = "Open"; b.log("PortalOpened", { portal: p.id }); } return arrived; }
  if (p.state !== "Open") return arrived;
  if (p.cooldownLeft > 0) { p.cooldownLeft--; return arrived; }
  let n = 0;
  while (p.queue.length && n < p.capacity) {
    const spot = hexNeighbors(p.pos).find((h) => b.isFree(h));
    if (!spot) { b.log("PortalBlocked", { portal: p.id, queued: p.queue.length }); break; } // stays queued
    const q = p.queue.shift()!;
    const u = b.spawn(q.defId, p.side, spot, { platoonId: q.platoonId, uidPrefix: "rf" });
    if (q.platoonId) { const pl = b.platoon(q.platoonId); if (b.def(u).roles.includes("FootSoldier")) pl.footUids.push(u.uid); }
    arrived.push(u); n++;
    b.log("ReinforcementArrived", { portal: p.id, uid: u.uid, defId: q.defId });
  }
  if (n > 0) { p.cooldownLeft = p.cooldown; for (const a of b.activeUnits(p.side)) if (hexDistance(a.pos!, p.pos) <= 3) changeMorale(b, a, 5, "Reinforcements arrived"); }
  return arrived;
}

export function attackPortal(b: Battle, attacker: UnitState, p: Portal, finalAtk: number): boolean {
  if (!attacker.pos || hexDistance(attacker.pos, p.pos) > effectiveRange(b, attacker)) return false;
  const dmg = Math.max(100, finalAtk - p.def);
  p.hp -= dmg;
  attacker.attackedThisActivation = true;
  b.log("PortalAttacked", { portal: p.id, by: attacker.uid, damage: dmg, hp: p.hp });
  if (p.hp <= 0) destroyPortal(b, p, attacker.uid);
  return true;
}

/** Destroying cancels queued units and refunds half their Reserve cost. */
export function destroyPortal(b: Battle, p: Portal, by: string): void {
  p.state = "Destroyed";
  const side = b.sides.get(p.side)!;
  const refund = p.queue.reduce((s, q) => s + Math.floor(q.cost / 2), 0);
  side.reservePoints += refund;
  p.queue = [];
  b.log("PortalDestroyed", { portal: p.id, by, refund });
}

/** Capturing takes two uninterrupted actions by an eligible specialist (PortalKeeper or Support). */
export function captureStep(b: Battle, u: UnitState, p: Portal): boolean {
  const d = b.def(u);
  if (!u.pos || hexDistance(u.pos, p.pos) > 1 || u.side === p.side) return false;
  if (!d.roles.includes("PortalKeeper") && !d.roles.includes("Support")) return false;
  if (p.captureBy && p.captureBy !== u.uid) p.captureProgress = 0; // interrupted by a different capturer
  p.captureBy = u.uid; p.captureProgress++;
  b.log("PortalCaptureStep", { portal: p.id, by: u.uid, progress: p.captureProgress });
  if (p.captureProgress >= 2) {
    p.state = "Open"; p.side = u.side; p.queue = []; p.captureProgress = 0; p.captureBy = null;
    b.log("PortalCaptured", { portal: p.id, newSide: u.side });
  }
  return true;
}

/** If the capturer moved away or was defeated, progress resets. Called at End Phase. */
export function checkCaptureInterrupt(b: Battle, p: Portal): void {
  if (!p.captureBy) return;
  const u = b.units.get(p.captureBy);
  if (!u || u.defeated || !u.pos || hexDistance(u.pos, p.pos) > 1) { p.captureProgress = 0; p.captureBy = null; b.log("PortalCaptureInterrupted", { portal: p.id }); }
}
