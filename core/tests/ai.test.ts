import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { runAiActivation, DIFFICULTY } from "../src/ai.js";

describe("AI treats splitting as a trade, not a free gain", () => {
  it("never splits against a single hard hitter", () => {
    const { b, ctrl } = newBattle();
    const adept = b.spawn("SHI_ELITE_MIRROR-SHADE-ADEPT", "A", { q: 5, r: 5 });
    b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 5, r: 7 }); // the only threat on the field, well within range to consider splitting
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(adept.splitBodies ?? 1).toBe(1);
    expect([...b.units.values()].filter((u) => u.isClone)).toHaveLength(0);
  });

  it("splits to hold ground when a crowd of enemies is closing in", () => {
    const { b, ctrl } = newBattle();
    const adept = b.spawn("SHI_ELITE_MIRROR-SHADE-ADEPT", "A", { q: 5, r: 5 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 7 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 7 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);
    expect(adept.splitBodies).toBe(3);
    expect([...b.units.values()].filter((u) => u.isClone)).toHaveLength(2);
  });

  it("hunts a reachable enemy copy over a live soldier, shrinking the original", () => {
    const { b, ctrl } = newBattle();
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const original = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 10, r: 10 });
    original.splitBodies = 2;
    const clone = b.spawn(original.defId, "B", { q: 6, r: 5 }, { platoonId: null, uidPrefix: "clone" });
    clone.isClone = true; clone.cloneOf = original.uid; clone.splitBodies = 2; clone.hp = 1; clone.morale = 0;
    const soldier = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 6 });
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:A", DIFFICULTY.normal);

    expect(clone.defeated).toBe(true);
    expect(soldier.defeated).toBe(false);
    // the original reclaims the fallen copy's share
    expect(original.splitBodies).toBe(1);
    expect(b.events.some((e) => e.type === "SplitShareReclaimed")).toBe(true);
  });
});
