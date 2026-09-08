# Roadmap and standing intent

This file is the working brief for anyone, human or agent, picking up the next piece of the game on `main`. It
sits beside the original engineering brief and records what the owner has decided since. **Decisions here
override the original brief where they conflict.** See "A note on branches" at the end before treating this as
the only place the game is being built.

## Owner's standing intent

- Art: grimdark hand-painted concept illustration. "Less cartoonish", "not AI-looking", "League-style splash
  quality", "more grunge". Never credit any AI tool in repo content.
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

- Rules engine: hex grid, modifier pipeline (every contribution source-tracked), theme cohesion,
  composition/doctrine, command and succession, combat, morale, effects interpreter, clones, rituals, Divine
  Entities, reinforcement portals, eleven composable objective types, a utility-scoring AI.
- One fully data-defined scenario, `Threefold Invocation`, playable start to finish.
- Direct test coverage for `ai.ts` (target selection, movement goals, active-ability use, the ritual sync/release
  policy).
- **Irregular battlefield generator** (`core/src/mapgen.ts`, `docs/mechanics.md`): carves an odd-shaped playable
  area out of a rectangular grid (a reserved inset core plus randomized edge "bites", so the outline is never a
  plain rectangle but the interior always stays solid and connected) and scatters Mountain, Forest, Mud, Trench
  and Ruins terrain, a handful of Fortification points, a river with fords, and a road — all from one seed, fully
  deterministic. New terrain rules (`data/terrain/terrain.json`, loaded as `Registry.terrainRules`):
  - `Mountain` costs 5x ground movement; flying units ignore it, per the owner's stated rule.
  - `Mud`, `Trench` and `Ford` cost 2x ground movement.
  - `Trench` grants +100 DEF, `Ruins` +50 DEF (both source-tracked as `Terrain: <kind>`, same pipeline slot as
    the existing `Fortification` +200 and `HighGround` ranged-ATK bonus, which are now data-driven from the same
    table instead of hardcoded).
  - `Road` always costs 1 movement, including where it crosses rough terrain or bridges a river at a ford.
  - `core/tests/mapgen.test.ts` and `core/tests/terrain.test.ts` cover determinism, seed variance, the carved
    outline, density scaling, river/ford/road connectivity, and every new cost and DEF rule.

## Next, in priority order

1. **Deployment-zone balance check on generated maps.** Now that `generateBattlefield` exists, a scenario author
   picking two deployment anchors on a generated map has no way to know whether both sides get a fair path to
   the middle. Add a check (path cost between anchor sets, via the existing BFS-reachable movement code) that
   flags an anchor pair as unbalanced past some tolerance, so generated maps can be validated before use.
2. **A second scenario built on a generated map**, to prove the objective/AI/victory systems generalize beyond
   the one hand-authored `Threefold Invocation` map and to exercise `mapgen.ts` end to end in a real playthrough.
3. **Named biome presets** (Ashfall, Marsh, Highland Pass) as parameter bundles over `MapSpec`, so a scenario can
   ask for a region by name instead of tuning raw density knobs. (A biome system already exists on the much
   larger `claude/dragon-art-style-examples-qdjeb6` branch under a different generator; this item is scoped to
   `main`'s own `mapgen.ts` and should not assume that branch's code.)
4. **Samurai and Shinobi rank ladders with mechanical privileges** — claimed by open PR
   `claude/wizardly-ride-5hqpsp` ("Samurai and Shinobi rank ladders with mechanical privileges"). Do not
   duplicate; Knight, Dragon Host and Ritual Cult ladders remain open once that lands.
5. **Siege and cavalry roster for the four combat factions** — claimed by open PR
   `agent/2026-09-07-siege-cavalry-rosters`. Do not duplicate.
6. **Three universal win conditions** (Wipeout, Army Leader Killed, Surrender) — claimed by open PR
   `claude/wizardly-ride-hdn4rj` (and duplicated by two later passes that didn't check first,
   `claude/wizardly-ride-klrwsv` and `claude/wizardly-ride-o4mt3i`; a future pass should close two of the three
   rather than open a fourth). Do not duplicate further.
7. **AI use of terrain for positioning** (trenches, high ground, mountain chokepoints, siege standoff range) —
   partially claimed alongside item 6 by `claude/wizardly-ride-klrwsv`. Worth a dedicated pass once the
   win-condition duplicates above are resolved, scoped specifically to `core/src/ai.ts` picking up the new
   terrain costs and DEF bonuses added by this pass.

## Brainstorm log

Append dated notes here. Ideas are proposals until the owner approves them.

- 2026-09-07: `holdForSyncPolicy` (`core/src/ai.ts`) only considers rituals with a `linkGroup`; an unlinked,
  single-circle ritual that completes would never be released by AI control. Proposal: give it a second branch
  that releases an unlinked `CompletedHeld` ritual immediately, since a single circle has no group to
  synchronize with. Not yet implemented.
- 2026-09-08 (proposal): Now that `mapgen.ts` can carve an irregular outline and scatter rough terrain, siege
  units (min-range, no-fire-point-blank per the roster claimed in item 5 above) would read much more like real
  artillery if the generator could also mark a handful of `HighGround` hexes near each side's deployment anchor
  specifically for siege placement — giving both the ranged-ATK bonus and a sightline over intervening Mountain
  or Forest. This is a natural follow-up once both the siege roster and the deployment-zone balance check (item
  1) land, not a change to make unilaterally now since it touches how deployment anchors are chosen.
- 2026-09-08 (proposal): The river walk in `mapgen.ts` always crosses top-to-bottom. A `MapSpec.riverAxis`
  ("vertical" | "horizontal") knob would let a scenario author orient the water hazard to match a themed
  battlefield (e.g. a Samurai river-delta province) without touching the carving or scatter logic. Small, additive,
  and worth doing alongside item 3 (named biomes) rather than as its own pass.

## A note on branches

`main` is behind `claude/dragon-art-style-examples-qdjeb6`, which carries its own `docs/AGENT_BRIEF.md`,
`docs/CHECKLIST.md` and a much longer `docs/ROADMAP.md` (cards, a permanent holding, a march/movement layer, a
web client, many more units and rank ladders, and dozens of open pull requests building on top of it). That
branch's `docs/CHECKLIST.md` is the actual claim protocol several recent passes have been using, and it already
has its own irregular map generator with named biomes — unrelated code to `main`'s new `core/src/mapgen.ts`
above; the two should not be conflated or merged into each other casually. This pass targeted `main` and PR'd
against `main` because that is what it was explicitly asked to do. Whether `main` should be fast-forwarded to
that branch, or whether the two are meant to stay separate, remains an owner decision flagged by several prior
passes; this one doesn't resolve it either.
