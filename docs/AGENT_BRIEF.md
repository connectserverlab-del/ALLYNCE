# Agent brief: recurring implementation pass

You are working in the ALLYNCE repository, an original tactical army strategy game. Read, in this order:

1. `docs/CHECKLIST.md` (the work queue and the claim protocol)
2. `docs/ROADMAP.md` (owner intent and the brainstorm log)
3. `README.md` and `docs/mechanics.md` (how the engine is organised)
4. `art/prompts/STYLE_GUIDE.md` (approved art direction) if the task touches art
5. The original engineering brief, if present under `docs/`, for the long-term vision

## Where work goes

**Every pass works on the integration branch `claude/merge-85-prs-ec3ca0`, which is pull request #88.**

Eighty-five parallel branches were open at once before this rule existed. Each was green alone and
several were not green together: two branches implemented the same checklist item four different ways,
one moved a fix another branch had just made, and one silently overwrote a hand-authored faction on
every regeneration. Consolidating them cost more than the features did. One branch, reviewed as one
pull request, is what replaced that.

So:

- Branch from `claude/merge-85-prs-ec3ca0`, not from `main`.
- Push your commits to `claude/merge-85-prs-ec3ca0`. Pull first (`git pull --rebase=false origin
  claude/merge-85-prs-ec3ca0`) so a concurrent pass is merged rather than clobbered.
- **Do not open a new pull request.** Your work appears in #88. Never force-push it: other passes and
  the owner's review are on that history.
- If the branch is red when you arrive, fixing it *is* your item for the pass.

If #88 has been merged or closed, the integration branch has done its job: start the next one from
`main`, open one pull request for it, and update this section to name it.

## The target

ALLYNCE is aimed at being a AAA game for PC and console, with multiplayer as a first-class pillar.
`docs/ROADMAP.md` states the five pillars and the honest scale; read it before picking an item. Every
queued item serves at least one pillar. An item that serves none is not AAA work — say so rather than
doing it.

Two consequences for a pass, both cheap now and expensive later:

- **Do not reach for `Math.random()`, wall-clock time, or iteration order that depends on object identity.**
  The engine is deterministic and that guarantee is what lockstep multiplayer, replays and server-side
  validation all rest on. Seeded `Rng` or nothing.
- **Player-facing strings are content, not code.** They will be localised.

## Each pass

1. `npm install` and then `npm run check` must be green before you change anything. That is the same
   command CI runs: generated-data drift, typecheck, the Vitest rules suite, the headless browser
   checks and the roster invariants. If it is red, fixing it *is* the item for this pass — do not
   layer new work on a broken branch.
2. **Claim an item before working.** Open `docs/CHECKLIST.md`. An item is already claimed if its id
   appears in an open pull request title or body, in a branch name, or in a commit on the integration
   branch — draft or not. Take the highest **unclaimed** Queue item that is not blocked on an owner
   decision. One pass takes exactly one item. If every item is claimed or blocked, do not invent
   scope: improve tests, docs, or engine robustness, and say so.
3. Put the item id in your commit subject. On a shared branch the commit log is what makes a claim
   visible to the next pass, so do it even when the work is small.
4. Implement data-first: numbers and content in `data/`, rules in `core/src`, tests in `core/tests`,
   docs updated to match. Keep the modifier breakdown honest — every new bonus or penalty records its
   source string, the same way `computeStat`'s `Modifier[]` already does.
5. Generated files are regenerated, never hand-edited. `data/units/expansion.json`,
   `data/abilities/expansion.json` and the expansion entries of `data/factions/factions.json` come
   from `tools/content/` via `npm run gen:content`; `art/ASSET_REGISTRY.json` from `npm run assets`;
   `docs/samples/*.html` from `node scripts/build-sample.mjs`. An edit made in the output is reverted
   the next time anything regenerates, and CI fails on the drift. Change the generator.
6. Run `npm run check` until green. Do not push red.
7. Commit with a clear message. Keep AI tool names and attribution out of the repository itself —
   code, data, docs, art, pull request prose. The owner asked for that and it holds.

   The one exception is not ours to make: some environments require a `Co-Authored-By` trailer and a
   session link on commits and pull request descriptions, and refuse the commit without them. Where
   that applies, comply with the environment and keep everything *inside* the repository clean, which
   is what the rule is actually protecting. Do not edit this line to make the conflict go away; a
   later pass needs to know it exists.
8. Move the finished item from the Queue to Done in `docs/CHECKLIST.md`, in the same commit. Add at
   least one dated line to the roadmap's brainstorm log: an idea that follows from the owner's stated
   intent, marked as a proposal.

## Standing design facts

- The rules engine is a TypeScript reference implementation (`core/src`) with a deterministic event
  log; the Vitest suite in `core/tests` is the acceptance spec. See `docs/mechanics.md` for the module
  map.
- Terrain and unit stats are pure data (`data/units`, `data/abilities`, `data/factions`,
  `data/compositions`, `data/scenarios`, `data/rules`). Nothing that changes game balance belongs in
  `core/src`.
- Cards: 100-card main deck, 20-card ritual/fusion/stratagem side deck, stars 1-10. Rules in
  `data/cards/`, engine in `core/src/cards.ts`, reference in `docs/cards-and-kingdom.md`.
- The holding: `data/kingdom/`, `core/src/kingdom.ts`. Everything it grants must reach battle as a
  named, source-tracked modifier so the attack breakdown stays honest.
- Per-round battle state (duels, order flags, hidden-after-attack and intercept marks, timed terrain)
  lives on the `Battle` instance, never at module scope. Two battles exist in one process routinely —
  a match runner, a test file, the campaign layer — and module-scope state leaks between them.
- Platoon Commanders already have a Second and a succession line (`command.ts`). An **Army Leader**
  for the win-condition system is a distinct, army-wide unique unit, not a repurposed platoon
  Commander, or it short-circuits succession.
- The three universal win conditions (Wipeout, LeaderKilled, Surrender) are always evaluated under
  whatever objectives a scenario declares; read `docs/mechanics.md`'s "Universal win conditions"
  section before touching `evaluateVictory` in `core/src/battle.ts`.
- A unit in a faction that has a rank ladder needs a `factionRank` its ladder actually lists, and a
  Commander or Second needs a rung that may lead a Platoon, or `validateArmy` rejects every platoon
  it leads.
- Maps are painted straight down from above. Never commission a three-quarter battlefield painting.

## Guardrails

- Do not change approved art or rename units without an owner decision recorded in the roadmap.
- Do not add real-world religious names or symbols; Divine Entities stay fictional.
- Do not generate new art in an automated pass unless the roadmap item explicitly calls for it; art is
  sampled and approved by the owner first.
- Do not skip, disable or loosen a test or an invariant to get green. If content genuinely lags a
  rule, record the gap in an explicit list the way `data/art/awaiting-art.json` and
  `data/cards/awaiting-skill.json` do, so the rule still bites everywhere else.
- Do not merge pull requests.
