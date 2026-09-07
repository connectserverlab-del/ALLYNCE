import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, blob, reg } from "./helpers.js";
import { rankOf, commandRadiusOf, canLead } from "../src/ranks.js";
import { computeStat } from "../src/modifiers.js";
import { validateArmy } from "../src/composition.js";
import { resolveAttack } from "../src/combat.js";

describe("Samurai rank ladder", () => {
  it("loads nineteen ordered ranks and assigns them to Samurai units", () => {
    const ladder = reg.ranks.get("SAM")!;
    expect(ladder.ranks).toHaveLength(19);
    expect(ladder.ranks.map((r) => r.tier)).toEqual([...ladder.ranks.keys()]);
    const { b } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    expect(rankOf(b, b.unit(p.commanderUid!))?.title).toBe("Hatamoto");
    expect(rankOf(b, b.unit(p.secondUid!))?.title).toBe("Churo");
    expect(rankOf(b, b.unit(p.eliteUid!))?.title).toBe("Umamawari");
    expect(rankOf(b, b.unit(p.footUids[0]!))?.title).toBe("Koyakunin");
  });

  it("two-sword ranks strike harder on reaction attacks only", () => {
    const { b } = newBattle();
    const champion = b.spawn("SAM_ELITE_ONI-GATE-CHAMPION", "A", { q: 5, r: 5 });
    const enemy = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    const normal = computeStat(b, champion, "ATK", { attacker: champion, defender: enemy }).final;
    const reaction = resolveAttack(b, champion, enemy, { reaction: true });
    expect(reaction.atk).toBe(normal + 50);
    const foot = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 4, r: 5 });
    expect(computeStat(b, foot, "ATK", { attacker: foot, defender: enemy, reaction: true }).modifiers.map((m) => m.source)).not.toContain("Rank: two swords (reaction)");
  });

  it("mounted-in-war ranks gain movement only near the enemy; banner ranks extend command radius", () => {
    const { b, ctrl } = newBattle();
    const retainer = b.spawn("SAM_SECOND_WHITE-CRANE-RETAINER", "A", { q: 2, r: 2 });
    expect(ctrl.movementAllowance(retainer)).toBe(4);
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 2 });
    expect(ctrl.movementAllowance(retainer)).toBe(5);
    const daimyo = b.spawn("SAM_COMMANDER_EMBER-BANNER-DAIMYO", "A", { q: 10, r: 10 });
    expect(commandRadiusOf(b, daimyo)).toBe(4);
  });

  it("army validation rejects a platoon whose commander rank cannot lead", () => {
    const ladder = reg.ranks.get("SAM");
    expect(canLead(ladder, "KOYAKUNIN", "Platoon")).toBe(false);
    expect(canLead(ladder, "HATAMOTO", "Company")).toBe(true);
    expect(canLead(ladder, "SHOGUN", "Platoon")).toBe(false);
    expect(canLead(undefined, undefined, "Platoon")).toBe(true); // factions without a ladder are unrestricted
    const r = validateArmy(reg, { side: "A", capacity: 200, platoons: [{ id: "P", side: "A", ...SAM, commander: "SAM_FOOT_EMBERLINE-ASHIGARU" }], specialists: [] });
    expect(r.errors.join("\n")).toMatch(/may not lead a Platoon/);
  });
});
