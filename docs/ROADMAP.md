# Roadmap and standing intent

This file is the working brief for anyone, human or agent, picking up the next piece of the game on `main`.
**Decisions here override earlier notes where they conflict.**

## A note on scope

This roadmap describes the codebase actually present on `main`: the rules-engine vertical slice (hex grid, terrain,
modifiers, cohesion, doctrine, succession, combat, morale, effects, clones, rituals, Divine Entities, portals,
objectives, utility AI) plus the Samurai and Shinobi rank ladders added in this pass. It does not describe the much
larger card game, holding/economy, warrant board, seven themed divisions, or march-and-camera interface that a
long-running branch (`claude/dragon-art-style-examples-qdjeb6`) has built on top of an earlier snapshot of this same
engine, nor the dozens of passes stacked on top of that branch or on top of other unmerged branches based on `main`.
Whether and when to merge any of that into `main` is an owner decision this file does not make; until that happens,
treat them as separate roadmaps, and pick items from this one only if you are actually working from `main`.

## Owner's standing intent (in their words, paraphrased where needed)

- Art: grimdark hand-painted concept illustration. "Less cartoonish", "not AI-looking", "League-style splash
  quality", "more grunge". Never credit any AI tool in repo content.
- Maps are never even squares or cookie-cutter. Real battlefields are uneven: trenches, mud, mountains, valleys,
  rivers. Playable areas are odd shapes.
- Three universal win conditions: wipe out the opponent, kill their army leader, or force a surrender. Scenario
  objectives sit on top of these.
- Every faction gets rank ladders with mechanical weight, cannons (siege) and cavalry that fit its theme.
- Ritual and Fusion are first-class functions of the engine.
- Samples first. Show the owner a sample of any new visual direction before scaling it.
- The army is a **100-card deck** plus a **20-card ritual/fusion side deck**. Cards carry 1 to 10 stars.
- Beyond match-to-match battles there is a **permanent holding**: base building, research that upgrades units,
  and recruitment draws.
- Cards are **paper**, never metal, and nothing in the interface may carry punched holes or rows of dots.
- Do not add real-world religious names or symbols; Divine Entities stay fictional.

## Done (on `main`)

- Rules engine (TypeScript reference): hex grid, terrain rules table, elevation-free movement costs, modifier
  pipeline with source-tracked breakdowns, theme cohesion, platoon doctrine and Continuity, command auras,
  succession, combat with facing arcs and reactions, morale bands, the shared effects interpreter, clones,
  rituals with Held/Unstable/synchronized release, Divine Entities, reinforcement portals, eleven composable
  objectives, and a goal-oriented utility AI.
- `Threefold Invocation`: one fully data-defined, playable scenario exercising every system above.
- 17 unit concepts with approved (Round 4 quality bar) concept art and cutouts; art pipeline and asset manifest.
- **This pass**: Samurai (`data/factions/ranks/SAM.json`, 19 rungs, Koyakunin to Shogun) and Shinobi
  (`data/factions/ranks/SHI.json`, 6 rungs, Apprentice to Kage) rank ladders. `Registry.rankOf` resolves a unit's
  optional `rankId` to a rung with named, source-tracked privileges wired into the existing modifier pipeline and
  movement code rather than bolted on beside it: `twoSwords` (+50 ATK on a reaction attack), `mounted` (+1
  Movement, conditional on a nearby enemy for "war"), `commandRadiusBonus` (extends the aura, morale recovery and
  `PreventRouted` radius alike), `banner` (+5 further Morale recovery), `castle` (+100 further DEF on
  Fortification), `canopy` (Forest costs 1 Movement instead of 2), `hideOnForestStop`, and `ignoreZoc`
  /`passAllies`/`bonusMov`. Only the rungs the current roster actually occupies are exercised in battle; the
  higher Samurai tiers and Shinobi's Kage (with a declared but unwired Shadow Step) are real rungs reserved for
  units not yet rostered. See `docs/mechanics.md`'s "Rank ladders" section and `core/tests/ranks.test.ts`.

## Next, in priority order

1. **Knight, Dragon Host and Ritual Cult rank ladders**, extending the Samurai/Shinobi pattern above. Knight
   privileges likely mirror Samurai's mounted/castle vocabulary (a defensive, cavalry-supporting faction); Dragon
   Host is airborne and mostly ignores terrain, so its ladder probably weights aura and reaction-attack privileges
   over movement ones; Ritual Cult has no Commander/Second today (`RIT_LEADER_AFFILIATED-SUMMONER` is a
   `Specialist`), so its ladder may need a leadership slot decision first.
2. **Three universal win conditions.** `main` only has the implicit wipeout (`alive.length === 0`) and each
   scenario's own objectives; "kill their army leader" and "force a surrender" (concede when the whole chain of
   command is gone and morale has collapsed) are not implemented yet. `VictoryRules` in `battle.ts` has no leader
   or surrender concept to hang either on.
3. **Siege pieces.** `Role: "Siege"` exists in `types.ts`, but no unit in `data/units/units.json` uses it. One
   siege unit per combat faction (Samurai, Shinobi, Knight, Dragon Host), each with a minimum range so it cannot
   fire adjacent, would give the roster a real target for that role.
4. **Cavalry beyond the one Dragoon.** Only `KNI_ELITE_SKY-LANCE-DRAGOON` carries the `Cavalry` role today.
   Cavalry for Samurai, Shinobi and Ritual Cult would match the owner's "cannons and cavalry that fit its theme"
   intent, and would be a natural fit for the Samurai `mounted` rank privilege above.
5. **Irregular battlefield generator.** `Threefold Invocation`'s map is hand-authored; the owner's "never a
   cookie-cutter map" intent (trenches, mud, mountains, valleys, rivers) has no generator on `main` yet, and no
   `Trench`/`Mud` terrain types exist in `types.ts` to generate.
6. **A second scenario.** One playable scenario makes it hard to tell a genuinely reusable objective/AI system
   from one that only happens to work for `Threefold Invocation`'s specific layout.

## Brainstorm log

Append dated notes here. Ideas are proposals until the owner approves them.

- 2026-09-08: **Proposal** — once a faction's rank ladder reaches its top rungs (Shogun for Samurai, Kage for
  Shinobi), let the scenario file name that unit as the side's `leader` for the win-condition system above
  (Next #2), so "kill the army leader" always resolves to the highest-ranked living unit in the chain of command
  rather than a separately-authored field that can drift out of sync with the ladder.
- 2026-09-08: **Proposal** — a `demoted` flag for a unit whose commander/second falls and is not replaced before
  Continuity expires: rather than the platoon simply losing its aura, the highest-tier surviving unit on the rank
  ladder could inherit a partial aura scaled to its own rung, giving the ladder mechanical weight during a
  succession crisis and not only while the chain of command is intact.
