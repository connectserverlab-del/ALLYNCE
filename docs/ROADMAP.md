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
- Duplicate-card reforge: spend several copies of a card for one copy of a same-faction card one star above it,
  so a duplicate a deck can no longer use still has somewhere to go.

### Done in the scenario-authoring pass

- Position roles (`anchor`, `deployZone`, `lerp`, `near`, `ritualCenter`) so a scenario's platoons, specialists,
  portals, ritual circles and hex-bearing objectives can pin to a **generated** field instead of only fixed
  coordinates. A scenario's `"map"` may now be `{ "generate": ... }` in place of the hand-authored `{ width, height,
  terrain }` form.
- `data/scenarios/ashfall_crossing.json`: a Dragon Host river-crossing scenario authored entirely by role, so the
  same file plays a different, still-legal battlefield every seed. Exercises all three of objectives, a ritual and
  a portal on generated ground.

### Done in the AI positioning pass

- Terrain-seeking movement: Trench and HighGround now score alongside the existing Fortification bonus when the
  AI closes on any goal, so it settles on defensible ground rather than open terrain when the choice is otherwise
  even.
- Siege pieces never advance into their own minimum range: each activation they retreat if an enemy has closed
  inside it, close only as far as their own range needs, and Set Up rather than charge further once in the firing
  band.
- Cavalry's charge goal is the nearest hex adjacent to its target that is outside that target's front arc, so the
  path swings wide onto a flank or rear hex instead of walking into the front.
- Surrender is no longer dead code: a side yields once every platoon has fallen out of Doctrine (no living
  commander and no Continuity left) *and* its average morale has collapsed into the Broken band, exercised once
  per round for both sides. In today's matches this rarely fires in practice — see `OWN-3` in
  `docs/CHECKLIST.md` for why.

### Done in the deck editor pass

- The Deck and Rites screens are no longer read-only: every card that could ever sit in the main or side deck is
  browsable, with a stepper to sleeve or unsleeve one copy at a time. The main deck grid spans all eleven
  factions now, not just the ones already sleeved.
- A live legality panel sits above both grids and updates on every edit: deck size, the leading faction's
  minimum, each card's star-based copy limit, and the collection cap on top of it for the main deck. It mirrors
  `validateDeck` in `core/src/cards.ts` — that function stays the single source of truth for the rule, and the
  page's arithmetic is kept in step with it by hand, since the page has no build step to import the engine at
  runtime.
- `moveCard` in `core/src/cards.ts` is the tested, single place a deck list gains or loses one physical copy,
  capped by the same rules the legality panel checks.

### Done in the campaign map pass

- A province is a graph of regions (`data/campaign/samurai_province.json`, six regions from the Ashfall
  keep-lands to the Iron Vale), each with neighbors, a starting owner and its own biome bias.
- A side may only contest a region bordering territory it already holds, so a campaign advances as one
  contiguous front instead of a side reaching across the map.
- Fighting for a region is an ordinary generated-field match: its biome bias hands straight to
  `setUpMatch`/`runMatch`, so the same region plays a different, still-legal field every time, the same way
  `ashfall_crossing` already regenerates per seed.
- A held region pays its owner resources per hour as a named, source-tracked income line — `"Region: Ashfall
  Keep Lands"` — folded into the holding capped by the same storage an ordinary building respects.

### Done in the weather pass

- Weather (`Clear`/`Rain`/`Fog`) and time of day (`Day`/`Night`) are round modifiers rolled once per battle from
  the match seed (`data/rules/weather.json`), so a replay reproduces the same conditions.
- Rain floods the Open ground beside Water and Fords into Mud for the rest of the battle, the same terrain a
  river's own low ground already produces during map generation, just triggered by weather instead of geography.
- Fog cuts every ranged unit's effective attack range by one hex, floored at one so melee reach never shrinks.
  `attack`, Overwatch, portal attacks, and every AI targeting and siege-standoff check read the same effective
  range, so the AI never tries a shot the fog will actually refuse.
- Night is a named, source-tracked `"Time of Day: Night"` −25 ATK on ranged attacks, folded into `computeStat`
  alongside terrain and command bonuses.

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

### Done in the stratagem pass

- Stratagem cards: a third side-deck kind alongside ritual and fusion. Each names a target (a platoon or a hex)
  and a one-round effect that costs no sacrifice and no material, only the card. Forced March (+3 MOV to a
  platoon), Smokescreen (Smoke terrain over a hex and its neighbours for two rounds), and False Retreat (+3 MOV
  and +100 ATK on a platoon at -50 DEF) ship as the first three. `checkStratagem`/`playStratagem` in `cards.ts`
  validate and spend them the same way rituals and fusions are validated and spent; the effects themselves reuse
  the existing temporary-modifier and timed-terrain machinery so every number stays source-tracked.

- AI splitting as a trade: a unit now only spawns copies when a crowd of enemies is closing in (holding
  ground or baiting), never against a single hard hitter, and treats an enemy's own copy as a hunt-worthy
  kill that shrinks the original back down.

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
  **Built in the stratagem pass** (see Done), with exactly those three cards.
- 2026-09-05: Fusion charges as a scenario resource: defenders start with 2, attackers 1, to make late fusions a comeback tool.
- 2026-09-05: Proposal — now that a scenario can pin positions to a generated field by role, a named biome
  (`data/scenarios/*.json` → `map.generate`) could carry its own bias (a Mountain Pass scenario with `rugged`
  pushed high and a forced single road anchor, a Drowned Marsh with `river` widened and mud dominant) so each of
  the concept-art regions gets a matching, still-regenerating scenario rather than one fixed painting standing in
  for the whole biome.
- 2026-09-05: Proposal — the same role vocabulary (`anchor`, `lerp`, `near`) could place a campaign map's per-region
  scenario objectives, so a won region's fortification always sits sensibly relative to that region's own generated
  anchors instead of needing hand-tuned coordinates for every region added to the campaign map from Q-5.
- 2026-09-05: Proposal — an Army Standard, a bannerman specialist distinct from the Commander, carried near the
  command group and capturable or destroyable like a small portal. Losing it (with no bearer left to recover it,
  after Continuity's succession attempt has run) would be what actually ends the match on "leader killed", rather
  than the very first Commander's death alone deciding it outright as it does today (see `OWN-3`). This would give
  the Samurai banner privilege and every faction's rank ladder a piece of real mechanical weight to protect, and
  would let all three win conditions carry closer to equal odds of deciding a given match instead of one dominating.

- 2026-09-05: Proposal — now that the Deck and Rites screens let a player sleeve any card they own, the Rites
  grid could show, for each ritual or fusion still in the browsing pool, whether the muster being built in the
  Deck screen actually has the sacrifices or materials it would need — a theme's stars for a ritual, the named
  roles for a fusion — so a deck built card by card can be steered toward the rite it is meant to feed, rather
  than the two screens being checked against each other by eye. Ritual and Fusion are supposed to be first-class
  functions of the engine; right now they are only checked against the field once a battle has already started.

- 2026-09-05: Proposal — a region held for several campaign ticks in a row could raise a temporary Garrison at
  its battle anchor for the next fight there: a themed siege emplacement or cavalry picket drawn from the
  holding side's own faction (a cannon at the Stonebridge bridgehead, a cavalry picket in the Iron Vale), gone
  again if the region changes hands. This would give long-held ground a defender's edge that reads as the
  region's own biome and faction rather than a flat number, and would put the campaign map's regions and the
  faction's themed siege and cavalry pieces to work together instead of each sitting in its own system.
- 2026-09-05: Proposal — now that weather is a per-battle roll (`data/rules/weather.json`), a campaign region's
  own biome bias (`data/campaign/*.json`) could weight that roll instead of leaving Rain and Fog equally likely
  everywhere on the map: a river region like Reed Shallows would roll Rain far more often than a dry rise like
  Cinderpeak Heights. A held region's fights would start to read as that region's own ground and climate instead
  of a flat, region-blind die roll shared by the whole engine — the same idea already at work in the named-biome
  scenario proposal above, one layer further out.

- 2026-09-05: Proposal — now that every host faction's signature rank trait changes a specific terrain's movement
  cost (Samurai's disciplined line has no such trait yet, Shinobi canopy-step Forest, Knight surefoot Mud, Dragon
  Host climber Mountain, Ritual Cult waterwalk Water/Ford), a Samurai rank could pick up a matching trait of its
  own — a high-tier retainer holding formation on a Road (a marching-order movement bonus, or an ATK/DEF bonus
  while the whole platoon is aligned on one) — so the last host faction's ladder carries the same kind of
  mechanical weight as the four that now have one.

- 2026-09-05: Proposal — gate which reforge targets show up by how far the holding's own faction has climbed its
  rank ladder (a holding that has never fielded a Marshal could not reforge toward one), so the rank ladders and
  the card collection reinforce each other instead of running as separate systems.

- 2026-09-05: Proposal — a cavalry-themed stratagem, "Hit and Fade," that lets one cavalry platoon disengage from
  adjacent enemies this round without drawing a reaction attack. Cavalry already carries the raiding role in the
  fusion and siege kit; a stratagem that lets it strike and pull back cleanly would give every faction's cavalry
  a second, cheaper way to use that role beyond the charge bonus it already has.

- 2026-09-05: Proposal — once Q-12 deepens the five sworn companies, give each one themed cavalry or siege
  piece of its own (a Windmarch horse-archer already implies cavalry; Cutpurse Court could field a garrote-line
  skirmish rider, Dunewake Compact a caravan-hauled siege sled), so "every faction gets cannons and cavalry that
  fit its theme" reaches the companies too, not only the four host armies.
- 2026-09-05: Proposal — a warrant escort's opening platoon now draws its commander, second, elite and foot
  soldiers from the target's own company, but the handful of "extra" specialist slots still draw from the whole
  escort deck and can surface a stray host-army unit standing beside a sworn company's line. Constraining those
  extras to the escort's own faction (or an explicit small ally list per company) would close the last place a
  warrant still reads as partly borrowed.

- 2026-09-05: Proposal — a Shinobi rank privilege, "Read the Double," that marks a split enemy's true body to
  every Shinobi within 3 hexes once it has taken its first hit after splitting. Splitting already trades stat
  weight for presence; this would give one faction's rank ladder a mechanical answer that turns the hunt for
  the original from a computed tiebreaker into a visible, playable duel.
