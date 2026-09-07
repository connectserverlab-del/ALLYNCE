import { describe, it, expect } from "vitest";
import { newBattle, reg } from "./helpers.js";
import { rankOf } from "../src/ranks.js";

describe("Shinobi ranks and movement traits", () => {
  it("has six ranks with escalating movement traits", () => {
    const l = reg.ranks.get("SHI")!;
    expect(l.ranks.map((r) => r.title)).toEqual(["Apprentice", "Genin", "Chunin", "Jounin", "Anbu", "Kage"]);
    expect(l.ranks[5]!.movement?.shadowStep).toBe(3);
  });
  it("Genin cross forest tree to tree at cost 1 while a Knight pays 2", () => {
    const { b, ctrl } = newBattle();
    const genin = b.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 2, r: 5 });
    const knight = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "A", { q: 2, r: 10 });
    for (const q of [3, 4, 5, 6, 7]) { b.terrain.set(`${q},5`, "Forest"); b.terrain.set(`${q},10`, "Forest"); }
    expect(rankOf(b, genin)?.title).toBe("Genin");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(ctrl.reachable(genin).get("7,5")?.cost).toBe(5);   // 5 forest hexes at 1 each, within MOV 6
    expect(ctrl.reachable(knight).has("7,10")).toBe(false);   // 5 forest hexes at 2 each exceeds MOV 3
    expect(ctrl.reachable(knight).get("3,10")?.cost).toBe(2);
  });
  it("Chunin hide when stopping in forest; Jounin ignore zones of control", () => {
    const { b, ctrl } = newBattle();
    const chunin = b.spawn("SHI_SECOND_REED-SIGNAL-LIEUTENANT", "A", { q: 2, r: 2 });
    b.terrain.set("3,2", "Forest");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    ctrl.move(chunin, { q: 3, r: 2 });
    expect(b.hasStatus(chunin, "Hidden")).toBe(true);
    const jounin = b.spawn("SHI_COMMANDER_VEILED-MOON-JONIN", "A", { q: 10, r: 10 });
    b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 11, r: 10 });
    jounin.ap = 2; const hp = jounin.hp;
    ctrl.move(jounin, { q: 9, r: 10 });
    expect(jounin.hp).toBe(hp); // no reaction attack
  });
  it("Kage Shadow Step relocates into cover once per activation", () => {
    const { b, ctrl } = newBattle();
    const kage = b.spawn("SHI_COMMANDER_VEILED-MOON-JONIN", "A", { q: 5, r: 5 });
    b.reg.units.get("SHI_COMMANDER_VEILED-MOON-JONIN")!.factionRank = "KAGE";
    b.terrain.set("8,5", "Forest");
    ctrl.commandPhase(); ctrl.beginActivation("ind:A");
    expect(() => ctrl.shadowStep(kage, { q: 7, r: 5 })).toThrow(/cover/);
    ctrl.shadowStep(kage, { q: 8, r: 5 });
    expect(kage.pos).toEqual({ q: 8, r: 5 });
    expect(b.hasStatus(kage, "Hidden")).toBe(true);
    expect(() => ctrl.shadowStep(kage, { q: 8, r: 5 })).toThrow();
    b.reg.units.get("SHI_COMMANDER_VEILED-MOON-JONIN")!.factionRank = "JOUNIN";
  });
});
