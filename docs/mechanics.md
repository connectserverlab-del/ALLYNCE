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
| Marching between battles | `march.ts`, `data/movement/march.json` | Continuous movement in seconds over the same hexes the battle fights on. A straight line where one works; an A* over the grid, string-pulled to a few waypoints, where it does not. Nothing crosses a field in more than 45 seconds, and a route forced the long way round hurries rather than arriving late |
| §18 Architecture | all | Simulation is separate from presentation; every action logs a serializable event |

## Card skills

Every card at four stars and above carries one ability it can spend an action on. Six kinds cover the roster,
all of them ordinary temporary modifiers so they appear in the stat breakdown by name instead of as a hidden
number, and all of them defined in `data/abilities/abilities.json` rather than in code.

| Kind | What it does | Example |
|---|---|---|
| `SelfSacrificeBuff` | Spend a share of maximum health for attack this round. Never lethal: a unit that cannot pay the price cannot use it at all. | Blood Offering — 15% health for +450 ATK |
| `SelfHaste` | Movement for one round, for this unit or, with `bandWide`, for its whole band. | Second Wind — +3 MOV; Ridge Pace — +3 MOV band-wide |
| `BandAtk` | A team attack buff across the band. | Choir of Edges — +220 ATK |
| `EnemyAtkDebuff` | Every enemy inside the ability's range loses attack for the round. | Judgement's Weight — -300 ATK within 2 |
| `EnemySlow` | Every enemy inside range loses movement, optionally with a status. | Deep Frost — -3 MOV and Suppressed within 3 |
| `SpawnClones` | The body divides: attack and defence are shared evenly across the original and every copy. | Swarm Split — four bodies at a quarter each |

**The band** is the platoon where a unit has one, and the unit plus the allies standing beside it where it does
not. The creature divisions mostly deploy loose rather than in platoons, so without that fallback a team buff
would do nothing for half the roster.

### Splitting is not duplication

A clone ability divides the body rather than copying it. `UnitState.splitBodies` records how many bodies the
unit's attack and defence are currently shared across — itself plus its living copies — and `computeStat`
divides the base by it for the original and every copy alike. Twin Echo makes three bodies at a third each;
Swarm Split makes four at a quarter. The bodies together are never worth more than the one they came from, so
splitting buys presence on more hexes and pays for it in weight on each.

Copies still keep the rest of the clone rules: one hit kills them, they grant no cohesion, they count for
nothing in composition, they cannot use abilities, be tributed, be sacrificed or take prisoners, and they
expire on their timer. What is new is the way back up. When a copy leaves the field the original reclaims its
share — two thirds with one copy left, whole once the last one falls — which makes hunting the copies worth an
activation instead of an annoyance to be ignored. A body that has already split cannot split again.

A test in `core/tests/skills.test.ts` walks the whole registry and fails if any card at four stars or above is
carrying no ability it can activate, so the rule cannot quietly rot as the roster grows.

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

## Unity port guidance

- `Battle` → a plain C# class owned by a `BattleRunner` MonoBehaviour; keep it free of `UnityEngine` types.
- `UnitDef`, `AbilityDef`, `FactionDef` → ScriptableObjects generated from the JSON by an editor importer.
- `computeStat` → `ModifierPipeline.Compute(unit, stat, ctx)` returning the same `StatBreakdown` for tooltips.
- `applyEffect` → `IEffectHandler` per `effect.kind`, registered in a dictionary.
- `events` → `List<GameEvent>` serialized with the save; replay by re-applying actions with the same seed.
