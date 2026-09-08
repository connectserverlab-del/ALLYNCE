# Mechanics implementation map

Each brief section maps to a module in `core/src`. All balance values live in `data/`, never in code.

| Brief section | Module | Notes |
|---|---|---|
| §3 Battlefield and turn structure | `battle.ts`, `hex.ts`, `state.ts` | Command / Activation / Objective / End phases, 2 AP, standard actions |
| §4 Unit statistics | `types.ts`, `data.ts`, `data/units/units.json` | All required fields; registry validates references on load |
| §5 Army construction | `composition.ts` | `validateArmy`, slot rules, unique and boss limits, capacity |
| §6 Theme cohesion and doctrine | `cohesion.ts`, `composition.ts`, `modifiers.ts` | `doctrineState`, Continuity, layered breakdown with sources |
| §7 Combat | `combat.ts`, `modifiers.ts` | Deterministic damage, arcs, terrain, statuses, intercession, duel |
| §8 Morale and command | `morale.ts`, `command.ts` | Bands, sources, succession, strongest aura only, Rally |
| §9 Faction doctrines | `data/abilities/abilities.json`, `effects.ts` | Orders and passives as data; interpreter in `applyEffect` |
| §11 Ritual system | `rituals.ts` | Ratings, formula, states, hold and instability, sync release |
| §12 Reinforcement portals | `portals.ts` | Lifecycle, queue, capture, destroy refund |
| §13 Cavalry and flying | `battle.ts` (`reachable`), `effects.ts` (`ChargeBonus`) | Anti-air, forest costs, Predatory Airspace, Diving Charge, Exposed |
| §14 Abilities and clones | `effects.ts` | Twin Echo reference implementation |
| §15 Objectives | `objectives.ts` | Eleven composable types |
| §16 AI | `ai.ts` | Utility scoring, release policy, difficulty without stat bonuses |
| §18 Architecture | all | Simulation is separate from presentation; every action logs a serializable event |
| Battlefield generation | `mapgen.ts`, `data/terrain/terrain.json` | Irregular playable outline, rough terrain scatter, river/ford/road; terrain move cost and DEF bonus tables |

## Worked example (from the brief §7)

Foot soldier 1,500 base ATK, two matching neighbours (+100), full Doctrine (+100), commander order (+150) = 1,850.
Against 1,600 DEF: `max(100, 1850 − 1600) = 250`. `core/tests/combat.test.ts` assembles this live and asserts the
breakdown contains each named source.

## Scenario flow (Threefold Invocation)

1. Side A deploys one Shinobi platoon and nine ritualists across three circles. The affiliated summoner's circle
   scores 14 progress per round; the two foreign circles score 11.
2. Side B deploys Knight and Samurai platoons, two portal keepers and two small portals with queued reinforcements.
3. Completed circles enter **Held**. Each held round adds one Unstable stack: 100 × stacks damage to participants and
   +1 disruption sensitivity.
4. The attacker AI releases only when every live circle is Held (synchronized) or when instability reaches three
   stacks. A synchronized release manifests all three Sovereigns at full Anchors; anything else weakens the summon.
5. Defenders win by collapsing two circles or surviving twelve rounds.

## Battlefield generator

`generateBattlefield(spec: MapSpec)` (`core/src/mapgen.ts`) produces a `GeneratedMap` (a `playable` set of hex
keys and a `terrain` map) from one seed:

1. **Irregular outline.** A margin band is reserved as a solid, always-playable core; outside it, a seeded
   number of random-radius "bites" are carved out of the rectangle's edge. The result is never a plain
   rectangle when `irregularity > 0`, but the interior a scenario needs for deployment and objectives is never
   touched.
2. **Rough terrain scatter.** `Mountain`, `Forest`, `Mud`, `Trench` and `Ruins` are grown as random-walk blobs
   from seed hexes inside the playable area, sized by each `*Density` knob. A handful of single-hex
   `Fortification` points are placed last.
3. **River and road.** A river walks greedily from the playable hex nearest the top edge to the one nearest the
   bottom edge, marking `Water`, with a configurable number of hexes along it converted to `Ford` (passable to
   ground units, unlike `Water`). A road walks left-edge to right-edge over whatever terrain the walk crosses,
   always at cost 1, bridging the river at a `Ford` rather than cutting straight through `Water`.

Every step reuses the existing `Rng` (mulberry32) already used for battle determinism, so the same seed always
produces the same map. `data/terrain/terrain.json` holds the numbers `mapgen.ts` and the movement/modifier code
both read (`Registry.terrainRules`):

- `moveCost`: per-terrain ground/cavalry/flying step cost. `Mountain` is 5x for ground, ignored by flying units.
  `Mud`, `Trench` and `Ford` are 2x. `Road` and `Ruins` are not listed, so they default to the normal cost of 1.
- `defBonus`: `Fortification` +200, `Trench` +100, `Ruins` +50, applied by `computeStat` in `modifiers.ts` as a
  `Terrain: <kind>` source, the same slot the existing Fortification and High Ground bonuses already used.
- `highGroundRangedAtk`: the existing High Ground ranged-ATK bonus, now data-driven instead of hardcoded.

A scenario file can adopt a generated map by calling `generateBattlefield` and copying its `terrain` entries into
`Battle.terrain` the same way `scenario.ts` already copies a hand-authored `map.terrain` list; no scenario does
this yet (see `docs/ROADMAP.md`'s Next list).

## Unity port guidance

- `Battle` → a plain C# class owned by a `BattleRunner` MonoBehaviour; keep it free of `UnityEngine` types.
- `UnitDef`, `AbilityDef`, `FactionDef` → ScriptableObjects generated from the JSON by an editor importer.
- `computeStat` → `ModifierPipeline.Compute(unit, stat, ctx)` returning the same `StatBreakdown` for tooltips.
- `applyEffect` → `IEffectHandler` per `effect.kind`, registered in a dictionary.
- `events` → `List<GameEvent>` serialized with the save; replay by re-applying actions with the same seed.
