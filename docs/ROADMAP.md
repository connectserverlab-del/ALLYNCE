# Roadmap and standing intent

This file is the working brief for anyone, human or agent, picking up the next piece of the game. It sits beside the
original engineering brief and records what the owner has decided since. **Decisions here override the original
brief where they conflict.**

## Owner's standing intent (in their words, paraphrased where needed)

- Art: grimdark hand-painted concept illustration. "Less cartoonish", "not AI-looking", "League-style splash
  quality", "more grunge". Round 4 (V01, in `art/samples`) is the approved bar. Never credit any AI tool in repo
  content.
- Maps are never even squares or cookie-cutter. Real battlefields are uneven: trenches, mud, mountains, valleys,
  rivers. Playable areas are odd shapes. The current battlefield (`data/scenarios/threefold_invocation.json`) is
  still a fixed 24×18 rectangle with a few hand-placed terrain patches — this has not been addressed yet.
- Three universal win conditions: wipe out the opponent, kill their army leader, or force a surrender. Scenario
  objectives sit on top of these. Implemented in `core/src/battle.ts` (`evaluateVictory`) and
  `data/rules/victory.json`; see `docs/mechanics.md`.
- Every faction gets rank ladders with mechanical weight. Not started on this line of the codebase — every
  faction is currently a flat Commander/Second/Elite/FootSoldier template.
- Every faction gets cannons (siege) and cavalry that fit its theme. Only one Cavalry-flagged unit exists
  (`KNI_ELITE_SKY-LANCE-DRAGOON`); there is no Siege role unit yet.
- Ritual and Fusion are first-class functions of the engine. Rituals are implemented (`core/src/rituals.ts`);
  Fusion does not exist yet.
- Samples first. Show the owner a sample of any new visual direction before scaling it.
- Maps are painted **straight down from above**, like a hand-painted satellite photograph, with readable regions,
  roads and rooftops. Three-quarter battlefield paintings are rejected.
- The army is a **100-card deck** plus a **20-card ritual/fusion side deck**. Cards carry 1 to 10 stars; 10 is
  reserved for deities, gods, Kage, shoguns and kings, 1 for levy and squires. Not started on this line of the
  codebase.
- Beyond match-to-match battles there is a **permanent holding**: base building, research that upgrades units,
  and recruitment draws. Not started on this line of the codebase.
- Every asset must sit beside the existing characters without breaking immersion. Interface and icons included.
- Battlefields must be large enough that units sit comfortably and the camera zooms in; a unit must never scale a
  mountain instantly. Mountains slow ground movement fivefold; only fliers ignore them. No Mountain terrain type
  exists yet (`Terrain` in `core/src/types.ts` has Open, Forest, HighGround, Fortification, Smoke, AntiAir, Water).
- Cards are **paper**, never metal, and nothing in the interface may carry punched holes or rows of dots.

## Done

- Rules engine (TypeScript reference, 39 tests): hex grid, terrain-aware movement, the modifier pipeline with a
  named-source breakdown for every stat, theme cohesion, army composition and doctrine, command aura and
  succession, deterministic combat, morale bands, a data-driven effects interpreter (Twin Echo clone reference),
  the ritual system (progress, Held, Unstable, synchronized release), reinforcement portals, eleven composable
  objective types, a seeded/replayable turn machine, and a utility-scoring AI.
- Three universal win conditions — Wipeout, LeaderKilled (opt-in per scenario via a designated Army Leader,
  deliberately kept distinct from platoon Commanders so it does not undercut succession), and Surrender
  (sustained low average morale, not a single bad round) — always evaluated under any scenario objectives.
  Thresholds in `data/rules/victory.json`. See `docs/mechanics.md`.
- `Threefold Invocation`: a fully data-defined, playable-start-to-finish scenario exercising rituals, portals,
  succession, clones and now the universal win conditions together.
- Approved V01 art: 8 units across the four combat factions (Samurai, Shinobi, Knight, Dragon Host), each with a
  concept painting and a cutout, plus the round-by-round rejection history in `docs/art-pipeline.md`.

## Next, in priority order

1. **Irregular, odd-shaped battlefields.** The current map is a fixed rectangle with a handful of hand-placed
   terrain patches — exactly the "cookie-cutter" shape the owner rejected. Needs new Terrain values (Mountain,
   Valley, Trench, Mud, River, Ford, Road, Ruins), movement-cost rules for them (Mountains ×5, ×6 for cavalry, ×2
   for fliers), and a seeded generator that carves a non-rectangular playable area with balanced deployment
   anchors. Not blocked; this is the highest-leverage foundational item left.
2. **Rank ladders with mechanical weight**, one faction at a time (Samurai first is a reasonable start given the
   owner named it explicitly in the original brief). Not blocked, but scope it to one faction per pass — a full
   ladder times four factions is not "one item."
3. **Themed cannons and cavalry**, four of each, one faction at a time. Needs a new Siege role and matching
   abilities (set up, minimum range, breaching shot, suppressive fire) in `data/abilities` and `core/src/effects.ts`.
   Not blocked.
4. **Fusion** as a first-class engine function alongside Ritual. Needs a design pass (materials, summon rules,
   interaction with the composition validator) before implementation — flag for an owner nod on scope before a
   pass claims it, since it touches army legality broadly.
5. **A genuine Army-Leader-tier unique unit** per faction (King/Shogun/Kage or equivalent), distinct from platoon
   Commanders, so `LeaderKilled` has something to target without cannibalizing succession. Naming and exact
   lore role need an owner decision before art or stats are finalized — do not invent faction rulers unilaterally.
6. **Cards (100-card deck + 20-card side deck) and the permanent holding.** Large, structural, and not yet
   scoped by the owner on this line of the codebase — needs an owner decision on sequencing before any pass
   claims a piece of it.

## Brainstorm log

Append dated notes here. Ideas are proposals until the owner approves them.

- 2026-09-08: Proposal — give each faction a single Army-Leader-tier unique (a King, Shogun, Kage, or Dragon
  Host equivalent) that sits above platoon Commanders in the deployment hierarchy: it has no Second and no
  succession line, so its death is unambiguous and clean to wire into the new `LeaderKilled` win condition. Its
  loss could also apply an army-wide morale penalty (distinct from ordinary "Commander defeated" per-platoon
  morale loss in `command.ts`) even in scenarios that don't designate it as the formal win-condition target,
  so the figure matters mechanically before every faction has one modeled.
- 2026-09-08: Proposal — once Mountain terrain exists, a Siege unit's "set up" state could be blocked from
  Mountain hexes entirely (matches the intent that only fliers ignore the fivefold cost; siege pieces are the
  least mobile unit type and shouldn't be able to perch on high ground the rest of the army can barely climb),
  while ranged units on adjacent HighGround still get the existing +1 range bonus over a dug-in siege line.
