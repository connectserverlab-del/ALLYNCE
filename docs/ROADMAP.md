# Roadmap and standing intent

This file did not previously exist on `main`; it is seeded here because the owner's standing intent needs a home
on the branch this repository actually treats as `main`, and because forward passes need a brainstorm log to add
to. See "A note on branches" at the end of this file before treating this as the only place the game is being
built.

## Owner's standing intent

- Art: grimdark hand-painted concept illustration. "Less cartoonish", "not AI-looking", "League-style splash
  quality", "more grunge". Round 4 in `art/samples` is the approved bar. Never credit any AI tool in repo content.
- Maps are never even squares or cookie-cutter. Real battlefields are uneven: trenches, mud, mountains, valleys,
  rivers. Playable areas are odd shapes.
- Three universal win conditions: wipe out the opponent, kill their army leader, or force a surrender. Scenario
  objectives sit on top of these.
- Every faction gets rank ladders with mechanical weight.
- Every faction gets cannons (siege) and cavalry that fit its theme.
- Ritual and Fusion are first-class functions of the engine.
- Samples first. Show the owner a sample of any new visual direction before scaling it.
- Cards are paper, never metal, and nothing in the interface may carry punched holes or rows of dots.
- No real-world religious names or symbols. Divine Entities stay fictional.

## Done (on `main`)

- Rules engine: hex grid, terrain rules table, modifier pipeline (every contribution source-tracked), theme
  cohesion, composition/doctrine, command and succession, combat, morale, effects interpreter, clones, rituals,
  Divine Entities, reinforcement portals, eleven composable objective types, a utility-scoring AI.
- One fully data-defined scenario, `Threefold Invocation`, playable start to finish.
- Direct test coverage for `ai.ts` (`core/tests/ai.test.ts`): target selection under the utility scorer
  (ritualist priority, clone avoidance), moving toward the only real goal on the field when no enemy unit
  exists but an enemy ritual does, a platoon leader auto-issuing its faction order once an enemy is in range,
  the two "immediate value" active abilities (a clone-spawning skill, a duel challenge against an adjacent
  elite), and both branches of `holdForSyncPolicy` (holds a linked group until every member is held, releases
  the whole group early once one member crosses the instability danger threshold). None of this had a direct
  test before; it was previously exercised only incidentally through full-match tests.

## Next, in priority order

1. Irregular battlefield generator: mountains, valleys, rivers, fords, trenches, mud, roads, ruins on top of the
   existing terrain rules table, so scenarios stop hand-placing every hex. Directly serves the owner's "uneven,
   odd-shaped battlefields" intent and nothing in `core/src` currently generates a map — `threefold_invocation.json`
   hard-codes its terrain list.
2. Rank ladders with mechanical weight for at least one faction (Samurai is the natural first, being the
   reference faction in `docs/mechanics.md`'s worked example): a promotion track with a real stat or privilege
   change per rank, not just a cosmetic title.
3. Siege and cavalry rosters for the four combat factions (Samurai, Shinobi, Knight, Dragon Host), fitting each
   faction's theme, per the owner's standing intent.
4. A second scenario, to prove the objective/AI systems generalize beyond `Threefold Invocation`.

## Brainstorm log

Append dated notes here. Ideas are proposals until the owner approves them.

- 2026-09-07 (proposal): `holdForSyncPolicy` (`core/src/ai.ts`) only ever considers rituals that carry a
  `linkGroup` — the grouping loop skips any ritual whose `linkGroup` is `null` before it can reach the release
  check, so a side's unlinked, single-circle ritual can never appear in the policy's output. Once such a ritual
  completes and enters `CompletedHeld`, this AI policy holds it forever: there is nothing to synchronize with,
  so the "wait for the whole group, or bail out under `unstableStacks >= 3` danger" logic that protects a linked
  group never gets a chance to run for it, and it would ride out instability indefinitely under AI control.
  Proposal: give `holdForSyncPolicy` a second branch alongside the grouped one — any live `CompletedHeld` ritual
  with `linkGroup === null` releases immediately, since a single circle has no synchronization to wait for and
  the point of holding at all was to wait for sibling circles that, in this case, do not exist. This keeps
  Ritual as a first-class, AI-playable function of the engine rather than one with a policy gap that only shows
  up when a scenario author chooses not to link a circle.

## A note on branches

`main` is behind `claude/dragon-art-style-examples-qdjeb6`, which carries its own `docs/AGENT_BRIEF.md`,
`docs/CHECKLIST.md` and a much longer `docs/ROADMAP.md` (cards, a permanent holding, a march/movement layer, a
web client, many more units and rank ladders, and dozens of open pull requests building on top of it). That
branch's `docs/CHECKLIST.md` is the actual claim protocol several recent passes have been using. This pass
targeted `main` and PR'd against `main` because that is what it was explicitly asked to do, and because the item
implemented here (direct test coverage for the existing AI, no gameplay change) stands on its own regardless of
which branch it lands on. Whether `main` should be fast-forwarded to that branch, or whether the two are meant to
stay separate, is an owner decision this pass is flagging rather than making — a prior pass
(`agent/2026-09-07-siege-cavalry-rosters`) flagged the same thing; it is still open.
