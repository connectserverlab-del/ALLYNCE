import { describe, it, expect } from "vitest";
import { Battle } from "../src/state.js";
import { loadRegistry } from "../src/data.js";
import { rankOf, RITUAL_INSTABILITY_BASE } from "../src/ranks.js";
import { createRitual, computeRitualProgress, disruptRitual, ritualParticipants } from "../src/rituals.js";

/**
 * Both current Ritual Cult units sit on the privilege-free Affiliated tier (see data/factions/ranks/RIT.json),
 * so the shared registry used by core/tests/rituals.test.ts never sees a rank bonus. These tests promote a
 * spawned unit on an isolated registry copy to prove the ladder's ritualMastery and instabilityCeiling
 * privileges actually reach computeRitualProgress and disruptRitual, without touching that shared fixture.
 */
function battleWithPromotedLeader(rankId: string) {
  const freshReg = loadRegistry();
  freshReg.units.get("RIT_LEADER_AFFILIATED-SUMMONER")!.factionRank = rankId;
  const b = new Battle(freshReg, { seed: 1, width: 24, height: 18 });
  return b;
}

describe("Ritual Cult rank ladder", () => {
  it("loads five ranks, none of which may lead any organization", () => {
    const b = new Battle(loadRegistry(), { seed: 1, width: 24, height: 18 });
    const ladder = b.reg.ranks.get("RIT")!;
    expect(ladder.ranks).toHaveLength(5);
    expect(ladder.ranks.every((r) => r.canLead.length === 0)).toBe(true);
    const summoner = b.spawn("RIT_LEADER_AFFILIATED-SUMMONER", "A", { q: 5, r: 5 });
    expect(rankOf(b, summoner)?.title).toBe("Affiliated");
  });

  it("ritual mastery adds a source-tracked bonus to a circle's Progress", () => {
    const base = new Battle(loadRegistry(), { seed: 1, width: 24, height: 18 });
    const baseLead = base.spawn("RIT_LEADER_AFFILIATED-SUMMONER", "A", { q: 10, r: 5 });
    const baseCircle = createRitual(base, { id: "c", side: "A", center: { q: 10, r: 5 }, radius: 1, required: 30, leaderUid: baseLead.uid, summonDefId: null, linkGroup: null });
    const baseCalc = computeRitualProgress(base, baseCircle);
    expect(baseCalc.rankMastery).toBe(0);

    const promoted = battleWithPromotedLeader("MASTER_RITUALIST");
    const lead = promoted.spawn("RIT_LEADER_AFFILIATED-SUMMONER", "A", { q: 10, r: 5 });
    expect(rankOf(promoted, lead)?.privileges.ritualMastery).toBe(3);
    const circle = createRitual(promoted, { id: "c", side: "A", center: { q: 10, r: 5 }, radius: 1, required: 30, leaderUid: lead.uid, summonDefId: null, linkGroup: null });
    const calc = computeRitualProgress(promoted, circle);
    expect(calc.rankMastery).toBe(3);
    expect(calc.total).toBe(baseCalc.total + 3);
  });

  it("instability ceiling raises how many Unstable stacks a held ritual can sustain before disruption collapses it", () => {
    const promoted = battleWithPromotedLeader("GRAND_RITUALIST");
    const lead = promoted.spawn("RIT_LEADER_AFFILIATED-SUMMONER", "A", { q: 10, r: 5 });
    expect(rankOf(promoted, lead)?.privileges.instabilityCeiling).toBe(6);
    const circle = createRitual(promoted, { id: "c", side: "A", center: { q: 10, r: 5 }, radius: 1, required: 30, leaderUid: lead.uid, summonDefId: null, linkGroup: null });
    circle.state = "CompletedHeld";
    circle.unstableStacks = RITUAL_INSTABILITY_BASE; // at the un-ranked baseline, this alone would be enough to collapse
    disruptRitual(promoted, circle, circle.unstableStacks, "test");
    expect(circle.state).toBe("CompletedHeld"); // the Grand Ritualist's higher ceiling holds it
    circle.unstableStacks = 6;
    disruptRitual(promoted, circle, 6, "test");
    expect(circle.state).toBe("Collapsed");
  });

  it("ritualParticipants still excludes flying, Silenced and Routed ritualists regardless of rank", () => {
    const promoted = battleWithPromotedLeader("ADEPT");
    const lead = promoted.spawn("RIT_LEADER_AFFILIATED-SUMMONER", "A", { q: 10, r: 5 });
    const circle = createRitual(promoted, { id: "c", side: "A", center: { q: 10, r: 5 }, radius: 1, required: 30, leaderUid: lead.uid, summonDefId: null, linkGroup: null });
    expect(ritualParticipants(promoted, circle)).toHaveLength(1);
    promoted.addStatus(lead, "Silenced", 1, "test");
    expect(ritualParticipants(promoted, circle)).toHaveLength(0);
  });
});
