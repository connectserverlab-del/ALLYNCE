# Agent brief: recurring implementation pass

You are working in the ALLYNCE repository, an original tactical army strategy game. Read, in this order:

1. `docs/CHECKLIST.md` (the work queue and the claim protocol)
2. `docs/ROADMAP.md` (owner intent and the brainstorm log)
3. `README.md` and `docs/mechanics.md` (how the engine is organised)
4. `art/prompts/STYLE_GUIDE.md` (approved art direction) if the task touches art
5. The original engineering brief, if present under `docs/`, for the long-term vision

1. `docs/ROADMAP.md` (owner intent, what is done, what is next, brainstorm log)
2. `README.md` and `docs/mechanics.md` (how the engine is organised)
3. `art/prompts/STYLE_GUIDE.md` (approved art direction) if the task touches art
4. The original engineering brief, if present under `docs/`, for the long-term vision

## Each pass

1. `npm install && npm test` must be green before you change anything.
2. **Claim an item before working.** Open `docs/CHECKLIST.md`. List open pull requests and remote branches matching
   `agent/*`. An item is already claimed if its id appears in an open PR title, an open PR body, or a branch name,
   draft or not. Take the highest **unclaimed** item from the Queue that is not blocked on an owner decision.
   One pass takes exactly one item. If every item is claimed or blocked, do not invent work: improve tests, docs
   or the AI, and say so in the pull request.
3. Name the branch `agent/<yyyy-mm-dd>-<ITEM-ID>` and put the item id in the pull request title. That is what makes
   your claim visible to the next pass, so do it even if the work is small.

2. Pick the highest item in "Next" that is not blocked on an owner decision. Do one item well rather than several
   half-done. If everything is blocked, improve tests, docs or the AI instead.
3. Implement data-first: numbers in `data/`, rules in `core/src`, tests in `core/tests`. Keep the modifier breakdown
   honest: every new bonus records its source.
4. Run `npm test` and `npm run typecheck`. Do not push red.
5. Commit with a clear message. Keep AI tool names and attribution out of the repository itself — code,
   data, docs, art, PR prose. The owner asked for that and it holds.

1. `docs/ROADMAP.md` (owner intent, done list, prioritized next items, brainstorm log)
2. `README.md` and `docs/mechanics.md` (how the engine is organised)
3. `art/prompts/STYLE_GUIDE.md` (approved art direction) if the task touches art

## Each pass

1. `npm install && npm test` must be green before you change anything. If it is red, fixing it *is* the item
   for this pass — do not layer new work on a broken suite.
2. Take the highest-priority item in the roadmap's **Next** list that is not blocked on an owner decision.
   One pass takes exactly one item. If every remaining item is blocked, do not invent scope: improve tests,
   docs, or engine robustness instead, and say so in the pull request.
3. Implement data-first: numbers and content in `data/`, rules in `core/src`, tests in `core/tests`, docs
   updated to match. Keep the modifier breakdown honest — every new bonus or penalty records its source string,
   the same way `computeStat`'s `Modifier[]` already does.
4. Run `npm test` and `npm run typecheck`. Do not push red.
5. Commit with a clear message. Keep AI tool names and attribution out of the repository itself — code, data,
   docs, art, PR prose. The owner asked for that and it holds.

   The one exception is not ours to make: some environments require a `Co-Authored-By` trailer and a session
   link on commits and PR descriptions, and refuse the commit without them. Where that applies, comply with
   the environment and keep everything *inside* the repository clean, which is what the rule is actually
   protecting. Do not edit this line to make the conflict go away; a later pass needs to know it exists.
6. Push to a new branch named `agent/<yyyy-mm-dd>-<topic>` and open a draft pull request that explains what changed,
   why it follows the owner's intent, and what decision (if any) the owner should make next.
7. Move the finished item from the Queue to Done in `docs/CHECKLIST.md`, in the same pull request. Add at least one dated line to the brainstorm log:
   an idea that follows from the owner's stated intent, marked as a proposal.

## Standing design facts

- Cards: 100-card main deck, 20-card ritual/fusion side deck, stars 1-10. Rules in `data/cards/`, engine in
  `core/src/cards.ts`, reference in `docs/cards-and-kingdom.md`.
- The holding: `data/kingdom/`, `core/src/kingdom.ts`. Everything it grants must reach battle as a named,
  source-tracked modifier so the attack breakdown stays honest.
- Maps are painted straight down from above. Never commission a three-quarter battlefield painting.

6. Push to a new branch and open a draft pull request that explains what changed, why it follows the owner's
   intent, and what decision (if any) the owner should make next.
7. Move the finished item from "Next" to "Done" in `docs/ROADMAP.md`. Add at least one dated line to the brainstorm log:
   an idea that follows from the owner's stated intent, marked as a proposal.

6. Push to a new branch and open a draft pull request that explains what changed, why it follows the owner's
   intent, and what decision (if any) the owner should make next.
7. Move the finished item from **Next** to **Done** in `docs/ROADMAP.md`, in the same pull request. Add at
   least one dated line to the brainstorm log: an idea that follows from the owner's stated intent, marked as
   a proposal.

## Standing design facts

- The rules engine is a TypeScript reference implementation (`core/src`) with a deterministic event log; the
  Vitest suite in `core/tests` is the acceptance spec. See `docs/mechanics.md` for the module map.
- Terrain and unit stats are pure data (`data/units`, `data/abilities`, `data/factions`, `data/compositions`,
  `data/scenarios`, `data/rules`). Nothing that changes game balance belongs in `core/src`.
- Every faction currently uses a flat Commander/Second/Elite/FootSoldier template (`data/units/units.json`).
  Platoon Commanders already have a Second and a succession line (`command.ts`) — an **Army Leader** for the
  win-condition system (see below) must be a distinct, army-wide unique unit, not a repurposed platoon
  Commander, or it will short-circuit succession.
- The three universal win conditions (Wipeout, LeaderKilled, Surrender) are always evaluated under whatever
  objectives a scenario declares; see `docs/mechanics.md`'s "Universal win conditions" section before touching
  `evaluateVictory` in `core/src/battle.ts`.
- Maps are painted straight down from above. Never commission a three-quarter battlefield painting.

## Guardrails

- Do not change approved art or rename units without an owner decision recorded in the roadmap.
- Do not add real-world religious names or symbols; Divine Entities stay fictional.
- Do not generate new art in an automated pass unless the roadmap item explicitly calls for it; art is sampled and approved by the owner first.

- Do not generate new art in an automated pass unless the roadmap item explicitly calls for it; art is sampled
  and approved by the owner first.
- Do not merge pull requests.
