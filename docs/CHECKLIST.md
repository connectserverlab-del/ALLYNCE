# Running checklist

The single source of truth for what is left to build, and the queue the hourly implementation pass works from.
Every item has a stable id. **One pass takes one item.**

## All work goes through one branch (2026-09-08)

An earlier pass diagnosed the real bottleneck correctly: the queue was never gridlocked, but none of the
~85 open pull requests had merged, so `main` stayed frozen at its first commit and every hour added another
branch. Passes that checked out `main` saw a nearly-empty project — `main` has no `docs/AGENT_BRIEF.md` — and
reimplemented finished features from scratch. `Q-2` was built four separate times that way; the three
universal win conditions three times; the rank ladders twice.

That is resolved. All eighty-five branches are merged into **`claude/merge-85-prs-ec3ca0`, pull request #88**,
and that branch is now where work happens.

**Every pass branches from, and pushes to, `claude/merge-85-prs-ec3ca0`. No pass opens a new pull request.**
See `docs/AGENT_BRIEF.md` for the mechanics. Consolidating those branches cost more than the features in them
did, and the duplication was not carelessness — it was the predictable result of parallel passes that could
not see each other's work. One branch removes the cause.

## How a pass claims an item without colliding with another pass

Passes run in fresh sessions and cannot see each other, so claiming happens through what they can all read:
the integration branch's commit log, and open pull requests.

1. Fetch `claude/merge-85-prs-ec3ca0` and read its recent commit subjects.
2. An item is **claimed** if its id appears in a commit subject on that branch, or in an open pull request
   title or body. Treat claimed items as taken even if the pull request is a draft.
3. Take the highest unclaimed item that is not blocked on an owner decision.
4. Put the item id in your commit subject. On a shared branch that is what makes the claim visible.
5. Move the item to Done in this file in the same commit.
6. Pull before you push (`git pull --rebase=false origin claude/merge-85-prs-ec3ca0`) so a concurrent pass is
   merged rather than clobbered. Never force-push the integration branch.

If every item is claimed or blocked, do not invent work: improve tests, tighten docs, or sharpen the AI, and say
so in the commit.

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
| `OWN-2` | Raise the deck faction minimum from 40 toward 60 | Needs 15-20 distinct cards per faction. The roster is now 88 cards across 18 factions, but the four host armies still hold only 8-9 each, so the minimum stays at 40 |
| `OWN-3` | Let a side's designated army leader pass to a successor (update `leaderUid` in `resolveSuccession`), and delay the "army leader killed" win check until Continuity's succession attempt has actually run, instead of ending the match at the End Phase of the same round the leader fell | Changes when a match can end and how much the succession/Continuity system actually protects an army; also decides whether the new AI surrender policy (`Q-3`) ever gets a chance to fire in a standard match, since it is currently always shadowed by the instant leader-killed check |
| `OWN-3` | Let the five sworn companies (Cobalt Conclave, Thorn Coven, Cutpurse Court, Windmarch Host, Dunewake Compact) field a full platoon of their own, the way three divisions now can (see D-26) | Each company's `weakness` text in `data/factions/factions.json` names this directly as the point ("Sworn company, not an army: cannot lead a host of its own" and similar). Giving them the cards to do it anyway is a lore change, not a data fix, and needs a call on whether that weakness still stands. Chaos Warband (`CHR`) is a second case: its own text puns on the gap ("no line, no discipline, no second plan" — it has no card that can fill the Second slot at all) and reads as deliberate rather than missing |
| `OWN-4` | Which client is the product: the Unity port scaffold under `unity/`, or the web client as the shipping surface | Decides where every item from `Q-28` onward is built, and whether `unity/` gets real investment or is retired. The TypeScript core stays the rules authority either way. Art at volume (`Q-17`) should wait on this, since the target client sets the resolution and format |
| `OWN-5` | Multiplayer shape and budget: peer-to-peer lockstep, or an authoritative server with hosting to pay for; ranked or friendlies; which platforms play together | `Q-19` to `Q-24` build the foundation both need, so they are not blocked. The transport, matchmaking and anti-cheat work after them is a cost decision, not a technical one |
| `OWN-6` | Audio direction: one sampled scene (a charge, a ritual release, a rout) approved before any cue table is filled in | The samples-first rule the owner set for art applies here too. `Q-28` builds the bus and can land without it; the cues themselves wait |

## Queue

The target is now a AAA game for PC and console with multiplayer (see `docs/ROADMAP.md`). These items are
ordered so each one is completable in a single pass, lands behind the invariants already in place, and moves
one of the roadmap's five pillars forward. An item that serves no pillar does not belong here.

Netcode comes first not because multiplayer ships first, but because the shape it demands — commands as data,
a hashable per-round state, no hidden mutation — is far cheaper to build into the engine now than to retrofit
around a year of content. The engine is already deterministic and already logs every event; `Q-19` to `Q-24`
are about making that guarantee provable and remote-playable rather than incidental.

| Id | Item | Why it matters |
|---|---|---|
| `Q-19` | Determinism harness: a test that runs one scripted match twice from the same seed and asserts the two event logs hash identically, and a second that asserts two different seeds diverge | Determinism is claimed everywhere and asserted nowhere. Lockstep multiplayer, replays and server validation all rest on it, so it needs to be a test that fails loudly the first time someone reaches for `Math.random()` |
| `Q-20` | Per-round state hash written into the event log (`RoundHash`), covering unit positions, hit points, statuses, morale and side state | The desync detector. Two clients compare one number per round instead of diffing whole battles, and a replay that diverges says exactly which round it broke on |
| `Q-21` | A `Command` type and a command log: every mutating controller entry point (`move`, `attack`, `useAbility`, `channel`, `surrender`, card plays) expressible as a serialisable record, with `applyCommand` as the single funnel | Lockstep sends commands, not state. This is the largest structural item in the queue and the one everything else in the netcode line depends on; take it as its own pass and do not widen it |
| `Q-22` | Rebuild a battle from its command log alone, and assert it reproduces the same event log and round hashes | Proves the command layer is complete — anything still mutating outside `applyCommand` shows up here as a mismatch |
| `Q-23` | Command validation: a pure `isLegal(command, battle)` check the engine runs before applying, so an illegal command is rejected rather than throwing mid-mutation | Server-authoritative play needs to reject a cheating client without the battle already half-changed. It also gives the UI a clean way to grey out an illegal action |
| `Q-24` | Two-client lockstep simulation in tests: two `Battle` instances, one command stream, round-hash comparison each round, and a deliberate desync case that the detector catches | The whole netcode foundation, exercised end to end in-process before any transport exists |
| `Q-25` | Save-version migration framework: a registry of `n -> n+1` migrations, `loadBattle` walking a save forward from any older version, and a fixture save per version in the suite | Save version is already 6 and each bump so far has been "throw on mismatch". A shipped game cannot invalidate a player's campaign on patch day |
| `Q-26` | Round-trip completeness test: one battle exercising the holding, a mid-channel ritual, a queued portal and an in-progress march at once, asserting every computed stat and side-level number is identical across save/load | Proposed in the brainstorm log after `kingdomEffects` was found missing from `BattleSave` entirely. One test across every carry-over system catches the next omission the day it lands |
| `Q-27` | Headless match simulator (`npm run sim:balance`): run N seeded matches across faction pairings and write a win-rate and match-length report to `docs/balance/` | Balance telemetry. With deterministic seeds this is cheap and turns "does the Dragon Host feel strong" into a number a pass can act on |
| `Q-28` | Audio event bus: a data-defined cue table mapping event-log kinds to sound ids, a stub player in the web client, and a test that every event kind has a cue or is explicitly marked silent | The game currently makes no sound at all. Driving audio off the existing event log means the cue table is content, not code, and cannot drift from what actually happens |
| `Q-29` | Gamepad-first input: an input abstraction over the web client with full stick/d-pad/face-button navigation of every screen, and focus state visible without a mouse | Console is a stated target and console means no pointer. Retrofitting gamepad navigation after the UI settles is far more expensive than building the abstraction now |
| `Q-30` | Accessibility pass: colourblind-safe terrain and faction palettes with a contrast test, text scaling, reduced-motion honouring `prefers-reduced-motion`, and full keyboard navigation | A shelf requirement on both target platforms, and cheapest while the client is still small |
| `Q-31` | Settings: a persisted settings model (audio levels, text scale, reduced motion, colourblind palette, input scheme) with a screen in the client and a save-migration path of its own | Every item above needs somewhere for the player to turn it on |
| `Q-32` | Performance budget test: a ~950-hex battle at full unit count with an asserted ceiling on AI activation time and round resolution, failing CI when a change makes the game slower | Frame budget is a shipping requirement. An asserted ceiling turns a gradual slide into a failing test on the commit that caused it |
| `Q-33` | Localisation: extract every player-facing string in the web client and in `data/` to a keyed catalogue, add a pseudo-locale that lengthens and accents every string, and a test that no bare literal reaches a screen | Cheap now, and the pseudo-locale immediately exposes the layouts that break on longer text |
| `Q-34` | Campaign loop: province map, holding and warrant board joined into one persisted progression with a defined start, middle and completion, saved and resumable | The three systems exist separately. Pillar 3 is the loop between them, and it is what makes a player return |
| `Q-35` | Briefing and narrative text as data: a per-scenario and per-region briefing catalogue, localisable, rendered in the client before a battle | A campaign needs a voice. Keeping it in data means it localises for free and does not need an engine change to edit |
| `Q-36` | Tutorial scenario: a scripted opening battle that introduces movement, facing, terrain and one card play, with its own win condition and no way to lose it | Onboarding is where a tactics game loses most of its players |
| `Q-17` | Paint the 295 units listed in `data/art/awaiting-art.json`, emptying it as each lands | The expansion and the sworn-company rosters arrived unpainted; a blank card is the most visible gap in the game. Needs `OWN-4` first |
| `Q-18` | Give the 52 four-star-and-above cards in `data/cards/awaiting-skill.json` a spendable skill | `D-19` says every card at four stars and up carries one; the generated roster predates that rule |

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
| `D-21` | Cloning splits attack and defence across the original and its copies instead of duplicating them, and the original reclaims each share as a copy falls |
| `D-22` | AI spends the six card skills on their own terms, fights the ground it stands on (terrain, elevation, siege screening, cavalry flanking) and yields a lost field |
| `D-23` | Marching: continuous movement in seconds, squads with formation slots, a 45-second cap scaled by distance, and hex routing round anything a straight line cannot cross |
| `D-24` | March screen: click the ground to send a squad, drag a name onto a squad to have that unit walk over and fall in, with the real engine bundled into the page rather than a recording of it |
| `D-25` | `scripts/audit-cutouts.py` fails a cutout that kept its background or lost its figure, so a card cannot ship as a pale slab again |
| `D-26` | Scenario authoring on generated ground: position roles (anchor, deployZone, lerp, near, ritualCenter) so a scenario's objectives, rituals and portals pin to a generated field instead of fixed coordinates; `data/scenarios/ashfall_crossing.json` as the reference scenario |
| `D-27` | AI: seeks trenches and high ground when moving, keeps siege pieces out of their own minimum range and sets them up once in their firing band, routes cavalry to a flank or rear hex instead of the front arc, and surrenders once a side is both leaderless (Doctrine `"None"`) and morale-broken |
| `D-28` | Campaign map: regions on a province graph, each with its own biome bias and neighbors; a side may only contest ground bordering territory it already holds, fighting for a region is an ordinary generated-field match, and a held region pays its owner named, source-tracked resources per hour into the holding |
| `D-29` | Deck editor in the sample page: every card that could ever sleeve, browsable and editable card by card in both the main and side deck, with a live legality panel that mirrors `validateDeck` |
| `D-30` | Weather and time of day as round modifiers: rolled once per battle from the seed; Rain turns Open ground beside Water and Fords to Mud, Fog cuts ranged range by one hex (AI, siege stand-off and portal attacks all read the same effective range), Night is a named −25 ATK on ranged attacks |
| `D-31` | Knight (8 ranks), Dragon Host (7 ranks) and Ritual Cult (4 ranks) rank ladders, each escalating one mechanical trait per rank (surefoot, climber, waterwalk respectively), matching the Samurai and Shinobi ladders already in place |
| `D-32` | Duplicate-card reforge: spend several copies of a card for one copy of a same-faction card one star above it |
| `D-33` | Stratagem cards as a third side-deck kind: Forced March, Smokescreen and False Retreat, each a one-round effect on a targeted platoon or hex, validated and spent through `checkStratagem`/`playStratagem` |
| `D-34` | Escort composition for warrants: a sworn company's target is escorted by its own company, not a borrowed host starter deck |
| `D-35` | AI splitting as a trade: only spawns copies when a crowd of enemies is closing in, never against a single hard hitter, and treats an enemy copy as a hunt-worthy kill that shrinks the original |
| `D-36` | AI now spends all six card skills, not only clones, charges and duels: self and band attack buffs before a swing, haste to close ground its base movement cannot, and area debuffs on whoever is already close enough to hit back |
| `D-37` | Unity port scaffold: `unity/Runtime` and `unity/Editor` C# skeleton matching `docs/mechanics.md`'s guidance, plus a generator (`npm run unity:scaffold`) that mirrors `EFFECT_KINDS` and `TERRAIN_RULES` into checked-in C#, tested against the TypeScript reference so the two cannot silently drift |
| `D-38` | Replay: `core/src/replay.ts` steps a cursor through `Battle.events` by index or round and narrates every event type by unit name; `Q-10` |
| `D-39` | Q-11, found already done: the Wanted Board screen (`Writs` in the sample page rail, `renderWrits`/`openWrit` in `web/sample/template.html`) shipped in the same pass as the wanted-board core (D-17) but was never moved off the queue. Verified against the current data pipeline and left as-is; this entry just corrects the bookkeeping |
| `D-40` | Q-12, the achievable slice: Choir Militant, Ashpit Legion and Winter Famine each gained a second, distinct FootSoldier card sharing its sibling's theme, so a deck built around one can field a real five-foot line instead of one body five times. Winter Famine also had no card able to fill the Second slot at all (two Elites, no Second) and gets one, `WEN_SECOND_RIME-ANTLER-WARDEN`. `core/tests/companies.test.ts` proves each of the three now validates a legal, varied platoon on its own. The other four divisions and all five sworn companies are unchanged — see `OWN-3` |
| `D-41` | Warrant board screen in the sample page: posted writs, what each pays, the escort standing in the way, and the current deck's gaps below it — turned out already built in the card-and-holding pass (`c57816b`), just never checked off. Q-11 removed from the Queue rather than left to be reopened by a future pass. |
| `D-42` | A division's own doctrine and platoon order: the seven themed divisions can now fill Commander, Second, Elite and five foot from their own four cards and carry a faction Order plus a passive Doctrine the way the four host armies do, so a Choir or a Swarm can lead a deck instead of only joining one. Widened `SlotName` on one existing card each for Spiral Warband and Winter Famine (their only Second-eligible member); no new cards, no new art. |
| `D-43` | Writs screen made live: taking and giving back a warrant runs the real `core/src/wanted.ts` in the page (`web/sample/writs-boot.mts`, `scripts/bundle-writs.mjs`), and each posted warrant shows whether it would close or chip at a gap in the current deck (`contractRelief`) |
| `D-44` | Fusion recipes are checked at registry load time like every other cross-reference: a bad input unit, result unit or granted ability now throws at startup instead of failing silently mid-battle or leaving a recipe permanently unreachable |
| `D-45` | `deploymentBalance` in the map generator: rejects a field whose noise happened to hand one anchor's own approach ground more than 10% harder terrain than the other's, re-rolling deterministic derived seeds until it doesn't |
| `D-46` | Second art pass on weak cutouts: all 88 units now carry both a concept and a cutout, and every cutout audits clean (`npm run assets`: 0 missing under "Units"; `python3 scripts/audit-cutouts.py`: 88/88 in band). `core/tests/art.test.ts` now runs the same opacity check on every `npm test`, so the gap this item tracked can't reopen silently. |
| `D-47` | The AI actually reaches for Fusion in a full match: it fuses adjacent, recipe-eligible allies once a fight is close enough to be worth the platoon depth traded away, and only once nothing more urgent (an attack, a move that still gains ground) is on offer |
| `D-48` | Scenario authoring by role: a scenario's deploy hexes, ritual centers, portals and `CaptureHold`/`Escort` objective hexes can be pinned relative to a generated field's own anchors and deploy zones instead of fixed coordinates, so the same scenario file replays on any regeneration of the ground; `data/scenarios/ford_crossing.json` is the worked example |
| `D-49` | Named biomes (Ashfall, Marsh, Highland Pass) as data-defined presets over the battlefield generator, with a `wetness` knob and per-battle overrides |
| `D-50` | Knight rank ladder (14 ranks, Page to King), with its own lance-charge ATK privilege alongside mounted movement, banner and castle; Dragon Host and Ritual Cult ladders remain |
| `D-51` | Dragon Host rank ladder (9 ranks, wing dive keyed to altitude lost) and Ritual Cult rank ladder (5 ranks, ritual mastery and instability ceiling, no leadership privilege) |
| `D-52` | Fixed `drawFromBanner` reseeding identically across separate calls once elapsed time and collection size both hold still (a run of duplicate pulls could lock a banner onto one card for dozens of draws in a row); added a monotonic `KingdomState.draws` counter to the seed and a regression test |
| `D-53` | Deck editor in the sample page: the Deck and Rites screens sleeve and pull copies live, checked against the bundled `validateDeck` on every change |
| `D-54` | Scenario authoring on generated ground (`Q-2`): rituals, portals, deploy hexes and hold/escort objectives pin to a role — anchor, deploy zone, midpoint, trench, ruins, fortification, ford, road — with a midpoint fallback when a role's feature did not generate; `data/scenarios/contested_ford.json` is the worked example |
| `D-55` | `attackPortal` rejects same-side attacks and attacks on an already-destroyed or captured portal, matching the guard `captureStep` already had; direct test coverage for the attack path (none existed) |
