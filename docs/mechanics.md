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
| Universal win conditions | `battle.ts` (`evaluateVictory`), `data/rules/victory.json` | Wipeout, LeaderKilled, Surrender — always evaluated under any scenario objectives |
| §16 AI | `ai.ts` | Utility scoring, release policy, difficulty without stat bonuses |
| §18 Architecture | all | Simulation is separate from presentation; every action logs a serializable event |

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

## Universal win conditions

Every battle is decided by one of three ways, on top of whatever objectives the scenario layers in:

1. **Wipeout** — a side has no living, un-cloned units left on the field.
2. **LeaderKilled** — a side's designated Army Leader is defeated. A scenario opts a side in by setting
   `armyLeaderDefId` on that side in its scenario file; `buildScenario` resolves it to the deployed unit's
   runtime id. Left unset, the condition stays inactive for that side — there is no default. **An Army Leader is
   not a platoon Commander.** Platoon Commanders already have a Second and a succession line
   (`command.ts`); wiring `LeaderKilled` to one would end the battle before succession ever fires, which is why
   `Threefold Invocation` does not set this field yet — its Commanders are platoon-level, not army-level. The
   roster has no King/Shogun/Kage-tier unique unit to point this at until one exists (see the brainstorm log).
3. **Surrender** — a side's average morale among living, un-cloned units falls at or below
   `surrenderMoraleThreshold` and stays there for `surrenderSustainedRounds` consecutive End Phases, both read
   from `data/rules/victory.json`. The sustained window exists so one bad round of combat can't end a war outright;
   morale climbing back above the threshold resets the streak.

`BattleController.evaluateVictory()` checks scenario objectives first, then these three (Wipeout, LeaderKilled,
Surrender, in that order per side), then the round limit as a last resort. `core/tests/victory.test.ts` exercises
all three in isolation with bare battles; `core/tests/battle.test.ts` confirms the full Threefold Invocation
scenario still runs its full objective/ritual/portal/succession sequence with Wipeout and Surrender both live and
LeaderKilled correctly inactive.

## Unity port guidance

- `Battle` → a plain C# class owned by a `BattleRunner` MonoBehaviour; keep it free of `UnityEngine` types.
- `UnitDef`, `AbilityDef`, `FactionDef` → ScriptableObjects generated from the JSON by an editor importer.
- `computeStat` → `ModifierPipeline.Compute(unit, stat, ctx)` returning the same `StatBreakdown` for tooltips.
- `applyEffect` → `IEffectHandler` per `effect.kind`, registered in a dictionary.
- `events` → `List<GameEvent>` serialized with the save; replay by re-applying actions with the same seed.
