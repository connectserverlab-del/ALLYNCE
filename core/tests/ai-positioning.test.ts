import { describe, it, expect } from "vitest";
import { runAiActivation, DIFFICULTY } from "../src/ai.js";
import { hexKey, hexDistance } from "../src/hex.js";
import { newBattle } from "./helpers.js";

describe("AI terrain and positioning preferences", () => {
  it("a ranged unit holds its stand-off ring rather than closing to melee, and prefers High Ground within it", () => {
    const { b, ctrl } = newBattle();
    const enemy = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 10 });
    const scout = b.spawn("SHI_SECOND_REED-SIGNAL-LIEUTENANT", "B", { q: 10, r: 14 }); // range 2
    b.terrain.set(hexKey({ q: 11, r: 11 }), "HighGround");
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:B", DIFFICULTY.normal);
    expect(scout.pos).not.toBeNull();
    expect(hexDistance(scout.pos!, enemy.pos!)).toBe(2); // held the ranged stand-off ring, didn't push to 1
    expect(b.terrainAt(scout.pos!)).toBe("HighGround");
  });

  it("Cavalry paths onto a flank or rear hex around an equal-distance target instead of the front", () => {
    const { b, ctrl } = newBattle();
    const enemy = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 10 });
    enemy.facing = 0; // faces toward (11,10): the front arc covers (11,10), (11,9), (10,11)
    const dragoon = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 10, r: 15 }); // Cavalry, range 1
    ctrl.commandPhase();
    runAiActivation(ctrl, "ind:B", DIFFICULTY.normal);
    // Sky-Lance Dragoon's ATK one-shots the foot soldier, so read the arc off the Attack event rather than
    // the (now-removed) defender position.
    const attack = b.events.find((e) => e.type === "Attack" && e.data["attacker"] === dragoon.uid);
    expect(attack?.data["arc"]).not.toBe("front");
  });
});
