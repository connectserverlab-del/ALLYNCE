# Running checklist

The single source of truth for what is left to build, and the queue the hourly implementation pass works from.
Every item has a stable id. **One pass takes one item.**

## How a pass claims an item without colliding with another pass

Passes run in fresh sessions and cannot see each other, so claiming happens through GitHub, which they can all read:

1. List open pull requests and remote branches matching `agent/*`.
2. An item is **claimed** if its id appears in an open PR title, an open PR body, or a branch name. Treat claimed
   items as taken even if the PR is a draft.
3. Take the highest unclaimed item that is not blocked on an owner decision.
4. Name the branch `agent/<yyyy-mm-dd>-<ITEM-ID>` and put the item id in the PR title. That is what makes the
   claim visible to the next pass.
5. When the work merges, move the item to Done in this file in the same PR.

If every item is claimed or blocked, do not invent work: improve tests, tighten docs, or sharpen the AI, and say
so in the PR.

## Blocked on an owner decision

| Id | Item | Waiting on |
|---|---|---|
| `OWN-1` | Scale the remaining building tier art (25 paintings) | Confirmation that building portraits stay at a low angle rather than strictly top-down |
| `OWN-2` | Raise the deck faction minimum from 40 toward 60 | Needs 15-20 distinct cards per faction. The roster is now 88 cards across 18 factions, but the four host armies still hold only 8-9 each, so the minimum stays at 40 |

## Queue

| Id | Item | Why it matters |
|---|---|---|
| `Q-1` | Second art pass on weak cutouts: any unit whose card still reads "no art yet", plus re-cuts where the flood fill left a panel edge | Blank cards are the most visible gap in the game |
| `Q-2` | Scenario authoring on top of generated ground: let a scenario pin objectives, rituals and portals to a generated field by role rather than by fixed coordinates | Scenarios currently hard-code hexes, which breaks on a regenerated map |
| `Q-3` | AI: use trenches and high ground, position siege behind the line, route cavalry to flanks, surrender when the leader is dead and morale is broken | The AI ignores the terrain rules the player must respect |
| `Q-4` | Deck editor in the sample page: move cards between main and side deck with live legality | Deck building is the core loop and is currently read-only |
| `Q-5` | Campaign map: regions on the province map, each a scenario; a won region feeds the holding's production | Connects the battle layer to the holding layer |
| `Q-6` | Weather and time of day as round modifiers (rain turns open ground to mud near rivers, fog cuts ranged range) | Deepens the terrain system already in place |
| `Q-7` | Duplicate-card reforge: spend copies to raise a card's star by one | Duplicates now arrive from warrants as well as recruitment and need a sink beyond deck depth |
| `Q-8` | Stratagem cards as a third side-deck kind, one-round battlefield effects | Fills out the side deck beyond ritual and fusion |
| `Q-9` | Unity port scaffolding: ScriptableObject importer for `data/`, and the C# module skeleton in `docs/mechanics.md` | The engine target the brief names |
| `Q-10` | Replay viewer: step through a saved event log | The event log already exists and is unused |
| `Q-11` | Warrant board screen in the sample page: read the posted writs, take one, and see which of them close the gaps in the current deck | The board exists in the core and has no interface |
| `Q-12` | Give the sworn companies and the seven divisions depth: each has four cards, enough to hire but not to lead | A division is a flavour of ally until it can field a line of its own |
| `Q-13` | Escort composition for warrants: build the escort around the target's own company rather than a generic host starter deck | The escort currently reads as a borrowed army with the target bolted on |
| `Q-14` | Teach the AI to spend the six card skills: buff before a charge, debuff before a defence, clone when outnumbered | Every 4-star card carries a skill and the AI only reaches for clones, charges and duels |
| `Q-15` | A division's own doctrine and platoon order, so a Choir or a Swarm can lead a deck instead of only joining one | Seven divisions is a lot of flavour with no army identity behind it |

## Done

| Id | Item |
|---|---|
| `D-1` | Rules engine: hex grid, terrain table, modifier pipeline, cohesion, doctrine, succession, combat, morale, effects, clones |
| `D-2` | Rituals with hold, instability and synchronised release; Divine Entities with anchors |
| `D-3` | Reinforcement portals; eleven composable objective types |
| `D-4` | Samurai rank ladder (19 ranks) and Shinobi rank ladder (6 ranks with movement traits) |
| `D-5` | Irregular battlefield generator: mountains, valleys, rivers, fords, trenches, mud, roads, ruins |
| `D-6` | Three universal win conditions: wipeout, army leader killed, surrender |
| `D-7` | Fusion; siege pieces and cavalry for all four factions |
| `D-8` | Card system: 100-card main deck, 20-card side deck, stars 1-10, tribute and ritual and fusion summoning |
| `D-9` | The holding: buildings, research tree, recruitment banners, carry-over as named modifiers |
| `D-10` | Field scale to ~950 hexes, zoom camera, minimap; mountains at 5x cost with the labored climb |
| `D-11` | Building tier bands with art fallback; regenerable asset registry |
| `D-12` | Paper card stock and the painted star asset |
| `D-13` | Full match runner, card-playing AI, spoils paid into the holding, save and load |
| `D-14` | Unit art for all 40 cards |
| `D-15` | Five sworn companies: Cobalt Conclave mages, Thorn Coven hexers, Cutpurse Court rogues, Windmarch Host steppe archers, Dunewake Compact caravaneers — 20 cards, painted |
| `D-16` | Card ownership: a deck may only run the copies the holding actually owns, with a starter box that opens a legal hundred |
| `D-17` | Wanted board: rotating warrants up to 7 stars, subdue-not-kill capture, copies paid into the collection |
| `D-18` | Seven themed divisions: angels, demons, chaos riders, demigods, wendigo-kin, sasquatch, ant creatures with humanoid myrmidons — 28 cards, painted |
| `D-19` | A usable skill on every card at four stars and above: six kinds, all data-defined, enforced by a registry-wide test |
| `D-20` | Card face: name across the top band, ATK and DEF in dark ink on the paper, copy badge moved to the foot |
