import type { Registry } from "./data.js";
import type { Battle } from "./state.js";
import type { Terrain, UnitDef } from "./types.js";
import { TERRAIN_RULES } from "./types.js";
import type { Hex } from "./hex.js";
import { hexKey } from "./hex.js";
import type { GeneratedMap } from "./mapgen.js";
import { hexToPixel } from "./mapgen.js";

/**
 * Marching: continuous movement over the same ground the hex rules fight on.
 *
 * The turn-based battle spends movement points to step between hexes. A march spends seconds: a squad is
 * dragged to a point and its units walk there, and the only thing an animator has to do is call `step` with
 * the frame's delta and draw what it finds. Nothing here replaces the hex code — `battle.ts` still owns
 * activations, zones of control and reaction attacks, and it still needs a grid to own them on. This module
 * reads the same generated field and the same `TERRAIN_RULES` costs, so a walk over mud is slow for exactly
 * the reason a hex step over mud is expensive, and the two never drift apart.
 *
 * Everything is deterministic: no clock, no randomness, and iteration only ever over insertion-ordered maps.
 * The same field given the same orders and the same sequence of deltas lands on the same positions.
 */

/** A point in world space. Same units and orientation as `hexToPixel`, so one hex is about 1.73 across. */
export interface Vec2 { x: number; y: number }

/** Tunables from `data/movement/march.json`. Every number a designer would touch lives there. */
export interface MarchRules {
  travelCapSeconds: number;
  referenceMov: number; minPace: number; maxPace: number;
  referenceTerrainCost: number; roadHaste: number; flightIgnoresGround: boolean;
  joinRadius: number; arriveRadius: number;
  formationSpacing: number; formationRingSlots: number;
  sampleStep: number;
  notes?: Record<string, string>;
}

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

/** What an order is for. A Join keeps chasing a body that is itself moving; a March goes to a fixed point. */
export type OrderKind = "March" | "Join";

export interface MarchOrder {
  kind: OrderKind;
  /** Where the unit was pointed. For a Join this is refreshed to wherever the squad now stands. */
  destination: Vec2;
  /** Where it can actually walk to: the destination, or the last point short of ground it cannot enter. */
  target: Vec2;
  /** The squad being joined, for a Join order. */
  squadId: string | null;
  /** Distance left to cover when the order was given, so progress reads against the whole walk. */
  span: number;
  /** Predicted seconds for the walk, already inside the cap. */
  seconds: number;
  elapsed: number;
  /** Speed multiplier that hurries a walk too long for the cap; 1 for anything that already fits. */
  haste: number;
  /** True when impassable ground cut the walk short of where it was pointed. */
  blocked: boolean;
}

export interface MarchUnit {
  id: string; defId: string; side: string;
  pos: Vec2;
  /** Travel direction in radians, x right and y down. Kept while standing so a unit does not snap around. */
  facing: number;
  squadId: string | null;
  order: MarchOrder | null;
}

/** A named body with a leader. Members hold formation slots by their order in `memberIds`, leader first. */
export interface Squad {
  id: string; name: string; side: string;
  leaderId: string;
  memberIds: string[];
  /** Where the squad was last sent, so a unit that joins mid-march falls in at the destination. */
  destination: Vec2 | null;
}

export interface MarchEvent { at: number; type: string; data: Record<string, unknown> }

export interface MarchField {
  readonly reg: Registry;
  readonly rules: MarchRules;
  readonly name: string;
  readonly bounds: Bounds;
  /** The longest crossing. Walking speed is this over the cap, which is where the cap comes from. */
  readonly diagonal: number;
  /** World units per second at reference pace on open ground. */
  readonly speed: number;
  readonly terrain: Map<string, Terrain>;
  readonly units: Map<string, MarchUnit>;
  readonly squads: Map<string, Squad>;
  readonly events: MarchEvent[];
  time: number;
  seq: number;
}

// ---------- world space ----------

/** Hex centre as a world point. */
export const pointOfHex = (h: Hex): Vec2 => hexToPixel(h);

/** The hex a world point falls in: the inverse of `hexToPixel`, rounded through cube coordinates. */
export function hexAtPoint(p: Vec2): Hex {
  const r = p.y / 1.5;
  const q = p.x / Math.sqrt(3) - r / 2;
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

/**
 * Terrain under a point: the terrain of the hex containing it, exactly as `Battle.terrainAt` reads it, and
 * open ground off the edge of the generated blob. The blob's ragged outline is a hex-era artefact — a walk
 * is bounded by the field's extent instead, which is what `clampToField` is for.
 */
export function terrainAt(field: MarchField, p: Vec2): Terrain {
  return field.terrain.get(hexKey(hexAtPoint(p))) ?? "Open";
}

/** Keep a dragged destination on the map. */
export function clampToField(field: MarchField, p: Vec2): Vec2 {
  const b = field.bounds;
  return { x: Math.min(b.maxX, Math.max(b.minX, p.x)), y: Math.min(b.maxY, Math.max(b.minY, p.y)) };
}

// ---------- field ----------

/** Open a march field over a generated map. Terrain is borrowed, not copied out into a second table. */
export function newMarchField(reg: Registry, map: GeneratedMap): MarchField {
  const terrain = new Map<string, Terrain>();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const h of map.hexes) {
    if (h.terrain !== "Open") terrain.set(hexKey(h), h.terrain);
    const p = hexToPixel(h);
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const bounds: Bounds = { minX, minY, maxX, maxY };
  const diagonal = Math.hypot(maxX - minX, maxY - minY);
  const rules = reg.march;
  return {
    reg, rules, name: map.name, bounds, diagonal,
    speed: diagonal / rules.travelCapSeconds,
    terrain, units: new Map(), squads: new Map(), events: [], time: 0, seq: 0,
  };
}

function log(field: MarchField, type: string, data: Record<string, unknown> = {}): void {
  field.events.push({ at: field.time, type, data });
}

/** Put a unit on the field. */
export function enlist(field: MarchField, defId: string, at: Vec2, opts: { id?: string; side?: string; facing?: number } = {}): MarchUnit {
  field.reg.unit(defId); // an unknown definition should fail here, not on the first step
  const u: MarchUnit = {
    id: opts.id ?? `m${++field.seq}`, defId, side: opts.side ?? "A",
    pos: { x: at.x, y: at.y }, facing: opts.facing ?? 0, squadId: null, order: null,
  };
  field.units.set(u.id, u);
  return u;
}

/** Mirror a deployed battle onto the field, so a hex deployment can be marched from where it stands. */
export function enlistFromBattle(field: MarchField, b: Battle): MarchUnit[] {
  const out: MarchUnit[] = [];
  for (const u of b.activeUnits()) out.push(enlist(field, u.defId, pointOfHex(u.pos!), { id: u.uid, side: u.side }));
  return out;
}

export function unitOf(field: MarchField, id: string): MarchUnit {
  const u = field.units.get(id);
  if (!u) throw new Error(`No marching unit ${id}`);
  return u;
}
export function squadOf(field: MarchField, id: string): Squad {
  const s = field.squads.get(id);
  if (!s) throw new Error(`No squad ${id}`);
  return s;
}

/** Form a squad. The leader takes the centre slot and everyone else falls in around it. */
export function formSquad(field: MarchField, opts: { leaderId: string; memberIds?: string[]; id?: string; name?: string }): Squad {
  const leader = unitOf(field, opts.leaderId);
  const ids = [leader.id, ...(opts.memberIds ?? []).filter((m) => m !== leader.id)];
  const s: Squad = {
    id: opts.id ?? `sq${++field.seq}`, name: opts.name ?? `Squad ${field.squads.size + 1}`,
    side: leader.side, leaderId: leader.id, memberIds: ids, destination: null,
  };
  for (const id of ids) unitOf(field, id).squadId = s.id;
  field.squads.set(s.id, s);
  return s;
}

/** Where the squad is right now: its leader. A follower walks at this, not at a slot it has not earned yet. */
export function squadAnchor(field: MarchField, s: Squad): Vec2 {
  const leader = field.units.get(s.leaderId) ?? field.units.get(s.memberIds[0]!);
  return leader ? { x: leader.pos.x, y: leader.pos.y } : { x: 0, y: 0 };
}

/**
 * Formation offset for the nth member. Slot 0 is the leader; then rings of six, twelve, eighteen at one
 * spacing apart, so a squad of any size arrives as a body instead of stacking on one pixel.
 */
export function formationSlot(field: MarchField, index: number): Vec2 {
  if (index <= 0) return { x: 0, y: 0 };
  const per = field.rules.formationRingSlots;
  let ring = 1, first = 1;
  while (index >= first + per * ring) { first += per * ring; ring++; }
  const angle = (2 * Math.PI * (index - first)) / (per * ring);
  const radius = ring * field.rules.formationSpacing;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

// ---------- pace ----------

/** How fast this definition walks relative to the reference, from its MOV. */
export function soloPace(field: MarchField, defId: string): number {
  const r = field.rules;
  return Math.min(r.maxPace, Math.max(r.minPace, field.reg.unit(defId).mov / r.referenceMov));
}

/** A squad walks at its slowest member's pace: a body does not leave its heavy behind. */
export function paceOf(field: MarchField, u: MarchUnit): number {
  const s = u.squadId ? field.squads.get(u.squadId) : undefined;
  if (!s) return soloPace(field, u.defId);
  let slowest = Infinity;
  for (const id of s.memberIds) { const m = field.units.get(id); if (m) slowest = Math.min(slowest, soloPace(field, m.defId)); }
  return Number.isFinite(slowest) ? slowest : soloPace(field, u.defId);
}

/**
 * How much a terrain multiplies walking speed, or null where the ground is closed to this unit. The costs
 * come from `TERRAIN_RULES`, so mud and forest at cost 2 walk at half pace and rock at 5 at a fifth; only
 * the road bonus is march-specific, because a hex step prices a road the same as a field and a march does not.
 */
export function terrainSpeedFactor(field: MarchField, def: UnitDef, t: Terrain): number | null {
  const rule = TERRAIN_RULES[t];
  const cost = def.flying ? rule.costFlying : def.roles.includes("Cavalry") ? rule.costCavalry : rule.costFoot;
  if (cost === null) return null;
  if (def.flying && field.rules.flightIgnoresGround) return 1;
  let f = field.rules.referenceTerrainCost / cost;
  if (t === "Road") f *= field.rules.roadHaste;
  return f;
}

// ---------- planning ----------

interface Plan { target: Vec2; span: number; seconds: number; haste: number; blocked: boolean }

/**
 * Work a straight walk out ahead of time: sample the ground along it, add up the seconds, and stop at the
 * first ground the unit cannot enter. A walk longer than the cap is hurried by `haste` so it still lands
 * inside it, which is what makes the cap a promise about the longest crossing rather than a hope.
 */
function planWalk(field: MarchField, def: UnitDef, pace: number, from: Vec2, to: Vec2): Plan {
  const dx = to.x - from.x, dy = to.y - from.y;
  const span = Math.hypot(dx, dy);
  if (span <= 0) return { target: { x: to.x, y: to.y }, span: 0, seconds: 0, haste: 1, blocked: false };
  const ux = dx / span, uy = dy / span;
  const steps = Math.max(1, Math.ceil(span / field.rules.sampleStep));
  const segment = span / steps;
  let walked = 0, seconds = 0;
  for (let i = 0; i < steps; i++) {
    const mid = walked + segment / 2;
    const factor = terrainSpeedFactor(field, def, terrainAt(field, { x: from.x + ux * mid, y: from.y + uy * mid }));
    if (factor === null) break;
    seconds += segment / (field.speed * pace * factor);
    walked += segment;
  }
  const blocked = walked < span - 1e-9;
  const capped = Math.min(seconds, field.rules.travelCapSeconds);
  return {
    target: blocked ? { x: from.x + ux * walked, y: from.y + uy * walked } : { x: to.x, y: to.y },
    span: walked, seconds: capped, haste: capped > 0 ? seconds / capped : 1, blocked,
  };
}

/** Seconds this unit needs to walk between two points, terrain and pace included, never above the cap. */
export function travelSeconds(field: MarchField, from: Vec2, to: Vec2, unit: MarchUnit | string): number {
  const u = typeof unit === "string" ? unitOf(field, unit) : unit;
  return planWalk(field, field.reg.unit(u.defId), paceOf(field, u), from, to).seconds;
}

/** Seconds before the whole squad is in place: the last member to arrive decides. */
export function squadTravelSeconds(field: MarchField, squadId: string, to: Vec2): number {
  const s = squadOf(field, squadId);
  const dest = clampToField(field, to);
  let worst = 0;
  for (let i = 0; i < s.memberIds.length; i++) {
    const m = field.units.get(s.memberIds[i]!);
    if (!m) continue;
    const slot = formationSlot(field, i);
    worst = Math.max(worst, travelSeconds(field, m.pos, { x: dest.x + slot.x, y: dest.y + slot.y }, m));
  }
  return worst;
}

function give(field: MarchField, u: MarchUnit, kind: OrderKind, destination: Vec2, squadId: string | null): MarchOrder | null {
  const plan = planWalk(field, field.reg.unit(u.defId), paceOf(field, u), u.pos, destination);
  if (plan.span <= field.rules.arriveRadius) {
    u.order = null;
    if (plan.blocked) log(field, "MarchBlocked", { unit: u.id, destination });
    return null;
  }
  u.order = {
    kind, destination: { x: destination.x, y: destination.y }, target: plan.target, squadId,
    span: plan.span, seconds: plan.seconds, elapsed: 0, haste: plan.haste, blocked: plan.blocked,
  };
  u.facing = Math.atan2(plan.target.y - u.pos.y, plan.target.x - u.pos.x);
  return u.order;
}

/** Re-time an order in flight from where the unit has got to. Membership changes the pace, so joining re-times. */
function replan(field: MarchField, u: MarchUnit): void {
  const o = u.order;
  if (!o) return;
  // seconds is always the prediction from the last plan, so the clock on it starts again here
  const plan = planWalk(field, field.reg.unit(u.defId), paceOf(field, u), u.pos, o.destination);
  o.target = plan.target; o.seconds = plan.seconds; o.haste = plan.haste; o.blocked = plan.blocked;
  o.elapsed = 0;
}

// ---------- orders ----------

/** Send one unit to a point. Any order it was already walking is replaced where it stands. */
export function orderUnit(field: MarchField, unitId: string, to: Vec2): MarchOrder | null {
  const u = unitOf(field, unitId);
  const dest = clampToField(field, to);
  const o = give(field, u, "March", dest, null);
  log(field, "MarchOrdered", { unit: u.id, to: dest, seconds: o?.seconds ?? 0 });
  return o;
}

/** Send a squad to a point. Every member walks to its own slot around it, so they arrive as a body. */
export function orderSquad(field: MarchField, squadId: string, to: Vec2): void {
  const s = squadOf(field, squadId);
  const dest = clampToField(field, to);
  s.destination = dest;
  for (let i = 0; i < s.memberIds.length; i++) {
    const m = field.units.get(s.memberIds[i]!);
    if (!m) continue;
    const slot = formationSlot(field, i);
    give(field, m, "March", { x: dest.x + slot.x, y: dest.y + slot.y }, null);
  }
  log(field, "SquadOrdered", { squad: s.id, to: dest, members: s.memberIds.length });
}

/**
 * Send a loose unit to join a squad. It only walks at the body for now — the join itself happens inside
 * `step`, once it is actually close enough, because walking there is the whole point of the order.
 */
export function followSquad(field: MarchField, unitId: string, squadId: string): MarchOrder | null {
  const u = unitOf(field, unitId);
  const s = squadOf(field, squadId);
  if (u.squadId === s.id) return u.order;
  const o = give(field, u, "Join", squadAnchor(field, s), s.id);
  log(field, "FollowOrdered", { unit: u.id, squad: s.id });
  return o;
}

/** Stop where you are. */
export function halt(field: MarchField, unitId: string): void {
  const u = unitOf(field, unitId);
  if (!u.order) return;
  u.order = null;
  log(field, "Halted", { unit: u.id });
}

// ---------- stepping ----------

/** Advance the whole field by a fixed timestep. */
export function step(field: MarchField, dt: number): void {
  if (dt <= 0) return;
  field.time += dt;
  for (const u of field.units.values()) advance(field, u, dt);
  for (const u of field.units.values()) if (u.order && u.order.kind === "Join") tryJoin(field, u);
}

function advance(field: MarchField, u: MarchUnit, dt: number): void {
  const o = u.order;
  if (!o) return;
  if (o.kind === "Join") { chase(field, u, o); if (!u.order) return; }
  const dx = o.target.x - u.pos.x, dy = o.target.y - u.pos.y;
  const left = Math.hypot(dx, dy);
  o.elapsed += dt;
  if (left <= field.rules.arriveRadius) {
    // the plan ran out at the edge of something impassable rather than at the destination: go around it
    if (o.blocked && steerAround(field, u, o, dt)) { replan(field, u); return; }
    arrive(field, u, o); return;
  }
  const factor = terrainSpeedFactor(field, field.reg.unit(u.defId), terrainAt(field, u.pos));
  if (factor === null) { o.blocked = true; arrive(field, u, o); return; } // walked into ground it cannot cross
  const travel = field.speed * paceOf(field, u) * factor * o.haste * dt;
  u.facing = Math.atan2(dy, dx);
  if (travel >= left) { u.pos = { x: o.target.x, y: o.target.y }; arrive(field, u, o); return; }
  u.pos = { x: u.pos.x + (dx / left) * travel, y: u.pos.y + (dy / left) * travel };
}

/**
 * Walk around what is in the way.
 *
 * A plan is a straight line, so ground the unit cannot cross truncates it and leaves the unit standing
 * at the edge — which for a follower means standing four metres from a squad it will never join because
 * a trench runs between them. Rather than a pathfinder, the unit fans out from the heading it wanted and
 * takes the first passable one that still brings it closer: enough to round a trench, a river or a spur,
 * and honest about being nothing more than that. A pocket it cannot see out of will still hold it.
 */
function steerAround(field: MarchField, u: MarchUnit, o: MarchOrder, dt: number): boolean {
  const d = field.reg.unit(u.defId);
  const here = terrainSpeedFactor(field, d, terrainAt(field, u.pos));
  if (here === null) return false;                       // already standing somewhere it cannot be
  const want = Math.atan2(o.destination.y - u.pos.y, o.destination.x - u.pos.x);
  const reach = Math.hypot(o.destination.x - u.pos.x, o.destination.y - u.pos.y);
  const stride = field.speed * paceOf(field, u) * here * o.haste * dt;
  if (stride <= 0) return false;
  // fanned both ways, nearest heading first, so the unit hugs the obstacle rather than turning about
  for (const off of STEER_FAN) {
    const a = want + off;
    const probe = clampToField(field, { x: u.pos.x + Math.cos(a) * stride, y: u.pos.y + Math.sin(a) * stride });
    if (terrainSpeedFactor(field, d, terrainAt(field, probe)) === null) continue;
    if (Math.hypot(o.destination.x - probe.x, o.destination.y - probe.y) >= reach) continue;
    u.pos = probe;
    u.facing = a;
    return true;
  }
  return false;
}

/** Headings tried when a walk is blocked, in order: a little aside, then a lot, each way. */
const STEER_FAN = [0.45, -0.45, 0.9, -0.9, 1.35, -1.35] as const;

function arrive(field: MarchField, u: MarchUnit, o: MarchOrder): void {
  if (o.kind === "Join") return; // a follower that has caught up is joined below, not stopped here
  u.order = null;
  log(field, "Arrived", { unit: u.id, at: { x: u.pos.x, y: u.pos.y }, blocked: o.blocked });
}

/** A Join chases a body that is itself walking, so the target is refreshed as the squad moves. */
function chase(field: MarchField, u: MarchUnit, o: MarchOrder): void {
  const s = o.squadId ? field.squads.get(o.squadId) : undefined;
  if (!s) { u.order = null; return; }
  const anchor = squadAnchor(field, s);
  if (Math.hypot(anchor.x - o.destination.x, anchor.y - o.destination.y) <= field.rules.arriveRadius) return;
  o.destination = anchor;
  replan(field, u);
}

function tryJoin(field: MarchField, u: MarchUnit): void {
  const o = u.order!;
  const s = o.squadId ? field.squads.get(o.squadId) : undefined;
  if (!s) { u.order = null; return; }
  const anchor = squadAnchor(field, s);
  if (Math.hypot(anchor.x - u.pos.x, anchor.y - u.pos.y) > field.rules.joinRadius) return;
  s.memberIds.push(u.id);
  u.squadId = s.id;
  const slot = formationSlot(field, s.memberIds.length - 1);
  const base = s.destination ?? anchor;
  give(field, u, "March", clampToField(field, { x: base.x + slot.x, y: base.y + slot.y }), null);
  // the newcomer may be the heaviest thing in the squad, and the rest have to wait for it from here on
  for (const id of s.memberIds) { const m = field.units.get(id); if (m && m !== u) replan(field, m); }
  log(field, "Joined", { unit: u.id, squad: s.id, slot: s.memberIds.length - 1 });
}

// ---------- what an animator reads ----------

export interface MarchPose {
  id: string; defId: string; side: string; squadId: string | null;
  pos: Vec2;
  /** Radians, x right and y down. */
  facing: number;
  walking: boolean;
  /** 0..1 along the current order, 1 while standing. */
  progress: number;
  secondsLeft: number;
  terrain: Terrain;
}

export function poseOf(field: MarchField, unitId: string): MarchPose {
  const u = unitOf(field, unitId);
  const o = u.order;
  const left = o ? Math.hypot(o.target.x - u.pos.x, o.target.y - u.pos.y) : 0;
  return {
    id: u.id, defId: u.defId, side: u.side, squadId: u.squadId,
    pos: { x: u.pos.x, y: u.pos.y }, facing: u.facing, walking: !!o,
    progress: o && o.span > 0 ? Math.min(1, Math.max(0, 1 - left / o.span)) : 1,
    secondsLeft: o ? Math.max(0, o.seconds - o.elapsed) : 0,
    terrain: terrainAt(field, u.pos),
  };
}

export function poses(field: MarchField): MarchPose[] {
  return [...field.units.keys()].map((id) => poseOf(field, id));
}
