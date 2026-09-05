import { describe, it, expect } from "vitest";
import { Registry } from "../src/registry.js";
import { reg } from "./helpers.js";
import type { FusionRecipe } from "../src/fusion.js";

/** Rebuild a Registry from the real loaded data, swapping in one replacement fusion list. */
function withFusions(fusions: FusionRecipe[]): () => Registry {
  return () =>
    new Registry(
      [...reg.units.values()],
      [...reg.abilities.values()],
      Object.fromEntries([...reg.factions.values()].map((f) => [f.id, f])),
      reg.rules,
      [...reg.ranks.values()],
      fusions,
      reg.deckRules,
      [...reg.sideCards.values()],
      reg.kingdom,
      [...reg.research.values()],
      [...reg.banners.values()],
      reg.wanted,
      reg.march,
    );
}

const REAL_FUSION = reg.fusions.get("FUS_PAIRED_LINE")!;

/** The real fusion table with FUS_PAIRED_LINE swapped for a broken copy. Every recipe here is named by
 * a side card (see data/cards/side_cards.json), so dropping one instead of swapping it fails that
 * unrelated check first. */
function withPairedLineReplacedBy(broken: FusionRecipe): FusionRecipe[] {
  return [...reg.fusions.values()].map((r) => (r.id === "FUS_PAIRED_LINE" ? broken : r));
}

describe("fusion recipes are checked at load time, the same as unit and faction references", () => {
  it("accepts the real fusion table", () => {
    expect(withFusions([...reg.fusions.values()])).not.toThrow();
  });

  it("rejects a recipe naming a missing input unit", () => {
    const broken: FusionRecipe = { ...REAL_FUSION, inputs: [{ defId: "SAM_NO_SUCH_UNIT" }, { defId: "SAM_NO_SUCH_UNIT" }] };
    expect(withFusions(withPairedLineReplacedBy(broken))).toThrow(/missing input/);
  });

  it("rejects a recipe naming a missing result unit", () => {
    const broken: FusionRecipe = { ...REAL_FUSION, result: { ...REAL_FUSION.result, defId: "DIV_NO_SUCH_UNIT" } };
    expect(withFusions(withPairedLineReplacedBy(broken))).toThrow(/missing result unit/);
  });

  it("rejects a recipe granting a missing ability", () => {
    const broken: FusionRecipe = { ...REAL_FUSION, result: { ...REAL_FUSION.result, passives: ["ABL_NO_SUCH_ABILITY"] } };
    expect(withFusions(withPairedLineReplacedBy(broken))).toThrow(/missing ability/);
  });
});
