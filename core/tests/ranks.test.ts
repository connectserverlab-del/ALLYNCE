import { describe, expect, it } from "vitest";
import { blob, deploy, newBattle, reg, SAM, SHI } from "./helpers.js";
import { canLead, commandRadiusOf, rankOf } from "../src/ranks.js";
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

describe("Samurai and Shinobi rank ladders", () => {
  it("resolves a unit's rung on its faction's ladder; a faction with no ladder resolves to none", () => {
    const { b } = newBattle();
    const daimyo = b.spawn("SAM_COMMANDER_EMBER-BANNER-DAIMYO", "A", { q: 4, r: 4 });
    expect(rankOf(b, daimyo)?.title).toBe("Hatamoto");
    const jonin = b.spawn("SHI_COMMANDER_VEILED-MOON-JONIN", "A", { q: 6, r: 4 });
    expect(rankOf(b, jonin)?.title).toBe("Jounin");
    // The sworn companies have no ladder of their own, so their officers hold no rung.
    const magister = b.spawn("ARC_COMMANDER_AZURE-SEAL-MAGISTER", "A", { q: 8, r: 4 });
    expect(rankOf(b, magister)).toBeUndefined();
  });

  it("two swords grants +50 ATK on a reaction attack only, never on a standard attack", () => {
    const { b } = newBattle();
    const champion = b.spawn("SAM_ELITE_ONI-GATE-CHAMPION", "A", { q: 5, r: 5 });
    const standard = computeStat(b, champion, "ATK");
    const reaction = computeStat(b, champion, "ATK", { reaction: true });
    expect(standard.modifiers.some((m) => m.source.includes("two swords"))).toBe(false);
    expect(reaction.modifiers.find((m) => m.source.includes("two swords"))?.value).toBe(50);
  });

  it("mounted 'always' grants +1 Movement unconditionally", () => {
    const { b, ctrl } = newBattle();
    const daimyo = b.spawn("SAM_COMMANDER_EMBER-BANNER-DAIMYO", "A", { q: 5, r: 5 }); // Hatamoto: mounted always
    expect(ctrl.movementAllowance(daimyo)).toBe(b.def(daimyo).mov + 1);
  });

  it("mounted 'war' grants +1 Movement only while an enemy is within 6 hexes", () => {
    const { b, ctrl } = newBattle();
    const retainer = b.spawn("SAM_SECOND_WHITE-CRANE-RETAINER", "A", { q: 5, r: 5 });
    expect(ctrl.movementAllowance(retainer)).toBe(b.def(retainer).mov);
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    expect(ctrl.movementAllowance(retainer)).toBe(b.def(retainer).mov + 1);
  });

  it("commandRadiusBonus lets the Daimyo's aura reach a platoon member beyond the base radius", () => {
    const { b } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    const cmdr = b.unit(p.commanderUid!);
    const foot = b.unit(p.footUids[0]!);
    expect(b.def(cmdr).commandRadius).toBe(3);
    b.place(foot, { q: cmdr.pos!.q + 4, r: cmdr.pos!.r }); // beyond the base radius, within the +2 rank bonus
    expect(b.distance(cmdr, foot)).toBe(4);
    const atk = computeStat(b, foot, "ATK");
    expect(atk.modifiers.find((m) => m.source.includes("Commander aura"))?.value).toBe(100);
  });

  it("castle grants allies on a Fortification hex inside the leader's radius a further +100 DEF", () => {
    const { b } = newBattle();
    const p = deploy(b, "S", "A", SAM, blob(5, 5));
    // Only the castle-holding rungs carry the privilege; a Hatamoto commander does not.
    const cmdr = b.spawn("SAM_LORD_ASHFALL-DAIMYO", "A", { q: 9, r: 9 }, { platoonId: p.id }); // Joshu Daimyo: castle
    const foot = b.unit(p.footUids[0]!);
    const fort = { q: cmdr.pos!.q, r: cmdr.pos!.r - 4 }; // distance 4: clear of the deployment blob, inside the boosted radius
    b.terrain.set(`${fort.q},${fort.r}`, "Fortification");
    b.place(foot, fort);
    const def = computeStat(b, foot, "DEF");
    expect(def.modifiers.find((m) => m.source === "Terrain: Fortification")?.value).toBe(200);
    expect(def.modifiers.find((m) => m.source.includes("castle"))?.value).toBe(100);
  });

  it("canopy step lets a Shinobi cross Forest for 1 Movement instead of 2", () => {
    const { b, ctrl } = newBattle();
    const operative = b.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 10, r: 10 });
    b.terrain.set("11,10", "Forest");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(ctrl.reachable(operative).get("11,10")?.cost).toBe(1);
  });

  it("hideOnForestStop applies Hidden when a Chunin-or-higher Shinobi ends its move in Forest", () => {
    const { b, ctrl } = newBattle();
    const lieutenant = b.spawn("SHI_SECOND_REED-SIGNAL-LIEUTENANT", "A", { q: 10, r: 10 });
    b.terrain.set("11,10", "Forest");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    ctrl.move(lieutenant, { q: 11, r: 10 });
    expect(b.hasStatus(lieutenant, "Hidden")).toBe(true);
  });

  it("ignoreZoc lets a Jounin-or-higher Shinobi leave an enemy's side without a reaction attack", () => {
    const { b, ctrl } = newBattle();
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 5, r: 6 });
    const jonin = b.spawn("SHI_COMMANDER_VEILED-MOON-JONIN", "A", { q: 5, r: 7 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    const hp = jonin.hp;
    ctrl.move(jonin, { q: 5, r: 8 });
    expect(jonin.hp).toBe(hp);
    expect(b.events.some((e) => e.type === "ReactionAttack")).toBe(false);
  });

  it("Anbu's bonusMov adds +1 Movement and passAllies lets it move through an allied hex", () => {
    const { b, ctrl } = newBattle();
    const adept = b.spawn("SHI_ELITE_MIRROR-SHADE-ADEPT", "A", { q: 5, r: 5 });
    expect(ctrl.movementAllowance(adept)).toBe(b.def(adept).mov + 1);
    b.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 6, r: 5 });
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(ctrl.reachable(adept).has("7,5")).toBe(true);
  });
});
