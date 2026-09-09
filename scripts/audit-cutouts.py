#!/usr/bin/env python3
"""Check that every cut-out asset has actually been cut out.

A cutout that kept its whole background is not an obvious failure. The registry counts the file as
present because it exists, and at thumbnail size on a contact sheet a pale slab reads as a light
costume, so one shipped that way and sat on the deck screen for several passes. The tell is
arithmetic rather than visual: an image whose alpha is opaque everywhere was never cut, and one
that is opaque almost nowhere lost the subject along with the ground.

    python3 scripts/audit-cutouts.py                 # every group below
    python3 scripts/audit-cutouts.py buildings       # one group
    python3 scripts/audit-cutouts.py 'art/**/*.png'  # an explicit glob, audited at the loosest band

Exits non-zero if anything is outside its band, so it can gate a build.

The bands are per group, and they are per group because one number could not do the job. A lone
figure on white leaves less of its frame standing than a building drawn out to its own footprint
does, so a single floor loose enough for the thinnest unit is far too loose for a building. That is
not hypothetical: cutting the eight approved building plates against a pale ground ate them and left
0.14-0.29 of each frame, every one of which passed the old 0.12 floor. The floors below sit under
the observed minimum of each group with room to spare, and the observed minimum is in the comment
so the next person can see what the number is made of.
"""
import glob, os, sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# group -> (glob, floor, ceiling).  Measured minima at the time of writing, for context:
#   units 0.195 · buildings 0.418 · props 0.368 · map symbols 0.573 · cards 0.435
GROUPS = {
    "units":     ("art/samples/*_CUTOUT_*.png", 0.15, 0.95),
    "buildings": ("art/buildings/BLD_*_V01.png", 0.30, 0.95),
    "props":     ("art/props/PROP_*_V01.png", 0.25, 0.95),
    "map":       ("art/map/MAP_*_V01.png", 0.35, 0.95),
    "cards":     ("art/cards/SIDE_*_V01.png", 0.30, 0.95),
}
LOOSEST = (0.12, 0.95)


def opaque_share(path):
    im = Image.open(path)
    if im.mode != "RGBA":
        return 1.0                      # no alpha channel at all: nothing was ever lifted
    a = im.getchannel("A")
    return sum(n for v, n in zip(range(256), a.histogram()) if v > 8) / (im.width * im.height)


def audit(label, pattern, floor, ceiling, required=True):
    paths = sorted(glob.glob(os.path.join(ROOT, pattern), recursive=True))
    if not paths:
        if required:
            print(f"  {label}: nothing matched {pattern}")
            return 0, 1
        return 0, 0
    bad = []
    for p in paths:
        share = opaque_share(p)
        name = os.path.relpath(p, ROOT)
        if share >= ceiling:
            bad.append((name, share, "kept its background"))
        elif share <= floor:
            bad.append((name, share, "lost the subject"))
    for name, share, why in bad:
        print(f"  {share:5.3f}  {name}  — {why}")
    print(f"  {len(paths) - len(bad)}/{len(paths)} {label} in band ({floor:.2f}-{ceiling:.2f} opaque)")
    return len(paths), len(bad)


def main(arg=None):
    if arg and arg in GROUPS:
        pattern, floor, ceiling = GROUPS[arg]
        return 1 if audit(arg, pattern, floor, ceiling)[1] else 0
    if arg:
        return 1 if audit("matched", arg, *LOOSEST)[1] else 0
    total = failed = 0
    for label, (pattern, floor, ceiling) in GROUPS.items():
        n, b = audit(label, pattern, floor, ceiling)
        total += n; failed += b
    print(f"{total - failed}/{total} cut assets in band")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else None))
