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

## Status

- Rules engine (TypeScript reference, 54 tests): hex grid, terrain rules table, elevation, modifier pipeline, cohesion,
  doctrine, succession, combat, morale, effects, clones, rituals, divine entities, portals, objectives, utility AI.
- Irregular map generator with mountains, valleys, trenches, mud, rivers, fords, roads, ruins, fortifications.
- Win conditions (wipeout, leader killed, surrender), army leaders per side.
- Samurai and Shinobi rank ladders with privileges and movement traits, Shadow Step. Knight rank ladder (14
  ranks, Page to King) with its own lance-charge ATK privilege. See `docs/knight-ranks.md`.
- Fusion (Paired Line, Gate Wardens, Twinwing Drake, Calamity Form). Siege pieces (set up, minimum range, breaching
  shot, smoke shell, concussive blast). Cavalry (lance charge, hit and fade).
- 17 unit concepts with cutouts, 2 battlefield paintings, 1 HUD material sheet.
- Interactive map + HUD sample (see `docs/ui-sample.md`).
- Replay: a cursor over a battle's event log (`core/src/replay.ts`) that steps forward, back, or straight to a
  round, and narrates every event by unit name. No screen consumes it yet; it is the engine half of `Q-10`.

## Done, and what's next

`docs/CHECKLIST.md` is the single source of truth for finished work (its `Done` table) and the live work queue
(its `Queue` table, claimed via open PRs and `agent/*` branches — see that file's claim protocol). Keeping a
second, hand-maintained done/next list here let the two drift apart, so this file no longer carries one; check
`docs/CHECKLIST.md` for what is built and what is queued next, and come back here for the owner's standing
intent below and the brainstorm log.

### Pass note — 2026-09-07

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

### Done in the Company Order pass

- Company organization's battlefield effect, named in `data/compositions/platoon.json` since the vertical slice
  but never wired up ("One army-level order per round"), is now live: a side fielding three or more non-Broken
  platoons, with a living commander or second who may lead a Company, can spend one Company Order per round to
  reissue its faction's signature platoon order to every platoon on the side at once (`companyLeader` in
  `composition.ts`, `BattleController.useCompanyOrder` in `battle.ts`).

### Done in the sworn company siege and cavalry pass

- The five sworn companies (Cobalt Conclave, Thorn Coven, Cutpurse Court, Windmarch Host, Dunewake Compact) each
  fielded a Commander, Second, Elite and FootSoldier but no themed cannon or cavalry, unlike the four host armies.
  Cobalt Conclave, Thorn Coven, Cutpurse Court and Dunewake Compact now each have both (Warded Culverin/Wardbound
  Courser, Blight Mortar/Bramblehorn Rider, Stolen Bombard/Backstreet Courser, Glassroad Ballista/Dunewake
  Vanguard); Windmarch Host already had cavalry through its Elite and Commander, so it only needed the Steppe
  Falconet, a mobile gun that skips Set Up in exchange for a lighter structure-breaching hit. All nine reuse the
  existing generic siege and cavalry mechanics (`ABL_SIEGE_SETUP`, `ABL_BREACHING_SHOT`, `ABL_LANCE_CHARGE`,
  `ABL_HIT_AND_FADE`, `ABL_CONCUSSIVE_BLAST`) rather than adding new ones, the same way the host armies' own
  cavalry already share `ABL_LANCE_CHARGE` unchanged. No unit has art yet; sampling that is a separate,
  owner-led step. Ritual Cult and the seven divisions still have neither and are their own follow-on passes.

### Done in the host roster-depth pass

- Each host army (Samurai, Knight, Shinobi, Dragon Host) now fields fifteen distinct cards, up from eight or
  nine. The new cards are three named Commander, Second and Elite cards per faction rather than one apiece,
  which matters mechanically and not just for deck bulk: `uniqueCopiesPerArmy` caps a unique unit at one copy
  per army, so with only one Commander card a faction could never deploy the three platoons a Company
  organization requires. Three distinct leaders per slot make a three-platoon Company buildable for the first
  time; `core/tests/company.test.ts` proves it for all four host factions and also proves the old one-leader
  roster still cannot. The new cards ship data-only, no art yet, per the sample-first art pipeline.

### Done in the biome pass

- Three named biomes (Ashfall, Marsh, Highland Pass) as data-defined presets over the battlefield generator's
  existing knobs, plus a `wetness` knob so a wet or dry region reads that way in the mud it gets. Per-battle
  overrides still win over the preset.

### Done in the rank ladder pass

- Dragon Host rank ladder (9 ranks, Hatchling to Elder Sovereign): reuses `mounted`, `commandRadiusBonus`,
  `banner` and `supreme` from the Samurai ladder, and adds wing dive, an ATK privilege keyed to altitude lost
  this activation rather than hexes moved — a faction that fights from the air gets nothing from a ground
  charge. See `docs/dragon-ranks.md`.
- Ritual Cult rank ladder (5 ranks, Affiliated to Grand Ritualist): grants no `canLead` privilege at any tier,
  matching the faction's "specialist teams only" identity, and instead keys rank to ritual mastery (a Progress
  bonus) and a higher instability ceiling on a held ritual. See `docs/ritual-ranks.md`.

## Status note (2026-09-08)

Every id in `docs/CHECKLIST.md`'s Queue table (`Q-1` through `Q-16`, minus the ids that were never assigned) already
has a matching open pull request or `agent/*` branch, several more than once. That queue has been fully claimed for
multiple passes running, so this pass could not take a Next item without duplicating work already in flight; it adds
docs and the brainstorm entries below instead, per the brief's guidance for when the queue is saturated.

Separately, an unrelated pull request (`Merge all 85 open pull requests into one integration branch`, branch
`claude/merge-85-prs-ec3ca0`, base `main`) already exists, is marked mergeable, and reports the full suite green after
folding in every other open PR by hand. Roughly ninety pull requests are open across this repository and none of the
recent ones have merged, which means every fresh pass keeps claiming queue items against a base that never advances.
**This is an owner decision, not something a pass can resolve**: review and merge that integration branch (or a
curated subset of the open PRs) before the next few passes run, or the queue will keep filling with parallel
implementations of the same ids that can never land together.

## Next, in priority order

1. **Owner review of the redesigned interface and the new maps.** The earlier three-quarter map paintings are
   retired; the new top-down direction and the card-led interface both need a verdict before scaling.
2. **More cards per faction.** A hundred-card deck currently leans on levy and foot because each faction has
   only eight to eleven distinct cards. Fifteen to twenty per faction would let the faction minimum rise from
   40 back toward 60.
3. **Old item:** Do not scale the UI until the three decisions in the sample page are
   answered (map look, command bar material, field size).
2. Dragon Host and Ritual Cult rank ladders with one mechanical trait each per rank. (Knight ladder is done —
   see Done, above.)

2. Knight rank ladder with its own mechanical trait per rank. Dragon Host (wing dive, keyed to altitude lost
   rather than hexes moved — see `docs/dragon-ranks.md`) and Ritual Cult (ritual mastery and instability
   ceiling, no leadership privilege — see `docs/ritual-ranks.md`) are done.
3. Remaining unit art (see `pending` in `art/ASSET_MANIFEST.json`), then construction sheets for approved units.

2. Knight, Dragon Host and Ritual Cult rank ladders with one mechanical trait each per rank.
3. Construction sheets and action-pose sheets for the approved units (see `docs/art-pipeline.md` step 5) — no unit
   still lacks a base cutout, so this is the remaining art debt.
4. Map generator: named biomes (Ashfall, Marsh, Highland pass), scenario-authored overrides on top of generated ground,
   deployment-zone balance check (path cost between anchors within 10 percent both ways).

4. Map generator: named biomes (Ashfall, Marsh, Highland pass), scenario-authored overrides on top of generated ground.

4. Map generator: scenario-authored overrides on top of generated ground, deployment-zone balance check (path cost
   between anchors within 10 percent both ways).
5. AI: use trenches and high ground, siege positioning behind the line, cavalry flank routing, surrender when the
   leader is dead and average morale is below 20.
6. Army builder validation UI in the sample page (drag units into slots, live doctrine and capacity readout).
7. Formation Sandbox mode as a page: place units, see cohesion and doctrine live.
8. ~~Unity port scaffolding~~ — done: the engine target is written down in `docs/mechanics.md`'s
   "Unity port guidance", and a structural scaffold following it lives under `unity/` (see
   `unity/README.md`). Next on this thread, whenever it is picked up: port `computeStat` and the
   `applyEffect` cases into `unity/Runtime` one kind at a time against real Unity, once a project
   exists to compile them in.

- Every faction gets rank ladders with mechanical weight. Samurai (19 ranks) and Shinobi (6, each with a movement
  trait; Shinobi outrun Knights through forest) are named directly; the other factions follow the same idea.
- Every faction gets cannons (siege) and cavalry that fit its theme.
- Ritual and Fusion are first-class functions of the engine.
- Samples first. Show the owner a sample of any new visual direction before scaling it.
- Beyond match-to-match battles there is, eventually, a permanent holding: base building, research that upgrades
  units, and recruitment draws. A card-based army (a large main deck plus a small ritual/fusion side deck) sits
  alongside the battle layer. Neither has started yet; the vertical slice below is the foundation both build on.

## Done

- Rules engine (TypeScript reference, 40 tests): hex grid, terrain rules table, elevation, modifier pipeline,
  cohesion, doctrine, succession, combat, morale, effects, clones, rituals, divine entities, portals, objectives,
  utility AI.
- Three universal win conditions layered under scenario objectives: Wipeout (a side with no living units), Army
  Leader Killed (a scenario-designated unit whose death ends the battle immediately, independent of Doctrine
  succession), and Surrender (a side's command structure fully collapsed — `organizationLevel` at "None" — and its
  remaining morale too low to fight on, or an explicit `surrender()` decision). See `docs/mechanics.md`.
- `Threefold Invocation` scenario, fully data-defined and playable start to finish: ritual host vs. portal-backed
  defenders, three linked circles, synchronized release.
- V01 art samples: one commander plus one elite or foot soldier from each of four factions (Samurai, Shinobi,
  Knight, Dragon Host), two dragon tiers. See `docs/art-pipeline.md`.

## Next, in priority order

1. **Irregular battlefield generator.** Maps are currently hand-authored per scenario as fixed hex lists (see
   `data/scenarios/threefold_invocation.json`). The owner's standing intent is uneven, odd-shaped playable areas
   generated with mountains, valleys, rivers, fords, trenches and mud rather than drawn by hand every time.
2. **Rank ladders with mechanical weight, Samurai first (19 ranks), then Shinobi (6, with movement traits).**
   Data-defined per-rank privileges in the same style as the existing platoon Order/passive abilities.

   Note for whoever picks this up: giving a platoon Commander a rank is straightforward, but a rank ladder's top
   rung reads as "the army's leader" in exactly the sense the Army Leader Killed win condition means — and a
   platoon Commander's death is already handled by the succession system (the Second is promoted, Doctrine
   survives through Continuity). Naming a Commander as a scenario's `armyLeader` today would make the battle end
   the instant they fall, before succession ever gets a chance to run, which contradicts a mechanic the owner
   already approved. **Decision needed:** should the army-leader win condition point at the top rank of the
   ladder specifically (once ranks exist, so only the single highest-ranked unit is "the leader", distinct from
   ordinary platoon Commanders who still have a Second to fall back on), or should it stay opt-in per scenario
   for boss/unique units only, with ordinary Commanders never eligible?
3. **Themed siege pieces ("cannons") and cavalry for every faction.** Only the Knight faction has a cavalry-role
   unit today (`KNI_ELITE_SKY-LANCE-DRAGOON`); no faction has a Siege-role unit yet.
4. **Fusion as a first-class engine function**, alongside the existing clone framework (Twin Echo) in
   `effects.ts`.
5. **Remaining unit art and construction sheets**, sample-first per `art/prompts/STYLE_GUIDE.md` — owner review
   gates scaling, so an automated pass should not batch-generate here without a sample already approved.
6. **Card system and permanent holding.** Large, multi-pass pillars (100-card main deck, ritual/fusion side deck,
   base building, research, recruitment) that build on top of the vertical slice above; sequence after the
   battle-layer items so the data model they lean on (ranks, siege/cavalry rosters, Fusion) already exists.

2. **Card art for the new roster cards.** The fifteen-per-faction pass above added twenty-six cards with no
   cutout yet, so their cards read "no art yet"; `docs/asset-registry.md` tracks them alongside the building
   tiers still to paint. Highest value art task.
3. **Old item:** Do not scale the UI until the three decisions in the sample page are
   answered (map look, command bar material, field size).
4. Knight, Dragon Host and Ritual Cult rank ladders with one mechanical trait each per rank.
5. Remaining unit art (see `docs/asset-registry.md`), then construction sheets for approved units.
6. Map generator: named biomes (Ashfall, Marsh, Highland pass), scenario-authored overrides on top of generated ground,
   deployment-zone balance check (path cost between anchors within 10 percent both ways).
7. AI: use trenches and high ground, siege positioning behind the line, cavalry flank routing, surrender when the
   leader is dead and average morale is below 20.
8. Army builder validation UI in the sample page (drag units into slots, live doctrine and capacity readout).
9. Formation Sandbox mode as a page: place units, see cohesion and doctrine live.
10. Unity port scaffolding once the owner confirms the engine target (see `docs/mechanics.md`).

The done list, the priority queue and what is blocked on an owner decision now live in `docs/CHECKLIST.md`,
which is what each implementation pass reads and claims from. Keeping that accounting in one file stops this
one from drifting out of sync with it, as its own "Done" and "Next" sections once did. This file stays the
place for the owner's standing intent, above, and the brainstorm log, below.

This file did not previously exist on `main`; it is seeded here because the owner's standing intent needs a home
on the branch this repository actually treats as `main`, and because forward passes need a brainstorm log to add
to. See "A note on branches" at the end of this file before treating this as the only place the game is being
built.

This file is the working brief for anyone, human or agent, picking up the next piece of the game on `main`. It
sits beside the original engineering brief and records what the owner has decided since. **Decisions here
override the original brief where they conflict.** See "A note on branches" at the end before treating this as
the only place the game is being built.

## Owner's standing intent

- Art: grimdark hand-painted concept illustration. "Less cartoonish", "not AI-looking", "League-style splash
  quality", "more grunge". Round 4 in `art/samples` is the approved bar. Never credit any AI tool in repo content.

This file is the working brief for anyone, human or agent, picking up the next piece of the game on this branch.

This file is the working brief for anyone, human or agent, picking up the next piece of the game on `main`.
**Decisions here override earlier notes where they conflict.**

## A note on scope

This roadmap describes the codebase actually present on `main` as of this pass: the rules-engine vertical slice
merged in the first pull request (hex grid, terrain, modifiers, cohesion, doctrine, succession, combat, morale,
effects, clones, rituals, Divine Entities, portals, objectives, utility AI) plus the victory-condition and AI
work added in this pass. It does not describe the much larger card game, holding/economy, warrant board, seven
themed divisions, or march-and-camera interface that a long-running branch (`claude/dragon-art-style-examples-qdjeb6`,
open as pull request #2 at time of writing) has built on top of an earlier snapshot of this same engine, nor the
dozens of passes stacked on top of that branch. Whether and when to merge that branch into `main` is an owner
decision this file does not make; until that happens, treat the two as separate roadmaps, and pick items from
this one only if you are actually working from `main`.

This roadmap describes the codebase actually present on `main`: the rules-engine vertical slice (hex grid, terrain,
modifiers, cohesion, doctrine, succession, combat, morale, effects, clones, rituals, Divine Entities, portals,
objectives, utility AI) plus the Samurai and Shinobi rank ladders added in this pass. It does not describe the much
larger card game, holding/economy, warrant board, seven themed divisions, or march-and-camera interface that a
long-running branch (`claude/dragon-art-style-examples-qdjeb6`) has built on top of an earlier snapshot of this same
engine, nor the dozens of passes stacked on top of that branch or on top of other unmerged branches based on `main`.
Whether and when to merge any of that into `main` is an owner decision this file does not make; until that happens,
treat them as separate roadmaps, and pick items from this one only if you are actually working from `main`.

## Owner's standing intent (in their words, paraphrased where needed)

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

- Direct test coverage for `ai.ts` (`core/tests/ai.test.ts`): target selection under the utility scorer
  (ritualist priority, clone avoidance), moving toward the only real goal on the field when no enemy unit
  exists but an enemy ritual does, a platoon leader auto-issuing its faction order once an enemy is in range,
  the two "immediate value" active abilities (a clone-spawning skill, a duel challenge against an adjacent
  elite), and both branches of `holdForSyncPolicy` (holds a linked group until every member is held, releases
  the whole group early once one member crosses the instability danger threshold). None of this had a direct
  test before; it was previously exercised only incidentally through full-match tests.

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

3. Siege and cavalry rosters for the four combat factions (Samurai, Shinobi, Knight, Dragon Host), fitting each
   faction's theme, per the owner's standing intent.
4. A second scenario, to prove the objective/AI systems generalize beyond `Threefold Invocation`.

Audited `docs/CHECKLIST.md`'s Queue against open pull requests and `agent/*` branches: every one of the
fourteen open items (`Q-1` through `Q-16`, skipping the ones already merged) has a matching open PR title or a
still-existing claim branch, several dating back to `2026-09-05` and never merged. Per this file's own claim
protocol, that means the queue is fully claimed; this pass did not start a new Queue item, and instead refreshed
this file and `README.md` (stale test count, an implemented-features list that had fallen behind
`docs/CHECKLIST.md`'s `Done` table) and added the brainstorm entry below. **Decision for the owner:** there are
now 60+ open draft pull requests against this repository, the great majority never merged. Until some of that
backlog is reviewed and merged (or closed), the Queue effectively cannot free up new claims for future passes —
worth a look when time allows.

- Every faction gets rank ladders with mechanical weight, cannons (siege) and cavalry that fit its theme.
- Ritual and Fusion are first-class functions of the engine.
- Samples first. Show the owner a sample of any new visual direction before scaling it.
- The army is a **100-card deck** plus a **20-card ritual/fusion side deck**. Cards carry 1 to 10 stars.
- Beyond match-to-match battles there is a **permanent holding**: base building, research that upgrades units,
  and recruitment draws.
- Cards are **paper**, never metal, and nothing in the interface may carry punched holes or rows of dots.
- Do not add real-world religious names or symbols; Divine Entities stay fictional.

## Done (on `main`)

- Rules engine (TypeScript reference): hex grid, terrain rules table, elevation-free movement costs, modifier
  pipeline with source-tracked breakdowns, theme cohesion, platoon doctrine and Continuity, command auras,
  succession, combat with facing arcs and reactions, morale bands, the shared effects interpreter, clones,
  rituals with Held/Unstable/synchronized release, Divine Entities, reinforcement portals, eleven composable
  objectives, and a goal-oriented utility AI.
- `Threefold Invocation`: one fully data-defined, playable scenario exercising every system above.
- 17 unit concepts with approved (Round 4 quality bar) concept art and cutouts; art pipeline and asset manifest.
- **This pass**: the three universal win conditions are real. `evaluateVictory` now checks a scenario-named
  army leader per side (`VictoryRules.leaders`, from an optional `leader` field per side in the scenario file)
  and ends the match the round that leader falls, ahead of the round limit. `BattleController.surrender(side)`
  lets a side concede outright, and `ai.ts`'s `maybeSurrender` calls it once a side's whole chain of command
  (every platoon's Commander and Second) is gone and its average morale has fallen below the Disordered/Routed
  line — rather than letting the AI grind a lost battle to a full wipeout. The AI also positions with more care:
  ranged units (`range > 1`) hold their stand-off ring instead of closing to melee and weight High Ground within
  it, and Cavalry routes for a flank or rear hex around an equal-distance target instead of walking into the
  front arc.

## Next, in priority order

1. **Samurai and Shinobi rank ladders.** The owner's rank-ladder intent applies to every faction; `main` has
   none yet (`UnitDef.rank` is currently a flat label, not a ladder). Samurai and Shinobi first, since the two
   factions in `Threefold Invocation` already carry the most distinct identities (`docs/mechanics.md` §9).
2. **Knight, Dragon Host and Ritual Cult rank ladders**, once the Samurai/Shinobi pattern above exists to extend.
3. **Siege pieces.** `Role: "Siege"` already exists in `types.ts`, but no unit in `data/units/units.json` uses
   it yet — the AI's stand-off positioning above has nothing to fire against in a real match. One siege unit per
   combat faction (Samurai, Shinobi, Knight, Dragon Host), each with a minimum range so it cannot fire adjacent,
   would give both the roster and the AI positioning work a real target.
4. **Cavalry beyond the one Dragoon.** Only `KNI_ELITE_SKY-LANCE-DRAGOON` carries the `Cavalry` role today; the
   new flank-routing AI only has one unit to exercise it. Cavalry for Samurai, Shinobi and Ritual Cult would
   match the owner's "cannons and cavalry that fit its theme" intent and broaden that AI path.

- **This pass**: Samurai (`data/factions/ranks/SAM.json`, 19 rungs, Koyakunin to Shogun) and Shinobi
  (`data/factions/ranks/SHI.json`, 6 rungs, Apprentice to Kage) rank ladders. `Registry.rankOf` resolves a unit's
  optional `rankId` to a rung with named, source-tracked privileges wired into the existing modifier pipeline and
  movement code rather than bolted on beside it: `twoSwords` (+50 ATK on a reaction attack), `mounted` (+1
  Movement, conditional on a nearby enemy for "war"), `commandRadiusBonus` (extends the aura, morale recovery and
  `PreventRouted` radius alike), `banner` (+5 further Morale recovery), `castle` (+100 further DEF on
  Fortification), `canopy` (Forest costs 1 Movement instead of 2), `hideOnForestStop`, and `ignoreZoc`
  /`passAllies`/`bonusMov`. Only the rungs the current roster actually occupies are exercised in battle; the
  higher Samurai tiers and Shinobi's Kage (with a declared but unwired Shadow Step) are real rungs reserved for
  units not yet rostered. See `docs/mechanics.md`'s "Rank ladders" section and `core/tests/ranks.test.ts`.

## Next, in priority order

1. **Knight, Dragon Host and Ritual Cult rank ladders**, extending the Samurai/Shinobi pattern above. Knight
   privileges likely mirror Samurai's mounted/castle vocabulary (a defensive, cavalry-supporting faction); Dragon
   Host is airborne and mostly ignores terrain, so its ladder probably weights aura and reaction-attack privileges
   over movement ones; Ritual Cult has no Commander/Second today (`RIT_LEADER_AFFILIATED-SUMMONER` is a
   `Specialist`), so its ladder may need a leadership slot decision first.
2. **Three universal win conditions.** `main` only has the implicit wipeout (`alive.length === 0`) and each
   scenario's own objectives; "kill their army leader" and "force a surrender" (concede when the whole chain of
   command is gone and morale has collapsed) are not implemented yet. `VictoryRules` in `battle.ts` has no leader
   or surrender concept to hang either on.
3. **Siege pieces.** `Role: "Siege"` exists in `types.ts`, but no unit in `data/units/units.json` uses it. One
   siege unit per combat faction (Samurai, Shinobi, Knight, Dragon Host), each with a minimum range so it cannot
   fire adjacent, would give the roster a real target for that role.
4. **Cavalry beyond the one Dragoon.** Only `KNI_ELITE_SKY-LANCE-DRAGOON` carries the `Cavalry` role today.
   Cavalry for Samurai, Shinobi and Ritual Cult would match the owner's "cannons and cavalry that fit its theme"
   intent, and would be a natural fit for the Samurai `mounted` rank privilege above.
5. **Irregular battlefield generator.** `Threefold Invocation`'s map is hand-authored; the owner's "never a
   cookie-cutter map" intent (trenches, mud, mountains, valleys, rivers) has no generator on `main` yet, and no
   `Trench`/`Mud` terrain types exist in `types.ts` to generate.
6. **A second scenario.** One playable scenario makes it hard to tell a genuinely reusable objective/AI system
   from one that only happens to work for `Threefold Invocation`'s specific layout.

5. Army builder validation UI in the sample page (drag units into slots, live doctrine and capacity readout).
6. Formation Sandbox mode as a page: place units, see cohesion and doctrine live.
7. Unity port scaffolding once the owner confirms the engine target (see `docs/mechanics.md`).

AI use of trenches and high ground, siege positioning behind the line, cavalry flank routing, and surrender when
the leader is dead and morale has collapsed is done (see `docs/CHECKLIST.md` D-22) and is dropped from this list.

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

- 2026-09-08 (process, not a game-design idea — see `docs/CHECKLIST.md` for the full note): ~75 pull requests
  are open and none have merged, including the trunk PR itself. Recommend the owner triage and merge a batch,
  starting with PR #2, before more automated passes run.
- 2026-09-08 proposal: give pikes and set siege pieces a real answer to cavalry, tying "themed cavalry" and
  uneven-ground intent together. Today a lance charge is a flat attack bonus with no counterplay named in
  `docs/mechanics.md`. Historically, cavalry that charges a braced spear or pike line balks rather than
  breaking it. Proposal: a "braced" stance (any Set siege piece, or a foot unit with a pike-family skill,
  that did not move this round) that, when charged, cancels the attacker's lance-charge bonus for that attack
  and applies a small morale hit to the charging unit instead of to the braced one — so cavalry stays the
  answer to unbraced lines and open ground, and braced infantry becomes the answer to cavalry, rather than
  either side just trading flat numbers. Would read as a new modifier source on the combat side (each faction
  keeps its own cavalry and siege art and stats; nothing about existing units changes by default) and a status
  flag for "did not move, and chose to brace" set during the order phase. Proposal only, not implemented —
  needs an owner call on which unit skills carry the pike-family tag before any rank ladder or card leans on
  it.
- 2026-09-05: Weather as a round modifier (rain turns Open to Mud along rivers, fog reduces ranged range by 1).
- 2026-09-05: Siege pieces could target hexes for suppressive fire, laying a temporary "Shelled" terrain (−50 DEF,
  breaks charges) for one round.
- 2026-09-05: Shinobi Kage as an Army-tier unique with a once-per-battle "Night Falls" that hides every Shinobi in
  forest for one round.
- 2026-09-05: Proposal — a Samurai province campaign map where each region is a scenario, won regions feed the
  holding's resource production, and losing a region costs the buildings raised there.
- 2026-09-05: Proposal — duplicate cards from recruitment could feed a "reforge" that raises a card's star by
  one, giving duplicates a purpose instead of dead weight.
- 2026-09-08: Proposal — tie rank privileges to the terrain generator instead of only to combat stats, so a rank
  ladder pays off on the uneven ground it was built for rather than only in a straight fight. Concretely: a
  Knight rank at or above (say) Banneret ignores the Mud movement penalty picked up after rain (see the weather
  proposal above); a Dragon Host rank at or above their mounted tier treats Mountain hexes as home ground, adding
  a fixed ATK bonus there instead of only paying the labored-climb cost like everyone else. Every such privilege
  would still be a single named, source-tracked modifier through the existing pipeline, same as every other rank
  privilege today, so it costs nothing new in the modifier system, only new terrain-conditional entries in
  `data/factions/ranks`. Worth doing once the Knight and Dragon Host ladders currently in flight land, so the privilege
  table has real ranks to attach to.
- 2026-09-05: Proposal — the side deck could hold a third card kind, a Stratagem, played from the side deck for a
  one-round battlefield effect (a forced march, a smokescreen, a false retreat), keeping the twenty-card cap.
  **Built in the stratagem pass** (see Done), with exactly those three cards.

- 2026-09-06: Proposal — `composition.ts` now requires a Company-capable commander once an army fields more than
  one platoon (rank ladders declared `canLead: [..., "Company", ...]` for exactly this, but nothing checked it
  before). That only gates army legality; a Company-rank leader who is actually present in battle grants no
  battlefield effect of its own beyond their personal privileges (banner, castle, and so on). A named, source-
  tracked "Company Command" bonus — say, a small morale or command-radius bump to every platoon in the same
  Company while its qualifying leader lives — would give the rank ladders' higher tiers the same mechanical
  weight in play that the Platoon tier already has, and would finally give the currently-unused
  `organizationLevel` helper in `composition.ts` a real caller.

- 2026-09-07: Proposal — only Knight fields a Portal Keeper today (`KNI_SUPPORT_PORTAL-KEEPER`, now that Open
  Reinforcement Portal and Reserve-fed queueing actually run). The other three host factions get the same bar
  already met for rank ladders, cannons and cavalry: a themed keeper apiece, one hex of reach on the call so the
  ground it opens on still reads as chosen rather than automatic — a Samurai signal-drum bearer, a Shinobi
  dead-drop handler who calls in from cover rather than the open, and a Dragon Host clutch-warden whose portal
  hatches wyrmlings instead of marching in foot. Same numbers, different name and cutout, so the mechanic reads as
  four factions fighting the same war rather than one faction with a rule the others lack.
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

- 2026-09-06: Proposal — an `EliminateRank` objective: satisfied once every enemy unit holding a named faction
  rank (a Shogun, a Jonin, a Marshal) is defeated or subdued. This gives the rank ladders a stake beyond their
  own mechanics: a scenario could be won by unseating a specific rank rather than only the fixed army leader,
  which matters once Knight, Dragon Host and Ritual Cult get ladders of their own.

- 2026-09-06: Proposal — the standing intent asks every faction for a themed cannon and a themed cavalry unit, but
  the roster only carries one of each for the four host armies (Samurai, Shinobi, Knight, Dragon Host); Ritual
  Cult, the five sworn companies and the seven divisions have neither (the Windmarch steppe archers and the Choir
  Militant have a cavalry-flagged unit each, everyone else has zero). A themed pair per remaining faction —
  a Ritual Cult siege idea could be a portable summoning brazier that fires a delayed Unstable pulse instead of a
  shot, and Wendigo-kin cavalry could be antlered pack-runners rather than mounted riders — would close that gap
  the same way the rank ladders are being closed faction by faction. Card art for whatever gets picked stays a
  separate, owner-sampled step.

- 2026-09-06: Proposal — now that Silent Directive correctly lands its post-attack Hide (a same-call ordering bug
  meant the generic "attacking reveals you" check stripped the status the instant it was granted), a unit that
  attacks out of Hidden could carry a small named first-strike ATK bonus, giving ambush play offensive weight
  rather than only defensive avoidance.

- 2026-09-06: Proposal — the new Company Order only fires for factions with a signature platoon order
  (`faction.platoonOrder`), which today is Samurai, Shinobi, Knight and Dragon Host alone. The five sworn
  companies and seven divisions have none, so once they field three platoons together their rank of Company
  gains nothing. Giving each its own signature order, the way the standing intent already asks for a rank
  ladder, a cannon and a cavalry unit per faction, would close the gap the same way and give the Company tier
  the weight everywhere the rank ladders eventually reach it.
- 2026-09-06: Proposal — Ritual Cult has no Commander/Second/Elite/FootSoldier roles at all (its two units are
  both Specialist-slot Ritualists), so it cannot field a standard platoon and the Company Order as built does
  not apply to it. Worth an owner decision on whether Ritual Cult ever fields fought platoons like the other
  factions, or whether its equivalent of "one army-level order per round" should instead be an extra ritual
  hold/instability charge once three ritual circles are active at once — its own kind of Company.

- 2026-09-06: Proposal — the Samurai `castle` privilege ("Rank: castle lord nearby", +100 DEF to allies holding
  Fortification within command radius) is currently the only rank privilege that rewards holding ground, and it
  is Samurai-only. As Knight, Dragon Host and Ritual Cult ladders land, each top tier could carry its own
  ground-holding privilege in its own idiom rather than reusing "castle": a Knight bastion-lord extending the
  same Fortification bonus to a keep or gatehouse, a Dragon Host aerie-lord doing it from high ground instead of
  a wall, a Ritual Cult archon speeding channeling for ritualists inside the same radius instead of granting DEF.
  Same mechanical shape (a named, source-tracked modifier keyed to a rank privilege and a terrain or ritual
  condition), four different flavors, so no faction's top rank is mechanically thinner than Samurai's.

- 2026-09-06: Proposal — the seven divisions (Choir Militant, Ashpit Legion, Spiral Warband, Half-Born Host,
  Winter Famine, Ridge Kin, Formic Swarm) are the next gap for a themed cannon and cavalry pair, the same way the
  sworn companies were just closed: Spiral Warband and Choir Militant already read as naturally mounted or
  winged, so they may only need a siege piece each, while the rest need both. Ritual Cult has no Cavalry- or
  Siege-capable roster shape at all yet (its two units are both Specialist Ritualists); whether it gets a
  conventional pair or something built from its own idiom (a portable summoning brazier for siege, bound spirits
  for cavalry) is worth an owner decision before building it.
- 2026-09-06: Proposal — every new Specialist unit this pass reused an existing generic ability rather than
  inventing one, which kept the pass small but means none of the nine has a distinct signature beyond its
  numbers. A follow-on pass could give one or two of them a genuinely new effect (a Cobalt Conclave ward that
  shields the whole platoon for a round, a Cutpurse Court cavalry withdrawal that hides the rider on retreat)
  once the plain versions have been played and found wanting.

- 2026-09-06: Proposal — right now only the Samurai ladder's Hatamoto rank carries a morale privilege (`banner`,
  +5 Morale to the platoon in the Command Phase); Knight, Dragon Host and Ritual Cult commanders recover the base
  +5 only and have no equivalent. When those three ladders land (see Next, item 2), give each top command rank
  its own morale-facing privilege in the same slot Hatamoto uses, distinct in flavor per faction (a Knight banner
  bearer rallying broken lines, a Dragon Host commander's roar steadying nearby wings, a Ritual Cult overseer
  suppressing panic through the circle) so mechanical weight at the top of the ladder is consistent across
  factions rather than a Samurai-only bonus.

- 2026-09-06: Proposal — once rank ladders land, derive a scenario's default Army Leader automatically as the
  side's single highest-ranked living unit, rather than requiring every scenario to hand-pick an `armyLeader`
  def id. This gives rank itself a mechanical consequence at the army level (the intent behind "rank ladders
  with mechanical weight") and resolves the succession conflict noted under item 2 above: an ordinary platoon
  Commander below the top rank would never qualify, only the actual army-level leader would.
- 2026-09-06: Proposal — once the irregular battlefield generator lands, add a fourth flavor of the Surrender
  win condition: a side whose organized platoons are terrain-cut off (no path within their movement budget) from
  every ritual circle and portal they own, for a set number of rounds, surrenders even at moderate morale. This
  ties the "odd-shaped battlefields" intent to the win-condition layer so terrain itself can decide a fight, not
  only attrition.

- 2026-09-06: Proposal — give the banner rank privilege more mechanical weight: a leader whose rank carries `banner`
  already doubles morale recovery at the start of each round, but the manual Rally action still heals a flat 10
  regardless of rank. Let `banner` leaders Rally for 15 instead, so climbing a faction's rank ladder keeps paying off
  in the moment a platoon calls on its commander, not only between rounds.

- 2026-09-06: Proposal — give the next three rank ladders (Knight, Dragon Host, Ritual Cult) a signature terrain
  tie the way Samurai already leans on high ground and Shinobi outrun everyone through forest: Knights hold rank
  privileges on Fortification and Trench (their doctrine is the shield wall, not the open field), Dragon Host ranks
  ignore or halve the Mountain movement penalty above a rank threshold (dragons do not care about a slope), and
  Ritual Cult ranks reduce ritual instability while the circle's center sits on Ruins (old ground remembers the
  working). Keeps "mechanical weight" meaning a rank changes how the ground plays, not only a bigger stat block,
  and gives each ladder a distinct board presence instead of three copies of the same privilege shape.

- 2026-09-06: Proposal — `organizationLevel` currently grants Company status to any three intact platoons, but
  the Samurai ladder already marks which ranks may lead a Company (Hatamoto and above) and the new roster gives
  every host faction three named Commander cards spanning several ranks. Require at least one deployed
  commander whose rank can lead a Company before the Company bonus applies, so climbing the ladder — not just
  owning three platoons — is what unlocks the higher tier of organization. Gives the rank ladders the
  mechanical weight the brief asks for beyond the Platoon level, and gives the new alternate Commander cards a
  reason to differ by rank rather than only by name.

- 2026-09-06: Proposal — scenario and ritual leader references resolve by unit defId plus side, which is fine while
  a side fields exactly one copy of a named commander but breaks once card duplicates or a warrant escort put two
  copies of the same commander on one side (the resolver finds the first live match, not necessarily the one the
  scenario meant). Give platoons and rituals an optional unit-instance reference — the platoon's own id, e.g.
  `leaderPlatoon: "A-1"` meaning "that platoon's commander" — so a scenario keeps pointing at the intended unit
  once the deck-ownership system lets an army run more than one copy of its own leader.

- 2026-09-06: Proposal — `data/compositions/platoon.json`'s `wizardsPerPlatoon` limit is currently unenforceable:
  `validateArmy` counts it by `rank === "Wizard"`, but no unit in `data/units/units.json` carries that rank (the
  enum is Commander/Second/Elite/Foot/Cavalry/Specialist/Levy/Lord/Kage/Shogun/King/Elder/Deity), including the
  one unit whose name says otherwise, `ARC_ELITE_STORMGLASS-WIZARD` (rank `Elite`). Since Ritual Cult and its
  Arcanist theme are where spellcasters actually live, the limit could instead count the `Ritualist` role (already
  on the books for ritual-casting units) rather than a rank that was never wired up. Left as a proposal rather than
  a silent fix, since deciding which units count as a "wizard" for this cap is a rules call, not a test-file fix.

- 2026-09-06: Proposal — tie some rituals and fusions to the ground they are cast on instead of letting them fire
  anywhere: Gate Wardens could need ruins underfoot (echoing whatever stood there before), Calamity Form could
  need high ground, a water-affinity ritual could need a river or ford tile. The map generator already tags roles
  like these for anchors and deployment zones, and Q-2's scenario-authoring-by-role work is teaching the engine to
  read those tags for objectives, rituals and portals; reusing the same role tags for fusion/ritual eligibility
  would make an odd-shaped battlefield part of the decision to commit an already-costly play, not just scenery
  around it, and would cost little once Q-2 lands the underlying lookup.

- 2026-09-06: Proposal — let a rank ladder's apex rank gate a named variant of the faction's own themed cannon or
  cavalry piece (same stats and skill, a different name and a small mechanical rider such as one extra hex of
  minimum range or one extra hex of charge distance) so the top of a ladder buys a unique piece of hardware
  instead of only a title, keeping rank ladders and themed siege/cavalry the same source-tracked system rather
  than adding a second one.
- 2026-09-06: Proposal — have the map generator flag any single ford, bridge, or one-hex-wide pass it lays down
  between two large landmasses as a named chokepoint, so a scenario can spawn a "Hold the Crossing" objective on
  it automatically instead of an author picking the hex by hand; this only fires on battlefields irregular enough
  to produce a genuine chokepoint; open, even ground would spawn nothing.

- 2026-09-06: Proposal — `enlistFromBattle` only bridges one way, mirroring a finished battle's survivors onto
  the march field so they can walk off it. The reverse bridge would close the loop: a squad marching within a
  scenario's engagement radius of an enemy body triggers a new Battle deployed on the ground it is standing on,
  so a campaign region plays as continuous movement with hex combat as an event the ground itself provokes,
  rather than a separate screen the player opens by hand. Feeds the campaign map work (Q-5) once that exists;
  not a decision to make yet on its own.

- 2026-09-06: Proposal — tie some ritual and fusion recipes to the terrain the irregular map generator already
  lays down, instead of leaving them terrain-blind. A Ritual Cult sovereign invocation could require its circle
  stand on Ruins, a Dragon Host fusion could require High Ground, a Knight fusion could require a Fortification.
  Every battlefield is generated fresh and odd-shaped, so this would not be a fixed puzzle; it would give
  commanders a reason to fight for a specific hex beyond a flat defence bonus, and it would put the map
  generator's variety to work in the one system that currently ignores it.

- 2026-09-06: Proposal — now that the AI actually fuses, `targetScore` should weight an enemy's fused body
  (`UnitState.fusedFrom` is set) as a priority kill the way it already weights a ritualist or an exposed elite:
  a fused body carries the value of the two or three cards that went into it, so a smart opponent should want
  to break it apart before it lands the first swing, not treat it as an ordinary target of the same size.

- 2026-09-06: Proposal — a fourth, portal-driven path to surrender pressure: on an odd-shaped map with only two or
  three portals anchoring the uneven ground, a side that holds every portal on the field (by capture, not just
  survival) for three straight rounds should force an immediate morale check on the side with none, on top of the
  existing average-morale surrender condition. Capturing a portal already flips it permanently rather than merely
  disabling it, so this would give capture a payoff beyond the reinforcement stream it steals, and it reads as a
  natural escalation on a battlefield built from trenches and mud rather than an even square.

- 2026-09-06: Proposal — now that a scenario can pin its features to a generated field by role instead of fixed
  hexes (`docs/mechanics.md`, "Scenario authoring: role-pinned placement"), the campaign map (Q-5) could generate
  a fresh, irregular field for every region on the province map rather than reusing one hand-built one: a region
  keeps its scenario definition (which sides, which objectives, roughly where the ritual circle or the portal
  sits relative to the lines) while the ground itself is different, odd-shaped, every time it is fought over.
  Matches the owner's standing intent that battlefields are never even squares or cookie-cutter.

- 2026-09-07: Proposal — let a scenario name a biome (`"biome": "MARSH"`) instead of raw generator knobs, so scenario
  authoring reads as regional intent ("defend the ford at Marsh") rather than tuned noise numbers, with the
  scenario's own overrides still layered on top of the preset.

- 2026-09-07: Proposal — Dragon Host's rank ladder should carry its own aerial trait the way Knight now carries
  lance charge: a "diving charge" ATK bonus keyed to altitude lost this activation (flying from HighGround down
  onto the target) rather than hexes moved, so the ladder rewards the dive itself and not just distance covered.
- 2026-09-07: Proposal — Ritual Cult cannot unlock extra commanders or elites (specialist teams only), so its
  ladder should not gate `canLead` the way the three army ladders do. Instead, key its ranks to ritual mastery:
  faster Progress accrual, a higher Instability ceiling before a hold turns dangerous, or an extra linked circle
  a synchronized release can reach. Same data shape (`RankLadder`, `RankPrivileges`), a different mechanical
  axis to match a faction that fields teams, not armies.

- 2026-09-07: Proposal — `PortalAttacked` only logs the final damage a siege piece does to a structure, unlike unit
  combat which logs a full modifier breakdown. Now that firing on a structure runs through the same modifier
  pipeline as any other attack (see the `attackStructure` fix in this pass), the breakdown is available for free;
  carrying it onto the event would let a future siege UI show a player why a shot did what it did, the same way
  the attack log already does for unit-on-unit combat.

- 2026-09-07: Proposal — now that `DefendForRounds` actually checks whether its named `uidOrPortal` survives instead
  of only the round clock, let a scenario name that target by role (a platoon's commander, a portal's scenario
  role) instead of a raw runtime uid, the same way scenario authoring already names hexes by role on a regenerated
  field. A hand-picked uid breaks the moment the same scenario redeploys on a different generated battlefield or a
  different army composition; a role reference would not.

- 2026-09-07: Proposal — wing dive could read the irregular battlefield generator's own terrain rather than
  only elevation: a bonus (or a reduced `DIVE_BONUS_MIN_DROP`) when the diving Dragon Host unit's landing hex
  is Ruins or Trench, rewarding a flier that picks broken ground to strike into rather than open ground. Ties
  the new rank privilege to the map generator's own variety instead of leaving the two systems unaware of
  each other.
- 2026-09-07: Proposal — a Grand Ritualist could let its own circle count as two toward a linked group's
  synchronized release requirement (so a two-ritualist Ritual Cult team could still attempt a three-circle
  scenario like Threefold Invocation without needing a third body). Ritual Cult now has a ladder to hang this
  on, but it needs a scenario author's read before implementation: `linkedGroup` and `releaseRitual` currently
  assume one circle per linked entry, and this would be the first exception.

- 2026-09-07 (proposal): Now that Siege units have a `minRange`, give them a second passive that trades their
  already-low `mov` for extra DEF while they haven't moved this round ("Braced" — the crew digs in once the
  battery stops), so committing a siege piece to a position is a real decision rather than a unit that is simply
  weak until it happens to connect. Would reuse the existing per-unit temp-modifier mechanism in `modifiers.ts`;
  no new effect kind needed.
- 2026-09-07 (proposal): Rather than inventing a fifth ground-cavalry unit for Dragon Host purely to fill out a
  "four factions, four cavalry" checklist, let Dragon Host's existing Elite or Second pick up a `ChargeBonus`
  ability of its own (a dive, not a lance) so the faction's mobility identity gets the same charge-risk/reward
  mechanic without adding a redundant non-flying unit that contradicts "Dragon Host is an aerial force."

- 2026-09-07 (proposal): `holdForSyncPolicy` (`core/src/ai.ts`) only ever considers rituals that carry a
  `linkGroup` — the grouping loop skips any ritual whose `linkGroup` is `null` before it can reach the release
  check, so a side's unlinked, single-circle ritual can never appear in the policy's output. Once such a ritual
  completes and enters `CompletedHeld`, this AI policy holds it forever: there is nothing to synchronize with,
  so the "wait for the whole group, or bail out under `unstableStacks >= 3` danger" logic that protects a linked
  group never gets a chance to run for it, and it would ride out instability indefinitely under AI control.
  Proposal: give `holdForSyncPolicy` a second branch alongside the grouped one — any live `CompletedHeld` ritual
  with `linkGroup === null` releases immediately, since a single circle has no synchronization to wait for and
  the point of holding at all was to wait for sibling circles that, in this case, do not exist. This keeps
  Ritual as a first-class, AI-playable function of the engine rather than one with a policy gap that only shows
  up when a scenario author chooses not to link a circle.

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
branch's `docs/CHECKLIST.md` is the actual claim protocol several recent passes have been using. This pass
targeted `main` and PR'd against `main` because that is what it was explicitly asked to do, and because the item
implemented here (siege and cavalry data plus two small, additive engine rules) stands on its own regardless of
which branch it lands on. Whether `main` should be fast-forwarded to that branch, or whether the two are meant to
stay separate, is an owner decision this pass is flagging rather than making.

- 2026-09-07: Proposal — a registry-wide "round-trip completeness" test that builds one battle exercising the
  holding, a mid-channel ritual, a queued portal and an in-progress march all at once, then asserts every stat a
  unit can compute and every side-level number reads identically before and after a save/load cycle. This pass
  found `Battle.kingdomEffects` missing from `BattleSave` entirely: a saved and reloaded battle silently dropped
  every "Research: …" and building-level ATK/DEF bonus, plus the kingdom's movement and command-radius grants,
  because nothing re-ran `applyKingdom` after `loadBattle`. A single completeness test across every carry-over
  system at once would have caught that the day it was introduced instead of needing a dedicated hunt, and would
  catch the next one the same way.

- 2026-09-07: Proposal — now that a battle's duels, order flags, hidden-after-attack marks, intercept use and
  timed terrain live on the `Battle` instance instead of as module-level state (this pass; see `core/src/state.ts`),
  `core/src/save.ts` could carry them into `BattleSave` too. Right now a save mid-Formal-Duel, mid-Silent-Directive
  or with unexpired smoke on the field round-trips clean but silently forgets all four: `saveBattle`/`loadBattle`
  never mention any of them. A single save-format bump could close all four gaps at once rather than hunting
  them one at a time, the same way a save/load round-trip has already turned up at least one other silently
  dropped field on this project.

- 2026-09-07: Proposal — a rank privilege that reads the battlefield's own shape rather than a flat bonus: a
  unit that has held the same trench or high-ground hex for two full rounds gets a "dug in" arc widening
  (its rear arc shrinks, front widens) so odd-shaped ground rewards patience, not just position. Would sit
  next to the existing rank ladders as one more mechanically weighty privilege rather than a new system.

- 2026-09-07: Proposal — now that a banner draw's roll cannot repeat itself for lack of a changed seed, let a
  faction's own rank ladder lean on the same Recruitment Hall a player already levels: the apex rank of a
  ladder could shave a fixed number of draws off that faction's own banner's pity counter once earned, so
  reaching the top of a ladder pays into the economy loop and not only into battle. Ties rank ladders'
  "mechanical weight" to the holding the same way Company-tier leadership already ties it to the battlefield,
  without touching any banner's published odds table.

- 2026-09-07: Proposal — now that the Deck screen sleeves and pulls live, let it write the edited list back
  into the holding as the deck the next match actually plays, instead of a build the sample page throws
  away on reload. Ties the "beyond match-to-match battles" holding straight to the "100-card deck" it is
  supposed to own, and gives a rank ladder's privileges somewhere to land: a ladder could raise what a
  faction's own leadership lets a mixed deck field, rather than every deck answering to the same flat
  40-card primary-faction minimum regardless of who leads it.

- 2026-09-07: Proposal — field promotion as a holding-tracked commendation. Today a unit's `factionRank` is fixed
  in `data/units/units.json`; every rank ladder gives mechanical weight in a single battle but none of it carries
  forward. If a Second survives a won battle while acting commander under Broken doctrine (no succession candidate
  left to promote further), record a one-tier field promotion against that card in the holding, capped at the
  rank its role is allowed to hold. This gives campaign wins the same mechanical weight on the rank ladder that a
  won region is meant to give the holding's production, without touching the battle-time privilege tables
  (`data/factions/ranks/*.json`) that already carry the source-tracked bonuses.

- 2026-09-07: Proposal — `BuildingDef.effect` already carries `atk`, `def` and `cavalryAtk`, but no building grants
  morale the way the Hearthfire research does; only a study can. A Shrine-flavoured morale line (a chaplain's
  blessing before the march, say) would let the holding's morale contribution grow steadily with a building level
  the way its other stats do, instead of waiting on one late-tier study. Proposal only; no building data changed
  here.

- 2026-09-07: Proposal — a generic fusion recipe (no named result unit) currently builds its stat block from
  `{ ...strongest, ... }` in `fusion.ts`, where "strongest" means the higher ATK+DEF input. That silently carries
  the `rank` field along for the ride: fuse a ranked commander beside a plain foot soldier with a bigger stat
  total and the fused body inherits the foot soldier's rank, quietly dropping whatever command radius, mounted
  movement or banner-morale privilege the commander's rank carried. Rank ladders are meant to have mechanical
  weight; a fusion shouldn't be a way to launder it away by accident. A generic recipe could instead keep the
  higher-ranked input's rank explicitly (by ladder position, not by raw stats) unless the recipe names otherwise.

- 2026-09-07: Proposal — tie the Surrender win condition to rank instead of leaving it a free choice: a side may
  only offer surrender while a unit of at least Company-leading rank (per its own faction's ladder) is standing,
  and once the army leader is dead and no such rank survives, surrender should fire automatically rather than
  waiting on a decision nobody left on the field can make. This gives the rank ladders — already mechanically
  load-bearing in combat — a say in which of the three universal win conditions actually ends a battle, instead
  of leaving Surrender as the one win condition rank never touches.

- 2026-09-07: Proposal — now that a battle's Formal Duel pairings, orders and timed terrain survive a save
  (this pass; see `core/src/save.ts`), a scenario could seed timed terrain directly at setup instead of only
  through a mid-battle ability: a bog or smoke bank baked into an uneven battlefield's opening state, placed
  by role the same way `Q-2` pins objectives, rituals and portals to the generated ground. That would give
  scenario authors one more tool for the "no even squares" battlefield intent that does not depend on either
  side rolling the right ability.
- 2026-09-07: Proposal — Formal Duel currently lets any elite or leader challenge any enemy elite or leader
  regardless of rank, which sits oddly next to how much mechanical weight the rank ladders already carry
  elsewhere (command radius, two-sword reactions, castle defense, who may lead a platoon). A low-rank elite
  challenging an enemy Kage or Shogun to a Formal Duel could cost morale to both sides on issue, or simply be
  disallowed below a faction-specific rank floor, so the ladders get a say in this mechanic too instead of it
  being the one privilege-adjacent ability rank never touches.

- 2026-09-07: Proposal — `CaptureHold` targets one fixed hex, but an odd-shaped map usually has two chokepoints
  worth holding (both fords on a river map, both passes on a highland map), and a defender's real objective is
  "hold them together", not either alone. A composite `CaptureHoldAll` that lists several hexes and is satisfied
  only once every one of them individually reaches its own round count would express a pincer defense without a
  new mechanic: it reads the same per-hex counters `CaptureHold` already keeps, just several of them at once.
  Would need each named `Escort` and `CaptureHold` win state to log which of its component hexes is still
  contested, the way a multi-part objective ought to explain itself on the HUD.

implemented here (direct test coverage for the existing AI, no gameplay change) stands on its own regardless of
which branch it lands on. Whether `main` should be fast-forwarded to that branch, or whether the two are meant to
stay separate, is an owner decision this pass is flagging rather than making — a prior pass
(`agent/2026-09-07-siege-cavalry-rosters`) flagged the same thing; it is still open.

- 2026-09-07: Direct test coverage for `fuse()` on the two recipes nothing exercised yet, Gate Wardens and Twinwing
  Drake, found a real bug: platoon-slot bookkeeping put the fused unit back into whichever slot the *first* input
  happened to occupy, rather than the slot the recipe names. Paired Line never exposed it because both inputs are
  always foot soldiers, but Gate Wardens fuses an Elite with a foot soldier, and the caller (a player click order
  or a future AI) can pass either one first. Passing the foot soldier first left the fused Elite stranded in
  `footUids` with `eliteUid` nulled, misreporting a healthy platoon as Doctrine Broken. Fixed by clearing every
  input from whatever slot it held and placing the fused unit by the recipe's declared `result.slot` instead.
  Proposal — a fusion invariant test that runs every recipe in `data/abilities/fusions.json` through both input
  orders (all permutations, for a three-body recipe) and asserts identical slot placement and result stats no
  matter which unit is named the anchor, so an asymmetric-role recipe can't reintroduce this class of bug.

- 2026-09-07: Proposal — a twelfth objective type, `AnchorsBroken`, scoring a scenario loss when a summoned
  Divine Entity's anchors reach zero before its ritual can be repeated. Anchors currently only shrink the
  entity's own combat stats; this would let a scenario built around protecting one big summon risk the whole
  battle on it, as a scenario-authored objective layered on top of the three universal win conditions rather
  than a change to them.
- 2026-09-07: Proposal — once the Dragon Host rank ladder lands, a senior "Wing Rank" privilege that lets its
  riders cross Mountains at a rider's normal cost rather than the sixfold penalty cavalry pay elsewhere, the way
  Shinobi already outrun Knights through Forest. Gives the faction's themed cavalry a rank-gated answer to the
  terrain system rather than a flat stat bonus.

- 2026-09-07: Proposal — field promotion: defeating an enemy that holds a named rank (Samurai, Shinobi, Knight,
  Dragon Host or Ritual Cult) grants the unit that lands the killing blow a one-step, battle-only privilege from
  its own faction's next rank up (e.g. a Samurai Ashigaru that kills a ranked officer fights the rest of that
  battle as if promoted one rung, then reverts after). It gives the rank ladders mechanical weight in the moment
  a kill happens rather than only between battles, costs nothing to add per faction since it reads the existing
  ladder data, and stays a temporary in-battle modifier so it cannot be confused with the holding's own
  permanent advancement. Needs an owner call on whether the promotion should be visible to the enemy (a bright
  tell versus a quiet buff) and whether a Deity kill should grant more than one step.

- 2026-09-07: **Proposal** — give `moraleSummary` an optional "at risk of surrender" flag surfaced per side
  (rather than only the boolean decision `maybeSurrender` acts on), so a future HUD can warn a human player
  their command structure is one loss away from being forced to concede, instead of the surrender simply
  happening off-screen.
- 2026-09-07: **Proposal** — once siege units exist (see Next #3), give them a `minimumRange` field enforced the
  same way `range` already caps `attack()`, so a siege piece standing adjacent to a target is mechanically
  unable to fire rather than merely AI-discouraged from standing there.

- 2026-09-07: Proposal — once the generator names biomes (Ashfall, Marsh, Highland pass), let a scenario's
  role placements take a biome-scoped variant ("ford in the marsh reach" rather than just "ford"), so a
  scenario can ask for a specific kind of ground within a larger generated field instead of only the nearest
  instance of a feature.
- 2026-09-07: Proposal — a "flank" role pair (the passable hex on each side of the road, offset from the
  midpoint) so a scenario can pin an ambush or a flanking reinforcement point without hand-picking a hex,
  the same way rituals and portals now pin to the ruins or the ford.

- 2026-09-08: **Proposal** — once a faction's rank ladder reaches its top rungs (Shogun for Samurai, Kage for
  Shinobi), let the scenario file name that unit as the side's `leader` for the win-condition system above
  (Next #2), so "kill the army leader" always resolves to the highest-ranked living unit in the chain of command
  rather than a separately-authored field that can drift out of sync with the ladder.
- 2026-09-08: **Proposal** — a `demoted` flag for a unit whose commander/second falls and is not replaced before
  Continuity expires: rather than the platoon simply losing its aura, the highest-tier surviving unit on the rank
  ladder could inherit a partial aura scaled to its own rung, giving the ladder mechanical weight during a
  succession crisis and not only while the chain of command is intact.

- 2026-09-08: Proposal — give Fusion and Ritual, already first-class functions of the engine, a payoff on the rank
  ladders the same way combat stats already get one: gate one Fusion recipe or Ritual anchor per faction behind
  that faction's own top rank (a Shogun-only fusion partner for the Samurai, a Kage-exclusive ritual anchor for
  the Shinobi, and the same slot reserved for Knight, Dragon Host and Ritual Cult once those ladders land). The
  cost is a single rank check against a field the ranks system already records per unit, so it adds nothing new
  to the modifier pipeline and needs no new art or renamed units — only one new recipe or anchor entry per
  faction in `data/abilities/fusions.json` or the ritual data, each still summon-limited and source-tracked like
  every other one.

- 2026-09-08: Proposal — now that a unit's temporary modifiers (from Orders, charges and card skills) persist
  through a save/load round trip instead of vanishing by object identity, the `AbilityUsed` event log entry
  could carry the exact modifier it granted (source, stat, value) alongside the ability id. That would give
  anything that reads the event log later — an after-action report, a future step-through viewer — the same
  source-tracked honesty the live stat breakdown already has, instead of re-deriving it from the ability
  definition after the fact.

- 2026-09-08: Proposal — scale the Rally order's heal and radius by the caster's rank, not a flat +10/2 hexes for
  every Commander or Second regardless of ladder position. A fresh Ashigaru sergeant and a seasoned Daimyo already
  diverge in command radius through the rank privilege table; giving Rally the same per-rank privilege (say
  `rallyBonus`) would make climbing a ladder matter in the same battle it is fought, not only between them, and the
  bonus would sit beside `commandRadiusBonus` as a second named, source-tracked use of that table.

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

- 2026-09-08: Proposal — let a Fusion recipe optionally spend a ritual's leftover Unstable stacks as a named
  material ("Unstable Residue") instead of only fixed unit ingredients. A circle about to collapse would still
  feed the engine something back rather than being pure loss, at the cost of a source-tracked risk modifier
  (e.g. "Unstable Residue x2": -DEF for a few rounds) carried onto whatever the fusion produces. Ties Ritual and
  Fusion together as the brief asks without adding a new resource type.

- 2026-09-08: The Calamity Form's `Convergence` arrival was data-defined (`data/units/units.json`) but had no
  matching case in the engine, and Fusion never triggered a Divine Entity's arrival at all — only ritual release
  did. Fixed by routing Fusion's divine results through the same `arrivalEffect` ritual release already uses,
  and giving `Convergence` the only reading its own fusion text supports: Memory's reveal, Torment's fear pulse
  and Reincarnation's one revival landing together, since the card text says the Calamity Form only exists
  because those three stood together. Proposal, not implemented — worth an owner look regardless of the bug fix:
  the Calamity Form's `FusionDissolved` end (`tickFusions` in `core/src/fusion.ts`) currently "leaves nothing
  behind", which now reads as the convergence's arrival mattering and its unwinding not. A small departure
  effect — perhaps the same fear pulse in reverse, a morale boost to nearby allies as the pressure lifts — would
  make the three-round clock feel like it costs something at both ends instead of only the one.

branch's `docs/CHECKLIST.md` is the actual claim protocol several recent passes have been using, and it already
has its own irregular map generator with named biomes — unrelated code to `main`'s new `core/src/mapgen.ts`
above; the two should not be conflated or merged into each other casually. This pass targeted `main` and PR'd
against `main` because that is what it was explicitly asked to do. Whether `main` should be fast-forwarded to
that branch, or whether the two are meant to stay separate, remains an owner decision flagged by several prior
passes; this one doesn't resolve it either.

- 2026-09-08: Proposal — veterancy carried from battle into the holding: a unit that survives a fight banks a
  kill/survival tally, and at a threshold the holding can muster it back in as a named veteran variant (a small,
  source-tracked stat modifier plus a title on the card), giving rank ladders a second, personal track that sits
  underneath the faction ranks and rewards the permanent-holding loop for keeping the same body alive rather than
  only recruiting fresh ones.
- 2026-09-08: Proposal — scenario-authored terrain events: a scenario can declare a one-shot geography change tied
  to a round or a trigger (a bridge that collapses into Water once a unit crosses it, a trench that floods into Mud
  after N rounds near a river), layered on top of the irregular generator rather than replacing it, so a battlefield
  can turn uneven mid-fight instead of only at generation time.

- 2026-09-08: Proposal — gate a banner's top rate behind the holding's own rank ladder: the highest star a
  faction's banner can draw would be capped by the highest living rank the holding currently fields in that
  faction, so pulling a named lord or a sovereign requires already having someone in the field senior enough
  to vouch for them. Ties the rank ladders' "mechanical weight" directly to recruitment instead of leaving
  ranks and banners as two systems that never talk to each other. Not implemented; needs a call on whether the
  cap should be per-banner or per-faction, and whether it should ease as more of the ladder is filled.

- 2026-09-08: Proposal — now that capturing an enemy reinforcement portal counts toward `DestroyPortals` in its
  own right, a themed cavalry trait ("Portal Raider": one steppe or dragon-cavalry unit per faction captures in a
  single uninterrupted action instead of two) would give cavalry a distinct siege-adjacent job on odd-shaped maps
  where portals sit behind rough ground infantry cannot reach in time.

- 2026-09-08: Proposal — marching squads now promote a replacement leader by list order the instant the old one is
  reused or peels off elsewhere; that promotion could read rank instead, so the highest-ranked member left in a
  Samurai or Knight column takes over the same way a promoted second inherits command in the Command Phase. Would
  give the rank ladders another place their mechanical weight actually shows.

- 2026-09-08: Proposal — when a battle hits its round limit with nothing decisive, let the side with the higher
  average morale (`moraleSummary`) win the field instead of only a flat draw or a scenario-set default. Morale is
  already a first-class, source-tracked system; using it to break a stalemate gives a long battle a reason
  besides the clock, and a scenario that truly wants a coin-flip draw could still opt out by leaving
  `roundLimitWinner` unset only when both averages tie.

- 2026-09-08: Proposal — give each faction's siege piece a portal-specific breaching trait instead of the one
  shared `ABL_BREACHING_SHOT` bonus every cannon gets today: the Dragon Host's Siegewyrm collapses a still-telegraphing
  portal outright with its concussive blast (denying the reinforcement before it ever opens), the Knight trebuchet
  only chips a portal's hp at range but ignores its def entirely, the Samurai cannon halves the refund the defender
  gets on a kill (nothing walks away clean), and the Shinobi's piece can't dent a portal's hp at all but auto-wins
  any capture contest it assists. Read against `attackPortal` in `core/src/portals.ts`, which this pass caught doing
  no side check at all (a unit could "attack" and destroy its own portal) — worth widening the review to whether the
  four cannons should differ in more than raw numbers once that path gets more traffic.

- 2026-09-08 proposal: give rank ladders a mechanical say inside the ritual system, tying two pieces of stated
  intent (rank ladders with real mechanical weight, and ritual/fusion as first-class engine functions) together
  instead of leaving them parallel. Today any participant contributes the same ritual rating regardless of rank.
  Proposal — a unit above a named rank threshold on its own faction's ladder (a Samurai at Hatamoto and above,
  a Shinobi Chunin and above, and the equivalent rung once Knight, Dragon Host and Ritual Cult ladders land)
  could anchor a circle alone at reduced progress-per-round instead of needing the current minimum headcount,
  and could hold a circle one Unstable stack longer before it starts taking damage — representing discipline
  under pressure rather than a flat rating bonus, so it shows up as a named modifier source on the circle, not
  a hidden number. Proposal only; needs an owner call on which rank is the threshold per faction, since the
  ladders above Samurai and Shinobi are not built yet.

- 2026-09-08: Proposal — gate fusion materials by rank: a recipe could require at least one material at or above a
  named rank (a Gate Wardens fusion wanting a Chunin-or-higher Shinobi, say), so climbing a rank ladder pays off in
  the fusion system as well as in command radius and battlefield privileges, rather than the two systems staying
  parallel and unconnected.
- 2026-09-08: Proposal — let siege pieces claim a terrain-defined emplacement: the map generator could mark a small
  number of hexes per named biome as a gun pit or firing step (cheaper to occupy and set up from, for siege pieces
  only), so an odd-shaped, generated battlefield rewards the themed cannon a faction already brings instead of
  siege placement being anywhere-is-as-good-as-anywhere on open ground.
