import { describe, it, expect } from "vitest";
import { newBattle, deploy, SAM, KNI, blob, reg } from "./helpers.js";
import { validateArmy, activeLeader, doctrineState } from "../src/composition.js";

describe("composition.ts: validateArmy slot and faction checks", () => {
  it("flags a unit placed in a slot it does not carry", () => {
    // SAM_FOOT_EMBERLINE-ASHIGARU only declares the FootSoldier slot.
    const r = validateArmy(reg, {
      side: "A", capacity: 200,
      platoons: [{ id: "P", side: "A", ...SAM, commander: "SAM_FOOT_EMBERLINE-ASHIGARU" }],
      specialists: [],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/P: SAM_FOOT_EMBERLINE-ASHIGARU cannot fill Commander/);
  });

  it("flags a second whose faction rank cannot assume platoon command", () => {
    // SAM_FOOT_EMBERLINE-ASHIGARU holds KOYAKUNIN, which leads nothing (see data/factions/ranks/SAM.json).
    const r = validateArmy(reg, {
      side: "A", capacity: 200,
      platoons: [{ id: "P", side: "A", ...SAM, second: "SAM_FOOT_EMBERLINE-ASHIGARU" }],
      specialists: [],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/P: second SAM_FOOT_EMBERLINE-ASHIGARU holds rank KOYAKUNIN and could not assume platoon command/);
  });

  it("flags a platoon whose foot line is not all one faction with its leadership", () => {
    const r = validateArmy(reg, {
      side: "A", capacity: 200,
      platoons: [{ id: "P", side: "A", ...SAM, foot: [...SAM.foot.slice(0, 4), "KNI_FOOT_BASTION-MAN-AT-ARMS"] }],
      specialists: [],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/P: mixed factions (SAM,KNI|KNI,SAM)/);
  });

  it("a clean platoon from a single faction passes with no leadership or faction errors", () => {
    const r = validateArmy(reg, { side: "A", capacity: 200, platoons: [{ id: "P", side: "A", ...KNI }], specialists: [] });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejects a specialist that is summon-only, alongside the existing commander/elite unlock rule", () => {
    // Every current specialist-eligible unit in the registry has summonOnly: false, so this exercises
    // the branch directly against the Boss/Deity pool that the "summon-only" wording also covers.
    const r = validateArmy(reg, {
      side: "A", capacity: 200,
      platoons: [{ id: "P", side: "A", ...SAM }],
      specialists: ["DIV_BOSS_SOVEREIGN-OF-MEMORY"],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/DIV_BOSS_SOVEREIGN-OF-MEMORY is summon-only/);
  });

  it("wizardsPerPlatoon can never trigger: no unit in the registry carries rank \"Wizard\"", () => {
    // composition.ts filters `reg.unit(id).rank === "Wizard"`, but the `rank` enum in data/units/units.json
    // is Commander/Second/Elite/Foot/Cavalry/Specialist/Levy/Lord/Kage/Shogun/King/Elder/Deity — never "Wizard".
    // ARC_ELITE_STORMGLASS-WIZARD, the one unit whose name suggests it, carries rank "Elite". So the limit in
    // data/compositions/platoon.json ("wizardsPerPlatoon": 1) is currently dead code: no army can ever trip it,
    // however many spellcasters it fields. Documented here rather than silently "fixed" because picking which
    // role should count as a wizard (Ritualist? a new tag?) is a rules call for the roadmap, not a test file.
    const wizardRanked = [...reg.units.values()].filter((d: any) => d.rank === "Wizard");
    expect(wizardRanked).toHaveLength(0);
    const stacked = validateArmy(reg, {
      side: "A", capacity: 999,
      platoons: [
        { id: "P1", side: "A", ...SAM, elite: "ARC_ELITE_STORMGLASS-WIZARD" },
      ],
      specialists: [],
    });
    expect(stacked.errors.join("\n")).not.toMatch(/too many Wizards/);
  });
});

describe("composition.ts: activeLeader", () => {
  it("returns the commander's uid while alive and fielded", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    expect(activeLeader(b, p)).toBe(p.commanderUid);
  });

  it("returns null once the commander is defeated and removed from the field", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    const commander = b.unit(p.commanderUid!);
    commander.defeated = true;
    b.remove(commander);
    expect(activeLeader(b, p)).toBeNull();
  });

  it("returns null for a platoon with no commander on record", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    p.commanderUid = null;
    expect(activeLeader(b, p)).toBeNull();
  });
});

describe("composition.ts: doctrineState", () => {
  it("is Broken once the elite falls, even with a full foot line and a living commander", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(5, 5));
    expect(doctrineState(b, p)).toBe("Full");
    const elite = b.unit(p.eliteUid!);
    elite.defeated = true;
    b.remove(elite);
    expect(doctrineState(b, p)).toBe("Broken");
  });
});
