import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, blob } from "./helpers.js";
import { runAiActivation, shouldSurrender, maybeSurrender, DIFFICULTY } from "../src/ai.js";
import { defeat } from "../src/combat.js";
import { doctrineState } from "../src/composition.js";
import { attackArc } from "../src/hex.js";

describe("AI: siege positioning", () => {
  it("retreats out of minimum range instead of standing at the front, then sets up once safe", () => {
    const { b, ctrl } = newBattle();
    const gun = b.spawn("KNI_SIEGE_BASTION-BOMBARD", "A", { q: 5, r: 5 }); // minRange 2, range 4, mov 2
    const enemy = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 6, r: 5 }); // distance 1, inside minimum range
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(b.distance(gun, enemy)).toBe(3); // the farthest one activation's movement can buy, and outside minRange
    expect(gun.setUp).toBe(true); // safe and still within its own firing range, so it emplaces
  });

  it("closes only as far as its own firing range requires, then sets up instead of charging in", () => {
    const { b, ctrl } = newBattle();
    const gun = b.spawn("KNI_SIEGE_BASTION-BOMBARD", "A", { q: 2, r: 5 });
    const enemy = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 8, r: 5 }); // distance 6, out of range 4
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(b.distance(gun, enemy)).toBe(4); // never closer than its own range needs
    expect(gun.setUp).toBe(true);
  });
});

describe("AI: cavalry flanking", () => {
  it("routes around to a flank or rear hex instead of charging the front arc", () => {
    const { b, ctrl } = newBattle();
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 10, r: 10 }, { facing: 0 });
    const rider = b.spawn("SHI_CAVALRY_NIGHT-COURIER-RIDER", "A", { q: 17, r: 10 }); // due "front" of facing 0
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(b.distance(rider, enemy)).toBe(1);
    expect(attackArc(enemy.pos!, enemy.facing, rider.pos!)).not.toBe("front");
  });
});

describe("AI: surrender policy", () => {
  it("yields once every platoon is leaderless and average morale has collapsed, but not from either alone", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    b.sides.get("A")!.leaderUid = p.commanderUid;
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 20, r: 5 });

    // Morale has collapsed, but Doctrine still stands: no surrender.
    for (const u of b.activeUnits("A")) u.morale = 0;
    expect(shouldSurrender(ctrl, "A")).toBe(false);
    for (const u of b.activeUnits("A")) u.morale = b.def(u).morale;

    // Doctrine collapses (commander and second both fall, succession fails), but morale is still fine: no surrender.
    defeat(b, b.unit(p.secondUid!), "test");
    defeat(b, b.unit(p.commanderUid!), "test");
    ctrl.commandPhase();
    expect(doctrineState(b, p)).toBe("Broken");
    expect(shouldSurrender(ctrl, "A")).toBe(false);

    // Both together: the side yields.
    for (const u of b.activeUnits("A")) u.morale = 0;
    expect(shouldSurrender(ctrl, "A")).toBe(true);
    expect(maybeSurrender(ctrl, "A")).toBe(true);
    expect(b.sides.get("A")!.surrendered).toBe(true);
    expect(b.winner).toBe("B");
    expect(b.winReason).toBe("Surrender");
  });

  it("never re-surrenders or acts once a side has already yielded", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    b.sides.get("A")!.leaderUid = p.commanderUid;
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 20, r: 5 });
    defeat(b, b.unit(p.secondUid!), "test");
    defeat(b, b.unit(p.commanderUid!), "test");
    ctrl.commandPhase();
    for (const u of b.activeUnits("A")) u.morale = 0;
    expect(maybeSurrender(ctrl, "A")).toBe(true);
    expect(maybeSurrender(ctrl, "A")).toBe(false);
  });
});
