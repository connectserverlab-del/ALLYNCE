# Roadmap and standing intent

This file is the working brief for anyone, human or agent, picking up the next piece of the game. It sits beside the
original engineering brief and records what the owner has decided since. **Decisions here override the original brief
where they conflict.**

## Owner's standing intent (in their words, paraphrased where needed)

- Art: grimdark hand-painted concept illustration. "Less cartoonish", "not AI-looking", "League-style splash quality",
  "more grunge". Round 4 in `art/samples` is the approved bar. Never credit any AI tool in repo content.
- Maps are never even squares or cookie-cutter. Real battlefields are uneven: trenches, mud, mountains, valleys, rivers.
  Playable areas are odd shapes.
- Three universal win conditions: wipe out the opponent, kill their army leader, or force a surrender. Scenario
  objectives sit on top of these.
- Every faction gets rank ladders with mechanical weight. Samurai (19 ranks) and Shinobi (6, each with a movement
  trait; Shinobi outrun Knights through forest) are in. Knight, Dragon Host and Ritual Cult ladders are next.
- Every faction gets cannons (siege) and cavalry that fit its theme. Four of each exist with art.
- Ritual and Fusion are first-class functions of the engine.
- Samples first. Show the owner a sample of any new visual direction before scaling it.

## Done

- Rules engine (TypeScript reference, 54 tests): hex grid, terrain rules table, elevation, modifier pipeline, cohesion,
  doctrine, succession, combat, morale, effects, clones, rituals, divine entities, portals, objectives, utility AI.
- Irregular map generator with mountains, valleys, trenches, mud, rivers, fords, roads, ruins, fortifications.
- Win conditions (wipeout, leader killed, surrender), army leaders per side.
- Samurai and Shinobi rank ladders with privileges and movement traits, Shadow Step.
- Fusion (Paired Line, Gate Wardens, Twinwing Drake, Calamity Form). Siege pieces (set up, minimum range, breaching
  shot, smoke shell, concussive blast). Cavalry (lance charge, hit and fade).
- 17 unit concepts with cutouts, 2 battlefield paintings, 1 HUD material sheet.
- Interactive map + HUD sample (see `docs/ui-sample.md`).

## Next, in priority order

1. **Owner review of the map and HUD sample.** Do not scale the UI until the three decisions in the sample page are
   answered (map look, command bar material, field size).
2. Knight, Dragon Host and Ritual Cult rank ladders with one mechanical trait each per rank.
3. Remaining unit art (see `pending` in `art/ASSET_MANIFEST.json`), then construction sheets for approved units.
4. Map generator: named biomes (Ashfall, Marsh, Highland pass), scenario-authored overrides on top of generated ground,
   deployment-zone balance check (path cost between anchors within 10 percent both ways).
5. AI: use trenches and high ground, siege positioning behind the line, cavalry flank routing, surrender when the
   leader is dead and average morale is below 20.
6. Army builder validation UI in the sample page (drag units into slots, live doctrine and capacity readout).
7. Formation Sandbox mode as a page: place units, see cohesion and doctrine live.
8. Unity port scaffolding once the owner confirms the engine target (see `docs/mechanics.md`).

## Brainstorm log

Append dated notes here. Ideas are proposals until the owner approves them.

- 2026-09-05: Weather as a round modifier (rain turns Open to Mud along rivers, fog reduces ranged range by 1).
- 2026-09-05: Siege pieces could target hexes for suppressive fire, laying a temporary "Shelled" terrain (−50 DEF,
  breaks charges) for one round.
- 2026-09-05: Shinobi Kage as an Army-tier unique with a once-per-battle "Night Falls" that hides every Shinobi in
  forest for one round.
- 2026-09-05: Fusion charges as a scenario resource: defenders start with 2, attackers 1, to make late fusions a comeback tool.
