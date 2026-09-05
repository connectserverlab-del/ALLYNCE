# Unity port scaffold

This is scaffolding, not a working Unity project. There is no `.unity` scene, no `.csproj`, no
package manifest, and none of the C# here has been compiled — there is no Unity install or CI job
in this repository to compile it against. It exists so a real port has a structural starting point
that already agrees with `core/src` and `data/`, instead of inventing the shape from scratch. See
`docs/mechanics.md` → "Unity port guidance" for the file-by-file mapping this follows.

## Layout

- `Runtime/` — hand-written C# mirroring the TypeScript types and interfaces (`UnitDef`,
  `AbilityDef`, `UnitState`, `Modifier`/`StatBreakdown`, `IEffectHandler`). Stable shape; edit these
  by hand as the reference engine's own types change.
- `Editor/DataImporter.cs` — an editor-only script that reads `data/*.json` and creates/updates one
  ScriptableObject asset per unit, ability and faction. Needs the Newtonsoft Json Unity package
  (`com.unity.nuget.newtonsoft-json`), not vendored here.
- `Generated/` — output of `npm run unity:scaffold` (see `scripts/generate-unity-scaffold.ts` and
  `core/src/unityExport.ts`). Checked in like `art/ASSET_REGISTRY.json`; regenerate and commit after
  any change to `core/src/effects.ts`'s `EFFECT_KINDS`, `core/src/types.ts`'s `TERRAIN_RULES`, or the
  unit/ability/faction rosters in `data/`. Never hand-edit these files — the header says so and the
  next regeneration will discard the edit anyway.

## Using this in an actual Unity project

1. Create (or open) a Unity project.
2. Add the Newtonsoft Json package via the Package Manager.
3. Copy `Runtime/`, `Editor/` and `Generated/` under that project's `Assets/` folder (or symlink
   them, so `npm run unity:scaffold` keeps them current without a copy step).
4. Fix `DataImporter.RepoDataRoot` to point at this repository's `data/` folder from wherever the
   Unity project ends up checked out.
5. Run **ALLYNCE → Import Data From JSON** from the menu bar.

## What is stubbed vs. real

- `DataDefs.cs`, `BattleTypes.cs`: field shapes only, matching `core/src/types.ts`. No behaviour.
- `DataImporter.cs`: imports factions and units field-by-field; ability effects are kept as a
  `(kind, rawJson)` pair rather than parsed per kind, matching the generic-interpreter design in
  `core/src/effects.ts`. A handful of nested/enum unit fields (`size`, `roles`, `slots`, `ritual`,
  `divine`, `siege`) are left as a TODO — more parsing boilerplate, no design questions.
- `ModifierPipeline.cs`, `IEffectHandler.cs`: signatures and a registry that fails loudly
  (`NotImplementedException`) for any effect kind without a real handler, so a missing port is a
  compile-time-adjacent error instead of a silently-ignored ability. No actual game rules are
  implemented; `core/src/modifiers.ts` and `core/src/effects.ts` remain the reference behaviour
  until each piece is ported by hand.
