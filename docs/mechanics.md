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
| Rank ladders | `ranks.ts`, `data/factions/ranks/*.json` | Per-faction ladder of named rungs with source-tracked mechanical privileges |

## Rank ladders

Every faction is meant to carry a named rank ladder with real mechanical weight, not just a flavor label. `UnitDef.rank`
stays the coarse slot label (`Commander`, `Second`, `Elite`, `Foot`, ...); a unit optionally also carries `rankId`,
which resolves through `Registry.rankOf` to a rung on its faction's ladder in `data/factions/ranks/<FACTION>.json`.
A faction with no ladder file simply has no ranked privileges yet — `rankOf` returns `undefined` and every privilege
lookup is a no-op, so Knight, Dragon Host and Ritual Cult units are unaffected until their own ladders land.

Samurai (`SAM.json`) and Shinobi (`SHI.json`) are seeded first, at the sizes the owner named: nineteen Samurai rungs
from Koyakunin to Shogun, six Shinobi rungs from Apprentice to Kage. Each ladder only needs to be as deep as the
roster that occupies it — most SAM tiers above Joshu Daimyo, and Shinobi's own top rung (Kage, with a Shadow Step
privilege declared but not yet wired to a battle action), are real rungs reserved for units not yet rostered, the
same way the huge card-and-holding branch's own 19-rank Samurai table works.

Privileges are plain data, applied through the existing modifier pipeline and movement code so every bonus a rank
grants still shows up as a named, sourced entry in `computeStat`'s breakdown:

- `twoSwords` — +50 ATK on a reaction attack only (a zone-of-control strike or an Overwatch shot), via
  `resolveAttack`'s new `reaction` option and a `CombatContext.reaction` flag `computeStat` checks.
- `mounted: "war" | "always"` — +1 Movement, unconditional for `"always"`, only while an enemy is within 6 hexes
  for `"war"` (`rankMovementBonus` in `ranks.ts`, folded into `BattleController.movementAllowance`).
- `commandRadiusBonus` — added to a leader's command radius everywhere that radius already matters: the aura in
  `commandBonus`, the Command Phase's `commandRadiusRecovery`, and the `PreventRouted` ability effect.
- `banner` — platoon members inside the leader's radius recover +5 additional Morale in the Command Phase, on
  top of the existing +5 for merely being in radius.
- `castle` — allies inside the leader's radius standing on a Fortification hex gain a further +100 DEF, stacked
  onto the existing Fortification terrain bonus.
- `canopy` — Forest costs 1 Movement instead of the usual 2 (3 for Cavalry), in `BattleController.reachable`.
- `hideOnForestStop` — ending a move on a Forest hex applies Hidden, even without an ability granting it.
- `ignoreZoc` — leaving a hex adjacent to an enemy does not trigger a reaction attack.
- `passAllies` / `bonusMov` — may move through allied hexes; adds flatly to Movement.

`core/tests/ranks.test.ts` exercises every privilege above against the specific rostered unit that carries it.

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
