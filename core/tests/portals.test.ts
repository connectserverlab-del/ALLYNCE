import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { callPortal, queueReinforcement, tickPortal, destroyPortal, captureStep, checkCaptureInterrupt } from "../src/portals.js";
import { hexNeighbors } from "../src/hex.js";
import { runAiActivation, DIFFICULTY } from "../src/ai.js";

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
});
