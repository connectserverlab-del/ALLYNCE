import { describe, it, expect } from "vitest";
import { newBattle, kingdomWithResearch } from "./helpers.js";
import { createRitual, computeRitualProgress, tickRitual, releaseRitual, disruptRitual, collapse } from "../src/rituals.js";
import { resolveAttack } from "../src/combat.js";
import { hexDistance } from "../src/hex.js";
import { applyKingdom } from "../src/kingdom.js";

function setupCircles() {
  const { b, ctrl } = newBattle();
  const fast = createRitual(b, { id: "fast", side: "A", center: { q: 10, r: 5 }, radius: 1, required: 30, leaderUid: null, summonDefId: "DIV_BOSS_SOVEREIGN-OF-MEMORY", linkGroup: "g" });
  const slow = createRitual(b, { id: "slow", side: "A", center: { q: 10, r: 12 }, radius: 1, required: 30, leaderUid: null, summonDefId: "DIV_BOSS_SOVEREIGN-OF-TORMENT", linkGroup: "g" });
  const lead = b.spawn("RIT_LEADER_AFFILIATED-SUMMONER", "A", { q: 10, r: 5 });
  fast.leaderUid = lead.uid;
  b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "A", { q: 11, r: 5 });
  b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "A", { q: 9, r: 5 });
  b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "A", { q: 10, r: 12 });
  b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "A", { q: 11, r: 12 });
  b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "A", { q: 9, r: 12 });
  return { b, ctrl, fast, slow };
}

describe("rituals", () => {
  it("affiliated leader makes a circle progress faster than foreign ritualists; formula is explicit", () => {
    const { b, fast, slow } = setupCircles();
    const f = computeRitualProgress(b, fast), s = computeRitualProgress(b, slow);
    expect(f).toMatchObject({ channeling: 7, leaderKnowledge: 3, leaderLanguage: 3, teamAffinity: 1, total: 14 });
    expect(s).toMatchObject({ channeling: 6, leaderKnowledge: 3, leaderLanguage: 1, teamAffinity: 1, total: 11 });
    expect(f.total).toBeGreaterThan(s.total);
  });

  it("Prepared Ground research adds its named bonus to every circle's progress on that side", () => {
    const { b, fast, slow } = setupCircles();
    const before = computeRitualProgress(b, fast);
    const k = kingdomWithResearch("SAM", ["RES_DRILL_YARD", "RES_BANNER_DISCIPLINE", "RES_PREPARED_GROUND"]);
    applyKingdom(b, "A", k);
    const after = computeRitualProgress(b, fast);
    expect(after.holding).toBe(2);
    expect(after.total).toBe(before.total + 2);
    expect(computeRitualProgress(b, slow).holding).toBe(2);
  });

  it("completed rituals are Held, accumulate Unstable damage each round, and only sync when all release together", () => {
    const { b, ctrl, fast, slow } = setupCircles();
    for (let i = 0; i < 3; i++) { tickRitual(b, fast); tickRitual(b, slow); }
    expect(fast.state).toBe("CompletedHeld");
    expect(slow.state).toBe("CompletedHeld");
    const lead = b.unit(fast.leaderUid!);
    const hpBefore = lead.hp;
    tickRitual(b, fast); // holding -> 1 stack, 100 dmg
    expect(fast.unstableStacks).toBe(1);
    expect(lead.hp).toBe(hpBefore - 100);
    tickRitual(b, fast);
    expect(lead.hp).toBe(hpBefore - 100 - 200);
    // release only fast -> not synchronized -> weakened summon
    ctrl.objectivePhase({ fast: true });
    const memory = [...b.units.values()].find((u) => u.defId === "DIV_BOSS_SOVEREIGN-OF-MEMORY")!;
    expect(memory).toBeDefined();
    expect(memory.divine!.anchors).toBe(2);
    expect(b.events.some((e) => e.type === "SynchronizedRelease")).toBe(false);
  });

  it("synchronized release fires when every linked ritual releases in the same Objective Phase", () => {
    const { b, ctrl, fast, slow } = setupCircles();
    for (let i = 0; i < 3; i++) { tickRitual(b, fast); tickRitual(b, slow); }
    ctrl.objectivePhase({ fast: true, slow: true });
    expect(b.events.some((e) => e.type === "SynchronizedRelease")).toBe(true);
    const divs = [...b.units.values()].filter((u) => u.divine);
    expect(divs).toHaveLength(2);
    expect(divs.every((d) => d.divine!.anchors === 3)).toBe(true);
  });

  it("damage halves a ritualist's contribution, Silence removes it, and losing all participants disrupts", () => {
    const { b, fast } = setupCircles();
    const lead = b.unit(fast.leaderUid!);
    const raider = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "B", { q: 10, r: 4 });
    resolveAttack(b, raider, lead);
    expect(computeRitualProgress(b, fast).channeling).toBe(7 - 3 + 1);
    b.addStatus(b.unitAt({ q: 11, r: 5 })!, "Silenced", 1, "test");
    expect(computeRitualProgress(b, fast).participants).toHaveLength(2);
    tickRitual(b, fast); // now Channeling
    const center = { ...lead.pos! };
    for (const u of [...b.activeUnits("A")]) if (u.pos && hexDistance(u.pos, center) <= 1) { u.defeated = true; b.remove(u); }
    tickRitual(b, fast);
    expect(fast.state).toBe("Disrupted");
  });

  it("only one copy of a named Divine Entity may exist", () => {
    const { b, fast } = setupCircles();
    b.spawn("DIV_BOSS_SOVEREIGN-OF-MEMORY", "A", { q: 1, r: 1 });
    fast.state = "CompletedHeld";
    const s = releaseRitual(b, fast, { synchronized: true });
    expect(s).toBeNull();
  });

  it("collapse resets progress and rewards the enemy morale", () => {
    const { b, fast } = setupCircles();
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 1, r: 1 });
    const m = enemy.morale;
    disruptRitual(b, fast, 2, "test");
    collapse(b, fast, "test");
    expect(fast.state).toBe("Collapsed");
    expect(enemy.morale).toBe(m + 10);
  });
});
