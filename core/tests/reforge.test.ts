import { describe, it, expect } from "vitest";
import { reg } from "./helpers.js";
import { newKingdom, reforge, reforgeCost, reforgeTargets } from "../src/kingdom.js";

describe("reforging duplicate cards", () => {
  // The roster grows, so these assert the rule rather than a frozen list of ids: any card the roster
  // adds one star above a source is a legitimate new target, and must still obey every clause.
  it("targets are same-faction, not summon-only, not Divine, exactly one star above the source", () => {
    for (const src of ["KNI_FOOT_BASTION-MAN-AT-ARMS", "KNI_LEVY_BASTION-SQUIRE"]) {
      const from = reg.unit(src);
      const targets = reforgeTargets(reg, src);
      expect(targets.length, src).toBeGreaterThan(0);
      for (const t of targets) {
        expect(t.faction, t.id).toBe(from.faction);
        expect(t.stars, t.id).toBe((from.stars ?? 1) + 1);
        expect(t.summonOnly, t.id).toBeFalsy();
        expect(t.divine, t.id).toBeUndefined();
      }
    }
    // the hand-authored ladder step is still among them
    expect(reforgeTargets(reg, "KNI_LEVY_BASTION-SQUIRE").map((d) => d.id)).toContain("KNI_FOOT_BASTION-MAN-AT-ARMS");
  });

  it("has no target once there is no card a star above the source", () => {
    // Nothing sits above ten stars, so a ten-star card can never be reforged upward.
    for (const d of reg.units.values()) {
      if (d.stars === 10) expect(reforgeTargets(reg, d.id), d.id).toEqual([]);
    }
  });

  it("never offers a summon-only card as a target", () => {
    for (const d of reg.units.values()) {
      for (const t of reforgeTargets(reg, d.id)) expect(t.summonOnly, `${d.id} -> ${t.id}`).toBeFalsy();
    }
  });

  it("costs more copies of a low-star card than a high-star one, and nothing spends a 10-star card", () => {
    expect(reforgeCost(reg, "KNI_LEVY_BASTION-SQUIRE")).toBeGreaterThan(reforgeCost(reg, "KNI_ELITE_SKY-LANCE-DRAGOON"));
    expect(reforgeCost(reg, "SHI_KAGE_VOID-CROWN-KAGE")).toBe(0);
  });

  it("spends the cost in copies of the source for exactly one copy of the target", () => {
    const k = newKingdom(reg, "KNI");
    const cost = reforgeCost(reg, "KNI_LEVY_BASTION-SQUIRE");
    k.collection["KNI_LEVY_BASTION-SQUIRE"] = cost;
    const r = reforge(reg, k, "KNI_LEVY_BASTION-SQUIRE", "KNI_FOOT_BASTION-MAN-AT-ARMS");
    expect(r.ok).toBe(true);
    expect(k.collection["KNI_LEVY_BASTION-SQUIRE"]).toBe(0);
    expect(k.collection["KNI_FOOT_BASTION-MAN-AT-ARMS"]).toBe(1);
  });

  it("refuses to reforge without enough copies", () => {
    const k = newKingdom(reg, "KNI");
    const cost = reforgeCost(reg, "KNI_LEVY_BASTION-SQUIRE");
    k.collection["KNI_LEVY_BASTION-SQUIRE"] = cost - 1;
    const r = reforge(reg, k, "KNI_LEVY_BASTION-SQUIRE", "KNI_FOOT_BASTION-MAN-AT-ARMS");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(new RegExp(`takes ${cost} cop`));
    expect(k.collection["KNI_LEVY_BASTION-SQUIRE"]).toBe(cost - 1);
    expect(k.collection["KNI_FOOT_BASTION-MAN-AT-ARMS"] ?? 0).toBe(0);
  });

  it("refuses a target that is not one star above, not the source's faction, or does not exist", () => {
    const k = newKingdom(reg, "KNI");
    k.collection["KNI_LEVY_BASTION-SQUIRE"] = 20;
    expect(reforge(reg, k, "KNI_LEVY_BASTION-SQUIRE", "KNI_SUPPORT_PORTAL-KEEPER").ok).toBe(false); // two stars up
    expect(reforge(reg, k, "KNI_LEVY_BASTION-SQUIRE", "SAM_FOOT_EMBERLINE-ASHIGARU").ok).toBe(false); // wrong faction
    expect(reforge(reg, k, "KNI_LEVY_BASTION-SQUIRE", "NOT_A_CARD").ok).toBe(false);
    expect(k.collection["KNI_LEVY_BASTION-SQUIRE"]).toBe(20); // no partial spend on a rejected reforge
  });

  it("refuses a card at the top of the star scale, even with unlimited copies", () => {
    const k = newKingdom(reg, "KNI");
    k.collection["SHI_KAGE_VOID-CROWN-KAGE"] = 99;
    const r = reforge(reg, k, "SHI_KAGE_VOID-CROWN-KAGE", "anything");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/cannot be reforged further/);
  });
});
