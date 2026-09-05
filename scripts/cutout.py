#!/usr/bin/env python3
"""Lift a generated character off its paper ground and store it as a card cutout.

Higgsfield is asked for a plain white background and usually obliges, but often enough it returns
cream, warm grey, or a ground with faint brush texture. A fixed white threshold lifts nothing from
those, so the fill is seeded from the corners of the frame instead and its tolerance escalates until
it has actually cleared something. Two clean-up passes follow: isolated specks are dropped so the
crop hugs the figure, and background-coloured pockets the border fill could never reach — inside the
curve of a drawn bow, under a raised arm — are cleared on their own.

    python3 scripts/cutout.py 'incoming/*.png' art/samples

Each input file is named for the unit it depicts (SAM_FOOT_EMBERLINE-ASHIGARU.png) and produces
`<name>_CUTOUT_V01.png` with alpha plus `<name>_CONCEPT_V01.jpg` of the untouched frame.
"""
import sys, glob, os
from collections import deque
from PIL import Image

TOLERANCES = (30, 40, 52, 66, 82)
MIN_CLEARED = 0.28      # a fill that lifted less than this did not find the background
SPECK_SHARE = 0.004     # connected blobs smaller than this are dust, not the figure
POCKET_MIN = 400        # pixels; below this an enclosed light patch is highlight, not background


def _strip(src, tol):
    """Flood the background inward from every border pixel, seeded on the frame's own corners."""
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    seed = tuple(sorted(c[i] for c in corners)[1] for i in range(3))

    def is_bg(p):
        return all(abs(p[i] - seed[i]) <= tol for i in range(3))

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and is_bg(px[x, y]):
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and is_bg(px[x, y]):
                seen[y * w + x] = 1
                q.append((x, y))
    cleared = 0
    while q:
        x, y = q.popleft()
        cleared += 1
        px[x, y] = (px[x, y][0], px[x, y][1], px[x, y][2], 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and is_bg(px[nx, ny]):
                seen[ny * w + nx] = 1
                q.append((nx, ny))
    return im, cleared / (w * h)


def _drop_specks(im):
    """Clear opaque blobs too small to be part of the figure, so the crop box hugs it."""
    a = im.getchannel("A")
    w, h = im.size
    ap = a.load()
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or ap[sx, sy] <= 10:
                continue
            comp, q = [], deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and ap[nx, ny] > 10:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            if len(comp) < SPECK_SHARE * w * h:
                for x, y in comp:
                    ap[x, y] = 0
    im.putalpha(a)


def _clear_pockets(im, tol=24):
    """Clear near-white pockets the border fill could not reach, such as the inside of a bow."""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy][3] == 0:
                continue
            p0 = px[sx, sy]
            if not (p0[0] > 228 and p0[1] > 228 and p0[2] > 224):
                seen[sy * w + sx] = 1
                continue
            comp, q = [], deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < w and 0 <= ny < h) or seen[ny * w + nx]:
                        continue
                    p = px[nx, ny]
                    if p[3] and all(abs(p[i] - p0[i]) <= tol for i in range(3)):
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            if len(comp) > POCKET_MIN:
                for x, y in comp:
                    px[x, y] = (px[x, y][0], px[x, y][1], px[x, y][2], 0)


def cut(src, out_dir, size=1024):
    name = os.path.basename(src).rsplit(".", 1)[0]
    for tol in TOLERANCES:
        im, cleared = _strip(src, tol)
        if cleared >= MIN_CLEARED:
            break
    _drop_specks(im)
    _clear_pockets(im)
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(os.path.join(out_dir, f"{name}_CUTOUT_V01.png"), optimize=True)
    concept = Image.open(src).convert("RGB")
    concept.thumbnail((size, size), Image.LANCZOS)
    concept.save(os.path.join(out_dir, f"{name}_CONCEPT_V01.jpg"), quality=90, optimize=True)
    return name, im.size, round(cleared, 2)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "art/samples"
    os.makedirs(out_dir, exist_ok=True)
    files = sorted(glob.glob(sys.argv[1]))
    if not files:
        sys.exit(f"nothing matched {sys.argv[1]}")
    for f in files:
        name, size, cleared = cut(f, out_dir)
        print(f"{name:44} {size[0]}x{size[1]}  cleared {cleared:.0%}")
