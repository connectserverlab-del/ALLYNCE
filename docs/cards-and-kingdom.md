# Cards, decks and the holding

## The star scale

Every unit card carries 1 to 10 stars. Stars are the single currency of the card layer: they set what a card
costs to bring out, how many copies may sit in a deck, and what a ritual must burn to summon it.

| Stars | Who | Tribute to summon | Copies allowed |
|---|---|---|---|
| 1 | Levy and squires | free | 20 |
| 2 | Rank-and-file foot | free | 16 |
| 3 | Trained foot, drakes, junior specialists | free | 12 |
| 4 | Specialists, scouts, light riders, cell leaders | 1 | 8 |
| 5 | Seconds, cavalry, siege crews | 1 | 6 |
| 6 | Commanders | 1 | 4 |
| 7 | Elites and champions | 2 | 3 |
| 8 | Greater elites, true dragons, siege beasts | 2 | 2 |
| 9 | Named lords and legendary heroes | 3 | 1 |
| 10 | Deities, gods, Kage, shoguns, kings | — | 0 |

A tribute is one of your own deployed units, removed from the field to pay for the summon. The army leader can
never be tributed. Ten-star cards have no tribute cost because they cannot be summoned from the main deck at all:
they arrive only through a ritual or fusion card.

## Card faces

Every card in the game is printed on the same stock: sealed mulberry paper with a bronze-ink border, browned
along one edge, with a wax seal at the lower corner. Rank is carried entirely by the stars, not by the frame.
Stars are a separate painted asset composited onto the card, so a unit's star count can change without repainting
its frame. Nothing in the interface carries punched holes, rivets or rows of dots.

## The main deck: 100 cards

- Exactly 100 cards, no more, no less.
- Copy limits by star, as above. A named unique unit is always limited to one, whatever its star.
- A deck is led by one faction: at least 40 of its 100 cards must belong to it. The rest may be sworn allies.
- Opening hand 5, draw 1 in every Command Phase, hand capped at 7. Drawing past the cap discards.
- Running out of cards is not a loss; you simply stop drawing.

Summoning from hand places the card in a free hex within two of one of your commanders.

## The side deck: 20 cards

Twenty ritual and fusion cards that never enter the draw pile. They are played straight from the side deck when
the field already holds what they demand, and they carry stars of their own.

**Ritual cards** name a star total. Sacrifice your own deployed units until their stars meet it. Some rituals
restrict the sacrifices to one theme, some demand a commander among them, and the Sovereign invocations demand a
ritualist left alive to channel. The result appears where the first sacrifice stood.

**Fusion cards** name exact materials that must be standing adjacent to one another, and additionally spend a
Fusion charge. Paired Line locks two foot soldiers into one body; the Calamity Form needs all three Sovereigns
together and dissolves after three rounds.

## The holding

A permanent base that persists between battles.

- **Resources**: Koku, Iron, Timber, Silver, produced per hour by the Granary, Mine, Sawpit and Keep, capped by
  storage that grows with the Keep.
- **Buildings**: eleven, each to level 10. The Keep gates every other building: nothing may exceed its level.
- **Research**: twelve studies in four tiers, gated by the Research Hall's level and by prerequisites. One study
  runs at a time.
- **Recruitment**: three banners with weighted star tables and a pity counter that guarantees the banner's floor.
  The Recruitment Hall's level lifts the odds of the higher stars.

Everything the holding grants arrives in battle as a **named, source-tracked modifier**. "Forge 2" and
"Research: Forged Edge" appear as their own lines in the attack breakdown, so any number on the field can be
traced back to something you built.

| Building | What it carries into battle |
|---|---|
| Barracks | +12 Army Capacity per level |
| Forge | +10 ATK per level |
| Curtain Wall | +10 DEF per level |
| Stable | +15 ATK per level, cavalry only |
| Ritual Shrine | +1 Fusion charge per 4 levels, faster rituals |
| Research Hall | unlocks study tiers and speeds all building work |
| Recruitment Hall | lifts the star floor of every draw |


## Buildings change their look as they rise

Each building bands its ten levels into three visual tiers: levels 1 to 3 are thrown up in timber and thatch,
4 to 7 are rebuilt in mortared stone, 8 to 10 are enlarged, towered and fortified. `buildingArt` falls back to the
nearest lower tier that has been painted, so a missing asset never leaves a hole in the stronghold.

Painted so far: the Keep at all three tiers, the Curtain Wall at all three, the Barracks at tiers one and three.
`npm run assets` regenerates `docs/asset-registry.md`, which lists every asset the game expects and what is still
to paint.


## The loop

`runMatch` closes the circle between the two layers:

1. A holding pays for buildings, research and recruitment draws.
2. Its cards build a hundred-card deck and a twenty-card side deck.
3. `setUpMatch` generates a field, fields a legal opening force from the deck alone, deals an opening hand and
   applies each side's holding as named modifiers.
4. Rounds run: the AI draws, summons what it can pay for, plays any rite whose requirements are met, then
   manoeuvres. It never tributes more star value than the card it summons is worth, and never spends its leader.
5. The battle ends on one of the three universal conditions or the round limit.
6. `spoils` pays both sides, more for winning and more for the enemy stars broken, and the winner takes a card.
   `collectReward` banks it into the holding, and the loop begins again.

`saveBattle` and `loadBattle` round-trip a match in progress, including decks, hands and the uid counter, so a
restored battle keeps issuing fresh unit ids instead of colliding with saved ones.
