# Agent brief: recurring implementation pass

You are working in the ALLYNCE repository, an original tactical army strategy game. Read, in this order:

1. `docs/ROADMAP.md` (owner intent, the Done/Next lists and the brainstorm log)
2. `README.md` and `docs/mechanics.md` (how the engine is organised)
3. `art/prompts/STYLE_GUIDE.md` (approved art direction) if the task touches art

## Each pass

1. `npm install && npm test` must be green before you change anything. Fix red tests first if you find them.
2. Take the highest-priority item in `docs/ROADMAP.md`'s Next list that is not blocked on an owner decision and
   is not already claimed by an open pull request (check open PR titles/bodies and `agent/*` branch names first).
   One pass takes exactly one item. If every item is claimed or blocked, do not invent work: improve tests, docs
   or the AI, and say so in the pull request.
3. Implement data-first: numbers in `data/`, rules in `core/src`, tests in `core/tests`. Keep the modifier
   breakdown honest: every new bonus records its source.
4. Run `npm test` and `npm run typecheck`. Do not push red.
5. Commit with a clear message. Keep AI tool names and attribution out of the repository itself — code,
   data, docs, art, PR prose. The owner asked for that and it holds.

   The one exception is not ours to make: some environments require a `Co-Authored-By` trailer and a session
   link on commits and PR descriptions, and refuse the commit without them. Where that applies, comply with
   the environment and keep everything *inside* the repository clean, which is what the rule is actually
   protecting. Do not edit this line to make the conflict go away; a later pass needs to know it exists.
6. Push to a new branch and open a draft pull request that explains what changed, why it follows the owner's
   intent, and what decision (if any) the owner should make next.
7. Add at least one dated line to the brainstorm log: an idea that follows from the owner's stated intent,
   marked as a proposal. Update the Next list in the same pull request (move the finished item out, add anything
   new the pass uncovered).

## Guardrails

- Do not change approved art or rename units without an owner decision recorded in the roadmap.
- Do not add real-world religious names or symbols; Divine Entities stay fictional.
- Do not generate new art in an automated pass unless the roadmap item explicitly calls for it; art is sampled
  and approved by the owner first.
- Do not merge pull requests.
