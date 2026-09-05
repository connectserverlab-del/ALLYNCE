// Regenerates unity/Generated/* from core/src and data/. Run: npm run unity:scaffold
// The output is checked in, same convention as `npm run assets` and art/ASSET_REGISTRY.json:
// regenerate after any change to core/src/effects.ts's EFFECT_KINDS, core/src/types.ts's
// TERRAIN_RULES, or the unit/ability/faction rosters, and commit the result.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "../core/src/data.js";
import { effectKindsCsSource, terrainRulesCsSource, dataManifestJson } from "../core/src/unityExport.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = (rel: string, content: string) => writeFileSync(resolve(root, rel), content);

const reg = loadRegistry(); // throws on any cross-reference error, so a bad data edit fails the scaffold too

out("unity/Generated/EffectKinds.g.cs", effectKindsCsSource());
out("unity/Generated/TerrainRules.g.cs", terrainRulesCsSource());
out("unity/Generated/DataManifest.g.json", dataManifestJson(reg));

console.log("Wrote unity/Generated/EffectKinds.g.cs, TerrainRules.g.cs, DataManifest.g.json");
