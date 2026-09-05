import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { saveBattle, loadBattle } from "../src/save.js";
import { createRitual, tickRitual, disruptRitual, assistRitual } from "../src/rituals.js";
import { resolveAttack } from "../src/combat.js";
import { callPortal, queueReinforcement, tickPortal, captureStep } from "../src/portals.js";
import { hexNeighbors } from "../src/hex.js";
import { reg } from "./helpers.js";

describe("saving and loading rituals and portals", () => {
  it("round-trips a ritual mid-channel, with damaged participants, disruption and assist still pending", () => {
    const { b } = newBattle();
    const r = createRitual(b, { id: "r1", side: "A", center: { q: 10, r: 5 }, radius: 1, required: 999, leaderUid: null, summonDefId: "DIV_BOSS_SOVEREIGN-OF-MEMORY", linkGroup: null });
    const lead = b.spawn("RIT_LEADER_AFFILIATED-SUMMONER", "A", { q: 10, r: 5 });
    r.leaderUid = lead.uid;
    const helper = b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "A", { q: 11, r: 5 });
    tickRitual(b, r); // Preparing -> Channeling, first progress tick clears transient fields
    const raider = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 10, r: 4 });
    resolveAttack(b, raider, lead); // populates damagedThisRound via onRitualistDamaged
    disruptRitual(b, r, 2, raider.uid);
    assistRitual(b, r, helper);

    expect(r.damagedThisRound.size).toBeGreaterThan(0);
    expect(r.disruption).toBe(2);
    expect(r.assistBonus).toBe(1);
    expect(r.participantUids.length).toBeGreaterThan(0);

    const snap = saveBattle(b);
    const restored = loadBattle(reg, snap);
    const rr = restored.rituals.get("r1")!;
    expect(rr.damagedThisRound).toBeInstanceOf(Set);
    expect([...rr.damagedThisRound]).toEqual([...r.damagedThisRound]);
    expect(rr.disruption).toBe(r.disruption);
    expect(rr.assistBonus).toBe(r.assistBonus);
    expect(rr.participantUids).toEqual(r.participantUids);
    expect(rr.state).toBe(r.state);
    // continuing to tick the restored ritual behaves exactly like the original
    tickRitual(b, r);
    tickRitual(restored, rr);
    expect(JSON.stringify(saveBattle(restored))).toBe(JSON.stringify(saveBattle(b)));
  });

  it("round-trips a portal with a queued reinforcement, cooldown and in-progress capture", () => {
    const { b } = newBattle();
    b.sides.get("B")!.reservePoints = 20;
    const p = callPortal(b, "B", { q: 5, r: 5 }, { telegraph: 0, capacity: 1, cooldown: 2 })!;
    queueReinforcement(b, p, "KNI_FOOT_BASTION-MAN-AT-ARMS");
    queueReinforcement(b, p, "KNI_FOOT_BASTION-MAN-AT-ARMS");
    tickPortal(b, p); // one arrives, one stays queued, cooldown starts
    const openSpot = hexNeighbors(p.pos).find((h) => b.isFree(h))!;
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "A", openSpot);
    captureStep(b, keeper, p); // interrupted capture in progress against the portal's own side

    expect(p.queue).toHaveLength(1);
    expect(p.cooldownLeft).toBeGreaterThan(0);
    expect(p.captureBy).toBe(keeper.uid);
    expect(p.captureProgress).toBe(1);

    const snap = saveBattle(b);
    const restored = loadBattle(reg, snap);
    const rp = restored.portals.get(p.id)!;
    expect(rp.queue).toEqual(p.queue);
    expect(rp.cooldownLeft).toBe(p.cooldownLeft);
    expect(rp.captureBy).toBe(p.captureBy);
    expect(rp.captureProgress).toBe(p.captureProgress);
    // continuing to tick the restored portal behaves exactly like the original
    tickPortal(b, p);
    tickPortal(restored, rp);
    expect(JSON.stringify(saveBattle(restored))).toBe(JSON.stringify(saveBattle(b)));
  });
});
