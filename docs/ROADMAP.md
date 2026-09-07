# Roadmap and standing intent

This file is the working brief for anyone, human or agent, picking up the next piece of the game on this branch.
**Decisions here override earlier notes where they conflict.**

## A note on scope

This roadmap describes the codebase actually present on `main` as of this pass: the rules-engine vertical slice
merged in the first pull request (hex grid, terrain, modifiers, cohesion, doctrine, succession, combat, morale,
effects, clones, rituals, Divine Entities, portals, objectives, utility AI) plus the victory-condition and AI
work added in this pass. It does not describe the much larger card game, holding/economy, warrant board, seven
themed divisions, or march-and-camera interface that a long-running branch (`claude/dragon-art-style-examples-qdjeb6`,
open as pull request #2 at time of writing) has built on top of an earlier snapshot of this same engine, nor the
dozens of passes stacked on top of that branch. Whether and when to merge that branch into `main` is an owner
decision this file does not make; until that happens, treat the two as separate roadmaps, and pick items from
this one only if you are actually working from `main`.

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
- **This pass**: the three universal win conditions are real. `evaluateVictory` now checks a scenario-named
  army leader per side (`VictoryRules.leaders`, from an optional `leader` field per side in the scenario file)
  and ends the match the round that leader falls, ahead of the round limit. `BattleController.surrender(side)`
  lets a side concede outright, and `ai.ts`'s `maybeSurrender` calls it once a side's whole chain of command
  (every platoon's Commander and Second) is gone and its average morale has fallen below the Disordered/Routed
  line — rather than letting the AI grind a lost battle to a full wipeout. The AI also positions with more care:
  ranged units (`range > 1`) hold their stand-off ring instead of closing to melee and weight High Ground within
  it, and Cavalry routes for a flank or rear hex around an equal-distance target instead of walking into the
  front arc.

## Next, in priority order

1. **Samurai and Shinobi rank ladders.** The owner's rank-ladder intent applies to every faction; `main` has
   none yet (`UnitDef.rank` is currently a flat label, not a ladder). Samurai and Shinobi first, since the two
   factions in `Threefold Invocation` already carry the most distinct identities (`docs/mechanics.md` §9).
2. **Knight, Dragon Host and Ritual Cult rank ladders**, once the Samurai/Shinobi pattern above exists to extend.
3. **Siege pieces.** `Role: "Siege"` already exists in `types.ts`, but no unit in `data/units/units.json` uses
   it yet — the AI's stand-off positioning above has nothing to fire against in a real match. One siege unit per
   combat faction (Samurai, Shinobi, Knight, Dragon Host), each with a minimum range so it cannot fire adjacent,
   would give both the roster and the AI positioning work a real target.
4. **Cavalry beyond the one Dragoon.** Only `KNI_ELITE_SKY-LANCE-DRAGOON` carries the `Cavalry` role today; the
   new flank-routing AI only has one unit to exercise it. Cavalry for Samurai, Shinobi and Ritual Cult would
   match the owner's "cannons and cavalry that fit its theme" intent and broaden that AI path.
5. **Irregular battlefield generator.** `Threefold Invocation`'s map is hand-authored; the owner's "never a
   cookie-cutter map" intent (trenches, mud, mountains, valleys, rivers) has no generator on `main` yet, and no
   `Trench`/`Mud` terrain types exist in `types.ts` to generate.
6. **A second scenario.** One playable scenario makes it hard to tell a genuinely reusable objective/AI system
   from one that only happens to work for `Threefold Invocation`'s specific layout.

## Brainstorm log

Append dated notes here. Ideas are proposals until the owner approves them.

- 2026-09-07: **Proposal** — give `moraleSummary` an optional "at risk of surrender" flag surfaced per side
  (rather than only the boolean decision `maybeSurrender` acts on), so a future HUD can warn a human player
  their command structure is one loss away from being forced to concede, instead of the surrender simply
  happening off-screen.
- 2026-09-07: **Proposal** — once siege units exist (see Next #3), give them a `minimumRange` field enforced the
  same way `range` already caps `attack()`, so a siege piece standing adjacent to a target is mechanically
  unable to fire rather than merely AI-discouraged from standing there.
