# ALLYNCE — original tactical army strategy game

Data-first vertical slice for an original, PC-first tactical war game: platoons of eight, commanders with
second-in-command succession, theme cohesion, rituals that can be held and synchronized, reinforcement portals,
dragon cavalry raids, and objective-based victory. Everything is original: names, units, symbols, lore and art.

This repository holds five things:

| Area | Path | What it is |
|---|---|---|
| Game data | `data/` | JSON tables for units, abilities, factions, composition rules and scenarios. Engine-agnostic; the Unity build imports these directly. |
| Rules engine | `core/` | TypeScript reference implementation of every mechanic in the engineering brief, with a deterministic event log and a test suite that doubles as the acceptance spec for the C# port. |
| Web client | `web/` | Playable browser front end: field manual, campaign map, village, deck and inventory, and an animated battle screen. Plain ES modules — no build step. |
| Content tools | `tools/` | The roster generator, the static server and the UI smoke test. |
| Art pipeline | `art/`, `docs/art-pipeline.md` | Approved style direction, prompt library, sample sprites, rejected rounds and why, asset manifest and naming convention. |

## Quick start

```bash
npm install
npm test            # 161 tests: combat math, cohesion, composition, succession, clones, rituals, portals, scenarios, campaign, weather, rank ladders, full scenario, replay

npm test            # 155 tests: combat math, cohesion, composition, succession, clones, rituals, portals, cards,
                    # the holding, wanted board, marching, map generation, AI, and a full scenario end to end

npm test            # 153 tests: combat math, cohesion, composition, succession, clones, rituals, portals, save/load, full scenario

npm test            # 156 tests: combat math, cohesion, composition, succession, clones, rituals, portals, full scenario

npm test            # 159 tests: combat math, cohesion, composition, succession, clones, rituals, portals, full scenario

npm test            # 157 tests: combat math, cohesion, composition, succession, clones, rituals, portals, full scenario

npm test            # 40 tests: combat math, cohesion, composition, succession, clones, rituals, portals, victory, full scenario

npm test            # 160 tests: combat math, cohesion, composition, succession, clones, rituals, portals, full scenario

npm test            # combat math, cohesion, composition, succession, clones, rituals, portals, cards, the holding, marching, full scenario

npm test            # 155 tests: combat math, cohesion, composition, succession, clones, rituals, portals, full scenario

npm test            # 160 tests: combat math, cohesion, composition, succession, clones, rituals, portals, full scenario

npm test            # 40 tests: combat math, cohesion, composition, succession, clones, rituals, portals, siege/cavalry, full scenario

npm test            # 152 tests: combat math, cohesion, composition, succession, clones, rituals, portals, save/load, full scenario

npm test            # 154 tests: combat math, cohesion, composition, succession, clones, rituals, portals, full scenario

npm test            # 152 tests: combat math, cohesion, composition, succession, clones, rituals, portals, full scenario

npm test            # 156 tests: combat math, cohesion, composition, succession, clones, rituals, portals, full scenario

npm test            # 154 tests: combat math, cohesion, composition, succession, clones, rituals, portals, fusion, full scenario

npm test            # 151 tests: combat math, cohesion, composition, succession, clones, rituals, portals, marching, full scenario

npm test            # 44 tests: combat math, cohesion, composition, succession, clones, rituals, portals, victory conditions, AI positioning, full scenario

npm test            # combat math, cohesion, composition, succession, clones, rituals, portals, full scenario

npm test            # 44 tests: combat math, cohesion, composition, succession, clones, rituals, portals, rank ladders, full scenario
npm run sim:demo    # runs Threefold Invocation with AI on both sides and prints the round log
npm run typecheck
npm run assets      # rebuilds the asset registry from the data and from disk

npm run web         # serves the playable client at http://localhost:5173/web/index.html
npm test            # 48 tests: combat math, cohesion, composition, succession, clones, rituals, portals, roster, scenario
npm run test:ui     # headless browser checks on the client (card layout, village, deck, battle)
npm run gen:content # regenerates data/units/expansion.json from tools/content
npm run sim:demo    # runs Threefold Invocation with AI on both sides and prints the round log
npm run typecheck
npm run check       # everything above in one pass; this is what CI runs
npm run build:standalone   # bundles the whole client into dist/allynce.html
```

`build:standalone` inlines the styles, modules, game tables and painted plates into a
single ~2 MB HTML file that opens straight from disk with no server and no network
requests — the easiest way to hand the game to someone. Add `-- --artifact` to emit the
same page as a body fragment for hosts that supply their own document skeleton.

CI runs `npm run check` on every pull request and on `main`
(`.github/workflows/ci.yml`). A weekly routine runs the same command and only
reports when something fails.

## The client

`npm run web` serves a playable browser build with no bundler and no dependencies.

- **Field Manual** — a guide that teaches the game from a standing start, then doubles as the
  rules reference. Its numbers are read from `data/`, so the manual cannot drift from the tables.
- **Campaign** — nine objectives on a cartographic survey map; each briefs its opposition,
  its victory condition and its reward, and unlocks the next.
- **Village** — Muster Hall, Barracks, Forge, Granary, Wing Aviary, Cloister Shrine, Training
  Yard, Market, Reliquary and Scriptorium. Every one builds, upgrades and runs a real action:
  recruiting, collecting real-time output, trading, drilling three duplicates into a better
  unit, or invoking an Ascendant.
- **Muster** — your inventory on the left, your deck on the right. Sorting cards into the deck
  is the only route to the battlefield, and the deck is validated continuously against the same
  composition rules the simulation enforces.
- **Battle** — a hex board with movement ranges, facing arcs, the full stat breakdown behind
  every number, and a roughly one-second effect for each attack and ability.
- **Armoury** — the whole 272-unit roster, filterable, with a stat sheet per unit.

Every unit has art. Ten of them have painted concepts; the rest get a deterministic generated
heraldic portrait seeded from the unit id, so no card can render an empty art window.

## The roster

272 units across eleven factions, star-rated 1–10.

| Faction | Units | Ten-stars | Notes |
|---|---:|---:|---|
| Samurai | 24 | 2 | |
| Shinobi | 24 | 2 | |
| Knight | 25 | 2 | |
| Dragon Host | 34 | 3 | Everything flies |
| Ritual Cult | 17 | 1 | Specialists only |
| Thorn Coven | 20 | 2 | Attrition and entanglement |
| Angelic Host | 32 | 5 | Every unit flies; ordered by choir; archangels are one copy each |
| Stormbound Clan | 26 | 2 | Warriors and stormcallers of one bloodline |
| Monastic Orders | 20 | 2 | Several one-copy named holders |
| Fused Orders | 35 | 7 | Seven archetypes of five |
| Divine Entities | 15 | 3 | Summon-only, one copy per battle, no capacity cost |

Fusion archetypes are Warrior-Monk, Shadow-Blade, Dragonknight, Storm-Seraph, Thornwyrm,
Thunderstep and Ascetic Choir. A fusion unit keeps both parent themes, so it counts for Theme
Cohesion with either lineage — the reason to field one at all.

**Ten-star (Ascendant) units** are deliberately not one step up the curve. The power curve breaks
at ten and a flat Ascendant Manifestation term is added on top, so the frailest Ascendant outweighs
the heaviest nine-star. Each carries a signature ability no other unit has, arrives with an effect
that changes the battlefield, fights without needing cohesion, doctrine or a command aura, and
staggers at zero hit points rather than dying — it is removed only once every Anchor is broken.
One Ascendant may be fielded per army.

## What is implemented

- **Hex grid**: axial coordinates, adjacency, rings, facing, front/flank/rear arcs, BFS movement with terrain costs, zone of control, flying and anti-air rules.
- **Modifier pipeline**: `Final = Base + ThemeCohesion + Composition + Command + Status + Terrain (+ ability conditionals)`, every contribution tagged with its source for the breakdown tooltip.
- **Theme Cohesion**: `min(4, adjacentMatchingAllies) × 50`, clones excluded, Disordered morale caps at +100, graph edges exposed for the overlay.
- **Composition**: army validator (slots, five foot soldiers, one elite per platoon, unique limit, boss/deity exclusion, specialist limits, capacity). Doctrine states Full / Reduced / Broken with Continuity after a commander falls.
- **Command**: strongest-aura-only rule, succession in the Command Phase, promoted second inherits orders and keeps its own ability, Succession-category abilities fire (Last Oath, Smoke Relay, Inherited Wall, Slipstream).
- **Rank ladders**: per-faction ladders of named rungs, each with source-tracked mechanical privileges (aura reach, reaction-attack bonus, mounted movement, Fortification bonus, Forest movement, hiding, zone-of-control immunity). Samurai (19 rungs) and Shinobi (6 rungs) are seeded in `data/factions/ranks/`; Knight, Dragon Host and Ritual Cult have none yet.
- **Combat**: `max(100, ATK − DEF)`, flank −10% / rear −25% DEF, Defend +150, Fortification +200, high ground for ranged, Oath of Intercession, Formal Duel lockout, reaction attacks, Overwatch, Disengage.
- **Siege and cavalry**: every combat faction (Samurai, Shinobi, Knight, Dragon Host) has a themed Siege specialist with a `minRange` that keeps it from firing point-blank and a shared Breaching Volley bonus against Fortification terrain, plus a Cavalry Elite option with a `ChargeBonus`-driven charge ability. See `docs/mechanics.md`.
- **Morale**: 0–100 with Steady / Shaken / Disordered / Routed / Broken bands, all brief-listed loss and recovery sources, AI-controlled routed retreat.
- **Effects framework**: one data-driven interpreter for orders, passives, succession, clones, charges, terrain spawns and status grants. Twin Echo is the reference clone implementation (two clones, 1 HP, 40% ATK, no cohesion, no composition, expire after two rounds).
- **Rituals**: four ratings per ritualist, explicit progress formula, seven states, Held rituals gain Unstable stacks that damage participants and amplify disruption, synchronized release only when every linked circle releases in the same Objective Phase, weakened summons otherwise.
- **Divine Entities**: summon-only, one copy per battle, Manifestation and Anchors, stagger at 0 HP, arrival changes the battlefield (reveal, fear pulse, return the fallen).
- **Portals**: telegraph, open, capacity and cooldown, Reserve Points, queued units held when blocked, half refund on destruction, two-action capture by specialists, no opening in enemy zone of control.
- **Objectives**: eleven composable objective types, evaluated per side every End Phase.
- **Victory**: three universal win conditions apply to every battle underneath any scenario objectives — Wipeout (a side with no living units), Army Leader Killed (a scenario-designated leader's death, independent of Doctrine succession), and Surrender (a side's command structure fully collapsed and its remaining morale too low to fight on, or an explicit `surrender()` decision).
- **Turn machine**: Command → alternating Activation (2 AP per unit) → Objective → End, seeded RNG, serializable event log for save, replay and tests.
- **AI**: goal-oriented utility scoring (objective urgency, kill potential, formation gain or loss, isolation risk, commander caution), terrain-seeking movement toward trenches and high ground, siege pieces that hold off outside their own minimum range and set up rather than advance, cavalry that routes to a flank or rear hex instead of the front arc, a release policy that holds for synchronization until instability forces a decision, a surrender policy for a side that is both leaderless and morale-broken, and difficulty profiles that change risk and planning depth only.
- **Scenario**: `Threefold Invocation` fully data-defined and playable start to finish. Scenarios can also run on a
  generated field: `data/scenarios/ashfall_crossing.json` pins objectives, rituals and portals by role (deployment
  anchor, a point between two positions, a ring around one) instead of fixed coordinates, so the same file plays
  out on a different, still-legal battlefield every seed. See `docs/mechanics.md`.
- **A full match**: `runMatch` takes two decks, generates a field, deploys legal armies, plays every round with a card-playing AI and pays spoils into the holdings. Deterministic per seed. See `core/src/match.ts`.
- **Save and load**: `core/src/save.ts` round-trips a battle mid-match and a holding, with a version gate.
- **Replay**: `core/src/replay.ts` steps a cursor through a battle's event log one entry at a time (or jumps
  straight to an index or a round) and narrates each entry by unit name rather than raw id, so a saved or
  finished match can be read back move by move.

- **Save and load**: `core/src/save.ts` round-trips a battle mid-match and a holding, with a version gate, including the per-round effect flags (duels, orders, hidden strikes, rout immunity, timed terrain) that live outside the `Battle` object.
- **Cards and decks**: a 100-card main deck and a 20-card ritual/fusion side deck, with a 1-to-10 star scale that sets tribute cost, copy limits and ritual requirements. See `docs/cards-and-kingdom.md`.
- **The holding**: a permanent base with eleven buildings, a twelve-node research tree and three recruitment banners with pity. Everything it grants reaches the battlefield as a named, source-tracked modifier.
- **Campaign map**: a province of regions (`data/campaign/`), each with its own biome bias and neighbors. A side can only contest ground bordering territory it already holds, fighting for a region is an ordinary generated-field match, and a held region pays its owner named, source-tracked resources per hour into the holding. See `docs/cards-and-kingdom.md`.
- **Weather and time of day**: rolled once per battle from the match seed (`data/rules/weather.json`). Rain floods the Open ground beside Water and Fords into Mud for the rest of the fight; Fog cuts every ranged unit's attack range by one hex; Night is a named, source-tracked −25 ATK on ranged attacks. See `docs/mechanics.md`.

- **Reforging**: spend several copies of a card for one copy of a same-faction card one star above it, so a duplicate that has nowhere left to go in a deck still has somewhere to go in the collection.
- **Irregular battlefields**: seeded generator (`core/src/mapgen.ts`) carves an odd-shaped playable mask from a canvas, layers elevation into mountain ranges, high ground, open ground and valley floors, runs a river downhill with fords, digs trenches in front of each army, lays a road, gathers mud in low wet ground, and places ruins and fortifications. Fourteen terrain types with a data table for movement cost by foot, cavalry and flying, defence, concealment, sight and charge-breaking.

- **Irregular battlefields**: seeded generator (`core/src/mapgen.ts`) carves an odd-shaped playable mask from a canvas, layers elevation into mountain ranges, high ground, open ground and valley floors, runs a river downhill with fords, digs trenches in front of each army, lays a road, gathers mud in low wet ground, and places ruins and fortifications. Fourteen terrain types with a data table for movement cost by foot, cavalry and flying, defence, concealment, sight and charge-breaking. `deploymentBalance` scores how much harder one anchor's own approach ground is to cross than the other's and re-rolls until the two sides are within 10%.

- **Irregular battlefields**: seeded generator (`core/src/mapgen.ts`) carves an odd-shaped playable mask from a canvas, layers elevation into mountain ranges, high ground, open ground and valley floors, runs a river downhill with fords, digs trenches in front of each army, lays a road, gathers mud in low wet ground, and places ruins and fortifications. Fourteen terrain types with a data table for movement cost by foot, cavalry and flying, defence, concealment, sight and charge-breaking. Three named biomes (`data/biomes/biomes.json`) preset the generator's knobs into recognisable regions: Ashfall (dry, ruined highland), Marsh (wet, mud-heavy lowland) and Highland Pass (a narrow, mountain-locked corridor).

- **Scenario authoring on generated ground** (`core/src/placement.ts`): a scenario can pin its rituals, portals, deploy hexes and hold/escort objectives to a role on the generated field (an anchor, a deployment zone, the midpoint, a trench, the ruins, a fortification, a ford, the road) instead of a fixed hex, with a fallback to the midpoint when a role's feature did not generate on a given seed. See `data/scenarios/contested_ford.json`.
- **Universal win conditions**: wipe out the opponent, kill their army leader, or force a surrender. Scenario objectives layer on top.
- **Shinobi ranks**: Apprentice, Genin, Chunin, Jounin, Anbu, Kage, each with a movement trait (canopy movement through forest, hide on stopping in forest, ignore zones of control, pass allies, bonus movement, Shadow Step). See `docs/shinobi-ranks.md`.
- **Fusion**: recipe-driven merging of adjacent units into one (Paired Line, Gate Wardens, Twinwing Drake, and the Calamity Form from the three Sovereigns), paid with Fusion charges.
- **Siege and cavalry**: cannons per faction with set-up, minimum range and breaching shots (plus smoke shells and the Siegewyrm's concussive blast); cavalry per faction with lance charges that break in rough ground, and hit-and-fade riders.
- **Faction rank ladders**: every host faction has one now. Samurai (nineteen ranks, Koyakunin to Shogun) drives two-sword reaction bonuses, mounted movement, command radius, banner morale and castle defense; Shinobi (six) escalates movement traits up to Shadow Step; Knight (eight) adds surefoot, mud-proof marching; Dragon Host (seven) adds climber for its ground-bound wyrm-kin; Ritual Cult (four) adds waterwalk. All drive who may lead a platoon, company or army. See `docs/rank-ladders.md`.

- **Siege and cavalry**: cannons with set-up, minimum range and breaching shots (plus smoke shells and the Siegewyrm's concussive blast); cavalry with lance charges that break in rough ground, and hit-and-fade riders. The four host armies and the five sworn companies each field a themed pair; Ritual Cult and the seven divisions do not yet.
- **Faction rank ladders**: the Samurai ladder (nineteen ranks, Koyakunin to Shogun) drives two-sword reaction bonuses, mounted movement, command radius, banner morale, castle defense and who may lead a platoon, company or army. See `docs/samurai-ranks.md`.
- **The wanted board**: rotating warrants that pay in cards and bounty for a target taken alive rather than killed, either broken to a quarter health or cornered by two or more units. See `docs/cards-and-kingdom.md`.
- **Marching between battles**: continuous, seconds-based movement over the same generated hexes the battle fights on, squads at their slowest member's pace, routed around anything a straight line cannot cross, capped at 45 seconds. See `core/src/march.ts`.

## Content generation

`tools/content` holds the rosters as compact authored rows; `npm run gen:content` expands them
into `data/units/expansion.json` and `data/abilities/expansion.json` through one stat model, so
hundreds of units stay reviewable and the curves stay consistent. The hand-authored core roster in
`units.json` is never rewritten — the registry merges both files.

- **Faction rank ladders**: the Samurai ladder (nineteen ranks, Koyakunin to Shogun) drives two-sword reaction bonuses, mounted movement, command radius, banner morale, castle defense and who may lead a platoon, company or army. The Knight ladder (fourteen ranks, Page to King) reuses that same engine and adds a lance-charge ATK bonus of its own. See `docs/samurai-ranks.md` and `docs/knight-ranks.md`; Dragon Host and Ritual Cult ladders are next.

- **Faction rank ladders**: the Samurai ladder (nineteen ranks, Koyakunin to Shogun) drives two-sword reaction bonuses, mounted movement, command radius, banner morale, castle defense and who may lead a platoon, company or army. See `docs/samurai-ranks.md`. The Dragon Host ladder (nine ranks, Hatchling to Elder Sovereign) reuses those same privileges and adds its own: wing dive, an ATK bonus keyed to altitude lost this activation rather than hexes moved. See `docs/dragon-ranks.md`. The Ritual Cult ladder (five ranks, Affiliated to Grand Ritualist) grants no leadership privilege at all — specialist teams cannot unlock a commander or elite — and instead keys rank to ritual mastery: a Progress bonus and a higher instability ceiling on a held ritual. See `docs/ritual-ranks.md`.

- **Faction rank ladders**: the Samurai ladder (nineteen ranks, Koyakunin to Shogun) drives two-sword reaction bonuses, mounted movement, command radius, banner morale, castle defense and who may lead a platoon, company or army. Shinobi ranks carry the movement traits above. See `docs/samurai-ranks.md`.
- **Card ownership and the wanted board**: a deck may only run the copies a holding actually owns, opened by a starter box into a legal hundred; a rotating board of warrants up to seven stars pays subdued (not killed) targets into the collection. See `docs/cards-and-kingdom.md`.
- **Card skills**: every card at four stars and above carries one usable ability, drawn from six data-defined kinds, enforced by a registry-wide test so the roster cannot grow a silent card. See `docs/mechanics.md`.
- **Sworn companies and themed divisions**: five sworn companies (Cobalt Conclave, Thorn Coven, Cutpurse Court, Windmarch Host, Dunewake Compact) and seven themed divisions (angels, demons, chaos riders, demigods, wendigo-kin, sasquatch, ant-creature myrmidons) add 48 painted cards beyond the four host armies.
- **Marching**: continuous, seconds-based movement over the same hexes and terrain costs the battle fights on — a straight line where one is clear, an A* route pulled to a few waypoints where it is not, squads that hold formation slots around a leader, capped at 45 seconds for the longest crossing. See `docs/mechanics.md` and `core/src/march.ts`.
- **Asset integrity**: `scripts/audit-cutouts.py` fails a cutout that kept its background or lost its figure, so a card cannot ship as a blank slab.

- **Victory**: three universal win conditions layered on top of scenario objectives — wipeout, a named army
  leader killed, or a forced surrender (command structure gone and average morale collapsed) — any of which can
  end a match before its round limit.
- **Turn machine**: Command → alternating Activation (2 AP per unit) → Objective → End, seeded RNG, serializable event log for save, replay and tests.
- **AI**: goal-oriented utility scoring (objective urgency, kill potential, formation gain or loss, isolation risk, commander caution), terrain-aware positioning (ranged units hold their stand-off ring and favor High Ground, Cavalry routes for a flank or rear attack), a surrender policy for a lost fight, a release policy that holds for synchronization until instability forces a decision, and difficulty profiles that change risk and planning depth only.
- **Scenario**: `Threefold Invocation` fully data-defined and playable start to finish.

- **Marching**: a continuous, real-time layer over the same ground the hex rules fight on. A dragged order walks a squad at its slowest member's pace, forming up in ring slots around the leader; a straight line is routed over the hex grid and pulled tight into a few waypoints wherever it is blocked, and every walk is capped at 45 seconds scaled by distance. Deterministic: no clock, no randomness, same field and orders land on the same positions. See `core/src/march.ts`.
- **Wanted board**: rotating warrants up to seven stars, weighted toward whatever the holding is actually short of; a subdue-not-kill capture in battle pays the writ and the copy into the collection instead of the kill.

## Engine note

The brief targets Unity with C#. No .NET toolchain is available in this environment, so the rules are implemented
once in TypeScript as the executable specification. The port is mechanical: each module in `core/src` maps to one
`Assets/Scripts/*` folder in the brief's project structure, the JSON in `data/` loads unchanged, and the Vitest suite
defines the expected numbers for the C# tests. See `docs/mechanics.md` for the module map.

## Art

The approved direction and the full round-by-round history are in `docs/art-pipeline.md`. Prompts live in
`art/prompts/`. Sample sprites live in `art/samples/` under the naming convention
`[FACTION]_[ROLE]_[UNIT-NAME]_[ASSET-TYPE]_[VERSION]`.
