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
- Maps are painted **straight down from above**, like a hand-painted satellite photograph, with readable regions,
  roads and rooftops. The three-quarter battlefield paintings were rejected. A Samurai province with a Japanese
  aesthetic is the reference region.
- The army is a **100-card deck** plus a **20-card ritual/fusion side deck**. Cards carry 1 to 10 stars; 10 is
  reserved for deities, gods, Kage, shoguns and kings, 1 for levy and squires. Higher units demand sacrifices,
  as in the collectible card games the owner named.
- Beyond match-to-match battles there is a **permanent holding**: base building, research that upgrades units,
  and recruitment draws.
- Every asset must sit beside the existing characters without breaking immersion. Interface and icons included.
- Battlefields must be large enough that units sit comfortably and the camera zooms in; a unit must never scale a
  mountain instantly. Mountains slow ground movement fivefold; only fliers ignore them.
- Cards are **paper**, never metal, and nothing in the interface may carry punched holes or rows of dots.
- The stronghold's buildings and walls are upgradable and change their look as they rise, which means a growing
  asset list that has to be tracked.

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

### Done in the scale and tier pass

- Battlefields raised from ~300 to ~950 hexes, with anchors and deployment zones chosen for open room so a
  deployed line no longer walls itself in.
- Camera with four zoom levels, drag panning, wheel zoom, viewport culling and a clickable minimap.
- Mountains crossable at five times the cost (six for cavalry, two on the wing) plus the labored climb: a unit
  that cannot afford a hex may still take one, at the price of its whole activation.
- Building tier bands with art per tier and a fallback to the nearest painted tier.
- `npm run assets` regenerates a full asset registry from the data tables and from what is on disk.
- Cards reprinted on paper stock with a separate painted star asset; the metal frames are retired.

### Done in the card and holding pass

- Star scale 1-10 across all 40 units, with levy, named lords and 10-star sovereigns for each mortal faction.
- 100-card main deck and 20-card side deck: validation, copy limits, faction leadership, shuffle, draw, hand cap.
- Tribute summoning, ritual summoning by star total, fusion summoning by named materials, playable-card detection.
- The holding: eleven buildings with Keep gating and timers, resource production with storage, twelve-node
  research tree, three recruitment banners with pity, and carry-over into battle as named modifiers.
- New top-down painted maps (campaign, Samurai province), painted stronghold, card frames, card back, icon set.
- Redesigned interface: Field, Deck, Rites, Hold and Lands screens built on the painted assets.

## Next, in priority order

1. **Owner review of the redesigned interface and the new maps.** The earlier three-quarter map paintings are
   retired; the new top-down direction and the card-led interface both need a verdict before scaling.
2. **Card art for the blank cards.** Twenty-three of the forty units have no cutout yet, so their cards read
   "no art yet". Highest value art task.
3. **More cards per faction.** A hundred-card deck currently leans on levy and foot because each faction has
   only eight to eleven distinct cards. Fifteen to twenty per faction would let the faction minimum rise from
   40 back toward 60.
4. **Old item:** Do not scale the UI until the three decisions in the sample page are
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
- 2026-09-05: Proposal — a Samurai province campaign map where each region is a scenario, won regions feed the
  holding's resource production, and losing a region costs the buildings raised there.
- 2026-09-05: Proposal — duplicate cards from recruitment could feed a "reforge" that raises a card's star by
  one, giving duplicates a purpose instead of dead weight.
- 2026-09-05: Proposal — the side deck could hold a third card kind, a Stratagem, played from the side deck for a
  one-round battlefield effect (a forced march, a smokescreen, a false retreat), keeping the twenty-card cap.
- 2026-09-05: Fusion charges as a scenario resource: defenders start with 2, attackers 1, to make late fusions a comeback tool.
- 2026-09-05: Proposal — the army leader-killed win condition currently fires the instant the leader unit falls, in
  the same End Phase, before the next Command Phase can run succession. That leaves the leader-killed condition with
  no grace window at all while platoon Continuity gets one, so the two mechanics read as unequal weight for what the
  owner named a rank ladder with mechanical weight. Two ways to close the gap without touching how Continuity works:
  either let the leader-killed check itself wait one Command Phase so a promoted second can be recognised as the new
  army leader first, or introduce a separate, capturable Army Standard as the actual leader-killed trigger so the
  Commander's own death alone no longer instantly ends the battle. Either keeps all three win conditions comparably
  hard to reach.
