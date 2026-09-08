import { describe, it, expect } from "vitest";
import { newBattle, deploy, KNI, DRG, blob, reg } from "./helpers.js";
import { rankOf, commandRadiusOf, canLead } from "../src/ranks.js";
import { computeStat } from "../src/modifiers.js";
import { validateArmy } from "../src/composition.js";

describe("Dragon Host rank ladder", () => {
  it("loads seven ordered ranks and assigns them to Dragon Host units", () => {
    const ladder = reg.ranks.get("DRG")!;
    expect(ladder.ranks).toHaveLength(7);
    expect(ladder.ranks.map((r) => r.tier)).toEqual([...ladder.ranks.keys()]);
    const { b } = newBattle();
    const p = deploy(b, "D", "A", DRG, blob(5, 5));
    expect(rankOf(b, b.unit(p.commanderUid!))?.title).toBe("Wing Dominant");
    expect(rankOf(b, b.unit(p.secondUid!))?.title).toBe("Wingsecond");
    expect(rankOf(b, b.unit(p.eliteUid!))?.title).toBe("Wing Adept");
    expect(rankOf(b, b.unit(p.footUids[0]!))?.title).toBe("Wingling");
  });

  it("climber lets ground wyrm-kin scale mountains at cost 3; flying ranks are unaffected", () => {
    const { b, ctrl } = newBattle();
    const runner = b.spawn("DRG_CAVALRY_RIDGEBACK-RUNNER", "A", { q: 2, r: 5 }); // Wyrmkin, ground, climber
    const maw = b.spawn("DRG_ELITE_OBSIDIAN-MAW", "A", { q: 2, r: 10 }); // Wing Adept, flying, also climber
    b.terrain.set("3,5", "Mountain"); b.terrain.set("3,10", "Mountain");
    expect(rankOf(b, runner)?.title).toBe("Wyrmkin");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(ctrl.reachable(runner).get("3,5")?.cost).toBe(3);  // cavalry base 6, climber caps at 3
    expect(ctrl.reachable(maw).get("3,10")?.cost).toBe(2);    // flying base 2, climber never makes it worse
  });

  it("higher ranks extend command radius, up to the Elder's", () => {
    const { b } = newBattle();
    const dominant = b.spawn("DRG_COMMANDER_RIFTWING-DOMINANT", "A", { q: 10, r: 10 });
    expect(commandRadiusOf(b, dominant)).toBe(6); // base 4 + rank bonus 2
    const elder = b.spawn("DRG_ELDER_HOLLOW-CROWN-ELDER", "A", { q: 11, r: 10 });
    expect(commandRadiusOf(b, elder)).toBe(8); // base 5 + rank bonus 3
  });
});

describe("Ritual Cult rank ladder", () => {
  it("loads four ordered ranks and assigns them to Ritual Cult units", () => {
    const ladder = reg.ranks.get("RIT")!;
    expect(ladder.ranks).toHaveLength(4);
    expect(ladder.ranks.map((r) => r.tier)).toEqual([...ladder.ranks.keys()]);
    const { b } = newBattle();
    const summoner = b.spawn("RIT_LEADER_AFFILIATED-SUMMONER", "A", { q: 5, r: 5 });
    const ritualist = b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "A", { q: 6, r: 5 });
    expect(rankOf(b, summoner)?.title).toBe("Voice of the Rite");
    expect(rankOf(b, ritualist)?.title).toBe("Initiate");
  });

  it("waterwalk lets a Voice of the Rite cross water and fords at cost 1; an Initiate cannot cross water at all", () => {
    const { b, ctrl } = newBattle();
    const voice = b.spawn("RIT_LEADER_AFFILIATED-SUMMONER", "A", { q: 2, r: 5 });
    const initiate = b.spawn("RIT_FOOT_FOREIGN-RITUALIST", "A", { q: 2, r: 10 });
    b.terrain.set("3,5", "Water"); b.terrain.set("3,10", "Water");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(ctrl.reachable(voice).get("3,5")?.cost).toBe(1);
    expect(ctrl.reachable(initiate).has("3,10")).toBe(false);
  });
});
