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
| 3 | `scripts/build-sample.mjs` | Substitutes both into `web/sample/template.html` and writes `docs/samples/ashfall-hold.html`. |

The page has to open from a bare `file://` path with nothing beside it, so everything travels inside the HTML.
That is why it is tens of megabytes and why the packer downscales as hard as it does.

## The six screens

| Screen | What it shows |
|---|---|
| **Field** | The generated battlefield, painted ground clipped to the irregular shape, pan and zoom with a minimap. Round and phase, both sides' morale bands, cohesion links, the selected unit's reach and the summon zone, and a command bar carrying the engine's own ATK and DEF breakdowns term by term. |
| **Deck** | All hundred cards on paper stock, filterable by faction and sortable by star, copies or name. Each card face shows its star row, its tribute cost and its copy count; the detail panel adds how many copies the hold physically owns, because the copy limit is a ceiling and not a grant. |
| **Rites** | The twenty-card side deck. Rituals name a star total to sacrifice; fusions name exact adjacent materials. Cards playable on the current field are lit; the rest are dimmed with their requirements spelled out. |
| **Writs** | The wanted board: five warrants posted, what each pays in cards and bounty, the escort standing in the way, and how the target is taken alive. Below it, every card the current deck asks for that the hold cannot cover. |
| **Hold** | The stronghold seen from above with a pin per building, each at its real level and tier art, plus the research tree and the recruitment banners. |
| **Lands** | The world and province paintings, and the art-direction notes behind them. |

## Visual identity

- Ground soot black-blue `#12141a`; panels iron `#23272e` to `#2c3139`; parchment `#cfc3a6` for tooltips.
- Faction accents: Samurai ember `#c9562c`, Shinobi moon `#9aa7b3`, Knight dull gold `#b8923f`, Dragon pale cyan
  `#7fb6c2`, Ritual marsh `#7c9a5a`. The five sworn companies borrow the nearest of these rather than adding new
  hues, so a mixed deck stays readable.
- Type: Alegreya SC for labels, Alegreya Sans for body, JetBrains Mono for numbers.
- One card stock for everything: the sealed mulberry paper. Rank is carried by the star row, never by the frame.
