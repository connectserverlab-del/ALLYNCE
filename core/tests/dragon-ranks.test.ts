import { describe, it, expect } from "vitest";
import { newBattle, deploy, DRG, blob, reg } from "./helpers.js";
import { rankOf, canLead, DIVE_BONUS_MIN_DROP } from "../src/ranks.js";
import { computeStat } from "../src/modifiers.js";
import { validateArmy } from "../src/composition.js";

describe("Dragon Host rank ladder", () => {
  it("loads nine ordered ranks and assigns them to Dragon Host units", () => {
    const ladder = reg.ranks.get("DRG")!;
    expect(ladder.ranks).toHaveLength(9);
    expect(ladder.ranks.map((r) => r.tier)).toEqual([...ladder.ranks.keys()]);
    const { b } = newBattle();
    const p = deploy(b, "D", "A", DRG, blob(5, 5));
    expect(rankOf(b, b.unit(p.commanderUid!))?.title).toBe("Dominant");
    expect(rankOf(b, b.unit(p.secondUid!))?.title).toBe("Wing Second");
    expect(rankOf(b, b.unit(p.eliteUid!))?.title).toBe("Wingbreaker");
    expect(rankOf(b, b.unit(p.footUids[0]!))?.title).toBe("Skyrider");
    const ridgeback = b.spawn("DRG_CAVALRY_RIDGEBACK-RUNNER", "A", { q: 0, r: 0 });
    expect(rankOf(b, ridgeback)?.title).toBe("Ridgeback Warden");
    const siegewyrm = b.spawn("DRG_SIEGE_CINDERTHROAT-SIEGEWYRM", "A", { q: 0, r: 1 });
    expect(rankOf(b, siegewyrm)?.title).toBe("Cinder Warden");
  });

  it("diving charge adds ATK only once a flier has dropped enough net altitude this activation", () => {
    const { b } = newBattle();
    const diver = b.spawn("DRG_ELITE_OBSIDIAN-MAW", "A", { q: 5, r: 5 });
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    expect(rankOf(b, diver)?.title).toBe("Wingbreaker");
    const level = computeStat(b, diver, "ATK", { attacker: diver, defender: enemy });
    expect(level.modifiers.map((m) => m.source)).not.toContain("Rank: wing dive");
    diver.altitudeDropped = DIVE_BONUS_MIN_DROP;
    const diving = computeStat(b, diver, "ATK", { attacker: diver, defender: enemy });
    expect(diving.final).toBe(level.final + 250);
    expect(diving.modifiers.map((m) => m.source)).toContain("Rank: wing dive");

    // A rank with no divingCharge privilege never gets the bonus, however far it has dropped.
    const drake = b.spawn("DRG_FOOT_SLATEWING-DRAKE", "A", { q: 8, r: 5 });
    drake.altitudeDropped = DIVE_BONUS_MIN_DROP + 5;
    expect(computeStat(b, drake, "ATK", { attacker: drake, defender: enemy }).modifiers.map((m) => m.source)).not.toContain("Rank: wing dive");
  });

  it("climbing back to a net altitude gain resets the dive when a flier moves", () => {
    const { b, ctrl } = newBattle();
    const diver = b.spawn("DRG_ELITE_OBSIDIAN-MAW", "A", { q: 5, r: 5 });
    b.elevation.set("5,5", 2);
    b.elevation.set("6,5", 0);
    b.elevation.set("7,5", 3);
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    ctrl.move(diver, { q: 6, r: 5 }); // dropped 2 tiers
    expect(diver.altitudeDropped).toBe(2);
    ctrl.move(diver, { q: 7, r: 5 }); // climbed to a net gain over the activation start
    expect(diver.altitudeDropped).toBe(0);
  });

  it("banner privilege doubles command-radius morale recovery for platoon members", () => {
    const { b, ctrl } = newBattle();
    const p = deploy(b, "D", "A", DRG, blob(5, 5));
    expect(rankOf(b, b.unit(p.commanderUid!))?.privileges.banner).toBe(true);
    const foot = b.unit(p.footUids[0]!);
    foot.morale = 50;
    ctrl.commandPhase(); // runs commandRadiusRecovery once
    expect(foot.morale).toBe(60); // +5 command radius, +5 Rank: banner
  });

  it("army validation accepts the standard Dragon platoon and rejects a Skyrider commander", () => {
    const ladder = reg.ranks.get("DRG");
    expect(canLead(ladder, "SKYRIDER", "Platoon")).toBe(false);
    expect(canLead(ladder, "DOMINANT", "Company")).toBe(true);
    const bad = validateArmy(reg, { side: "A", capacity: 200, platoons: [{ id: "P", side: "A", ...DRG, commander: "DRG_FOOT_SLATEWING-DRAKE" }], specialists: [] });
    expect(bad.errors.join("\n")).toMatch(/may not lead a Platoon/);
    const good = validateArmy(reg, { side: "A", capacity: 200, platoons: [{ id: "P", side: "A", ...DRG }], specialists: [] });
    expect(good.ok).toBe(true);
  });
});
