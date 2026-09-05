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
- Every faction gets rank ladders with mechanical weight. Samurai (19 ranks), Shinobi (6, each with a movement
  trait; Shinobi outrun Knights through forest), Knight (8), Dragon Host (7) and Ritual Cult (4) are in.
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

### Done in the rank ladder pass

- Knight (8 ranks, Squire to King), Dragon Host (7 ranks, Hatchling to Elder) and Ritual Cult (4 ranks, Initiate
  to Hierophant) rank ladders, each escalating one mechanical trait at a time the same way Samurai and Shinobi
  already do. Every faction that fields a standard platoon now has a ladder; no faction is unrestricted by default
  anymore.
- Each ladder's signature trait fills in one of the three movement hooks the engine already declared but never
  used: Knight gets **surefoot** (mud costs 1 instead of 2-3, fitting its disciplined, defensive identity),
  Dragon Host gets **climber** (mountains cost 3 instead of 5-6 for its ground-bound wyrm-kin; flying ranks are
  unaffected), Ritual Cult gets **waterwalk** (water and fords cost 1, fitting its marsh-and-reed territory).
- Fixed a latent bug in `climber`'s cost calculation that would have made mountains *more* expensive for a flying
  unit than doing nothing at all; it now only ever lowers cost.
- See `docs/rank-ladders.md` (renamed from `docs/samurai-ranks.md`) for the full table of all five ladders.

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
- 2026-09-05: Proposal — now that every host faction's signature rank trait changes a specific terrain's movement
  cost (Samurai's disciplined line has no such trait yet, Shinobi canopy-step Forest, Knight surefoot Mud, Dragon
  Host climber Mountain, Ritual Cult waterwalk Water/Ford), a Samurai rank could pick up a matching trait of its
  own — a high-tier retainer holding formation on a Road (a marching-order movement bonus, or an ATK/DEF bonus
  while the whole platoon is aligned on one) — so the last host faction's ladder carries the same kind of
  mechanical weight as the four that now have one.
