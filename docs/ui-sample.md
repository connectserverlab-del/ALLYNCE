# The sample page

`docs/samples/ashfall-hold.html` is the whole game as one file you can double-click. Nothing on it is mocked up:
every number, card, warrant and stat breakdown comes out of the engine in `core/src`, and if a figure on the page
looks wrong it is wrong in the engine.

## Building it

```
node scripts/build-sample.mjs
```

Three steps, each its own file so any of them can be run or read alone:

| Step | File | What it does |
|---|---|---|
| 1 | `scripts/pack-sample-assets.py` | Reads the art off disk, downscales each class of asset to the size the page actually draws it at, and encodes it as data URIs. Cutouts go out as WebP, which carries the alpha a card face needs at roughly a sixth of PNG's weight. |
| 2 | `web/sample/data.mts` | Drives the real engine — a holding with buildings and research, a battle paused mid-activation, a hundred-card deck built against a collection, a warrant board — and writes the state as JSON. |
| 2b | `scripts/bundle-march.mjs` | Compiles the march engine for the browser through esbuild. |
| 3 | `scripts/build-sample.mjs` | Substitutes all three into `web/sample/template.html` and writes `docs/samples/ashfall-hold.html`. |

The March screen is the one screen that cannot be a snapshot. Every other screen shows a state the engine
had already reached when the page was built, which is fine for a battle paused mid-activation; but a march
is chosen by the person looking at it, so the walk has to be worked out in the page. Rather than
reimplement the movement rules in the template — where they would quietly drift from the ones the tests
run against — `web/sample/march-boot.mts` bundles the real `core/src/march.ts`, the map generator and the
data JSON into the page. That is why `Registry` lives in `core/src/registry.ts` with nothing that touches
a disk, and `core/src/data.ts` owns the file reading: the class has to be reachable without dragging
node:fs in behind it. No arrival time on that screen is computed by the template; they all come back from
`travelSeconds`.

The page has to open from a bare `file://` path with nothing beside it, so everything travels inside the HTML.
That is why it is tens of megabytes and why the packer downscales as hard as it does.

## The seven screens

| Screen | What it shows |
|---|---|
| **Field** | The generated battlefield, painted ground clipped to the irregular shape, pan and zoom with a minimap. Round and phase, both sides' morale bands, cohesion links, the selected unit's reach and the summon zone, and a command bar carrying the engine's own ATK and DEF breakdowns term by term. |
| **March** | Movement between battles, running live. Two squads and a few loose units stand on the generated ground; click anywhere to send the selected squad and they walk there, at the pace of their slowest member. Drag a name from the roster onto a squad and that unit walks over and falls in when it gets close. The clock reads elapsed time, who is still walking and the longest arrival, against the 45-second cap. |
| **Deck** | All hundred cards on paper stock, filterable by faction and sortable by star, copies or name. The name runs across the top band of the paper, LIFE, ATK and DEF sit under the art in dark ink, and the star row and wax seal close the foot. The detail panel adds the role, the summon cost and how many copies the hold physically owns, because the copy limit is a ceiling and not a grant. |
| **Rites** | The twenty-card side deck. Rituals name a star total to sacrifice; fusions name exact adjacent materials. Cards playable on the current field are lit; the rest are dimmed with their requirements spelled out. |
| **Writs** | The wanted board: five warrants posted, what each pays in cards and bounty, the escort standing in the way, and how the target is taken alive. Below it, every card the current deck asks for that the hold cannot cover. |
| **Hold** | The stronghold seen from above with a pin per building, each at its real level and tier art, plus the research tree and the recruitment banners. |
| **Lands** | The world and province paintings, and the art-direction notes behind them. |

## Visual identity

- The march ground is painted as regions, not tiles. The terrain data is per hex, because the battle rules
  need a grid, but a march is continuous: each hex is laid down as a disc wider than the hex spacing and
  the layer is blurred until the cell edges are gone, so a river reads as a river and nothing on screen
  suggests the walking is done in steps.
- Ground soot black-blue `#12141a`; panels iron `#23272e` to `#2c3139`; parchment `#cfc3a6` for tooltips.
- Faction accents: Samurai ember `#c9562c`, Shinobi moon `#9aa7b3`, Knight dull gold `#b8923f`, Dragon pale cyan
  `#7fb6c2`, Ritual marsh `#7c9a5a`. The sworn companies and the seven divisions borrow the nearest of these rather than adding new
  hues, so a mixed deck stays readable.
- Type: Alegreya SC for labels, Alegreya Sans for body, JetBrains Mono for numbers.
- One card stock for everything: the sealed mulberry paper. Rank is carried by the star row, never by the frame.
- Card face layout is measured against the frame painting itself, not guessed: the art window's dark ground
  ends at 64%, clear paper runs to 84.6%, and there are faint printed rules at 67.4% and 85%. The name takes
  the top band (6-17%), the three stats sit between the rules at 68-78%, and the star row closes at 79.5%, so
  no type ever lands on a rule or on the scorched foot where it cannot be read.
- The three stats are a three-column grid, not two values pushed to the ends. Equal columns cannot shove a
  four-digit number under the frame's inner bevel the way justified ends did. Each carries a painted icon — a
  heart, a sword, a shield — because at nine pixels a word label is a smudge, and shape plus colour still tells
  three numbers apart. The small face carries name, art, stats and stars and nothing else; role, rank and
  summon cost live in the detail panel, which has room.
- **Three card stocks, not one.** Soldiers keep the sealed mulberry paper; a ritual is green, a fusion violet,
  so a rite is never mistaken for a unit at a glance. Each painting puts its picture window and lower panel
  somewhere different, so a stock carries its own layout as custom properties rather than one set of
  percentages pretending to fit all three, and every stock is cropped to the same card proportions — a grid of
  cards in three shapes reads as a mistake. A fourth stock is one more row in that table.
- A ritual card shows the monster it brings out. Three of the four fusions have no such monster: they derive
  the new body from whatever fed them, so the card shows the first named material and the *formula* — sum,
  max+0.20 — rather than numbers it does not have.
- Faction names come from `data/factions/factions.json` through the export rather than a map in the template, so
  a division added tomorrow shows its real name instead of "undefined". Only the four host armies keep a short
  label, and new factions borrow the nearest existing accent hue rather than adding one.
