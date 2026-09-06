import { describe, it, expect } from "vitest";
import { loadRegistry } from "../src/data.js";
import type { GeneratedMap, MapHex } from "../src/mapgen.js";
import type { Terrain } from "../src/types.js";
import {
  newMarchField, enlist, enlistFromBattle, formSquad, orderUnit, orderSquad, followSquad, halt, step,
  travelSeconds, squadTravelSeconds, poseOf, poses, hexAtPoint, pointOfHex, terrainAt, soloPace, formationSlot,
  type MarchField, type Vec2,
} from "../src/march.js";
import { newBattle, deploy, blob, SAM } from "./helpers.js";

const reg = loadRegistry();

const REF = "SAM_LORD_ASHFALL-DAIMYO";            // MOV 5, the reference pace
const SLOW = "KNI_FOOT_BASTION-MAN-AT-ARMS";      // MOV 3
const HEAVY = "KNI_SIEGE_BASTION-BOMBARD";        // MOV 2, the thing a squad waits for
const FLIER = "ANG_FOOT_LAMPBEARER-CHORISTER";    // MOV 5, wings
const CAV = "SAM_CAVALRY_CRIMSON-UMAMAWARI-LANCER"; // MOV 7, and no way into a trench

const W = 30, H = 20;

/** A rectangular field laid out the way the generator lays one out, with a painter for bands of other ground. */
function testField(paint?: (q: number, r: number) => Terrain | undefined): MarchField {
  const hexes: MapHex[] = [];
  for (let r = 0; r < H; r++) for (let q = -Math.floor(r / 2); q < W - Math.floor(r / 2); q++) hexes.push({ q, r, terrain: paint?.(q, r) ?? "Open", elevation: 1 });
  const map: GeneratedMap = {
    name: "Proving Ground", seed: 1, width: W, height: H, hexes,
    deployZones: { A: [], B: [] }, anchors: { A: { q: 0, r: 0 }, B: { q: 0, r: 0 } }, features: [],
  };
  return newMarchField(reg, map);
}

const band = (from: number, to: number, t: Terrain) => (_q: number, r: number) => (r >= from && r <= to ? t : undefined);
/** A band with a way round it: rows `from`..`to` are painted only west of the `openFrom` column. */
const wall = (from: number, to: number, t: Terrain, openFrom: number) =>
  (q: number, r: number) => (r >= from && r <= to && q + Math.floor(r / 2) < openFrom ? t : undefined);
const corner = (f: MarchField): [Vec2, Vec2] => [{ x: f.bounds.minX, y: f.bounds.minY }, { x: f.bounds.maxX, y: f.bounds.maxY }];
/** Walk the field with a fixed timestep, up to `seconds`, stopping as soon as `until` is true. */
function run(f: MarchField, seconds: number, dt = 0.1, until?: () => boolean): number {
  let t = 0;
  while (t < seconds - 1e-9) { if (until?.()) break; step(f, dt); t += dt; }
  return t;
}

describe("marching", () => {
  it("puts a point on the same ground the hex map does", () => {
    const f = testField(band(5, 6, "Mud"));
    for (const h of [{ q: 0, r: 0 }, { q: 4, r: 5 }, { q: -3, r: 7 }]) expect(hexAtPoint(pointOfHex(h))).toEqual(h);
    expect(terrainAt(f, pointOfHex({ q: 4, r: 5 }))).toBe("Mud");
    expect(terrainAt(f, pointOfHex({ q: 4, r: 8 }))).toBe("Open");
  });

  it("scales travel time with distance and caps the longest crossing", () => {
    const f = testField();
    const [a, b] = corner(f);
    const u = enlist(f, REF, a);
    const half = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    expect(travelSeconds(f, a, b, u)).toBeCloseTo(f.rules.travelCapSeconds, 6);
    expect(travelSeconds(f, a, half, u)).toBeCloseTo(f.rules.travelCapSeconds / 2, 6);
    expect(travelSeconds(f, a, { x: a.x + (b.x - a.x) / 4, y: a.y + (b.y - a.y) / 4 }, u)).toBeCloseTo(f.rules.travelCapSeconds / 4, 6);
    // nothing on any ground at any pace is ever allowed past the cap
    const heavy = enlist(f, HEAVY, a);
    const slow = enlist(f, SLOW, a);
    for (const x of [u, heavy, slow]) expect(travelSeconds(f, a, b, x)).toBeLessThanOrEqual(f.rules.travelCapSeconds + 1e-9);
    expect(travelSeconds(f, a, b, heavy)).toBeCloseTo(f.rules.travelCapSeconds, 6);
  });

  it("walks the longest crossing in exactly the cap and no more", () => {
    const f = testField();
    const [a, b] = corner(f);
    const u = enlist(f, REF, a);
    orderUnit(f, u.id, b);
    run(f, f.rules.travelCapSeconds - 1);
    expect(poseOf(f, u.id).walking).toBe(true);
    run(f, 1.2);
    expect(poseOf(f, u.id).walking).toBe(false);
    expect(u.pos.x).toBeCloseTo(b.x, 6);
    expect(u.pos.y).toBeCloseTo(b.y, 6);
    // a unit far below the reference pace is hurried rather than allowed to run over the cap
    const heavy = enlist(f, HEAVY, a);
    orderUnit(f, heavy.id, b);
    const took = run(f, 3 * f.rules.travelCapSeconds, 0.1, () => !heavy.order);
    expect(heavy.order).toBeNull();
    expect(took).toBeLessThanOrEqual(f.rules.travelCapSeconds + 0.2);
    expect(took).toBeGreaterThan(f.rules.travelCapSeconds - 1);
  });

  it("lets terrain change the pace", () => {
    const open = testField(), mud = testField(band(8, 12, "Mud")), road = testField(band(8, 12, "Road"));
    const from = { x: 10, y: 0 }, to = { x: 10, y: open.bounds.maxY };
    const seconds = (f: MarchField, defId: string) => travelSeconds(f, from, to, enlist(f, defId, from));
    expect(seconds(mud, REF)).toBeGreaterThan(seconds(open, REF) * 1.15);
    expect(seconds(road, REF)).toBeLessThan(seconds(open, REF) * 0.95);
    // wings read only whether the ground is closed to them, never how rough it is
    expect(seconds(mud, FLIER)).toBeCloseTo(seconds(open, FLIER), 6);
    // and a faster definition is faster over the same ground
    expect(soloPace(open, REF)).toBeGreaterThan(soloPace(open, SLOW));
    expect(seconds(open, SLOW)).toBeGreaterThan(seconds(open, REF));
  });

  it("stops at ground it cannot enter instead of wading in", () => {
    const f = testField(band(9, 11, "Water"));
    const u = enlist(f, REF, { x: 10, y: 0 });
    const o = orderUnit(f, u.id, { x: 10, y: f.bounds.maxY })!;
    expect(o.blocked).toBe(true);
    run(f, 60, 0.1, () => !u.order);
    expect(u.pos.y).toBeLessThan(1.5 * 9);
    expect(f.events.some((e) => e.type === "Arrived" && e.data.blocked === true)).toBe(true);
  });

  it("moves a squad as a body at its slowest member's pace", () => {
    const f = testField();
    const arrivedAt = (id: string) => f.events.find((e) => e.type === "Arrived" && e.data.unit === id)!.at;
    const lead = enlist(f, REF, { x: 6, y: 6 });
    const mate = enlist(f, REF, { x: 4, y: 6 });
    const gun = enlist(f, HEAVY, { x: 5, y: 8 });
    const sq = formSquad(f, { leaderId: lead.id, memberIds: [mate.id, gun.id], name: "Vanguard" });
    const to = { x: 20, y: 16 };
    // the leader could outrun the battery alone, but as a squad it does not
    const alone = travelSeconds(f, lead.pos, to, enlist(f, REF, lead.pos));
    orderSquad(f, sq.id, to);
    expect(lead.order!.seconds).toBeGreaterThan(alone * 1.5);
    expect(squadTravelSeconds(f, sq.id, to)).toBeGreaterThanOrEqual(gun.order!.seconds - 1e-9);

    run(f, 120, 0.1, () => !lead.order && !mate.order && !gun.order);
    // every member ends on its own slot around the point, not stacked on it
    for (let i = 0; i < sq.memberIds.length; i++) {
      const m = f.units.get(sq.memberIds[i]!)!;
      const slot = formationSlot(f, i);
      expect(m.order).toBeNull();
      expect(Math.hypot(m.pos.x - to.x - slot.x, m.pos.y - to.y - slot.y)).toBeLessThan(f.rules.arriveRadius);
    }
    expect(Math.hypot(lead.pos.x - mate.pos.x, lead.pos.y - mate.pos.y)).toBeGreaterThan(f.rules.formationSpacing * 0.9);
    // and they land as a body: the battery is not still crossing the field when the leader is done
    const times = [lead, mate, gun].map((m) => arrivedAt(m.id));
    expect(Math.max(...times) - Math.min(...times)).toBeLessThan(Math.max(...times) * 0.25);
  });

  it("joins a follower to a squad only once it has walked into the radius", () => {
    const f = testField();
    const lead = enlist(f, REF, { x: 8, y: 8 });
    const sq = formSquad(f, { leaderId: lead.id });
    const loose = enlist(f, REF, { x: 30, y: 20 });
    followSquad(f, loose.id, sq.id);
    expect(loose.squadId).toBeNull();

    let joinedAt = -1;
    for (let i = 0; i < 2000 && joinedAt < 0; i++) {
      const before = Math.hypot(loose.pos.x - lead.pos.x, loose.pos.y - lead.pos.y);
      step(f, 0.05);
      if (loose.squadId) joinedAt = before;
      else expect(before).toBeGreaterThan(f.rules.joinRadius);
    }
    expect(joinedAt).toBeGreaterThan(0);
    expect(sq.memberIds).toContain(loose.id);
    expect(f.events.some((e) => e.type === "Joined" && e.data.unit === loose.id)).toBe(true);
    // and from then on it holds a formation slot instead of standing on the leader
    run(f, 30, 0.1, () => !loose.order);
    const gap = Math.hypot(loose.pos.x - lead.pos.x, loose.pos.y - lead.pos.y);
    expect(gap).toBeGreaterThan(f.rules.formationSpacing * 0.9);
    expect(gap).toBeLessThan(f.rules.formationSpacing * 2);
  });


  it("walks a follower around ground its own kind cannot cross", () => {
    // a trench is two movement points to a foot soldier and no way at all to a rider
    const f = testField(wall(8, 10, "Trench", 24));
    const lead = enlist(f, REF, { x: 8, y: 21 });
    const sq = formSquad(f, { leaderId: lead.id });
    const rider = enlist(f, CAV, { x: 8, y: 3 });
    const straight = Math.hypot(lead.pos.x - rider.pos.x, lead.pos.y - rider.pos.y);

    const o = followSquad(f, rider.id, sq.id)!;
    expect(o.routed).toBe(true);
    expect(o.blocked).toBe(false);
    expect(o.legs.length).toBeGreaterThan(1);
    expect(o.span).toBeGreaterThan(straight * 2);          // the long way round is genuinely long
    expect(o.seconds).toBeLessThanOrEqual(f.rules.travelCapSeconds);

    let trenched = 0;
    for (let i = 0; i < 3000 && !rider.squadId; i++) { step(f, 0.05); if (terrainAt(f, rider.pos) === "Trench") trenched++; }
    expect(rider.squadId).toBe(sq.id);
    expect(trenched).toBe(0);                              // it went around, it did not wade through
    expect(f.events.some((e) => e.type === "Joined" && e.data.unit === rider.id)).toBe(true);
  });

  it("routes a squad around a water band and still lands inside the cap", () => {
    const f = testField(wall(8, 10, "Water", 24));
    const lead = enlist(f, REF, { x: 8, y: 3 });
    const mate = enlist(f, REF, { x: 10, y: 3 });
    const sq = formSquad(f, { leaderId: lead.id, memberIds: [mate.id] });
    const to = { x: 8, y: 24 };
    const straight = Math.hypot(to.x - lead.pos.x, to.y - lead.pos.y);

    // the number a UI shows before the player commits is the routed one, and it obeys the cap
    const predicted = travelSeconds(f, lead.pos, to, lead);
    expect(predicted).toBeCloseTo(f.rules.travelCapSeconds, 6);
    expect(squadTravelSeconds(f, sq.id, to)).toBeCloseTo(f.rules.travelCapSeconds, 6);

    orderSquad(f, sq.id, to);
    expect(lead.order!.routed).toBe(true);
    expect(lead.order!.span).toBeGreaterThan(straight * 2);
    expect(lead.order!.haste).toBeGreaterThan(1);          // the long way round would have run past the cap
    expect(lead.order!.seconds).toBeCloseTo(f.rules.travelCapSeconds, 6);

    let wet = 0;
    const took = run(f, 3 * f.rules.travelCapSeconds, 0.05, () => !lead.order && !mate.order);
    for (const m of [lead, mate]) if (terrainAt(f, m.pos) === "Water") wet++;
    expect(wet).toBe(0);
    expect(took).toBeLessThanOrEqual(f.rules.travelCapSeconds + 0.2);
    expect(took).toBeCloseTo(predicted, 0);                // what the UI promised is what the walk cost
    expect(Math.hypot(lead.pos.x - to.x, lead.pos.y - to.y)).toBeLessThan(f.rules.arriveRadius);
  });

  it("gives up on a squad nothing can reach, and says so", () => {
    const f = testField(band(9, 11, "Water"));                 // no way round: the water spans the whole field
    const lead = enlist(f, REF, { x: 10, y: 25 });
    const sq = formSquad(f, { leaderId: lead.id });
    const loose = enlist(f, REF, { x: 10, y: 2 });
    const o = followSquad(f, loose.id, sq.id)!;
    expect(o.routed).toBe(false);
    expect(o.blocked).toBe(true);

    run(f, 90, 0.05, () => !loose.order);
    expect(loose.order).toBeNull();
    expect(loose.squadId).toBeNull();
    expect(loose.pos.y).toBeLessThan(1.5 * 9);
    expect(f.events.some((e) => e.type === "FollowFailed" && e.data.unit === loose.id)).toBe(true);
  });

  it("replaces an order cleanly in the middle of a walk", () => {
    const f = testField();
    const u = enlist(f, REF, { x: 5, y: 5 });
    const first = { x: 40, y: 5 }, second = { x: 5, y: 25 };
    orderUnit(f, u.id, first);
    run(f, 4);
    const turned = { x: u.pos.x, y: u.pos.y };
    expect(turned.x).toBeGreaterThan(5);
    expect(poseOf(f, u.id).progress).toBeGreaterThan(0);
    orderUnit(f, u.id, second);
    expect(u.order!.span).toBeCloseTo(Math.hypot(second.x - turned.x, second.y - turned.y), 6);
    expect(poseOf(f, u.id).progress).toBeCloseTo(0, 6);
    run(f, 60, 0.1, () => !u.order);
    expect(u.pos.x).toBeCloseTo(second.x, 6);
    expect(u.pos.y).toBeCloseTo(second.y, 6);
    expect(u.pos.x).toBeLessThan(first.x);
  });

  it("steps deterministically", () => {
    const play = (): string => {
      const f = testField((q, r) => band(8, 12, "Mud")(q, r) ?? wall(14, 15, "Water", 22)(q, r));
      const lead = enlist(f, REF, { x: 4, y: 4 });
      const gun = enlist(f, HEAVY, { x: 6, y: 4 });
      const scout = enlist(f, SLOW, { x: 28, y: 22 });
      const sq = formSquad(f, { leaderId: lead.id, memberIds: [gun.id] });
      orderSquad(f, sq.id, { x: 24, y: 22 });
      followSquad(f, scout.id, sq.id);
      for (const dt of [0.016, 0.033, 0.05, 0.1, 0.25]) for (let i = 0; i < 120; i++) step(f, dt);
      orderUnit(f, lead.id, { x: 2, y: 2 });
      for (let i = 0; i < 200; i++) step(f, 0.05);
      return JSON.stringify({ poses: poses(f), events: f.events });
    };
    expect(play()).toBe(play());
  });

  it("hands an animator a pose it can draw", () => {
    const f = testField();
    const u = enlist(f, REF, { x: 4, y: 4 });
    expect(poseOf(f, u.id)).toMatchObject({ walking: false, progress: 1, secondsLeft: 0 });
    orderUnit(f, u.id, { x: 14, y: 4 });
    step(f, 1);
    const p = poseOf(f, u.id);
    expect(p.walking).toBe(true);
    expect(p.facing).toBeCloseTo(0, 6);           // due east, x right and y down
    expect(p.progress).toBeGreaterThan(0);
    expect(p.progress).toBeLessThan(1);
    expect(p.secondsLeft).toBeGreaterThan(0);
    expect(p.terrain).toBe("Open");
    const turn = { x: u.pos.x, y: u.pos.y };
    orderUnit(f, u.id, { x: 4, y: 14 });
    expect(poseOf(f, u.id).facing).toBeCloseTo(Math.atan2(14 - turn.y, 4 - turn.x), 6);
    step(f, 0.5);
    expect(poseOf(f, u.id).facing).toBeGreaterThan(Math.PI / 2); // south and a little back west
  });

  it("mirrors a deployed battle onto the field, live units only", () => {
    const { b } = newBattle();
    const platoon = deploy(b, "P1", "A", SAM, blob(0, 0));
    const casualty = b.unit(platoon.footUids[0]!);
    b.remove(casualty); // a fallen unit should not walk onto the march field

    const f = testField();
    const enlisted = enlistFromBattle(f, b);

    const active = [...b.activeUnits()];
    expect(enlisted).toHaveLength(active.length);
    expect(enlisted.some((u) => u.id === casualty.uid)).toBe(false);
    for (const src of active) {
      const u = f.units.get(src.uid)!;
      expect(u).toBeDefined();
      expect(u.defId).toBe(src.defId);
      expect(u.side).toBe(src.side);
      expect(u.pos).toEqual(pointOfHex(src.pos!));
    }
  });

  it("halts a marching unit where it stands, and does nothing to one already stopped", () => {
    const f = testField();
    const u = enlist(f, REF, { x: 5, y: 5 });
    orderUnit(f, u.id, { x: 45, y: 5 });
    run(f, 2);
    expect(u.order).not.toBeNull();
    const stopped = { x: u.pos.x, y: u.pos.y };

    halt(f, u.id);
    expect(u.order).toBeNull();
    expect(f.events.some((e) => e.type === "Halted" && e.data.unit === u.id)).toBe(true);
    step(f, 1); // no order left to advance, so another tick must not move it
    expect(u.pos).toEqual(stopped);

    const before = f.events.length;
    halt(f, u.id); // already stopped: a no-op, not a second event
    expect(u.order).toBeNull();
    expect(f.events.length).toBe(before);
  });
});
