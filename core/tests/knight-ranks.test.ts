import { describe, it, expect } from "vitest";
import { newBattle, deploy, KNI, blob, reg } from "./helpers.js";
import { rankOf, canLead, CHARGE_BONUS_MIN_HEXES } from "../src/ranks.js";
import { computeStat } from "../src/modifiers.js";
import { validateArmy } from "../src/composition.js";

describe("Knight rank ladder", () => {
  it("loads fourteen ordered ranks and assigns them to Knight units", () => {
    const ladder = reg.ranks.get("KNI")!;
    expect(ladder.ranks).toHaveLength(14);
    expect(ladder.ranks.map((r) => r.tier)).toEqual([...ladder.ranks.keys()]);
    const { b } = newBattle();
    const p = deploy(b, "K", "A", KNI, blob(5, 5));
    expect(rankOf(b, b.unit(p.commanderUid!))?.title).toBe("Baron");
    expect(rankOf(b, b.unit(p.secondUid!))?.title).toBe("Knight Banneret");
    expect(rankOf(b, b.unit(p.eliteUid!))?.title).toBe("Viscount");
    expect(rankOf(b, b.unit(p.footUids[0]!))?.title).toBe("Man-at-Arms");
  });

  it("lance charge privilege adds ATK only once the rider has advanced far enough this activation", () => {
    const { b } = newBattle();
    const lancer = b.spawn("KNI_CAVALRY_DAWN-LANCER", "A", { q: 5, r: 5 });
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    expect(rankOf(b, lancer)?.title).toBe("Knight Bachelor");
    const before = computeStat(b, lancer, "ATK", { attacker: lancer, defender: enemy });
    expect(before.modifiers.map((m) => m.source)).not.toContain("Rank: lance charge");
    lancer.chargeMoved = CHARGE_BONUS_MIN_HEXES;
    const charging = computeStat(b, lancer, "ATK", { attacker: lancer, defender: enemy });
    expect(charging.final).toBe(before.final + 30);
    expect(charging.modifiers.map((m) => m.source)).toContain("Rank: lance charge");

    // A rank with no chargeBonus privilege never gets the bonus, however far it has moved.
    const footman = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 8, r: 5 });
    footman.chargeMoved = CHARGE_BONUS_MIN_HEXES + 5;
    expect(computeStat(b, footman, "ATK", { attacker: footman, defender: enemy }).modifiers.map((m) => m.source)).not.toContain("Rank: lance charge");
  });

  it("castle-holding ranks extend Fortification's DEF bonus to allies in command radius", () => {
    const { b } = newBattle();
    b.terrain.set("6,5", "Fortification");
    const viscount = b.spawn("KNI_ELITE_SKY-LANCE-DRAGOON", "A", { q: 5, r: 5 });
    const garrison = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 6, r: 5 });
    expect(rankOf(b, viscount)?.title).toBe("Viscount");
    const withLord = computeStat(b, garrison, "DEF");
    expect(withLord.modifiers.map((m) => m.source)).toContain("Rank: castle lord nearby");
    viscount.defeated = true;
    const withoutLord = computeStat(b, garrison, "DEF");
    expect(withoutLord.modifiers.map((m) => m.source)).not.toContain("Rank: castle lord nearby");
  });

  it("army validation rejects a Man-at-Arms commander and accepts the standard Knight platoon", () => {
    const ladder = reg.ranks.get("KNI");
    expect(canLead(ladder, "MAN_AT_ARMS", "Platoon")).toBe(false);
    expect(canLead(ladder, "BARON", "Company")).toBe(true);
    expect(canLead(ladder, "KING", "Platoon")).toBe(false);
    const bad = validateArmy(reg, { side: "A", capacity: 200, platoons: [{ id: "P", side: "A", ...KNI, commander: "KNI_FOOT_BASTION-MAN-AT-ARMS" }], specialists: [] });
    expect(bad.errors.join("\n")).toMatch(/may not lead a Platoon/);
    const good = validateArmy(reg, { side: "A", capacity: 200, platoons: [{ id: "P", side: "A", ...KNI }], specialists: [] });
    expect(good.ok).toBe(true);
  });
});
