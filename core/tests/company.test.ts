import { describe, it, expect } from "vitest";
import { newBattle, deploy, blob, reg } from "./helpers.js";
import { validateArmy, organizationLevel } from "../src/composition.js";
import type { PlatoonBlueprint } from "../src/composition.js";

/**
 * Before the extra Commander/Second/Elite cards, a host faction owned exactly one of each and
 * `uniqueCopiesPerArmy` (1) made a second or third platoon's leadership impossible to deploy at
 * the same time as the first. Three named alternates per slot make a three-platoon Company
 * actually buildable for the first time.
 */
const TRIADS: Record<string, { commanders: string[]; seconds: string[]; elites: string[]; foot: string }> = {
  SAM: {
    commanders: ["SAM_COMMANDER_EMBER-BANNER-DAIMYO", "SAM_COMMANDER_STONEGATE-WARDEN", "SAM_COMMANDER_CINDERWATCH-CAPTAIN"],
    seconds: ["SAM_SECOND_WHITE-CRANE-RETAINER", "SAM_SECOND_IRON-SASH-LIEUTENANT", "SAM_SECOND_JADE-CREST-RETAINER"],
    elites: ["SAM_ELITE_ONI-GATE-CHAMPION", "SAM_ELITE_CRIMSON-FANG-DUELIST", "SAM_ELITE_ASHEN-BLADE-SENTINEL"],
    foot: "SAM_FOOT_EMBERLINE-ASHIGARU",
  },
  KNI: {
    commanders: ["KNI_COMMANDER_SOLAR-BASTION-MARSHAL", "KNI_COMMANDER_IRONWALL-MARSHAL", "KNI_COMMANDER_VIGIL-BASTION-LORD"],
    seconds: ["KNI_SECOND_OATHBOUND-CASTELLAN", "KNI_SECOND_DAWNGUARD-LIEUTENANT", "KNI_SECOND_OATH-SHIELD-KNIGHT"],
    elites: ["KNI_ELITE_SKY-LANCE-DRAGOON", "KNI_ELITE_STORMBREAKER-PALADIN", "KNI_ELITE_SILVER-VOW-CHAMPION"],
    foot: "KNI_FOOT_BASTION-MAN-AT-ARMS",
  },
  SHI: {
    commanders: ["SHI_COMMANDER_VEILED-MOON-JONIN", "SHI_COMMANDER_HOLLOW-REED-JONIN", "SHI_COMMANDER_ASHVEIL-STRATEGIST"],
    seconds: ["SHI_SECOND_REED-SIGNAL-LIEUTENANT", "SHI_SECOND_INK-STEP-LIEUTENANT", "SHI_SECOND_SILENT-BELL-OPERATIVE"],
    elites: ["SHI_ELITE_MIRROR-SHADE-ADEPT", "SHI_ELITE_HOLLOW-MASK-ADEPT", "SHI_ELITE_NIGHT-GLASS-ASSASSIN"],
    foot: "SHI_FOOT_NIGHT-THREAD-OPERATIVE",
  },
  DRG: {
    commanders: ["DRG_COMMANDER_RIFTWING-DOMINANT", "DRG_COMMANDER_ASHWING-DOMINANT", "DRG_COMMANDER_STORMSCALE-SOVEREIGN"],
    seconds: ["DRG_SECOND_STORMCLAW-WINGSECOND", "DRG_SECOND_EMBERCLAW-WINGSECOND", "DRG_SECOND_DUSKWING-SECOND"],
    elites: ["DRG_ELITE_OBSIDIAN-MAW", "DRG_ELITE_CINDERMAW-STALKER", "DRG_ELITE_ASHFANG-RAVAGER"],
    foot: "DRG_FOOT_SLATEWING-DRAKE",
  },
};

function threePlatoons(faction: string): PlatoonBlueprint[] {
  const t = TRIADS[faction]!;
  return [0, 1, 2].map((i) => ({
    id: `P${i}`, side: "A", faction,
    commander: t.commanders[i]!, second: t.seconds[i]!, elite: t.elites[i]!,
    foot: Array(5).fill(t.foot),
  }));
}

describe("a host faction can now field a Company", () => {
  for (const faction of Object.keys(TRIADS)) {
    it(`${faction}: three distinct named leaders validate as one army and register as a Company on the field`, () => {
      const platoons = threePlatoons(faction);
      const result = validateArmy(reg, { side: "A", capacity: 9999, platoons, specialists: [] });
      expect(result.errors).toEqual([]);
      expect(result.ok).toBe(true);

      const { b } = newBattle();
      deploy(b, platoons[0]!.id, "A", platoons[0]!, blob(2, 2));
      deploy(b, platoons[1]!.id, "A", platoons[1]!, blob(2, 8));
      deploy(b, platoons[2]!.id, "A", platoons[2]!, blob(2, 14));
      expect(organizationLevel(b, "A")).toBe("Company");
    });
  }

  it("still rejects reusing the same unique commander across platoons (why the extra cards were needed)", () => {
    const t = TRIADS.SAM!;
    const platoons: PlatoonBlueprint[] = [0, 1, 2].map((i) => ({
      id: `P${i}`, side: "A", faction: "SAM",
      commander: t.commanders[0]!, second: t.seconds[0]!, elite: t.elites[0]!,
      foot: Array(5).fill(t.foot),
    }));
    const result = validateArmy(reg, { side: "A", capacity: 9999, platoons, specialists: [] });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/appears 3 times/);
  });
});
