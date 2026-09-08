import { describe, it, expect } from "vitest";
import { newBattle, deploy, KNI, DRG, blob, reg } from "./helpers.js";
import { rankOf, commandRadiusOf, canLead } from "../src/ranks.js";
import { computeStat } from "../src/modifiers.js";
import { validateArmy } from "../src/composition.js";

describe("Knight rank ladder", () => {
  it("loads eight ordered ranks and assigns them to Knight units", () => {
    const ladder = reg.ranks.get("KNI")!;
    expect(ladder.ranks).toHaveLength(8);
    expect(ladder.ranks.map((r) => r.tier)).toEqual([...ladder.ranks.keys()]);
    const { b } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(5, 5));
    expect(rankOf(b, b.unit(p.commanderUid!))?.title).toBe("Marshal");
    expect(rankOf(b, b.unit(p.secondUid!))?.title).toBe("Castellan");
    expect(rankOf(b, b.unit(p.eliteUid!))?.title).toBe("Knight-Banneret");
    expect(rankOf(b, b.unit(p.footUids[0]!))?.title).toBe("Man-at-Arms");
  });

  it("surefoot ranks march through mud at cost 1; a plain Man-at-Arms pays the full 2", () => {
    const { b, ctrl } = newBattle();
    const bombard = b.spawn("KNI_SIEGE_BASTION-BOMBARD", "A", { q: 2, r: 5 }); // Sergeant-at-Arms: surefoot
    const soldier = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 2, r: 10 }); // Man-at-Arms: no movement trait yet
    b.terrain.set("3,5", "Mud"); b.terrain.set("3,10", "Mud");
    expect(rankOf(b, bombard)?.title).toBe("Sergeant-at-Arms");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(ctrl.reachable(bombard).get("3,5")?.cost).toBe(1);
    expect(ctrl.reachable(soldier).get("3,10")?.cost).toBe(2);
  });

  it("two-sword ranks strike harder on reaction attacks; mounted-in-war ranks gain movement near the enemy", () => {
    const { b, ctrl } = newBattle();
    const banneret = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "A", { q: 5, r: 5 });
    const enemy = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 6, r: 5 });
    const normal = computeStat(b, banneret, "ATK", { attacker: banneret, defender: enemy }).final;
    const reaction = computeStat(b, banneret, "ATK", { attacker: banneret, defender: enemy, reaction: true }).final;
    expect(reaction).toBe(normal + 50);
    const errant = b.spawn("KNI_CAVALRY_DAWN-LANCER", "A", { q: 2, r: 2 });
    expect(rankOf(b, errant)?.title).toBe("Knight-Errant");
    expect(ctrl.movementAllowance(errant)).toBe(6);
    b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "B", { q: 6, r: 2 });
    expect(ctrl.movementAllowance(errant)).toBe(7);
  });

  it("Castellan rank extends Fortification's +100 DEF to a nearby garrison", () => {
    const { b } = newBattle();
    const castellan = b.spawn("KNI_SECOND_OATHBOUND-CASTELLAN", "A", { q: 5, r: 5 });
    const guard = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 6, r: 5 });
    b.terrain.set("6,5", "Fortification");
    const withCastellan = computeStat(b, guard, "DEF").modifiers.map((m) => m.source);
    expect(withCastellan).toContain("Rank: castle lord nearby");
    b.remove(castellan);
    expect(computeStat(b, guard, "DEF").modifiers.map((m) => m.source)).not.toContain("Rank: castle lord nearby");
  });

  it("army validation requires a Platoon-capable commander and second", () => {
    const ladder = reg.ranks.get("KNI");
    expect(canLead(ladder, "SQUIRE", "Platoon")).toBe(false);
    expect(canLead(ladder, "MARSHAL", "Platoon")).toBe(true);
    expect(canLead(ladder, "OATHBREAKER_KING", "Platoon")).toBe(false);
    const r = validateArmy(reg, { side: "A", capacity: 200, platoons: [{ id: "P", side: "A", ...KNI }], specialists: [] });
    expect(r.ok).toBe(true);
  });
});

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
