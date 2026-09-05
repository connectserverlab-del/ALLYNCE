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
