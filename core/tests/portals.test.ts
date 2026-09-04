import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { callPortal, queueReinforcement, tickPortal, destroyPortal, captureStep, checkCaptureInterrupt } from "../src/portals.js";
import { hexNeighbors } from "../src/hex.js";

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
