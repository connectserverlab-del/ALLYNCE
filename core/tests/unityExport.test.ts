import { describe, it, expect } from "vitest";
import { reg } from "./helpers.js";
import { effectKindsCsSource, terrainRulesCsSource, dataManifest } from "../src/unityExport.js";
import { EFFECT_KINDS } from "../src/effects.js";
import { TERRAIN_RULES } from "../src/types.js";
import type { Terrain } from "../src/types.js";

describe("unity port scaffold generators", () => {
  it("lists every known effect kind exactly once, as a valid C# identifier", () => {
    const src = effectKindsCsSource();
    for (const kind of EFFECT_KINDS) {
      expect(src.match(new RegExp(`public const string ${kind} = "${kind}";`))).toBeTruthy();
      expect(kind).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
    }
    const constLines = src.match(/public const string \w+ = "\w+";/g) ?? [];
    expect(constLines.length).toBe(EFFECT_KINDS.length);
    expect(new Set(constLines).size).toBe(constLines.length); // no duplicates
  });

  it("mirrors TERRAIN_RULES exactly, so the two tables cannot silently drift", () => {
    const src = terrainRulesCsSource();
    for (const terrain of Object.keys(TERRAIN_RULES) as Terrain[]) {
      const rule = TERRAIN_RULES[terrain];
      const block = src.match(new RegExp(`TerrainKind\\.${terrain}, new TerrainRule \\{[\\s\\S]*?\\} \\},`));
      expect(block, `missing block for ${terrain}`).toBeTruthy();
      const text = block![0];
      const cost = (v: number | null) => (v === null ? "null" : `${v}`);
      expect(text).toContain(`CostFoot = ${cost(rule.costFoot)}`);
      expect(text).toContain(`CostCavalry = ${cost(rule.costCavalry)}`);
      expect(text).toContain(`CostFlying = ${cost(rule.costFlying)}`);
      expect(text).toContain(`Def = ${rule.def}`);
      expect(text).toContain(`Concealment = ${rule.concealment}`);
      expect(text).toContain(`BlocksSight = ${rule.blocksSight}`);
      expect(text).toContain(`ChargeBreaks = ${rule.chargeBreaks}`);
      expect(text).toContain(`RangedAtk = ${rule.ranged.atk}`);
      expect(text).toContain(`RangedRange = ${rule.ranged.range}`);
    }
  });

  it("summarizes the loaded registry with matching counts and sorted, deduplicated ids", () => {
    const manifest = dataManifest(reg);
    expect(manifest.units).toBe(reg.units.size);
    expect(manifest.abilities).toBe(reg.abilities.size);
    expect(manifest.factions).toBe(reg.factions.size);
    expect(manifest.effectKinds).toBe(EFFECT_KINDS.length);
    expect(manifest.unitIds).toEqual([...manifest.unitIds].sort());
    expect(new Set(manifest.unitIds).size).toBe(manifest.unitIds.length);
    expect(manifest.unitIds).toContain("SAM_COMMANDER_EMBER-BANNER-DAIMYO");
  });
});
