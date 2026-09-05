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
| Mountains and the labored climb | `types.ts` (TERRAIN_RULES), `battle.ts` (`reachable`, `move`) | Rock costs foot 5, cavalry 6, wings 2. A unit that cannot afford a hex may still take one adjacent hex by spending its whole activation, so a range is slow rather than sealed |
| §13 Cavalry and flying | `battle.ts` (`reachable`), `effects.ts` (`ChargeBonus`) | Anti-air, forest costs, Predatory Airspace, Diving Charge, Exposed |
| §14 Abilities and clones | `effects.ts` | Twin Echo reference implementation |
| §15 Objectives | `objectives.ts` | Eleven composable types |
| §16 AI | `ai.ts` | Utility scoring, release policy, difficulty without stat bonuses |
| §18 Architecture | all | Simulation is separate from presentation; every action logs a serializable event |
| Scenario authoring | `scenario.ts` | `buildScenario` loads a scenario file onto either a hand-authored fixed map or a generated one; positions can be pinned by role instead of fixed coordinates (see below) |

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

## Scenario authoring on a generated field

A scenario's `"map"` is either the original fixed form (`{ width, height, terrain }`, exact coordinates, as
Threefold Invocation uses) or `{ "generate": { ...MapSpec minus seed } }`, which runs the same irregular-battlefield
generator `runMatch` uses. A generated map has no fixed coordinates to author against, so every position that would
otherwise be a `[q, r]` pair (platoon `deploy`, specialist and portal `at`, ritual `center`, and the hex-bearing
objectives `CaptureHold`/`Escort`) instead accepts a **role**, resolved against the concrete field once it is
generated:

- `{ "role": "anchor", "side": "A" | "B" }` — that side's deployment anchor.
- `{ "role": "deployZone", "side", "index" }` — the `index`-th hex of that side's zone (wraps); a platoon's whole
  `deploy` list can also be `{ "role": "deployZone", "side", "offset"?, "count"? }` to slice `count` hexes straight
  out of the zone instead of listing eight individually.
- `{ "role": "lerp", "from", "to", "frac", "lateral"? }` — a point on the line between two other positions (which
  may themselves be roles), stepped sideways by `lateral` hexes, snapped to the nearest standable, unclaimed hex.
- `{ "role": "near", "from", "ring", "index" }` — the `index`-th standable, unclaimed hex on the ring `ring` hexes
  from `from` (wraps; falls back to an expanding search if the ring is fully claimed).
- `{ "role": "ritualCenter", "id" }` — the already-resolved center of the named ritual. Ritual centers resolve
  before anything else is placed specifically so ritualists can be pinned relative to the fixed point instead of
  each re-deriving (and drifting from) the same raw anchor math.

Every resolved position is reserved so later ones cannot land on top of it, and a role on a fixed (non-generated)
map raises a clear error rather than silently doing nothing. `data/scenarios/ashfall_crossing.json` is the
reference example: the same file plays out on a different, still-legal battlefield every seed. See
`core/tests/scenario_roles.test.ts` for the resolution rules exercised directly.

## Unity port guidance

- `Battle` → a plain C# class owned by a `BattleRunner` MonoBehaviour; keep it free of `UnityEngine` types.
- `UnitDef`, `AbilityDef`, `FactionDef` → ScriptableObjects generated from the JSON by an editor importer.
- `computeStat` → `ModifierPipeline.Compute(unit, stat, ctx)` returning the same `StatBreakdown` for tooltips.
- `applyEffect` → `IEffectHandler` per `effect.kind`, registered in a dictionary.
- `events` → `List<GameEvent>` serialized with the save; replay by re-applying actions with the same seed.
