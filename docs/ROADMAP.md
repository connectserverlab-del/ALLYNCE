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
- Replay: a cursor over a battle's event log (`core/src/replay.ts`) that steps forward, back, or straight to a
  round, and narrates every event by unit name. No screen consumes it yet; it is the engine half of `Q-10`.

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

- The AI now spends all six card skills instead of leaning on clones, charges and duels alone: a self or band
  attack buff before it swings, haste when its own goal sits farther off than its base movement reaches, and
  an area debuff on whoever is already close enough to hit back, win or lose the exchange this round.

### Done in the division doctrine pass

- The seven themed divisions (Choir Militant, Ashpit Legion, Spiral Warband, Half-Born Host, Winter Famine,
  Ridge Kin, Formic Swarm) each carry a `platoonOrder` and a `passiveDoctrine`, the same two fields the four
  host armies have had since the rank-ladder pass, and can now fill Commander, Second, Elite and five foot from
  their own four cards — a division can lead a deck instead of only being hired into one. Spiral Warband and
  Winter Famine were each missing any card that could stand in the Second slot; rather than invent a new one,
  their existing Cavalry/Elite card widened to cover it, the same way Formic Swarm's one Elite already covered
  both Elite and Second with a second physical copy.
- The warrant board screen described in `docs/ui-sample.md` (posted writs, what each pays, the deck's
  remaining gaps) turned out to already be built, in the card-and-holding pass; it just was never checked off
  the Queue, so a future pass would have spent a cycle rediscovering it. Fixed in `docs/CHECKLIST.md`.

### Done in the map fairness pass

- `deploymentBalance` (`core/src/mapgen.ts`): scores a generated field by how much harder one anchor's own
  approach ground is to cross than the other's, and `generateMap` re-rolls deterministic derived seeds of
  the same spec until the two sides are within 10% of each other, or a bounded number of attempts run out.
  `core/tests/mapgen.test.ts` checks the band holds across a spread of seeds.

### Done in the art-completeness pass

- All 88 units now carry both a concept and a cutout; `npm run assets` reports 0 missing under "Units" and
  `python3 scripts/audit-cutouts.py` finds every one of them in the approved opacity band. `core/tests/art.test.ts`
  runs the same presence and opacity check on every `npm test`, so a blank or badly-cut card fails the build
  instead of sitting unnoticed on the deck screen. `art/ASSET_MANIFEST.json`'s `pending` list, stale since the
  roster was 40 units, is trimmed to the two structures (`STRUCTURE_REINFORCEMENT-PORTAL`,
  `STRUCTURE_RITUAL-CIRCLE`) that are actually still unpainted.

## Next, in priority order

1. **Owner review of the redesigned interface and the new maps.** The earlier three-quarter map paintings are
   retired; the new top-down direction and the card-led interface both need a verdict before scaling.
2. **More cards per faction.** A hundred-card deck currently leans on levy and foot because each faction has
   only eight to eleven distinct cards. Fifteen to twenty per faction would let the faction minimum rise from
   40 back toward 60.
3. **Old item:** Do not scale the UI until the three decisions in the sample page are
   answered (map look, command bar material, field size).
3. Remaining unit art (see `pending` in `art/ASSET_MANIFEST.json`), then construction sheets for approved units.

2. Knight, Dragon Host and Ritual Cult rank ladders with one mechanical trait each per rank.
3. Construction sheets and action-pose sheets for the approved units (see `docs/art-pipeline.md` step 5) — no unit
   still lacks a base cutout, so this is the remaining art debt.
4. Map generator: named biomes (Ashfall, Marsh, Highland pass), scenario-authored overrides on top of generated ground,
   deployment-zone balance check (path cost between anchors within 10 percent both ways).

4. Map generator: named biomes (Ashfall, Marsh, Highland pass), scenario-authored overrides on top of generated ground.
5. AI: use trenches and high ground, siege positioning behind the line, cavalry flank routing, surrender when the
   leader is dead and average morale is below 20.
6. Army builder validation UI in the sample page (drag units into slots, live doctrine and capacity readout).
7. Formation Sandbox mode as a page: place units, see cohesion and doctrine live.
8. ~~Unity port scaffolding~~ — done: the engine target is written down in `docs/mechanics.md`'s
   "Unity port guidance", and a structural scaffold following it lives under `unity/` (see
   `unity/README.md`). Next on this thread, whenever it is picked up: port `computeStat` and the
   `applyEffect` cases into `unity/Runtime` one kind at a time against real Unity, once a project
   exists to compile them in.

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

- 2026-09-05: Proposal — give a high Samurai or Knight rank a privilege that halves a self-sacrifice skill's
  health cost for anyone it commands within its radius. The rank ladders are meant to carry mechanical weight
  beyond morale and succession, and the six card skills are a lever nothing in a rank ladder reaches yet.

- 2026-09-05: Proposal — once real logic starts landing in `unity/Runtime` (see the Unity port scaffold under
  `unity/`), add a small headless C# console harness that replays one of the TypeScript engine's saved event
  logs and cross-checks the resulting HP, positions and morale against the TypeScript save file. That turns
  "the port agrees with the reference" into a test that runs on every ported system, the same way
  `core/tests/combat.test.ts` pins the worked example from the brief, instead of a claim nobody can check.
- 2026-09-05: Proposal — give the named biomes on the "Map generator" Next item (Ashfall, Marsh, Highland pass)
  their own Fortification/Ruins/Mountain density presets in the generator, so each painted region keeps a
  distinct silhouette at a glance — the way the approved Samurai province reads as Samurai before a single
  unit is on the field — rather than three regions that only differ by name and palette.

- 2026-09-05: Proposal — now that `replay.ts` can narrate a whole battle by unit name, a won region on the
  future campaign map (`Q-5`) could post its three or four loudest lines (the leader falling, a ritual
  synchronizing, the surrender) to the holding as a short after-action report, the way a real campaign log
  reads. No new art or UI chrome needed: it is the existing replay narration filtered to the high-weight event
  types and shown as text beside the reward screen.

- 2026-09-05: Proposal — resolve `OWN-3` by splitting rather than picking one side. Keep the five sworn companies
  capped exactly as their `weakness` text already promises ("not an army"): they stay hire-only, one card deep
  per slot, forever. Let the divisions grow into full factions on a visible schedule instead of case-by-case
  patching — the next one up, in card-count order, is Ridge Kin (Sasquatch), which is missing only a second
  distinct foot line the same way Choir Militant, Ashpit Legion and Winter Famine were before this pass. Chaos
  Warband keeps its missing Second permanently: "no second plan" is the joke, and giving it one would flatten it
  into an ordinary platoon. Half-Born Host keeps its four cards too — "few in number and impossible to replace"
  is the whole identity, and depth there should mean better abilities on what exists, not more bodies.

- 2026-09-05: Proposal — now that every division can lead its own platoon (doctrine and order), give each of the
  seven a themed siege piece and cavalry unit of its own, the way the four host armies already have one of
  each. Only Spiral Warband has a cavalry card today; none of the seven has a siege piece. Without one, a
  division leading its own deck still has to leave two of the battlefield roles the brief calls for — cannons
  and cavalry that fit the theme — entirely empty.

- 2026-09-05: Proposal — scale a warrant's escort by the target's rank on its own faction ladder rather than
  star count alone, so a Samurai target standing at Ashigaru carries a lighter escort than one standing at
  Hatamoto. Rank already carries mechanical weight in a platoon; the wanted board is the one place it still
  reads as flavour text.

- 2026-09-05: Proposal — gate a recipe behind rank, not just unit id: a fusion could require its anchor hold at
  least a named rung on its faction's ladder (only a Marshal-or-higher Knight leads the Oathbound Wall fusion,
  only a Jounin-or-higher Shinobi triggers a fusion with a shed-shadow effect). This gives the rank ladders
  mechanical weight over which fusions a platoon can even reach, the same way they already gate command radius
  and who may lead a platoon, rather than leaving fusion eligibility to unit id and theme alone.

- 2026-09-05: Proposal — the army leader-killed win condition currently fires the instant the leader unit falls, in
  the same End Phase, before the next Command Phase can run succession. That leaves the leader-killed condition with
  no grace window at all while platoon Continuity gets one, so the two mechanics read as unequal weight for what the
  owner named a rank ladder with mechanical weight. Two ways to close the gap without touching how Continuity works:
  either let the leader-killed check itself wait one Command Phase so a promoted second can be recognised as the new
  army leader first, or introduce a separate, capturable Army Standard as the actual leader-killed trigger so the
  Commander's own death alone no longer instantly ends the battle. Either keeps all three win conditions comparably
  hard to reach.

- 2026-09-05: Proposal — closing a warrant alive could leave a one-time, named study on the board immediately
  ("Captured Discipline: +1 Continuity Round" or the like), so a warrant's outcome shows up on the holding the
  same way a building or a study does: as a permanent, source-tracked line rather than a resource payout only.

- 2026-09-06: Proposal — score cavalry approach cost alongside foot in `deploymentBalance`. A field can pass the
  foot-movement band while still handing one side a much better cavalry corridor (a trench or forest patch that
  only cavalry treats as expensive), since Cavalry and Trench interact differently from Foot. Blending both costs,
  or requiring both within 10%, would close that gap without touching the terrain generation itself.
- 2026-09-06: Proposal — once regions exist for the Q-5 campaign map, run the same `deploymentBalance` check
  per region at campaign-generation time rather than only for a single stand-alone battle, so a chain of
  regions can't quietly hand one side an easier stretch of the whole province.

- 2026-09-06: Proposal — Unseen Network's relay could extend past targeting: once a holding researches a
  "Signal Beacon" study, a Hidden Shinobi standing beside an enemy could call in a strike from an allied siege
  piece anywhere on the field for the round, turning the doctrine from a sniping trick into real indirect fire.
- 2026-09-06: Proposal — have the registry check, at load, that every ability `effect.kind` appearing in
  `data/abilities/abilities.json` is one the engine actually dispatches somewhere (`applyEffect`, the modifier
  pipeline, combat, or movement). This pass found Unseen Network (Shinobi's faction doctrine) declared for
  months without ever being wired to anything — a silent no-op that only `docs/CHECKLIST.md`'s per-item review
  or a dedicated test would ever catch by hand. A load-time check would catch the next one the day it's added,
  the same way `validate()` already catches a unit naming a missing ability.

- 2026-09-06: Proposal — now that every unit has a base cutout, spend the next art pass on construction sheets
  (multi-angle turnarounds) for the four commanders first, since a rank ladder promotion is the one moment a card's
  art is expected to hold up at a larger size than the hand-of-cards view.
- 2026-09-06: Proposal — an uneven battlefield could carry a named "vantage" hex per elevation band (the single
  highest hex in a highland cluster, the driest hex in a marsh) that grants a small, source-tracked sight or
  defence bonus, giving odd-shaped terrain a landmark worth fighting over beyond raw elevation and movement cost.
