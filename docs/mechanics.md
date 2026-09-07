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
| §13 Cavalry and flying | `battle.ts` (`reachable`, `attack`), `effects.ts` (`ChargeBonus`) | Anti-air, forest costs, Predatory Airspace, Diving Charge, Exposed, minimum range for siege pieces |
| §14 Abilities and clones | `effects.ts` | Twin Echo reference implementation |
| §15 Objectives | `objectives.ts` | Eleven composable types |
| §16 AI | `ai.ts` | Utility scoring, release policy, difficulty without stat bonuses |
| §18 Architecture | all | Simulation is separate from presentation; every action logs a serializable event |

## Siege and cavalry roster

Each of the four combat factions (Samurai, Shinobi, Knight, Dragon Host) now fields one Siege-role specialist
and, where it did not already have one, one Cavalry-role Elite alternative:

- **Siege** (`Role: "Siege"`, `data/units/units.json`): deployed as an army specialist (`slots: ["Specialist"]`),
  like the existing Portal Keeper. Slow (`mov: 2`) and fragile, but hits hard at range with a new `minRange`
  field on `UnitDef` — `attack()` in `battle.ts` now rejects a target closer than `minRange` in addition to the
  existing maximum-range check, so a siege piece cannot be fired point-blank. All four carry the shared
  `ABL_BREACHING_VOLLEY` passive (`ConditionalAtk` with a new `vsTerrain` condition in `modifiers.ts`): +200 ATK
  against a defender standing on Fortification terrain. The Shinobi battery additionally carries
  `ABL_SMOKE_BATTERY`, reusing the existing `SpawnTerrain` effect to lay smoke around itself.
- **Cavalry** (`Role: "Cavalry"`, `slots: ["Elite"]`): the Knight faction already had one (Sky-Lance Dragoon).
  Samurai and Shinobi each gain an alternative Elite with a `ChargeBonus` ability (the same effect kind that
  powers Dragon Host's Diving Charge and Crushing Dive) — Lance Charge (higher bonus, requires more movement,
  forces Exposed) for Samurai and Fleet Strike (smaller bonus, triggers sooner, no Exposed penalty) for Shinobi.
  Dragon Host's own roster is already all-flying and is treated as fulfilling its faction's mobility niche
  without a dedicated ground Cavalry unit; see the roadmap brainstorm log for that as an open question.
- The AI's target filter (`ai.ts`) now also respects `minRange` so a siege unit does not attempt (and fail) a
  point-blank shot before falling back to repositioning.

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
