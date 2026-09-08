# Mechanics implementation map

Each brief section maps to a module in `core/src`. All balance values live in `data/`, never in code.

| Brief section | Module | Notes |
|---|---|---|
| §3 Battlefield and turn structure | `battle.ts`, `hex.ts`, `state.ts` | Command / Activation / Objective / End phases, 2 AP, standard actions |
| Irregular battlefield generator | `mapgen.ts` | Noise-warped mask, elevation, river, forest, road, trenches, ruins; `deploymentBalance` rejects a lopsided deal |
| §4 Unit statistics | `types.ts`, `data.ts`, `data/units/units.json` | All required fields; registry validates references on load |
| §5 Army construction | `composition.ts` | `validateArmy`, slot rules, unique and boss limits, capacity |
| Faction rank ladders | `ranks.ts`, `data/factions/ranks/*.json` | Per-faction tiers: privileges, movement traits, `canLead`. See `docs/samurai-ranks.md`, `docs/knight-ranks.md` |
| §6 Theme cohesion and doctrine | `cohesion.ts`, `composition.ts`, `modifiers.ts` | `doctrineState`, Continuity, layered breakdown with sources |
| §7 Combat | `combat.ts`, `modifiers.ts` | Deterministic damage, arcs, terrain, statuses, intercession, duel |
| §8 Morale and command | `morale.ts`, `command.ts` | Bands, sources, succession, strongest aura only, Rally |
| §9 Faction doctrines | `data/abilities/abilities.json`, `effects.ts` | Orders and passives as data; interpreter in `applyEffect`. A passive whose effect isn't a stat conditional or a movement/combat rule (`ConditionalDef`/`Atk`, `Intercept`, `DenyFlyingMovement`, `SharedVision`) does nothing in `applyEffect` by design — those kinds are checked directly where they matter (`modifiers.ts`, `combat.ts`, `battle.ts`) and are covered end to end in `core/tests/doctrine.test.ts`, one per host faction, so a newly declared passive kind can't ship unwired without a failing or missing test making that obvious |

| §9 Faction doctrines | `data/abilities/abilities.json`, `effects.ts` | Orders and passives as data; interpreter in `applyEffect` |
| Faction rank ladders | `ranks.ts`, `data/factions/ranks/*.json` | Samurai and Shinobi (`docs/samurai-ranks.md`), Dragon Host (`docs/dragon-ranks.md`), Ritual Cult (`docs/ritual-ranks.md`); Knight and the seven divisions have none yet |
| §11 Ritual system | `rituals.ts` | Ratings, formula, states, hold and instability, sync release |
| §12 Reinforcement portals | `portals.ts`, `battle.ts` (`openPortal`, `queueReinforcement`) | Lifecycle, queue, capture, destroy refund. A PortalKeeper's Open Reinforcement Portal calls one on an adjacent, uncontested hex; any of its side standing beside an Open portal can spend Reserve Points to queue into it |

| §12 Reinforcement portals | `portals.ts`, `battle.ts` (`attackStructure`) | Lifecycle, queue, capture, destroy refund; firing on a structure runs through the same source-tracked modifier pipeline as any other attack, so a siege piece's Breaching Shot bonus is a named modifier rather than a hidden add-on |
| Mountains and the labored climb | `types.ts` (TERRAIN_RULES), `battle.ts` (`reachable`, `move`) | Rock costs foot 5, cavalry 6, wings 2. A unit that cannot afford a hex may still take one adjacent hex by spending its whole activation, so a range is slow rather than sealed |
| §13 Cavalry and flying | `battle.ts` (`reachable`), `effects.ts` (`ChargeBonus`) | Anti-air, forest costs, Predatory Airspace, Diving Charge, Exposed |

| §12 Reinforcement portals | `portals.ts` | Lifecycle, queue, capture, destroy refund |
| §13 Cavalry and flying | `battle.ts` (`reachable`, `attack`), `effects.ts` (`ChargeBonus`) | Anti-air, forest costs, Predatory Airspace, Diving Charge, Exposed, minimum range for siege pieces |
| §14 Abilities and clones | `effects.ts` | Twin Echo reference implementation |
| §15 Objectives | `objectives.ts` | Eleven composable types |
| §16 AI | `ai.ts` | Utility scoring, release policy, surrender policy, difficulty without stat bonuses |

| §16 AI | `ai.ts` | Utility scoring, release policy, difficulty without stat bonuses. Reaches for Fusion (`tryFusion`) once an adjacent recipe-eligible ally, a spare Fusion charge and a nearby fight all line up, and only after an attack or a ground-gaining move has had first refusal |

| §16 AI | `ai.ts` | Utility scoring, release policy, difficulty without stat bonuses. A PortalKeeper feeds Reserve into a portal of its own that has already opened before it risks any on one that has not, and only calls a new one once nothing of its own is up within six hexes |

| §15 Objectives | `objectives.ts` | Eleven composable types. `DefendForRounds` with a `uidOrPortal` also requires that unit or portal to still be undefeated/undestroyed when the round count passes, not the clock alone |

| Irregular battlefields, generated | `mapgen.ts` (`Landmarks`), `placement.ts`, `scenario.ts` | A scenario built on `mapSpec` pins rituals, portals, deploy hexes and the two hex-bearing objectives (`CaptureHold`, `Escort`) to a role — anchor, deploy zone, midpoint, trench, ruins, fortification, ford, road — instead of a fixed [q, r] pair. A role that did not generate on a given seed falls back to the midpoint rather than failing the build. See `data/scenarios/contested_ford.json` |

| Universal win conditions | `battle.ts` (`evaluateVictory`), `data/rules/victory.json` | Wipeout, LeaderKilled, Surrender — always evaluated under any scenario objectives |
| §16 AI | `ai.ts` | Utility scoring, release policy, difficulty without stat bonuses |
| Marching between battles | `march.ts`, `data/movement/march.json` | Continuous movement in seconds over the same hexes the battle fights on. A straight line where one works; an A* over the grid, string-pulled to a few waypoints, where it does not. Nothing crosses a field in more than 45 seconds, and a route forced the long way round hurries rather than arriving late |

| Victory | `battle.ts` (`evaluateVictory`, `surrender`) | Three universal win conditions layered under scenario objectives: Wipeout, Army Leader Killed (`VictoryRules.armyLeaderUids`, resolved in `scenario.ts` from a side's optional `armyLeader` def id), Surrender (`organizationLevel` at "None" plus average morale at or below `DEFAULT_SURRENDER_MORALE`, or an explicit call) |
| §16 AI | `ai.ts` | Utility scoring, release policy, difficulty without stat bonuses |

| §16 AI | `ai.ts` | Utility scoring, release policy, terrain and flank positioning, difficulty without stat bonuses |
| §17 Victory | `battle.ts` (`evaluateVictory`, `surrender`) | Three universal win conditions on top of scenario objectives |

| Marching between battles | `march.ts`, `data/movement/march.json` | Continuous movement in seconds over the same hexes the battle fights on. A straight line where one works; an A* over the grid, string-pulled to a few waypoints, where it does not. Nothing crosses a field in more than 45 seconds, and a route forced the long way round hurries rather than arriving late. A unit belongs to at most one squad: reusing it as a new squad's member or letting it complete a Join order always removes it from whatever squad it was in first, promoting a new leader or disbanding the squad if that was its last member, so a squad's pace and formation slots never carry a member who has actually left |
| §18 Architecture | all | Simulation is separate from presentation; every action logs a serializable event |
| Scenario authoring | `scenario.ts` | `buildScenario` loads a scenario file onto either a hand-authored fixed map or a generated one; positions can be pinned by role instead of fixed coordinates (see below) |
| Campaign map | `campaign.ts`, `data/campaign/` | Regions on a province map, each with its own biome bias for `setUpMatch`; a held region's production is a named, source-tracked income line into the holding (see below) |
| Weather and time of day | `weather.ts`, `data/rules/weather.json` | Round modifiers rolled once per battle from the match seed; Rain reshapes terrain at setup, Fog and Night are named, source-tracked combat modifiers (see below) |

| Replay | `replay.ts` | `Replay` steps a cursor through `Battle.events` one at a time (or jumps by round/index); `describeEvent` narrates each entry by name, resolved from `Battle.units` |
| Commands (`Q-21`) | `commands.ts` | `Command`, a serialisable record of every mutating `BattleController` entry point and card play; `applyCommand` is the single funnel, and `Battle.commands` is the resulting log. See "Commands" under Determinism below |

| Irregular battlefields | `mapgen.ts` | Seeded playable-mask carve, elevation, rivers with fords, trenches, mud, roads, ruins and fortifications; fourteen terrain types |
| Cards and decks | `cards.ts`, `data/cards/` | 100-card main deck, 20-card ritual/fusion side deck, star scale, tribute/ritual/fusion summoning; see `docs/cards-and-kingdom.md` |
| The holding | `kingdom.ts`, `data/kingdom/` | Buildings, research tree, recruitment banners, carry-over into battle as named modifiers; see `docs/cards-and-kingdom.md` |
| The wanted board | `wanted.ts`, `data/missions/wanted.json` | Rotating warrants, subdue-not-kill capture, escort composition; see `docs/cards-and-kingdom.md` |
| Fusion | `fusion.ts` | Recipe-driven merges of adjacent units, paid with Fusion charges |
| Faction rank ladders | `ranks.ts` | Per-faction privilege ladders with mechanical traits; see `docs/samurai-ranks.md` |
| Data loading and validation | `registry.ts`, `data.ts` | Cross-reference checks at load (units, abilities, factions, fusion recipes) so a bad reference fails before a match starts |
| Save and load | `save.ts` | Round-trips a battle mid-match and a holding, with a version gate |
| The match loop | `match.ts` | Connects a holding and its decks to a generated battle and back; see `docs/cards-and-kingdom.md` |

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

### The AI spends all six kinds

`ai.ts`'s ability loop reaches for every one of the six kinds, not only `SpawnClones`, `ChargeBonus` and `Duel`:

- `SelfSacrificeBuff` and `BandAtk` fire only once a target is already inside attack range this activation, so
  the buff lands on a swing instead of an empty round. The self-sacrifice price is also weighed against the
  unit's own health: it keeps a cushion above the effect's own no-suicide floor, sized by the profile's risk
  tolerance, so an easy-difficulty unit stops bleeding itself sooner than a hard one.
- `SelfHaste` fires only when the unit's own chosen goal this activation sits farther away than its base
  movement allowance already reaches, so it is spent closing ground rather than standing still with it.
- `EnemyAtkDebuff` and `EnemySlow` fire on any enemy already within the ability's radius, whether or not this
  unit can land a blow of its own this activation — softening an attacker before it gets to swing back is the
  point of a debuff spent on defence, not only on offence.

`core/tests/ai.test.ts` drives `runAiActivation` directly against fixed positions for one card of each kind and
checks the resulting stat breakdown and cooldowns, so a change to the utility loop that stops using a skill
shows up as a failing test rather than a quieter AI nobody notices.

## Division doctrines and platoon orders

`FactionDef.platoonOrder` and `FactionDef.passiveDoctrine` name one ability each: an `Order` the platoon
commander may spend once a round (`Battle.useAbility`, gated on the platoon not being Broken), and a `Passive`
folded automatically into every one of that faction's units through `abilityModifiers`. The four host armies
(Samurai, Shinobi, Knight, Dragon Host) have carried one of each since the rank-ladder pass. The five sworn
companies still do not, by design: they are hired depth for someone else's platoon, never enough on their own
to fill Commander, Second, Elite and five foot at once.

The seven themed divisions (Choir Militant, Ashpit Legion, Spiral Warband, Half-Born Host, Winter Famine, Ridge
Kin, Formic Swarm) now do. Two of them — Spiral Warband and Winter Famine — were missing a card that could
stand in the Second slot at all, so `SlotName` was widened on their existing Cavalry/Elite card
(`CHR_CAVALRY_SPIRAL-MARKED-LANCER`, `WEN_ELITE_ANTLER-WRAITH`) rather than inventing a new one; Formic Swarm
already covers both from its one Elite by fielding a second physical copy. Every division's order and doctrine
reuses an existing `effects.ts` handler and, for the passive half, one of the two ability kinds
`abilityModifiers` actually turns into a stat line (`ConditionalDef`, `ConditionalAtk`) — nothing here needed a
new interpreter. `core/tests/divisions.test.ts` deploys a full platoon for all seven from nothing but their own
four cards, checks it lands on Full doctrine rather than Broken, and exercises each order and passive by name.

| Faction | Order | Doctrine |
|---|---|---|
| Choir Militant (ANG) | Judgement Hymn — rallies the platoon's morale | Angelic Ward — +45 DEF beside another Celestial |
| Ashpit Legion (DEM) | Ashen Warcry — morale shock to adjacent enemies | Ashen Toll — +90 ATK against enemy leaders and elites |
| Spiral Warband (CHR) | Broken Charge — +2 platoon Movement | No Second Plan — +70 ATK, unconditional |
| Half-Born Host (DMG) | Ascendant Push — a formation step into +90 ATK next melee | Mortal Weight — +50 DEF, unconditional |
| Winter Famine (WEN) | Crawling Cold — slows enemies within 3 hexes | Starveling Bite — +90 ATK against foot soldiers |
| Ridge Kin (SAS) | Stone Stand — +70 platoon DEF | Lone Hunt — +80 ATK against an isolated target |
| Formic Swarm (FMC) | Swarm Convergence — marks a target for +110 platoon ATK | One Will — +40 DEF with two Swarm allies adjacent |

## Deployment-zone balance check

`generateMap` deals terrain from noise, and noise does not know it owes both sides an even fight: a rugged
cluster or a wandering river can, by chance, land all the hard ground on one anchor's doorstep. `deploymentBalance`
scores a generated field by the average foot-movement cost of the passable ground within reach of each
deployment anchor — the terrain a side's own army actually has to walk through to advance — and returns the
ratio of the easier side to the harder one. `generateMap` re-rolls the same spec with deterministic derived
seeds (still exactly reproducible for a given input seed) until that ratio is at least 0.9, i.e. within 10%
both ways, or a bounded number of attempts run out, in which case it ships the least lopsided attempt rather
than looping forever. `core/tests/mapgen.test.ts` asserts the 10% band holds across a spread of seeds.

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

| Battlefield generation | `mapgen.ts`, `data/terrain/terrain.json` | Irregular playable outline, rough terrain scatter, river/ford/road; terrain move cost and DEF bonus tables |

## Randomness

There is no shared battle-level RNG. `Battle` exposes a public `seed: number` and nothing else; every subsystem
that needs randomness (`DeckState.shuffle`, `mapgen.ts`, `match.ts`'s AI turn order and post-match banner pull,
`kingdom.ts` recruitment, `wanted.ts` warrant generation) builds its own short-lived `Rng` from that seed plus a
fixed offset for its own concern (`b.seed + side.charCodeAt(0) + rounds`, `spec.seed ^ 0x5eed`, and so on). That
keeps one subsystem's random draws from shifting another's: adding an AI decision never reshuffles a deck that
draws from a different derived seed. An earlier `Battle.rng` field followed the seed but was never read by
anything and has been removed; if a future subsystem wants battle-scoped randomness it should derive its own
`Rng` from `seed` the same way the others do, not resurrect a shared instance.

### Determinism harness

`core/src/determinism.ts` exports `hashEvents`, a dependency-free hash over a battle's event log.
`core/tests/determinism.test.ts` runs a scripted match twice from the same seed and asserts the hashes are
equal, and runs several different seeds and asserts they diverge. This is the acceptance test for the
determinism guarantee this section claims: lockstep multiplayer, replays and server-side validation all rest
on the same seed always producing the same event log, and this is what fails loudly, in the suite every
`npm run check` runs, the first time a change reaches for `Math.random()`, wall-clock time, or iteration order
that depends on object identity.

`Q-20`'s per-round `RoundHash` is written at the end of every round by `BattleController.endPhase`, and
hashes two things together: that round's own slice of the event log, and `stateDigest(b)` — a canonical,
id-sorted digest of what the battle materially *is* at that moment (every unit's position, body, morale,
statuses, cooldowns, temporary modifiers and per-activation flags, plus side, ritual, portal and terrain
state).

Both halves are needed. Hashing only the events misses everything that changes without being logged —
action points, cooldowns ticking, a charge counter, a set-up flag, a modifier expiring — so two clients
drift apart while every event they emitted that round matches, and the divergence only surfaces rounds
later when it finally changes what someone does. A detector that names the wrong round is barely better
than none. Hashing only the state misses two different paths that happen to land on the same board.
`core/tests/determinism.test.ts` pins this: ten separate corruptions of unlogged state each move the
digest while leaving the event log byte-identical.

### Commands

`core/src/commands.ts` exports a `Command` type — a plain, serialisable record of every mutating
`BattleController` entry point (`move`, `attack`, `useAbility`, `channel`, `surrender`, the phase
transitions, and the card-play functions in `cards.ts`: `summonFromHand`, `ritualSummon`,
`fusionSummon`, `playStratagem`) — and `applyCommand(ctl, cmd)`, the single funnel that resolves a
command's uid references to live units, portals and rituals and calls the one method that already
owns that mutation. `Battle.commands` is the resulting log: every command `applyCommand` has actually
applied, in order. A command that throws is never appended, since it never mutated the battle.

`BattleSave` carries the command log (save version 7). A battle that lost it on save could not be
rebuilt from its commands (`Q-22`), replayed by a client that joined late, or validated server-side
after a reconnect — the same silent-drop this codebase has already paid for twice, with `kingdomEffects`
and with the per-round effect flags.

This is `Q-21`, the netcode line's foundation: lockstep sends commands, not state, so a command has to
survive `JSON.stringify`/`parse` and a network hop unchanged, which is why every field is a uid string
or a plain `Hex`, never a live object reference. `applyCommand` does not replace the named
`BattleController` methods — they stay the implementation and every existing caller (the AI, the match
runner) keeps calling them directly — it is the layer a network client or a replay drives instead, so
the two paths can never validate a move differently. `core/tests/commands.test.ts` proves the funnel:
for every command kind, applying it through `applyCommand` on one battle reaches the same event log
(by `hashEvents`) as calling the direct method on an identical forked battle, and a command that fails
its own validation is never logged as if it had applied.

`Q-22` proves the funnel is complete the other direction: `core/tests/rebuild.test.ts` builds a
fresh `Battle` the same deterministic way as another one already played through `applyCommand`, then
replays nothing but that other battle's `Battle.commands` — round-tripped through
`JSON.stringify`/`parse`, exactly what a save or a network hop does to it — into the fresh battle,
and asserts the same `hashEvents` and the same `roundHashes` across several rounds. A second test in
the same file proves the guarantee actually bites: one call that reaches the controller directly
instead of through `applyCommand` mutates the battle for real without ever reaching `commands`, and a
rebuild from that now-incomplete log diverges from what actually happened. `Q-23` (a pure `isLegal`
pre-check) and `Q-24` (two-client lockstep) build on this next.

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

## AI: terrain, siege, cavalry and surrender

- **Terrain-seeking movement**: when `moveToward` scores a candidate hex, Trench and HighGround now add to the
  score alongside the existing Fortification bonus, so a unit closing on any goal prefers to route through or
  settle on defensible ground rather than open terrain, all else equal.
- **Siege positioning**: a `Siege`-role unit never advances into its own minimum range. Each activation it either
  retreats away from the nearest enemy while inside `minRange`, closes only as far as its own `range` requires
  while outside it, or, once inside the firing band, calls Set Up instead of advancing further. This keeps siege
  pieces stood off from the front line by construction rather than by a hand-placed "hold position" order.
- **Cavalry flanking**: a `Cavalry`-role unit's charge goal is no longer the enemy's own hex but the nearest hex
  adjacent to it that is not in that enemy's front arc (`attackArc` in `hex.ts`), so the pathing naturally swings
  wide to land the charge on a flank or rear arc instead of walking straight into the front.
- **Surrender policy** (`shouldSurrender`/`maybeSurrender` in `ai.ts`): a side yields once every one of its
  platoons has fallen out of Doctrine (`organizationLevel` reports `"None"`: no living commander and no
  Continuity left to attempt succession) *and* its units' average morale has collapsed into the Broken band.
  Either condition alone is not enough — a leaderless but still-steady army keeps fighting, and a routed army
  with its command structure intact does too. `runMatch` and `demo.ts` call this once per round, right after
  activations, for both sides.

  This exercises the `surrender` win condition, which previously had no caller anywhere in the AI. In practice it
  will rarely fire yet: every side has exactly one designated `leaderUid`, and the "army leader killed" win check
  in `evaluateVictory` fires the moment that one unit is defeated, at the End Phase of the very same round —
  before the next round's Command Phase ever gets to run `resolveSuccession`. So Continuity's stated grace period
  ("Doctrine stays active through the next Command Phase while succession occurs") never actually gets a chance
  to save the match from an instant loss, and the new surrender policy is shadowed by it in every current
  scenario. See `OWN-3` in `docs/CHECKLIST.md`.

## Campaign map

`data/campaign/*.json` describes a province as a graph of regions: each region names its neighbors, a starting
owner (`"A"`, `"B"`, or `null` for neutral ground), a biome bias, and how many resources per hour it pays its
owner. `data/campaign/samurai_province.json` is the reference province — six regions in a ring, from the Ashfall
keep-lands down to the Iron Vale, with a mountain pass and a coast contested in between.

- **Adjacency, not teleporting**: `contestableRegions` only offers ground bordering a region the side already
  holds, so the front stays one contiguous line instead of a side reaching across the map for an easy region.
- **Every region is still a generated battle**: `battleMapSpec(region, seed)` is the region's own `map` bias
  (`size`, `forest`, `rugged`, `river`, `trenches`, `ruins`) with a seed attached — a `MapSpec` ready for
  `setUpMatch`/`runMatch`, exactly as if it had been typed by hand for that fight. A region has no fixed
  battlefield of its own; it regenerates a fresh, still-legal field every time it is fought over, the same way
  `ashfall_crossing` regenerates a scenario field per seed (see above).
- **Ownership only moves on a decisive result**: `resolveRegionBattle(state, regionId, winnerSide)` takes the
  region on a win and leaves it alone on a draw or an unresolved siege (`winnerSide` null).
- **Production is a named, source-tracked income line**: `regionProduction` lists each held region as
  `{ source: "Region: <name>", resource, perHour }`, the same shape as a building's `produces` entry.
  `applyCampaignProduction` folds that into a holding's resources over `seconds`, capped by the same
  `storageCap` an ordinary `tick` respects, so a campaign never lets a side's stores run past what its Keep
  can actually hold.

## Weather and time of day

`data/rules/weather.json` names every weather condition (`Clear`, `Rain`, `Fog`) and time-of-day condition
(`Day`, `Night`) with a roll weight and its effect. `setUpMatch` rolls one of each from a seed derived from the
match seed (so a replay reproduces it), right after the field generates and before either side deploys; a
`MatchSpec.weather` / `timeOfDay` override skips the roll for a scenario or a test that wants a fixed condition.

- **Rain** (`applyWeatherTerrain`): every Open hex within `mudRadius` of a Water or Ford hex turns to Mud for the
  rest of the battle — the same terrain a river's own low, wet ground already produces in `mapgen.ts`, just
  triggered by weather instead of geography. It never overwrites a hex that is already something other than
  Open, and it runs once, at setup, not every round.
- **Fog** (`effectiveRange`): every ranged unit's attack range drops by `rangedRangeMod` (one hex), floored at
  one so a unit is never argued out of its own melee reach. `battle.ts` (`attack`, the Overwatch check in
  `move`), `portals.ts` (`attackPortal`'s range gate) and `ai.ts` (targeting, siege stand-off distance, the
  charge-bonus range check) all read this instead of the unit's raw `range`, so the AI's decisions stay
  consistent with what `attack()` will actually allow.
- **Night** (`weatherRangedAtkMod`): a named `"Time of Day: Night"` entry in the modifier pipeline, `rangedAtkMod`
  ATK on any ranged attack — folded into `computeStat` alongside terrain and command bonuses, so the breakdown
  stays as honest as every other source.

Both conditions are independent (a battle can be foggy at night) and both are rolled the same way, so adding a
third weather or time-of-day condition is a data change: a new entry in `weather.json` plus, if it needs a new
kind of effect, one more field read where the existing ones are read.

## Scenario authoring: role-pinned placement

Threefold Invocation is hand-authored on a fixed map, so every deploy hex, ritual center and portal position is a
literal `[q, r]` in `data/scenarios/threefold_invocation.json`. That breaks the moment a scenario wants to run on
`generateMap`'s irregular ground instead: the anchors, deploy zones and passable hexes are different every seed.

`core/src/scenario-roles.ts` adds a second way to author a position, a **role** (`FieldRole`), resolved against the
generated field at build time instead of baked into the file:

- `{ role: "anchor", side }` — that side's deployment anchor.
- `{ role: "deployZone", side, index }` — the `index`-th hex of that side's deploy zone.
- `{ role: "along", from, to, distance, lateral? }` — `distance` hexes from `from`'s anchor toward `to`'s anchor
  (negative or past the far anchor extrapolates behind or beyond it), nudged `lateral` hexes to one side.

Any scenario field that used to take `[q, r]` (`deploy`, a specialist's `at`, a portal's `at`, a ritual's `center`,
and the hex on a `CaptureHold` or `Escort` objective) now takes a `Placement`: either the old literal tuple or a
role. A scenario opts into a generated field with `"map": { "generate": { ...MapSpec minus seed } }` in place of
the fixed `{ width, height, terrain }` block; `buildScenario` then resolves every role against that field before
deploying anything, spiralling a role to the nearest free hex if two features would otherwise land on the same
one. `data/scenarios/ford_crossing.json` is the worked example: the same file plays out on any seed, with its
ritual circle, reinforcement portal and capture-hold objective always the same distance from the lines they
belong to rather than the same two coordinates.

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

### Scaffold status

A structural scaffold following the mapping above lives under `unity/` — see `unity/README.md` for what
is stubbed versus real. It is not a working Unity project (no `.unity` scene, no package manifest, nothing
compiled), just the C# shapes and an editor importer sketch to build the real port against.

`unity/Generated/` is regenerated from this repository's own source of truth rather than hand-written:

- `EffectKinds.g.cs` mirrors `EFFECT_KINDS` in `core/src/effects.ts` — every `effect.kind` the interpreter
  (and the passive systems it defers to) understands.
- `TerrainRules.g.cs` mirrors `TERRAIN_RULES` in `core/src/types.ts`, field for field.
- `DataManifest.g.json` is a count-and-id summary of the loaded registry, for the importer to sanity-check
  against once it runs inside a real Unity project.

Run `npm run unity:scaffold` and commit the result after changing any of those three sources, the same way
`npm run assets` is re-run after an art or building-tier change. `core/tests/unityExport.test.ts` and
`core/tests/effect_kinds.test.ts` fail if the generated output or the ability data drift from the reference
TypeScript, so a forgotten regeneration shows up as a red test rather than a silent gap on the Unity side.

- `Replay` / `describeEvent` → a `ReplayController` MonoBehaviour holding the same cursor position, and a
  `switch` on `GameEvent.type` for narration; both are presentation-adjacent but stay data-only, no `UnityEngine`
  types needed until something actually draws the step.
