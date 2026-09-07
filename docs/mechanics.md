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
| §16 AI | `ai.ts` | Utility scoring, release policy, terrain and flank positioning, difficulty without stat bonuses |
| §17 Victory | `battle.ts` (`evaluateVictory`, `surrender`) | Three universal win conditions on top of scenario objectives |
| §18 Architecture | all | Simulation is separate from presentation; every action logs a serializable event |

## Victory: three universal conditions

Every scenario resolves through the same three conditions, evaluated in this order each End Phase, on top of
whatever scenario-specific objectives it defines:

1. **Scenario objectives** (`objectives.ts`) — unchanged, evaluated first so an authored win still takes priority.
2. **Army leader killed** — a scenario names one unit def id per side as that side's leader
   (`VictoryRules.leaders`, wired from the optional `leader` field on a scenario file's side; `buildScenario`
   only sets it when at least one side names one). If every deployed instance of that def id on that side is
   defeated, the battle ends immediately for the other side, reason `"Leader killed"`. A side with no leader
   named is simply never checked — this is additive, not a requirement scenarios must opt into.
3. **Round limit**, then **wipeout** (a side with nothing left standing) — unchanged.

A fourth path, **surrender**, is not a check `evaluateVictory` makes on its own — it is `BattleController.surrender(side)`,
callable at any point by a human player or an AI controller, which ends the battle immediately for the other side
(reason `"Surrender"`). `ai.ts`'s `maybeSurrender(ctrl, side)` is the AI's policy for when to call it: once a side
has lost every platoon's Commander *and* Second-in-command (`command.ts`'s `hasCommandStructure`) and its average
morale (`moraleSummary`) has fallen below the Disordered/Routed line (20), continuing only grinds toward the same
wipeout, so the AI concedes instead. This is a distinct signal from "army leader killed": a leader is one named
unit a scenario chooses to spotlight, while command structure is the whole chain of platoon leadership, so a side
can lose one without the other.

Once `b.winner` is set by any of these paths, `evaluateVictory` is a no-op on later calls — a surrender or a
leader's death mid-round is never overwritten by an objective that happens to complete before the round ends.

## AI positioning

`ai.ts`'s `moveToward` scores every reachable hex toward a goal, not just the closest one:

- A unit with `range > 1` (ranged units, and siege pieces once fielded) treats its own range as the ideal
  stand-off distance instead of closing to melee — the same High Ground ranged bonus in `modifiers.ts` then
  makes holding High Ground within that ring worth an extra push (+60 to the destination score).
- A `Cavalry` unit prefers a reachable hex that attacks its target's flank or rear (`hex.ts`'s `attackArc`)
  over an equal-distance front hex (+70), since `modifiers.ts` already docks a defender's DEF for being hit
  from a non-front arc.

Both are pure positioning preferences layered on the existing cohesion/isolation/Fortification scoring; no new
stat modifier is involved, so there is nothing new to source-track here.

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
5. Defenders win by collapsing two circles or surviving twelve rounds — or sooner, if either side's leader falls
   (Side A's Affiliated Summoner, Side B's Solar-Bastion Marshal) or its whole chain of command breaks under
   collapsing morale, both of which now end the match before the round limit.

## Unity port guidance

- `Battle` → a plain C# class owned by a `BattleRunner` MonoBehaviour; keep it free of `UnityEngine` types.
- `UnitDef`, `AbilityDef`, `FactionDef` → ScriptableObjects generated from the JSON by an editor importer.
- `computeStat` → `ModifierPipeline.Compute(unit, stat, ctx)` returning the same `StatBreakdown` for tooltips.
- `applyEffect` → `IEffectHandler` per `effect.kind`, registered in a dictionary.
- `events` → `List<GameEvent>` serialized with the save; replay by re-applying actions with the same seed.
