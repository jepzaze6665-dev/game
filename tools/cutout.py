"""Cut one character out of a concept sheet into a transparent PNG asset.

    python tools/cutout.py docs/human.jpg 478 22 618 188 h_swordsman [--ppu 75] [--tol 18]

The sheet background is a smooth grey gradient, the characters have dark
outlines. Background is estimated per row from the crop's border columns,
removed by a flood fill from the border (so grey armour inside the outline
survives), and small enclosed pockets that still match the background are
cleared too. Output goes to assets/units/<race>/<id>.png (trimmed, 2 px pad)
and assets/units/manifest.json gets the frame's anchor (feet centre) and the
source pixels-per-world-unit used by the renderer.
"""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def cut(src, box, uid, ppu=75, tol=18, pocket_max=0, strip_text=True, soft=0):
    im = Image.open(os.path.join(ROOT, src)).convert('RGB')
    x0, y0, x1, y1 = box
    a = np.asarray(im.crop((x0, y0, x1, y1))).astype(np.int16)
    h, w, _ = a.shape
    # background estimate: blend of left and right border columns per row
    left = np.median(a[:, :3, :], axis=1)
    right = np.median(a[:, -3:, :], axis=1)
    t = (np.arange(w) / max(1, w - 1))[None, :, None]
    bg = left[:, None, :] * (1 - t) + right[:, None, :] * t
    close = np.abs(a - bg).max(axis=2) <= tol
    # caption rows under the character: rows in the lower part of the crop whose
    # foreground is almost entirely bright text are treated as background
    if strip_text:
        # captions are white text: the first row in the lower half with a run of
        # near-white pixels starts the caption block; everything below it goes
        white = (a.min(axis=2) >= 225).sum(axis=1)
        for y in range(int(h * 0.55), h - 5):
            if all(white[y + i] >= 5 for i in range(5)):   # a text line is a block of white rows
                close[max(0, y - 4):, :] = True
                break
    # the fill may only travel through pixels that are not touching the dark
    # outline (closes 1 px gaps in it); the rim is added back afterwards
    lum = a.mean(axis=2)
    dark = lum < 60
    near_dark = dark | np.roll(dark, 1, 0) | np.roll(dark, -1, 0) | np.roll(dark, 1, 1) | np.roll(dark, -1, 1)
    travel = close & ~near_dark
    # flood fill from the border through background-like pixels
    outside = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if travel[y, x] and not outside[y, x]: outside[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if travel[y, x] and not outside[y, x]: outside[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and travel[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True; q.append((ny, nx))
    # grow the outside region back over the background rim next to the outline
    for _ in range(2):
        grown = outside | np.roll(outside, 1, 0) | np.roll(outside, -1, 0) | np.roll(outside, 1, 1) | np.roll(outside, -1, 1)
        outside = grown & close
    # small enclosed pockets (between legs, under arms) that still look like background
    rest = close & ~outside
    seen = np.zeros((h, w), bool)
    for sy in range(h):
        for sx in range(w):
            if not rest[sy, sx] or seen[sy, sx]: continue
            comp = [(sy, sx)]; seen[sy, sx] = True; q.append((sy, sx))
            while q:
                y, x = q.popleft()
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and rest[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; comp.append((ny, nx)); q.append((ny, nx))
            if len(comp) <= pocket_max:
                for y, x in comp: outside[y, x] = True
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    # glow halos: everything the fill reaches with a looser tolerance (but which the
    # strict fill did not) becomes semi-transparent, fading with its distance from the background colour
    if soft > tol:
        diff = np.abs(a - bg).max(axis=2)
        loose = (diff <= soft) & ~near_dark
        reach = outside.copy(); q = deque([(y, x) for y in range(h) for x in range(w) if outside[y, x]])
        while q:
            y, x = q.popleft()
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and loose[ny, nx] and not reach[ny, nx]:
                    reach[ny, nx] = True; q.append((ny, nx))
        halo = reach & ~outside
        alpha[halo] = np.clip((diff[halo] - tol) / (soft - tol) * 255, 0, 255).astype(np.uint8)
        outside = outside | (alpha == 0)
    # soften the very edge one pixel so the JPEG halo does not read as a hard grey rim
    edge = outside.copy()
    inner = ~outside
    rim = inner & (np.roll(outside, 1, 0) | np.roll(outside, -1, 0) | np.roll(outside, 1, 1) | np.roll(outside, -1, 1))
    alpha[rim] = 200
    rgba = np.dstack([a.astype(np.uint8), alpha])
    ys, xs = np.where(alpha > 0)
    pad = 2
    bx0, by0, bx1, by1 = max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + 1 + pad), min(h, ys.max() + 1 + pad)
    rgba = rgba[by0:by1, bx0:bx1]
    race = {'h': 'human', 'd': 'demon', 'r': 'robot', 'm': 'mummy'}[uid[0]]
    out_dir = os.path.join(ROOT, 'assets', 'units', race)
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, uid + '.png')
    Image.fromarray(rgba, 'RGBA').save(out)
    fh, fw = rgba.shape[:2]
    # anchor: feet centre = bottom of the opaque area, horizontal centre of the lowest rows
    cols = np.where(rgba[-pad - 6:-pad, :, 3].max(axis=0) > 0)[0]
    ax = int(round((cols.min() + cols.max()) / 2)) if len(cols) else fw // 2
    entry = {'file': f'{race}/{uid}.png', 'w': int(fw), 'h': int(fh), 'ax': ax, 'ay': int(fh - pad), 'ppu': ppu, 'src': src, 'box': list(box)}
    mpath = os.path.join(ROOT, 'assets', 'units', 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    manifest[uid] = {**manifest.get(uid, {}), **entry}   # keep rig links and other extras
    json.dump(manifest, open(mpath, 'w'), indent=2)
    print(uid, '->', os.path.relpath(out, ROOT), f'{fw}x{fh} anchor ({ax},{entry["ay"]}) ppu {ppu}; {int(outside.sum())} px removed')
    return out


if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    opts = dict(zip(sys.argv[1::1], sys.argv[2::1]))
    src, x0, y0, x1, y1, uid = args[0], *map(int, args[1:5]), args[5]
    cut(src, (x0, y0, x1, y1), uid, ppu=int(opts.get("--ppu", 75)), tol=int(opts.get("--tol", 18)), pocket_max=int(opts.get("--pocket", 0)), soft=int(opts.get("--soft", 0)))
