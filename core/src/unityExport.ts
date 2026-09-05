import type { Terrain, TerrainRule } from "./types.js";
import { TERRAIN_RULES } from "./types.js";
import { EFFECT_KINDS, type EffectKind } from "./effects.js";
import type { Registry } from "./data.js";

/**
 * Pure generators for the Unity port scaffold under `unity/Generated/`. Nothing here touches the
 * filesystem; `scripts/generate-unity-scaffold.ts` calls these and writes the result, so the shape
 * of the output is unit-testable without any I/O (see `core/tests/unityExport.test.ts`).
 *
 * These generators exist because the engine's contract lives in two places that must never drift:
 * the `effect.kind` strings abilities.json is allowed to use (core/src/effects.ts), and the terrain
 * numbers every combat roll depends on (core/src/types.ts). Regenerating from those modules, rather
 * than hand-writing the C# once, is what keeps the Unity side honest as the TypeScript reference
 * keeps changing.
 */

const HEADER = "// GENERATED FILE — do not hand-edit.\n// Run `npm run unity:scaffold` to regenerate from core/src and data/.\n";

function csIdentifier(kind: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(kind) ? kind : `Kind_${kind.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

/** `unity/Generated/EffectKinds.g.cs` — one string constant plus a lookup set per known effect.kind. */
export function effectKindsCsSource(kinds: readonly string[] = EFFECT_KINDS): string {
  const consts = kinds.map((k) => `        public const string ${csIdentifier(k)} = "${k}";`).join("\n");
  const setEntries = kinds.map((k) => `            ${csIdentifier(k)},`).join("\n");
  return `${HEADER}
namespace Allynce.Generated
{
    /// <summary>
    /// Every effect.kind the TypeScript reference (core/src/effects.ts) understands, mirrored so
    /// C# code can reference a kind by name instead of a bare string. See
    /// core/src/effects.ts EFFECT_KINDS and unity/Runtime/IEffectHandler.cs.
    /// </summary>
    public static class EffectKinds
    {
${consts}

        public static readonly System.Collections.Generic.HashSet<string> All = new System.Collections.Generic.HashSet<string>
        {
${setEntries}
        };
    }
}
`;
}

/** `unity/Generated/TerrainRules.g.cs` — a static table matching TERRAIN_RULES exactly, field for field. */
export function terrainRulesCsSource(rules: Record<Terrain, TerrainRule> = TERRAIN_RULES): string {
  const cost = (v: number | null) => (v === null ? "null" : `${v}`);
  const entries = (Object.keys(rules) as Terrain[])
    .map((terrain) => {
      const r = rules[terrain];
      return `            { TerrainKind.${terrain}, new TerrainRule {\n` +
        `                CostFoot = ${cost(r.costFoot)}, CostCavalry = ${cost(r.costCavalry)}, CostFlying = ${cost(r.costFlying)},\n` +
        `                Def = ${r.def}, Concealment = ${r.concealment ? "true" : "false"}, BlocksSight = ${r.blocksSight ? "true" : "false"},\n` +
        `                ChargeBreaks = ${r.chargeBreaks ? "true" : "false"}, RangedAtk = ${r.ranged.atk}, RangedRange = ${r.ranged.range},\n` +
        `            } },`;
    })
    .join("\n");
  return `${HEADER}
using System.Collections.Generic;

namespace Allynce.Generated
{
    /// <summary>
    /// Mirrors TERRAIN_RULES in core/src/types.ts. The shape (TerrainKind, TerrainRule) lives in
    /// unity/Runtime/BattleTypes.cs; only the values are generated here.
    /// </summary>
    public static class TerrainRules
    {
        public static readonly Dictionary<TerrainKind, TerrainRule> All = new Dictionary<TerrainKind, TerrainRule>
        {
${entries}
        };
    }
}
`;
}

export interface DataManifest {
  units: number;
  abilities: number;
  factions: number;
  effectKinds: number;
  unitIds: string[];
  abilityIds: string[];
  factionIds: string[];
}

/**
 * A small, deterministic summary of what the JSON in `data/` should import as. The Editor importer
 * (unity/Editor/DataImporter.cs) can diff its created-asset count against this after a real Unity
 * project exists, without needing to run the TypeScript loader itself.
 */
export function dataManifest(reg: Registry): DataManifest {
  const unitIds = [...reg.units.keys()].sort();
  const abilityIds = [...reg.abilities.keys()].sort();
  const factionIds = [...reg.factions.keys()].sort();
  return {
    units: unitIds.length,
    abilities: abilityIds.length,
    factions: factionIds.length,
    effectKinds: EFFECT_KINDS.length,
    unitIds,
    abilityIds,
    factionIds,
  };
}

export function dataManifestJson(reg: Registry): string {
  return JSON.stringify(dataManifest(reg), null, 2) + "\n";
}

export type { EffectKind };
