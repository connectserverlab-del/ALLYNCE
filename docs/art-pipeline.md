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
4. Run background removal on the job id. Store the 1024 px cutout and a 1024 px JPEG of the concept.
5. Only after approval: attach the approved image as the reference and generate the construction sheet, then the action-pose sheet (suffix prompts in the engineering brief §20).
6. Hand the cutout to the Unity prototype. `data/units/units.json` carries an `art.cutout` path per unit.

## Why the style changed four times

The original dragon reference was a compact pre-rendered sprite. Reproducing that finish on humans produced either
cartoon line art or a plastic 3D-render look, both rejected. Moving to hand-painted illustration fixed the medium;
adding heavy grunge fixed the mood. The approved look keeps the dragon reference's readable silhouette, slate palette
and elevated three-quarter camera while replacing its render finish with painted texture.

## Sample gallery

The nine approved samples cover one commander, one elite or one foot soldier from each faction plus both dragon tiers:

- Samurai: Ember Banner Daimyo (commander), Emberline Ashigaru (foot)
- Shinobi: Veiled Moon Jōnin (commander), Mirror Shade Adept (elite)
- Knight: Solar Bastion Marshal (commander), Sky-Lance Dragoon (elite dragon cavalry), Bastion Man-at-Arms (foot)
- Dragon Host: Riftwing Dominant (commander), Slatewing Drake (foot)

Twelve units and two structures remain and are listed under `pending` in the manifest.
