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
- Siege and cavalry roster for the four combat factions: one Siege specialist each (Samurai, Shinobi, Knight,
  Dragon Host), with a new `minRange` rule so siege pieces cannot fire point-blank, and a shared Breaching
  Volley bonus against Fortification terrain; Samurai and Shinobi each gain a Cavalry Elite alternative with a
  themed charge ability built on the existing `ChargeBonus` effect. Knight already had a cavalry-tagged Elite
  (Sky-Lance Dragoon); Dragon Host's roster is all-flying already and was left without a dedicated ground
  Cavalry unit — see the brainstorm log.

## Next, in priority order

1. Irregular battlefield generator: mountains, valleys, rivers, fords, trenches, mud, roads, ruins on top of the
   existing terrain rules table, so scenarios stop hand-placing every hex. Directly serves the owner's "uneven,
   odd-shaped battlefields" intent and nothing in `core/src` currently generates a map — `threefold_invocation.json`
   hard-codes its terrain list.
2. Rank ladders with mechanical weight for at least one faction (Samurai is the natural first, being the
   reference faction in `docs/mechanics.md`'s worked example): a promotion track with a real stat or privilege
   change per rank, not just a cosmetic title.
3. A second scenario, to prove the objective/AI systems generalize beyond `Threefold Invocation` and to exercise
   the new siege and cavalry units in an actual battle rather than only in isolated tests.
4. Decide whether Dragon Host gets a dedicated ground/anchor Cavalry unit or stays without one by design (see
   brainstorm log below) — this one is an owner call, not something to resolve by implementing it either way.

## Brainstorm log

Append dated notes here. Ideas are proposals until the owner approves them.

- 2026-09-07 (proposal): Now that Siege units have a `minRange`, give them a second passive that trades their
  already-low `mov` for extra DEF while they haven't moved this round ("Braced" — the crew digs in once the
  battery stops), so committing a siege piece to a position is a real decision rather than a unit that is simply
  weak until it happens to connect. Would reuse the existing per-unit temp-modifier mechanism in `modifiers.ts`;
  no new effect kind needed.
- 2026-09-07 (proposal): Rather than inventing a fifth ground-cavalry unit for Dragon Host purely to fill out a
  "four factions, four cavalry" checklist, let Dragon Host's existing Elite or Second pick up a `ChargeBonus`
  ability of its own (a dive, not a lance) so the faction's mobility identity gets the same charge-risk/reward
  mechanic without adding a redundant non-flying unit that contradicts "Dragon Host is an aerial force."

## A note on branches

`main` is behind `claude/dragon-art-style-examples-qdjeb6`, which carries its own `docs/AGENT_BRIEF.md`,
`docs/CHECKLIST.md` and a much longer `docs/ROADMAP.md` (cards, a permanent holding, a march/movement layer, a
web client, many more units and rank ladders, and dozens of open pull requests building on top of it). That
branch's `docs/CHECKLIST.md` is the actual claim protocol several recent passes have been using. This pass
targeted `main` and PR'd against `main` because that is what it was explicitly asked to do, and because the item
implemented here (siege and cavalry data plus two small, additive engine rules) stands on its own regardless of
which branch it lands on. Whether `main` should be fast-forwarded to that branch, or whether the two are meant to
stay separate, is an owner decision this pass is flagging rather than making.
