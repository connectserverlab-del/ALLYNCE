#!/usr/bin/env python3
"""Check that every card cutout has actually been cut out.

A cutout that kept its whole background is not an obvious failure. The registry counts the file as
present because it exists, and at thumbnail size on a contact sheet a pale slab reads as a light
costume, so one shipped that way and sat on the deck screen for several passes. The tell is
arithmetic rather than visual: an image whose alpha is opaque everywhere was never cut out, and one
that is opaque almost nowhere lost the figure along with the ground.

    python3 scripts/audit-cutouts.py            # every cutout under art/samples
    python3 scripts/audit-cutouts.py 'art/**/*_CUTOUT_*.png'

Exits non-zero if anything is outside the band, so it can gate a build.
"""
import glob, os, sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT = "art/samples/*_CUTOUT_*.png"

# A figure drawn to fill its frame covers roughly a third to two thirds of it. Outside this band
# something went wrong in one direction or the other.
FLOOR, CEILING = 0.12, 0.95


def opaque_share(path):
    im = Image.open(path)
    if im.mode != "RGBA":
        return 1.0                      # no alpha channel at all: nothing was ever lifted
    a = im.getchannel("A")
    return sum(n for v, n in zip(range(256), a.histogram()) if v > 8) / (im.width * im.height)


def main(pattern):
    paths = sorted(glob.glob(os.path.join(ROOT, pattern), recursive=True))
    if not paths:
        sys.exit(f"no cutouts matched {pattern}")
    bad = []
    for p in paths:
        share = opaque_share(p)
        name = os.path.relpath(p, ROOT)
        if share >= CEILING:
            bad.append((name, share, "kept its background"))
        elif share <= FLOOR:
            bad.append((name, share, "lost the figure"))
    for name, share, why in bad:
        print(f"  {share:5.3f}  {name}  — {why}")
    print(f"{len(paths) - len(bad)}/{len(paths)} cutouts in band "
          f"({FLOOR:.2f}-{CEILING:.2f} opaque)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT))
