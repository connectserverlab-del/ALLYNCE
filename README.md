# ALLYNCE — original tactical army strategy game

Data-first vertical slice for an original, PC-first tactical war game: platoons of eight, commanders with
second-in-command succession, theme cohesion, rituals that can be held and synchronized, reinforcement portals,
dragon cavalry raids, and objective-based victory. Everything is original: names, units, symbols, lore and art.

This repository currently holds three things:

| Area | Path | What it is |
|---|---|---|
| Game data | `data/` | JSON tables for units, abilities, factions, composition rules and scenarios. Engine-agnostic; the Unity build imports these directly. |
| Rules engine | `core/` | TypeScript reference implementation of every mechanic in the engineering brief, with a deterministic event log and a test suite that doubles as the acceptance spec for the C# port. |
| Art pipeline | `art/`, `docs/art-pipeline.md` | Approved style direction, prompt library, sample sprites, rejected rounds and why, asset manifest and naming convention. |

## Quick start

```bash
npm install
npm test            # 117 tests: combat math, cohesion, composition, succession, clones, rituals, portals, scenarios, campaign, weather
npm run sim:demo    # runs Threefold Invocation with AI on both sides and prints the round log
npm run typecheck
npm run assets      # rebuilds the asset registry from the data and from disk
```

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
- **AI**: goal-oriented utility scoring (objective urgency, kill potential, formation gain or loss, isolation risk, commander caution), terrain-seeking movement toward trenches and high ground, siege pieces that hold off outside their own minimum range and set up rather than advance, cavalry that routes to a flank or rear hex instead of the front arc, a release policy that holds for synchronization until instability forces a decision, a surrender policy for a side that is both leaderless and morale-broken, and difficulty profiles that change risk and planning depth only.
- **Scenario**: `Threefold Invocation` fully data-defined and playable start to finish. Scenarios can also run on a
  generated field: `data/scenarios/ashfall_crossing.json` pins objectives, rituals and portals by role (deployment
  anchor, a point between two positions, a ring around one) instead of fixed coordinates, so the same file plays
  out on a different, still-legal battlefield every seed. See `docs/mechanics.md`.
- **A full match**: `runMatch` takes two decks, generates a field, deploys legal armies, plays every round with a card-playing AI and pays spoils into the holdings. Deterministic per seed. See `core/src/match.ts`.
- **Save and load**: `core/src/save.ts` round-trips a battle mid-match and a holding, with a version gate.
- **Cards and decks**: a 100-card main deck and a 20-card ritual/fusion side deck, with a 1-to-10 star scale that sets tribute cost, copy limits and ritual requirements. See `docs/cards-and-kingdom.md`.
- **The holding**: a permanent base with eleven buildings, a twelve-node research tree and three recruitment banners with pity. Everything it grants reaches the battlefield as a named, source-tracked modifier.
- **Campaign map**: a province of regions (`data/campaign/`), each with its own biome bias and neighbors. A side can only contest ground bordering territory it already holds, fighting for a region is an ordinary generated-field match, and a held region pays its owner named, source-tracked resources per hour into the holding. See `docs/cards-and-kingdom.md`.
- **Weather and time of day**: rolled once per battle from the match seed (`data/rules/weather.json`). Rain floods the Open ground beside Water and Fords into Mud for the rest of the fight; Fog cuts every ranged unit's attack range by one hex; Night is a named, source-tracked −25 ATK on ranged attacks. See `docs/mechanics.md`.
- **Irregular battlefields**: seeded generator (`core/src/mapgen.ts`) carves an odd-shaped playable mask from a canvas, layers elevation into mountain ranges, high ground, open ground and valley floors, runs a river downhill with fords, digs trenches in front of each army, lays a road, gathers mud in low wet ground, and places ruins and fortifications. Fourteen terrain types with a data table for movement cost by foot, cavalry and flying, defence, concealment, sight and charge-breaking.
- **Universal win conditions**: wipe out the opponent, kill their army leader, or force a surrender. Scenario objectives layer on top.
- **Shinobi ranks**: Apprentice, Genin, Chunin, Jounin, Anbu, Kage, each with a movement trait (canopy movement through forest, hide on stopping in forest, ignore zones of control, pass allies, bonus movement, Shadow Step).
- **Fusion**: recipe-driven merging of adjacent units into one (Paired Line, Gate Wardens, Twinwing Drake, and the Calamity Form from the three Sovereigns), paid with Fusion charges.
- **Siege and cavalry**: cannons per faction with set-up, minimum range and breaching shots (plus smoke shells and the Siegewyrm's concussive blast); cavalry per faction with lance charges that break in rough ground, and hit-and-fade riders.
- **Faction rank ladders**: the Samurai ladder (nineteen ranks, Koyakunin to Shogun) drives two-sword reaction bonuses, mounted movement, command radius, banner morale, castle defense and who may lead a platoon, company or army. See `docs/samurai-ranks.md`.

## Engine note

The brief targets Unity with C#. No .NET toolchain is available in this environment, so the rules are implemented
once in TypeScript as the executable specification. The port is mechanical: each module in `core/src` maps to one
`Assets/Scripts/*` folder in the brief's project structure, the JSON in `data/` loads unchanged, and the Vitest suite
defines the expected numbers for the C# tests. See `docs/mechanics.md` for the module map.

## Art

The approved direction and the full round-by-round history are in `docs/art-pipeline.md`. Prompts live in
`art/prompts/`. Sample sprites live in `art/samples/` under the naming convention
`[FACTION]_[ROLE]_[UNIT-NAME]_[ASSET-TYPE]_[VERSION]`.
