import { describe, it, expect } from "vitest";
import { newBattle, deploy, blob, SAM } from "./helpers.js";
import { organizationLevel } from "../src/composition.js";

/**
 * `organizationLevel` reads a side's fielded platoons and buckets them at None / Platoon / Company
 * thresholds (0, 1-2, 3+ non-Broken platoons). Nothing in the engine reads the result yet, but the
 * rank ladders already declare which ranks may lead a Company (see `docs/samurai-ranks.md`), so the
 * helper is load-bearing for whatever gives that tier its own battlefield weight.
 */
describe("organizationLevel", () => {
  it("is None for a side with no platoons at all", () => {
    const { b } = newBattle();
    expect(organizationLevel(b, "A")).toBe("None");
  });

  it("is None once every platoon has broken, not merely reduced", () => {
    const { b } = newBattle();
    const p = deploy(b, "P1", "A", SAM, blob(0, 0));
    // Drop three of five foot: below the Reduced floor of 3, so the platoon goes Broken.
    for (const uid of p.footUids.slice(0, 3)) { b.unit(uid)!.defeated = true; b.remove(b.unit(uid)!); }
    expect(organizationLevel(b, "A")).toBe("None");
  });

  it("is Platoon with one or two non-Broken platoons fielded", () => {
    const { b } = newBattle();
    deploy(b, "P1", "A", SAM, blob(0, 0));
    expect(organizationLevel(b, "A")).toBe("Platoon");
    deploy(b, "P2", "A", SAM, blob(0, 4));
    expect(organizationLevel(b, "A")).toBe("Platoon");
  });

  it("is Company once a third non-Broken platoon joins the same side", () => {
    const { b } = newBattle();
    deploy(b, "P1", "A", SAM, blob(0, 0));
    deploy(b, "P2", "A", SAM, blob(0, 4));
    deploy(b, "P3", "A", SAM, blob(0, 8));
    expect(organizationLevel(b, "A")).toBe("Company");
  });

  it("a Broken platoon among the three does not count toward Company", () => {
    const { b } = newBattle();
    deploy(b, "P1", "A", SAM, blob(0, 0));
    deploy(b, "P2", "A", SAM, blob(0, 4));
    const p3 = deploy(b, "P3", "A", SAM, blob(0, 8));
    for (const uid of p3.footUids.slice(0, 3)) { b.unit(uid)!.defeated = true; b.remove(b.unit(uid)!); }
    expect(organizationLevel(b, "A")).toBe("Platoon");
  });

  it("counts each side's platoons independently", () => {
    const { b } = newBattle();
    deploy(b, "P1", "A", SAM, blob(0, 0));
    deploy(b, "P2", "A", SAM, blob(0, 4));
    deploy(b, "P3", "A", SAM, blob(0, 8));
    deploy(b, "Q1", "B", SAM, blob(12, 0));
    expect(organizationLevel(b, "A")).toBe("Company");
    expect(organizationLevel(b, "B")).toBe("Platoon");
  });
});
