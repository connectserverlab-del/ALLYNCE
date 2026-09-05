# Art Style Guide (V01, approved: grimdark hand-painted)

Approved after four exploration rounds: **gritty grimdark hand-painted digital game concept illustration**.
Heavy grunge on every material, rough textured brushwork, most of the figure in shadow with a few hard highlights,
desaturated smoky palette with one or two saturated accents per faction.

## Round history

| Round | Folder | Look | Verdict |
|---|---|---|---|
| 0 | `art/rejected/round0-render-style-anchors` | Pre-rendered 3D creature sprite, matte slate (matched the original dragon reference) | Good silhouette reference; pulled humans toward a plastic render look |
| 1 | `art/rejected/round1-too-cartoonish` | Clean, flat, anime-adjacent line art | Too cartoonish |
| 2 | `art/rejected/round2-3d-render-look` | Sculpted gritty miniature render | Reads as generic AI 3D render |
| 3 | `art/rejected/round3-clean-painterly` | Hand-painted splash-art quality, clean | Right medium, too polished |
| **4** | **`art/samples`** | **Grimdark hand-painted, heavy grunge** | **Approved** |
| 5 | `art/rejected/round5-angels-too-human`, `art/rejected/round5-same-silhouette` | Same look, but every card the same standing pose, and angels drawn as men with wings | Style kept; 16 cards repainted for silhouette and anatomy |

## Global Style Block (append to every unit prompt)

> Gritty grimdark hand-painted digital fantasy game character illustration, professional concept-art quality. Heavy grunge: scratched, dented, soot-stained and rust-streaked metal, dried mud and ash ground into cloth and boots, frayed torn edges, grime and sweat on weathered skin, scuffed cracked leather. Rough textured brushwork with dry-brush scumbling, scraped edges and controlled paint spatter kept inside the figure, darker moodier value structure with most of the figure in shadow and a few hard-edged highlights, desaturated smoky palette with one or two saturated accents. No clean polished surfaces, no pristine armor, no glossy highlights, not a 3D render, not photoreal, no anime, no cartoon outlines. COMPLETE FULL-BODY FIGURE FROM HEAD TO BOOTS, feet fully visible, generous empty margin on all sides, single character, slightly elevated three-quarter view facing lower-left, plain flat pure white background, no scenery, no floor, no text, no logo, no watermark, no UI, no card frame, no cropped limbs, no extra limbs, no modern objects, original design.

For creatures replace the material list with: *scarred weathered hide, chipped horns, torn and patched wing membranes, ash and dried mud on the claws and underbelly*, and require *whole creature fully visible, wings uncropped*.

## Generation settings that produced V01

- Tool: Higgsfield, model `nano_banana_pro`, resolution 2k, aspect 1:1, **text-only**.
- Image references were dropped after round 2: render-style references drag results back toward a 3D look. Style consistency comes from the shared Global Style Block and per-faction accent table instead.
- Background removal: Higgsfield `remove_background` on the completed job id.
- Repo storage: concepts as 1024 px JPEG (quality 90), cutouts as 1024 px PNG with alpha. Originals are 2048 px.
- Roughly one in eight submissions fails server-side with no error detail; resubmit the same prompt.

## Per-faction lighting accents

| Faction | Rim light | Accent |
|---|---|---|
| Samurai | dying ember orange | faded ember-red lacing, tarnished bronze |
| Shinobi | cold moon silver | muted jade, rain-darkened indigo |
| Knight | dull gold | stained ivory, cold blue steel |
| Dragon Host | cold pale cyan | slate blue, charcoal membranes |
| Ritual Cult | pale teal | marsh green, weathered teal |
| Cobalt Conclave | cold blue-white | cobalt blue, tarnished pewter |
| Thorn Coven | sickly green-grey | bruised violet, moss green, bone |
| Cutpurse Court | dull lamp amber | soot black, dirty brass, oxblood |
| Windmarch Host | bleached bone-white | dust ochre, felt brown, weathered horn |
| Dunewake Compact | low amber | sun-bleached linen, pale turquoise, scorched umber |
| Choir Militant | cold bone-white | ash grey, tarnished gold, dirty broken feathers |
| Ashpit Legion | low ember-red | charcoal hide with ember splits, sulphur yellow |
| Spiral Warband | sickly green-violet | rust brown, oxidised copper, looted mismatched plate |
| Half-Born Host | pale storm-blue | weathered bronze, grey wool, branching pale scars |
| Winter Famine | cold pale | grey-blue frostbitten hide, bone, dull frost-white |
| Ridge Kin | cool grey-green | wet bark, moss, matted fur, dull amber |
| Formic Swarm | low amber | oxidised brown chitin, black, pale resin repairs |

## Rules that never change per unit

- Head-to-toe figure, no crops.
- Foot soldiers keep a simple silhouette because they are duplicated five times per platoon.
- Commanders show rank through construction and materials, never oversized crowns.
- No glowing eyes, no fire covering the body, no gore, no real-world religious symbols, no franchise resemblance.
- Grunge is wear, weather and soot. Never blood.

## Next steps for scaling to the full roster

1. Generate the remaining 10 vertical-slice units (seconds, elites, foot soldiers not yet covered, ritualists, portal keeper) with the Global Style Block and the subject blocks in `UNIT_PROMPTS.md`.
2. Approve one canonical image per unit, then attach it as the reference for the construction sheet and the action-pose sheet (suffixes in the engineering brief §20).
3. Record model, settings and job id in `art/ASSET_MANIFEST.json` for every approved asset.

## Cards are paper, not metal (V02)

The first card frames were hammered iron with rows of punched sockets. Rejected: too metal, and the repeating
holes were unpleasant to look at. The rule now:

- Card stock is **aged paper**: linen paper, grey-buff card, dark mulberry paper. Foxing, tea stains, frayed and
  dog-eared edges, cloth tape at the corners, a wax seal on the highest tier.
- **Never** put holes, punched circles, perforations, rivets, eyelets or rows of dots on any card or interface piece.
  Add "no holes, no punched circles, no perforations, no rivets, no eyelets, no rows of dots" to every card prompt.
- Stars are a **separate painted asset**, not part of the frame: gold leaf rubbed thin over a paper chip for an
  earned star, a broken brush-ink outline for an unearned one. They are composited onto the card at render time,
  so a unit's star count can change without repainting the frame.

Three stocks map to rank: plain linen for 1 to 6 stars, inked and taped for 7 to 9, sealed mulberry for 10-star
cards and for every rite in the side deck.

## Two views of a building

The stronghold overview is painted **straight down**. Individual building portraits are painted at a **low angle**
so their walls, roofs and towers read. Both are correct; use the overview for the map and the portrait for the
upgrade panels.

## Background removal on toned grounds

The model sometimes returns a cream or lightly brushed ground instead of pure white, and the border flood fill
then lifts nothing. The cutter seeds its fill from the median of the four corner pixels rather than from pure
white, and escalates its tolerance (30, 40, 52, 66, 82) until at least 28% of the frame is cleared. Two passes
follow: isolated specks smaller than 0.4% of the frame are dropped so the crop box hugs the figure, and
background-coloured pockets the border fill could not reach — the inside of a drawn bow, a gap under a raised
arm — are cleared separately. A frame with visible brush texture in the background is not worth rescuing;
regenerate it with *absolutely no visible brush strokes or paint texture in the background* added to the prompt.

## Wendigo-themed creatures

The Winter Famine division is drawn as **original famine-spirits**, not as a depiction of the figure from
Algonquian belief that the name is usually attached to. Every prompt says so explicitly, the units are named
for what they do (Starveling, Antler Wraith, Hollow Hunger, Winter Maw) rather than borrowing a sacred name,
and the faction is called the Winter Famine. Keep it that way in any future round: the silhouette language —
starved frame, long limbs, broken antlers, frostbitten grey-blue hide — carries the idea without taking
somebody's sacred figure and putting it on a trading card.

## Getting silhouette variety out of this model (V01 art pass 5)

A contact sheet of the first 88 cards showed the owner was right: almost every card was a standing
three-quarter human of the same height and mass, weight even on both feet, arms down, weapon vertical. The
model's default figure is that pose, and nothing in the costume description pulls it off. What does:

- **Name the stance and say which foot carries the weight.** "Braced hard side-on, weight sunk onto the back
  leg", "all weight on the front foot and the back heel lifted clear", "down on one knee with the rear boot
  turned so its sole shows". Adjectives like *dynamic* or *aggressive* do nothing; a named body mechanic works
  almost every time.
- **Say what the weapon does to the outline, not just what it is.** A weapon named alone is drawn vertical in
  the right hand. "Slung across his back on a strap in a long diagonal", "laid horizontally across the back of
  his shoulders in the crook of both elbows", "extended forward and low, well ahead of the leading foot" all
  landed first try. Ration the vertical shaft to one card per faction.
- **Give mass as a comparison to another unit, never as an adjective.** "Half again the height and twice the
  width of a common soldier" and "barely shoulder-high to a grown man" both read at card size; *large* and
  *small* do not move the figure at all.
- **"Nothing hangs off the body" is a silhouette instruction and it works.** Spelling out *no coat, no cloak,
  no pouches, nothing that could swing or rattle* produces a genuinely closed narrow outline, which is the
  strongest possible contrast to a cluttered one. Put one of each in every faction of four.
- **Check the faction as a group, not card by card.** Each card can be fine on its own and the four still
  collide. Build a four-up sheet per faction and make sure no two share an answer on height, stance, weapon
  break, head or hangings.
- **A small or young figure drags the rendering toward anime.** The first Alley Runner came back cel-shaded
  with glossy manga eyes. Countered by saying the head is small and lost in shadow under a low brow and lank
  hair, plus *no large glossy eyes, no clean lineart, no cel shading, no anime, no manga, no comic-book style;
  the face and hair are painted with the same rough dry-brush grime as the rest of the figure.*

## Non-human anatomy (the Choir Militant lesson)

The angels first came back as men in armour with a symmetrical pair of wings on the back, because that is what
"angel" means to the model and every hint short of an instruction is read as flavour. What actually works:

- **Say what it is not, in those words:** *NOT a human being and NOT a man with wings glued on*. Repeat it.
- **Drop "no extra limbs" from the Global Style Block for these units** — it fights the design — and replace it
  with an explicit inventory: *exactly the limbs described: three arms, two legs, one wing.* Without a count
  the model quietly normalises back to two and two.
- **Say where the head is not.** "No head" alone still yields a helmeted head. What works is describing the
  thing that occupies the gap: a sealed brass collar with nothing above it, an open riveted collar standing
  between the shoulders like the mouth of a chimney that you can see down into, a wing folded permanently over
  the front of the shoulders. Add *no face, no eyes, no chin, no human head anywhere in the picture.*
- **Put the wings in named sockets.** "Six wings" gives three tidy pairs on the back. "Two from the small of
  the back hanging limp straight down, two from the middle shoulders held out low and sideways, two folded flat
  against the front of the chest like a second breastplate" gives a shape no human silhouette can make.
- **Make the wrongness specific.** *An extra elbow in each arm*, *digitigrade legs bending backward onto long
  hooved feet*, *the torso half again too long and the waist absurdly high*, *stubby squat legs under a
  towering stacked column*. Vague words — *unnatural*, *eldritch*, *inhuman* — change nothing.
- **Never write "crown" or "circlet" in an angel prompt.** Asking for "a beaten circlet hammered flat around
  the rim" painted a free-floating iron ring above the figure, i.e. a halo, which the faction forbids. Say
  *no ring, no circle, no disc, no crown, no halo above or behind the figure* instead.
- **Assembled, not born.** *Riveted seams and welded patches everywhere*, *bolted one above the other*,
  *assembled to a purpose rather than born* is the phrasing that reliably kills the heroic reading.
- **Ask for the dark value structure separately and loudly.** Headless armoured constructs come back bright
  silver and evenly lit unless told otherwise. A block headed *CRITICAL VALUE STRUCTURE* naming blackened
  soot-grey iron, three quarters of the figure in deep shadow, and only a few hard-edged highlights on named
  edges brought two of these cards back into the roster's range.

## Ground planes

Prompts occasionally come back with a rock or ledge painted under the feet, which the cutter keeps because it
touches the figure. There is no fixing that in post; regenerate with *ABSOLUTELY NO GROUND, no rock, no ledge,
no cliff, no dirt, no shadow cast on any surface, nothing at all beneath the feet* added to the prompt.
