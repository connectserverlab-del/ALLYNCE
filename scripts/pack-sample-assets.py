#!/usr/bin/env python3
"""Pack every painting the sample page needs into one JSON of data URIs.

The page opens from a bare file:// path, so nothing can be fetched at runtime; every frame, icon,
star, card token and building portrait has to travel inside the HTML. At full resolution that is
tens of megabytes for a page that never draws a token larger than a card face, so each class of
asset is downscaled to the size it is actually rendered at before it is encoded.

    python3 scripts/pack-sample-assets.py out.json

Called by `scripts/build-sample.mjs`; there is no reason to run it by hand.
"""
import base64, io, json, os, sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Longest edge each class of asset is drawn at, with a little headroom for high-density screens.
SIZES = {"token": 440, "frame": 620, "icon": 96, "star": 96, "tier": 560, "art": 1500}


def uri(rel, kind):
    """Downscale one file to the size its slot renders at and return it as a data URI."""
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        return None
    im = Image.open(path)
    box = SIZES[kind]
    if max(im.size) > box:
        im.thumbnail((box, box), Image.LANCZOS)
    buf = io.BytesIO()
    if im.mode in ("RGBA", "LA", "P") and kind != "art":
        # WebP carries the alpha a card cutout needs at roughly a sixth of PNG's weight, and the
        # whole page has to travel as one file
        im.convert("RGBA").save(buf, "WEBP", quality=82, method=3)
        mime = "image/webp"
    else:
        im.convert("RGB").save(buf, "JPEG", quality=86, optimize=True)
        mime = "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode()


UI = "art/ui"
ICONS = ["BLD-BARRACKS", "BLD-BUILD", "BLD-FORGE", "BLD-KEEP", "BLD-RECRUIT", "BLD-RESEARCH",
         "RES-IRON", "RES-KOKU", "RES-SILVER", "RES-TIMBER", "UI-BANNER", "UI-DRAW"]


def main(out_path):
    units = json.load(open(os.path.join(ROOT, "data/units/units.json")))
    registry = json.load(open(os.path.join(ROOT, "art/ASSET_REGISTRY.json")))["assets"]

    assets = {
        "frames": {
            "PLAIN": uri(f"{UI}/CARD-PAPER-PLAIN_V01.png", "frame"),
            "INKED": uri(f"{UI}/CARD-PAPER-INKED_V01.png", "frame"),
            "SEALED": uri(f"{UI}/CARD-PAPER-SEALED_V01.png", "frame"),
        },
        "star": {"on": uri(f"{UI}/STAR_FILLED_V01.png", "star"),
                 "off": uri(f"{UI}/STAR_EMPTY_V01.png", "star")},
        "icons": {},
        "art": {
            "ground": uri("art/concepts/MAP_MOUNTAIN-PASS_CONCEPT_V01.jpg", "art"),
            "world": uri("art/concepts/MAP_WORLD-CAMPAIGN_CONCEPT_V01.jpg", "art"),
            "province": uri("art/concepts/MAP_SAMURAI-PROVINCE_CONCEPT_V01.jpg", "art"),
            "hold": uri("art/concepts/BASE_STRONGHOLD-TOPDOWN_CONCEPT_V01.jpg", "art"),
            "holdAngle": uri("art/concepts/BASE_STRONGHOLD-ANGLED_CONCEPT_V01.jpg", "art"),
            "cardback": uri(f"{UI}/CARD-BACK-PAPER_V01.png", "frame"),
        },
        "tiers": {},
        "tokens": {},
    }
    for i in ICONS:
        u = uri(f"{UI}/ICON_{i}_V01.png", "icon")
        if u:
            assets["icons"][i] = u
    for entry in registry:
        if entry.get("kind") != "building" or entry.get("status") != "present":
            continue
        u = uri(entry["path"], "tier")
        if u:
            assets["tiers"][entry["id"]] = u
    for unit in units:
        cutout = (unit.get("art") or {}).get("cutout")
        if not cutout:
            continue
        u = uri(cutout, "token")
        if u:
            assets["tokens"][unit["id"]] = u

    with open(out_path, "w") as fh:
        json.dump(assets, fh)
    size = os.path.getsize(out_path) / 1e6
    print(f"packed {len(assets['tokens'])}/{len(units)} unit tokens, "
          f"{len(assets['tiers'])} building tiers, {len(assets['icons'])} icons "
          f"({size:.1f} MB)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
