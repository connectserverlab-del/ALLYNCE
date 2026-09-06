import { describe, it, expect } from "vitest";
import { reg } from "./helpers.js";
import { validateArmy } from "../src/composition.js";

const all = [...reg.units.values()];
const expansion = all.filter((u) => u.stars !== undefined);
const tenStar = all.filter((u) => u.stars === 10);

describe("expansion roster", () => {
  it("every expansion unit carries a legal star rating and tier", () => {
    for (const u of expansion) {
      expect(u.stars, u.id).toBeGreaterThanOrEqual(1);
      expect(u.stars, u.id).toBeLessThanOrEqual(10);
      expect(u.tier, u.id).toBeTruthy();
      expect(u.className, u.id).toBeTruthy();
      expect(u.lore, u.id).toBeTruthy();
    }
  });

  it("stat budget rises monotonically with star rating for the same archetype", () => {
    const foot = expansion
      .filter((u) => u.faction === "SAM" && u.roles.includes("FootSoldier"))
      .sort((a, b) => a.stars! - b.stars!);
    for (let i = 1; i < foot.length; i++) expect(foot[i]!.atk).toBeGreaterThan(foot[i - 1]!.atk);
  });

  it("ten-star units are off the curve, one-copy, and carry a signature ability", () => {
    // Compare the whole stat budget: a ten-star guardian spends it on DEF/HP, not ATK.
    const budget = (u: { hp: number; atk: number; def: number }) => u.hp + u.atk + u.def;
    const nineStarMax = Math.max(...expansion.filter((u) => u.stars === 9).map(budget));
    expect(tenStar.length).toBeGreaterThanOrEqual(20);
    for (const u of tenStar) {
      expect(budget(u), u.id).toBeGreaterThan(nineStarMax);
      expect(u.uniqueLimit, u.id).toBe(1);
      expect(u.signature, u.id).toBeTruthy();
      expect(u.actives, u.id).toContain(u.signature);
      // Ascendants manifest and are anchored rather than simply dying.
      expect(u.divine, u.id).toBeDefined();
      expect(u.divine!.arrival, u.id).toBeTruthy();
    }
  });

  it("every angel flies and every archangel is limited to one copy", () => {
    const angels = all.filter((u) => u.faction === "ANG");
    expect(angels.length).toBeGreaterThanOrEqual(30);
    for (const a of angels) expect(a.flying, a.id).toBe(true);
    const archangels = angels.filter((a) => a.keywords?.includes("Archangel"));
    expect(archangels.length).toBeGreaterThanOrEqual(8);
    for (const a of archangels) expect(a.uniqueLimit, a.id).toBe(1);
  });

  it("fusion units keep both parent themes so they bridge two cohesion groups", () => {
    const fusions = all.filter((u) => u.fusion);
    expect(fusions.length).toBe(35);
    for (const f of fusions) {
      expect(f.themes.length, f.id).toBe(2);
      expect(f.faction).toBe("FUS");
    }
    const archetypes = new Set(fusions.map((f) => f.className));
    expect(archetypes.size).toBe(7);
    for (const a of archetypes) expect(fusions.filter((f) => f.className === a).length).toBe(5);
  });

  it("requested per-faction expansion counts are met", () => {
    const n = (f: string) => all.filter((u) => u.faction === f).length;
    const ten = (f: string) => all.filter((u) => u.faction === f && u.stars === 10).length;
    for (const f of ["SAM", "SHI", "KNI"]) { expect(n(f), f).toBeGreaterThanOrEqual(24); expect(ten(f), f).toBe(2); }
    expect(n("THC")).toBeGreaterThanOrEqual(20); expect(ten("THC")).toBe(2);
    expect(n("DRG")).toBeGreaterThanOrEqual(34); expect(ten("DRG")).toBe(3);
    expect(n("STM")).toBeGreaterThanOrEqual(20);
    expect(n("MNK")).toBeGreaterThanOrEqual(20);
    expect(all.length).toBeGreaterThanOrEqual(250);
  });

  it("monastic orders include one-copy holders", () => {
    const holders = all.filter((u) => u.faction === "MNK" && u.uniqueLimit === 1);
    expect(holders.length).toBeGreaterThanOrEqual(4);
  });
});

describe("army limits", () => {
  const platoon = (elite: string) => ({
    id: "P1", side: "A", faction: "SAM",
    commander: "SAM_COMMANDER_EMBER-BANNER-DAIMYO",
    second: "SAM_SECOND_WHITE-CRANE-RETAINER",
    elite,
    foot: Array(5).fill("SAM_FOOT_EMBERLINE-ASHIGARU"),
  });

  it("rejects a second Ascendant in the same army", () => {
    const r = validateArmy(reg, {
      side: "A", capacity: 9999,
      platoons: [platoon("SAM_ELITE_KAGARIBI-THE-UNSHEATHED-DAWN"),
        { ...platoon("SAM_ELITE_KAGARIBI-THE-UNSHEATHED-DAWN"), id: "P2" }],
      specialists: [],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/Ascendant/);
  });

  it("allows exactly one Ascendant across two platoons", () => {
    const r = validateArmy(reg, {
      side: "A", capacity: 9999,
      platoons: [
        platoon("SAM_ELITE_KAGARIBI-THE-UNSHEATHED-DAWN"),
        {
          ...platoon("SAM_ELITE_ONI-GATE-CHAMPION"), id: "P2",
          commander: "SAM_COMMANDER_IRON-CHRYSANTHEMUM-CAPTAIN",
          second: "SAM_SECOND_RETAINER-OF-THE-DAWN-EDGE",
        },
      ],
      specialists: [],
    });
    expect(r.errors).toEqual([]);
  });
});
