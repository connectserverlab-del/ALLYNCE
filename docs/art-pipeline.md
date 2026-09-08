# Art pipeline

## Where things are

| Path | Contents |
|---|---|
| `art/prompts/STYLE_GUIDE.md` | Approved style, Global Style Block, faction accents, round history, scaling steps |
| `art/prompts/UNIT_PROMPTS.md` | Subject block for every unit in the vertical slice plus dragons, ritualists, structures |
| `art/samples/` | Approved V01 concepts (`_CONCEPT_V01.jpg`) and transparent cutouts (`_CUTOUT_V01.png`) |
| `art/samples/_CONTACT-SHEET_V01.jpg` | All nine approved samples on one sheet |
| `art/rejected/` | Every earlier round, kept for art direction history |
| `art/ASSET_MANIFEST.json` | Unit id, file paths, generation job id, approval flag, never-change notes |

## How a unit gets made

1. Take the subject block from `UNIT_PROMPTS.md`, append the Global Style Block, swap in the faction's rim-light and accent.
2. Generate at 2k, 1:1, text-only. Reject anything cropped, anything with a floor plane, anything glossy.
3. Approve one result. Record the job id in the manifest.
4. Lift the figure off its ground with `python3 scripts/cutout.py '<incoming>/*.png' art/samples`. The script
   seeds its flood fill from the frame's own corner colour rather than from pure white, so cream and warm-grey
   grounds lift too, escalates tolerance until at least 28% of the frame clears, drops specks, and clears
   background pockets the border fill cannot reach (inside a drawn bow, under a raised arm). It writes the
   1024 px cutout and a 1024 px JPEG of the untouched concept. Higgsfield's own `remove_background` is the
   fallback when a frame defeats it; a frame with visible brush texture in its background is not worth
   rescuing — regenerate it with *absolutely no visible brush strokes or paint texture in the background*.
   Then run `python3 scripts/audit-cutouts.py`, which fails any cutout still opaque across the whole frame
   (nothing was lifted) or opaque almost nowhere (the figure went with the ground). It exits non-zero, so it
   can gate a build; the eye cannot be trusted here, because a pale slab at thumbnail size reads as a costume.
5. Only after approval: attach the approved image as the reference and generate the construction sheet, then the action-pose sheet (suffix prompts in the engineering brief §20).
6. Hand the cutout to the Unity prototype. `data/units/units.json` carries an `art.cutout` path per unit.

## Why the style changed four times

The original dragon reference was a compact pre-rendered sprite. Reproducing that finish on humans produced either
cartoon line art or a plastic 3D-render look, both rejected. Moving to hand-painted illustration fixed the medium;
adding heavy grunge fixed the mood. The approved look keeps the dragon reference's readable silhouette, slate palette
and elevated three-quarter camera while replacing its render finish with painted texture.

## Sample gallery

The original nine approved samples, still the style reference (`art/prompts/STYLE_GUIDE.md` round 4), cover one
commander, one elite or one foot soldier from each faction plus both dragon tiers:

- Samurai: Ember Banner Daimyo (commander), Emberline Ashigaru (foot)
- Shinobi: Veiled Moon Jōnin (commander), Mirror Shade Adept (elite)
- Knight: Solar Bastion Marshal (commander), Sky-Lance Dragoon (elite dragon cavalry), Bastion Man-at-Arms (foot)
- Dragon Host: Riftwing Dominant (commander), Slatewing Drake (foot)

The roster has since grown well past these nine; `art/ASSET_MANIFEST.json` only ever tracked this original batch
plus a handful of later samples still awaiting approval. For whether a given unit's card has art, trust
`data/units/units.json` (`art.concept` / `art.cutout`) or `npm run assets`, not the manifest's `assets` list.

All 88 units currently in `data/units/units.json` have both a concept and a cutout on disk, and every cutout
audits clean — `npm run assets` reports 0 missing under "Units", and `python3 scripts/audit-cutouts.py` and
`core/tests/art.test.ts` (run on every `npm test`) both check the same opacity band. Two structures,
`STRUCTURE_REINFORCEMENT-PORTAL` and `STRUCTURE_RITUAL-CIRCLE`, remain unpainted and unused by any code path;
they are listed under `pending` in the manifest for whoever eventually gives portals and ritual circles their
own art.
