import { describe, expect, it } from "vitest";
import { newBattle } from "./helpers.js";
import { attackPortal, callPortal, captureStep, checkCaptureInterrupt, destroyPortal, queueReinforcement, tickPortal } from "../src/portals.js";
import { hexNeighbors } from "../src/hex.js";
import { evaluateObjective } from "../src/objectives.js";
import { DIFFICULTY, runAiActivation } from "../src/ai.js";
describe("reinforcement portals", () => {
  it("telegraphs one round, opens, spawns up to capacity, holds units when blocked, refunds half on destruction", () => {
    const { b } = newBattle();
    b.sides.get("B")!.reservePoints = 20;
    const p = callPortal(b, "B", { q: 5, r: 5 }, { capacity: 1, cooldown: 1 })!;
    expect(p.state).toBe("Telegraph");
    expect(queueReinforcement(b, p, "KNI_FOOT_BASTION-MAN-AT-ARMS")).toBe(true); // cost 4
    expect(queueReinforcement(b, p, "KNI_FOOT_BASTION-MAN-AT-ARMS")).toBe(true);
    expect(b.sides.get("B")!.reservePoints).toBe(12);
    expect(tickPortal(b, p)).toHaveLength(0);
    expect(p.state).toBe("Open");
    expect(tickPortal(b, p)).toHaveLength(1); // capacity 1
    expect(p.cooldownLeft).toBe(1);
    expect(tickPortal(b, p)).toHaveLength(0); // cooling down
    // block every adjacent hex
    for (const h of hexNeighbors(p.pos)) if (b.isFree(h)) b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", h);
    expect(tickPortal(b, p)).toHaveLength(0);
    expect(p.queue).toHaveLength(1);
    destroyPortal(b, p, "test");
    expect(p.state).toBe("Destroyed");
    expect(b.sides.get("B")!.reservePoints).toBe(14); // refund floor(4/2)
  });

  it("cannot open inside an enemy zone of control", () => {
    const { b } = newBattle();
    b.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 6, r: 5 });
    expect(callPortal(b, "B", { q: 5, r: 5 })).toBeNull();
  });

  it("capture takes two uninterrupted specialist actions", () => {
    const { b } = newBattle();
    const p = callPortal(b, "B", { q: 5, r: 5 }, { telegraph: 0 })!;
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "A", { q: 6, r: 5 });
    const soldier = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 4, r: 5 });
    expect(captureStep(b, soldier, p)).toBe(false);
    expect(captureStep(b, keeper, p)).toBe(true);
    expect(p.captureProgress).toBe(1);
    b.remove(keeper); b.place(keeper, { q: 9, r: 9 });
    checkCaptureInterrupt(b, p);
    expect(p.captureProgress).toBe(0);
    b.remove(keeper); b.place(keeper, { q: 6, r: 5 });
    captureStep(b, keeper, p); captureStep(b, keeper, p);
    expect(p.state).toBe("Open");
    expect(p.side).toBe("A");
    expect(p.originalSide).toBe("B"); // capture flips ownership, not the record of who raised it
  });

  it("capturing an enemy portal counts toward DestroyPortals exactly like blowing it up, because a capture never actually reaches the 'Captured' state", () => {
    const { b } = newBattle();
    const untouched = callPortal(b, "B", { q: 5, r: 5 }, { telegraph: 0 })!;
    const toCapture = callPortal(b, "B", { q: 10, r: 10 }, { telegraph: 0 })!;
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "A", { q: 11, r: 10 });
    captureStep(b, keeper, toCapture); captureStep(b, keeper, toCapture);
    expect(toCapture.state).toBe("Open"); // never "Captured" - ownership just flips
    expect(toCapture.side).toBe("A");

    expect(evaluateObjective(b, { type: "DestroyPortals", side: "A", count: 1 }).satisfied).toBe(true);
    expect(evaluateObjective(b, { type: "DestroyPortals", side: "A", count: 2 }).satisfied).toBe(false); // "untouched" still stands
    expect(evaluateObjective(b, { type: "DestroyPortals", side: "B", count: 1 }).satisfied).toBe(false); // B didn't destroy or capture its own portal
  });

  it("cannot open on an occupied hex", () => {
    const { b } = newBattle();
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 5, r: 5 });
    expect(callPortal(b, "B", { q: 5, r: 5 })).toBeNull();
  });

  it("a keeper on watch adds a spawn slot and shortens the cooldown", () => {
    const { b } = newBattle();
    const p = callPortal(b, "B", { q: 5, r: 5 }, { capacity: 1, cooldown: 2, keeperUid: "someKeeper" })!;
    expect(p.capacity).toBe(2);
    expect(p.cooldown).toBe(1);
  });

  it("attackPortal deals ATK-minus-DEF damage, floors at 100, and stays out of range for attackers who can't reach it", () => {
    const { b } = newBattle();
    const p = callPortal(b, "B", { q: 5, r: 5 }, { def: 1200, telegraph: 0 })!;
    const farAway = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 9, r: 9 });
    expect(attackPortal(b, farAway, p, 5000)).toBe(false);
    expect(p.hp).toBe(1200);
    expect(farAway.attackedThisActivation).toBeFalsy();

    const striker = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 6, r: 5 });
    expect(attackPortal(b, striker, p, 1250)).toBe(true); // 1250 - 1200 = 50, floored to 100
    expect(p.hp).toBe(1100);
    expect(striker.attackedThisActivation).toBe(true);
  });

  it("attackPortal destroys the portal at 0 HP, cancelling and half-refunding whatever is still queued", () => {
    const { b } = newBattle();
    b.sides.get("B")!.reservePoints = 20;
    const p = callPortal(b, "B", { q: 5, r: 5 }, { hp: 500, def: 100, telegraph: 0 })!;
    queueReinforcement(b, p, "KNI_FOOT_BASTION-MAN-AT-ARMS"); // cost 4
    const striker = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 6, r: 5 });
    expect(attackPortal(b, striker, p, 5000)).toBe(true);
    expect(p.state).toBe("Destroyed");
    expect(p.queue).toHaveLength(0);
    expect(b.sides.get("B")!.reservePoints).toBe(18); // 16 spent + floor(4/2) refund
  });

  it("queueReinforcement refuses a destroyed or captured portal, or a side that cannot afford the unit, without touching Reserve Points", () => {
    const { b } = newBattle();
    b.sides.get("B")!.reservePoints = 1; // less than the 4-point unit
    const poor = callPortal(b, "B", { q: 5, r: 5 })!;
    expect(queueReinforcement(b, poor, "KNI_FOOT_BASTION-MAN-AT-ARMS")).toBe(false);
    expect(b.sides.get("B")!.reservePoints).toBe(1);

    b.sides.get("B")!.reservePoints = 20;
    const destroyed = callPortal(b, "B", { q: 8, r: 8 })!;
    destroyPortal(b, destroyed, "test");
    expect(queueReinforcement(b, destroyed, "KNI_FOOT_BASTION-MAN-AT-ARMS")).toBe(false);
    expect(b.sides.get("B")!.reservePoints).toBe(20);

    const captured = callPortal(b, "B", { q: 11, r: 11 }, { telegraph: 0 })!;
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "A", { q: 12, r: 11 });
    captureStep(b, keeper, captured); captureStep(b, keeper, captured);
    expect(captured.side).toBe("A"); // capture flips it to "Open", not "Destroyed" or "Captured"...
    expect(queueReinforcement(b, captured, "KNI_FOOT_BASTION-MAN-AT-ARMS")).toBe(false); // ...but A never funded it, so the reserve check still blocks it
    expect(b.sides.get("B")!.reservePoints).toBe(20);
  });

  it("capture progress resets when a different specialist interrupts, and when the capturer is defeated rather than merely absent", () => {
    const { b } = newBattle();
    const p = callPortal(b, "B", { q: 5, r: 5 }, { telegraph: 0 })!;
    const first = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "A", { q: 6, r: 5 });
    const second = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "A", { q: 4, r: 5 });
    captureStep(b, first, p);
    expect(p.captureProgress).toBe(1);
    expect(p.captureBy).toBe(first.uid);
    captureStep(b, second, p); // a different capturer steps in: progress restarts under them
    expect(p.captureProgress).toBe(1);
    expect(p.captureBy).toBe(second.uid);

    second.defeated = true;
    checkCaptureInterrupt(b, p);
    expect(p.captureProgress).toBe(0);
    expect(p.captureBy).toBeNull();
  });

  it("a successful arrival lifts nearby allied morale as a named source, and leaves distant allies and enemies untouched", () => {
    const { b } = newBattle();
    const p = callPortal(b, "B", { q: 5, r: 5 }, { capacity: 1, telegraph: 0 })!;
    b.sides.get("B")!.reservePoints = 20;
    queueReinforcement(b, p, "KNI_FOOT_BASTION-MAN-AT-ARMS");
    const near = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 7, r: 5 }); // within 3 of the portal
    const far = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 20, r: 15 });
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 4, r: 5 });
    const nearMorale = near.morale, enemyMorale = enemy.morale;
    tickPortal(b, p);
    expect(near.morale).toBe(nearMorale + 5);
    expect(far.morale).toBe(75); // unchanged, out of the 3-hex radius
    expect(enemy.morale).toBe(enemyMorale); // reinforcements never cheer up the other side
    expect(b.events.some((e) => e.type === "Morale" && e.data.reason === "Reinforcements arrived")).toBe(true);
  });
});

describe("a keeper calling and feeding its own portal", () => {
  it("Open Reinforcement Portal telegraphs on an adjacent hex, spends its AP and Ability cooldown, and refuses out-of-range or blocked ground", () => {
    const { b, ctrl } = newBattle();
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "B", { q: 5, r: 5 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:B");
    expect(() => ctrl.openPortal(keeper, { q: 7, r: 5 })).toThrow(/Out of range/); // ability range is 1
    const p = ctrl.openPortal(keeper, { q: 6, r: 5 });
    expect(p.state).toBe("Telegraph");
    expect(p.side).toBe("B");
    expect(keeper.ap).toBe(0); // apCost 2 of a 2-AP activation
    expect(keeper.cooldowns["ABL_OPEN_PORTAL"]).toBe(4);
  });

  it("cannot call a portal onto occupied ground or into an enemy zone of control", () => {
    const { b, ctrl } = newBattle();
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "B", { q: 5, r: 5 });
    b.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 7, r: 5 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:B");
    expect(() => ctrl.openPortal(keeper, { q: 6, r: 5 })).toThrow(/Cannot open a portal/); // adjacent to an enemy
    expect(keeper.ap).toBe(2); // AP refunded, nothing spent on a failed call
  });

  it("a unit beside its own open portal can queue a reinforcement, and only there", () => {
    const { b, ctrl } = newBattle();
    b.sides.get("B")!.reservePoints = 10;
    const p = callPortal(b, "B", { q: 5, r: 5 }, { telegraph: 0 })!;
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "B", { q: 6, r: 5 });
    const farAlly = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 12, r: 12 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:B");
    expect(() => ctrl.queueReinforcement(farAlly, p, "KNI_FOOT_BASTION-MAN-AT-ARMS")).toThrow(/Not beside/);
    ctrl.queueReinforcement(keeper, p, "KNI_FOOT_BASTION-MAN-AT-ARMS"); // cost 4
    expect(p.queue).toHaveLength(1);
    expect(b.sides.get("B")!.reservePoints).toBe(6);
    expect(keeper.ap).toBe(1);
  });
});

describe("AI Portal Keeper", () => {
  it("calls a portal near itself when none of its side's is up, then feeds it once it opens", () => {
    const { b, ctrl } = newBattle();
    const keeper = b.spawn("KNI_SUPPORT_PORTAL-KEEPER", "B", { q: 5, r: 5 });
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 12, r: 12 }); // far off, so nothing else competes for the activation
    b.sides.get("B")!.reservePoints = 10;
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:B", DIFFICULTY.normal);
    const called = [...b.portals.values()].find((p) => p.side === "B");
    expect(called?.state).toBe("Telegraph");
    expect(keeper.cooldowns["ABL_OPEN_PORTAL"]).toBeGreaterThan(0);

    // next round: the portal opens, and the keeper — now off cooldown checks aside — feeds it instead of calling another
    tickPortal(b, called!);
    expect(called!.state).toBe("Open");
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:B", DIFFICULTY.normal);
    expect(called!.queue.length).toBeGreaterThan(0);
    expect([...b.portals.values()].filter((p) => p.side === "B")).toHaveLength(1); // fed the one it had rather than calling a second
  });

  it("attacking a portal damages an enemy's but is rejected against one's own or an already-destroyed one", () => {
    const { b } = newBattle();
    const p = callPortal(b, "B", { q: 5, r: 5 }, { telegraph: 0, hp: 5000, def: 400 })!;
    const owner = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    expect(attackPortal(b, owner, p, 2000)).toBe(false); // can't attack your own side's portal
    expect(p.hp).toBe(5000);

    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 4, r: 5 });
    expect(attackPortal(b, enemy, p, 2000)).toBe(true);
    expect(p.hp).toBe(3400); // 5000 - max(100, 2000 - 400)
    expect(enemy.attackedThisActivation).toBe(true);

    destroyPortal(b, p, enemy.uid);
    expect(attackPortal(b, enemy, p, 2000)).toBe(false); // already destroyed, nothing left to hit
    expect(p.state).toBe("Destroyed");
  });
});
