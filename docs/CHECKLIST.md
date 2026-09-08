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

## Running two passes at once

Two passes can share a branch safely if, and only if, they are given **disjoint file sets** rather than
disjoint topics — topics overlap, file lists do not. Name the files each pass may touch and say that
everything else is off limits for any reason.

Three things bite:

- **`docs/samples/ashfall-hold.html` is generated and about 8 MB.** Any two passes that both run
  `node scripts/build-sample.mjs` conflict on it and the conflict cannot be read. Exactly one pass rebuilds
  it, last, after the merge.
- **Shared helpers.** A pass barred from a file will reimplement what it needs from it. That is the right
  call under the rule, but the owner of that file should export the helper and delete the copy on merge,
  or the two definitions drift apart in silence.
- **`docs/CHECKLIST.md` is the one file everything wants.** Keep it with the merging pass; the other reports
  its checklist moves in prose and the merging pass makes them.

## Blocked on an owner decision

| Id | Item | Waiting on |
|---|---|---|
| `OWN-1` | Scale the remaining building tier art (25 paintings) | Confirmation that building portraits stay at a low angle rather than strictly top-down |
| `OWN-2` | Raise the deck faction minimum from 40 toward 60 | Needs 15-20 distinct cards per faction. The roster is now 60 cards across 11 factions, but the four host armies still hold only 8-9 each, so the minimum stays at 40 |
| `OWN-3` | Let a side's designated army leader pass to a successor (update `leaderUid` in `resolveSuccession`), and delay the "army leader killed" win check until Continuity's succession attempt has actually run, instead of ending the match at the End Phase of the same round the leader fell | Changes when a match can end and how much the succession/Continuity system actually protects an army; also decides whether the new AI surrender policy (`Q-3`) ever gets a chance to fire in a standard match, since it is currently always shadowed by the instant leader-killed check |

## Queue

| Id | Item | Why it matters |
|---|---|---|
| `Q-1` | Second art pass on weak cutouts: any unit whose card still reads "no art yet", plus re-cuts where the flood fill left a panel edge | Blank cards are the most visible gap in the game |
| `Q-9` | Unity port scaffolding: ScriptableObject importer for `data/`, and the C# module skeleton in `docs/mechanics.md` | The engine target the brief names |
| `Q-10` | Replay viewer: step through a saved event log | The event log already exists and is unused |
| `Q-11` | Warrant board screen in the sample page: read the posted writs, take one, and see which of them close the gaps in the current deck | The board exists in the core and has no interface |
| `Q-12` | Give the five sworn companies depth: each has four cards, enough to hire but not to lead | A company is a flavour of ally until it can field a line of its own |
| `Q-13` | Escort composition for warrants: build the escort around the target's own company rather than a generic host starter deck | The escort currently reads as a borrowed army with the target bolted on |
| `Q-15` | A division's own doctrine and platoon order, so a Choir or a Swarm can lead a deck instead of only joining one | Seven divisions is a lot of flavour with no army identity behind it |
| `Q-16` | Teach the AI that splitting is a trade, not a gain: split to hold ground or bait, never against a single hard hitter, and hunt enemy copies to shrink the original | Cloning now costs the caster real weight and the AI still treats it as free presence |

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
| `D-18` | Scenario authoring on generated ground: position roles (anchor, deployZone, lerp, near, ritualCenter) so a scenario's objectives, rituals and portals pin to a generated field instead of fixed coordinates; `data/scenarios/ashfall_crossing.json` as the reference scenario |
| `D-19` | AI: seeks trenches and high ground when moving, keeps siege pieces out of their own minimum range and sets them up once in their firing band, routes cavalry to a flank or rear hex instead of the front arc, and surrenders once a side is both leaderless (Doctrine `"None"`) and morale-broken |
| `D-20` | Campaign map: regions on a province graph, each with its own biome bias and neighbors; a side may only contest ground bordering territory it already holds, fighting for a region is an ordinary generated-field match, and a held region pays its owner named, source-tracked resources per hour into the holding |
| `D-21` | Seven themed divisions: angels, demons, chaos riders, demigods, wendigo-kin, sasquatch, ant creatures with humanoid myrmidons — 28 cards, painted |
| `D-22` | A usable skill on every card at four stars and above: six kinds, all data-defined, enforced by a registry-wide test |
| `D-23` | Card face: name across the top band, ATK and DEF in dark ink on the paper, copy badge moved to the foot |
| `D-24` | Cloning splits attack and defence across the original and its copies instead of duplicating them, and the original reclaims each share as a copy falls |
| `D-25` | AI spends the six card skills on their own terms, fights the ground it stands on (terrain, elevation, siege screening, cavalry flanking) and yields a lost field |
| `D-26` | Marching: continuous movement in seconds, squads with formation slots, a 45-second cap scaled by distance, and hex routing round anything a straight line cannot cross |
| `D-27` | March screen: click the ground to send a squad, drag a name onto a squad to have that unit walk over and fall in, with the real engine bundled into the page rather than a recording of it |
| `D-28` | `scripts/audit-cutouts.py` fails a cutout that kept its background or lost its figure, so a card cannot ship as a pale slab again |
| `D-29` | Deck editor in the sample page: every card that could ever sleeve, browsable and editable card by card in both the main and side deck, with a live legality panel that mirrors `validateDeck` |
| `D-30` | Weather and time of day as round modifiers: rolled once per battle from the seed; Rain turns Open ground beside Water and Fords to Mud, Fog cuts ranged range by one hex (AI, siege stand-off and portal attacks all read the same effective range), Night is a named −25 ATK on ranged attacks |
| `D-31` | Knight (8 ranks), Dragon Host (7 ranks) and Ritual Cult (4 ranks) rank ladders, each escalating one mechanical trait per rank (surefoot, climber, waterwalk respectively), matching the Samurai and Shinobi ladders already in place |
| `D-32` | Duplicate-card reforge: spend several copies of a card for one copy of a same-faction card one star above it |
| `D-33` | Stratagem cards as a third side-deck kind: Forced March, Smokescreen and False Retreat, each a one-round effect on a targeted platoon or hex, validated and spent through `checkStratagem`/`playStratagem` |
