import { describe, it, expect } from "vitest";
import { newBattle, deploy, reg, SAM, SHI, blob } from "./helpers.js";
import { computeStat } from "../src/modifiers.js";

describe("Samurai and Shinobi rank ladders", () => {
  it("resolves a unit's rung on its faction's ladder; factions without a ladder yet resolve to none", () => {
    const daimyo = reg.rankOf(reg.unit("SAM_COMMANDER_EMBER-BANNER-DAIMYO"));
    expect(daimyo?.title).toBe("Joshu Daimyo");
    const jonin = reg.rankOf(reg.unit("SHI_COMMANDER_VEILED-MOON-JONIN"));
    expect(jonin?.title).toBe("Jounin");
    expect(reg.rankOf(reg.unit("KNI_COMMANDER_SOLAR-BASTION-MARSHAL"))).toBeUndefined();
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
    const champion = b.spawn("SAM_ELITE_ONI-GATE-CHAMPION", "A", { q: 5, r: 5 });
    expect(ctrl.movementAllowance(champion)).toBe(b.def(champion).mov + 1);
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
    const cmdr = b.unit(p.commanderUid!);
    const foot = b.unit(p.footUids[0]!);
    const fort = { q: cmdr.pos!.q, r: cmdr.pos!.r - 4 }; // distance 4: outside the platoon's deployment blob, inside the boosted radius
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
