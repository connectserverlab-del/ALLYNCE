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
npm run web         # serves the playable client at http://localhost:5173/web/index.html
npm test            # 48 tests: combat math, cohesion, composition, succession, clones, rituals, portals, roster, scenario
npm run test:ui     # headless browser checks on the client (card layout, village, deck, battle)
npm run gen:content # regenerates data/units/expansion.json from tools/content
npm run sim:demo    # runs Threefold Invocation with AI on both sides and prints the round log
npm run typecheck
```

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
- **Combat**: `max(100, ATK − DEF)`, flank −10% / rear −25% DEF, Defend +150, Fortification +200, high ground for ranged, Oath of Intercession, Formal Duel lockout, reaction attacks, Overwatch, Disengage.
- **Morale**: 0–100 with Steady / Shaken / Disordered / Routed / Broken bands, all brief-listed loss and recovery sources, AI-controlled routed retreat.
- **Effects framework**: one data-driven interpreter for orders, passives, succession, clones, charges, terrain spawns and status grants. Twin Echo is the reference clone implementation (two clones, 1 HP, 40% ATK, no cohesion, no composition, expire after two rounds).
- **Rituals**: four ratings per ritualist, explicit progress formula, seven states, Held rituals gain Unstable stacks that damage participants and amplify disruption, synchronized release only when every linked circle releases in the same Objective Phase, weakened summons otherwise.
- **Divine Entities**: summon-only, one copy per battle, Manifestation and Anchors, stagger at 0 HP, arrival changes the battlefield (reveal, fear pulse, return the fallen).
- **Portals**: telegraph, open, capacity and cooldown, Reserve Points, queued units held when blocked, half refund on destruction, two-action capture by specialists, no opening in enemy zone of control.
- **Objectives**: eleven composable objective types, evaluated per side every End Phase.
- **Turn machine**: Command → alternating Activation (2 AP per unit) → Objective → End, seeded RNG, serializable event log for save, replay and tests.
- **AI**: goal-oriented utility scoring (objective urgency, kill potential, formation gain or loss, isolation risk, commander caution), a release policy that holds for synchronization until instability forces a decision, and difficulty profiles that change risk and planning depth only.
- **Scenario**: `Threefold Invocation` fully data-defined and playable start to finish.

## Content generation

`tools/content` holds the rosters as compact authored rows; `npm run gen:content` expands them
into `data/units/expansion.json` and `data/abilities/expansion.json` through one stat model, so
hundreds of units stay reviewable and the curves stay consistent. The hand-authored core roster in
`units.json` is never rewritten — the registry merges both files.

## Engine note

The brief targets Unity with C#. No .NET toolchain is available in this environment, so the rules are implemented
once in TypeScript as the executable specification. The port is mechanical: each module in `core/src` maps to one
`Assets/Scripts/*` folder in the brief's project structure, the JSON in `data/` loads unchanged, and the Vitest suite
defines the expected numbers for the C# tests. See `docs/mechanics.md` for the module map.

## Art

The approved direction and the full round-by-round history are in `docs/art-pipeline.md`. Prompts live in
`art/prompts/`. Sample sprites live in `art/samples/` under the naming convention
`[FACTION]_[ROLE]_[UNIT-NAME]_[ASSET-TYPE]_[VERSION]`.
