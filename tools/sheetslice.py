"""Slice an AI-generated animation sheet into game frames.

    python tools/sheetslice.py <sheet> <unitId> [--target 52] [--debug]
    python tools/sheetslice.py docs/human/king h_king --bands "idle:5,walk:8,run:8,atk:7,atk2:7,atk3:5,hurt:6,death:5"

The sheet has labelled rows of frames on a dark background. Frames are found
as connected blobs (text labels and tiny projectiles are dropped by size),
grouped into rows ("bands") and mapped to animation names through --bands,
one entry per band in reading order; a band holding two animations side by
side is written "idle:6+move:7". Every frame is keyed from its local
background, downscaled by one common factor so the idle frame is --target px
tall (this turns the soft "pixel look" into real pixels), anchored on the
band's ground line, and packed into assets/units/<race>/<id>.sheet.png with
assets/units/<race>/<id>.anim.json. The manifest entry gets `anim`.

Without --bands the tool only prints the bands it found (and writes a debug
image with --debug) so you can write the mapping.
"""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH = os.environ.get('SCRATCH', os.path.join(ROOT, 'assets', 'units'))


def local_bg(a, block=64):
    """Per-pixel background estimate: median of the darkest 60% of each block, smoothed."""
    h, w, _ = a.shape
    bh, bw = -(-h // block), -(-w // block)
    grid = np.zeros((bh, bw, 3))
    for by in range(bh):
        for bx in range(bw):
            blk = a[by * block:(by + 1) * block, bx * block:(bx + 1) * block].reshape(-1, 3)
            lum = blk.sum(axis=1)
            keep = blk[lum <= np.percentile(lum, 60)]
            grid[by, bx] = np.median(keep, axis=0)
    big = Image.fromarray(grid.astype(np.uint8)).resize((w, h), Image.BILINEAR)
    return np.asarray(big).astype(int)


def components(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32); boxes = []; cur = 0
    for y in range(h):
        row = mask[y]
        for x in np.where(row & (lab[y] == 0))[0]:
            if lab[y, x]: continue
            cur += 1; q = deque([(y, x)]); lab[y, x] = cur; x0 = x1 = x; y0 = y1 = y; n = 0
            while q:
                cy, cx = q.popleft(); n += 1
                if cx < x0: x0 = cx
                if cx > x1: x1 = cx
                if cy < y0: y0 = cy
                if cy > y1: y1 = cy
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = cur; q.append((ny, nx))
            boxes.append([x0, y0, x1 + 1, y1 + 1, n])
    components.labels = lab
    return boxes


def dilate(m, r):
    out = m.copy()
    for _ in range(r):
        n = out.copy()
        n[1:] |= out[:-1]; n[:-1] |= out[1:]; n[:, 1:] |= out[:, :-1]; n[:, :-1] |= out[:, 1:]
        out = n
    return out


def is_bg(a, bg, tol):
    """Sheet background: a flat dark grey. A pixel is background when it is grey and in
    the sheet's grey range, or within `tol` of the local background estimate."""
    mx, mn = a.max(axis=2), a.min(axis=2); lum = a.mean(axis=2)
    grey = (mx - mn <= 12) & (lum >= 34) & (lum <= 96)
    return grey | (np.abs(a - bg).max(axis=2) <= tol)


def find_frames(a, bg, tol=26, min_h=34, min_area=500):
    """Frames = bands of rows (separated by empty rows) split at empty columns."""
    diff = np.abs(a - bg).max(axis=2)
    fg = ~is_bg(a, bg, tol)
    h, w = fg.shape
    # horizontal separator lines: a single contiguous run across most of the width
    for y in range(h):
        row = fg[y]
        if row.mean() < 0.5: continue
        best = run = 0
        for v in row:
            run = run + 1 if v else 0
            if run > best: best = run
        if best >= 0.6 * w: fg[y] = False
    # drop small blobs: labels, sparkles, stray projectiles
    small = []
    for i, (x0, y0, x1, y1, n) in enumerate(components(fg), 1):
        if (y1 - y0) <= 26 or n < 60: small.append(i)
    if small: fg &= ~np.isin(components.labels, small)
    rows = fg.sum(axis=1)
    bands = []; y = 0
    while y < h:
        if rows[y] == 0: y += 1; continue
        y0 = y
        while y < h and not (rows[y:y + 4] == 0).all(): y += 1
        y1 = y
        if y1 - y0 >= min_h: bands.append((y0, y1))
    boxes = []
    for (y0, y1) in bands:
        cols = fg[y0:y1].sum(axis=0)
        segs = []; x = 0
        while x < w:
            if cols[x] == 0: x += 1; continue
            x0 = x
            while x < w and not (cols[x:x + 5] == 0).all(): x += 1
            segs.append([x0, x])
        # merge slivers (detached effects) into the nearer neighbour
        widths = sorted(s1 - s0 for s0, s1 in segs); med = widths[len(widths) // 2] if widths else 1
        merged = []
        for s0, s1 in segs:
            if merged and (s1 - s0) < med * 0.45 and s0 - merged[-1][1] < 14: merged[-1][1] = s1
            else: merged.append([s0, s1])
        for s0, s1 in merged:
            sub = fg[y0:y1, s0:s1]; yy = np.where(sub.any(axis=1))[0]
            if len(yy) == 0: continue
            by0, by1 = y0 + yy.min(), y0 + yy.max() + 1
            n = int(sub.sum())
            if by1 - by0 >= min_h and n >= min_area: boxes.append([s0, by0, s1, by1, n])
    return boxes, fg, diff


def split_to_count(fg, boxes, want):
    """Frames whose effects touch their neighbour come out merged; split the widest
    boxes at their emptiest interior column until the expected count is reached."""
    boxes = [list(b) for b in boxes]
    while len(boxes) < want:
        boxes.sort(key=lambda b: b[0])
        i = max(range(len(boxes)), key=lambda k: boxes[k][2] - boxes[k][0])
        x0, y0, x1, y1, n = boxes[i]
        cols = fg[y0:y1, x0:x1].sum(axis=0)
        lo, hi = int(len(cols) * 0.2), int(len(cols) * 0.8)
        if hi - lo < 4: break
        cut = lo + int(np.argmin(cols[lo:hi]))
        left = fg[y0:y1, x0:x0 + cut]; right = fg[y0:y1, x0 + cut:x1]
        def tight(sub, ox):
            yy = np.where(sub.any(axis=1))[0]; xx = np.where(sub.any(axis=0))[0]
            return [ox + xx.min(), y0 + yy.min(), ox + xx.max() + 1, y0 + yy.max() + 1, int(sub.sum())]
        boxes[i:i + 1] = [tight(left, x0), tight(right, x0 + cut)]
    boxes.sort(key=lambda b: b[0])
    return boxes


def bands_of(boxes, gap=50):
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    bands = []
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        if bands and abs(cy - bands[-1]['cy']) < gap and not (b[1] > bands[-1]['y1'] or b[3] < bands[-1]['y0']):
            band = bands[-1]; band['boxes'].append(b)
            band['y0'] = min(band['y0'], b[1]); band['y1'] = max(band['y1'], b[3])
            band['cy'] = (band['y0'] + band['y1']) / 2
        else:
            bands.append({'boxes': [b], 'y0': b[1], 'y1': b[3], 'cy': cy})
    for band in bands: band['boxes'].sort(key=lambda b: b[0])
    return bands


def key_frame(a, bg, box, tol=26):
    """Cut one frame with alpha from the sheet: flood fill from the border through background-like pixels."""
    x0, y0, x1, y1, _ = box
    pad = 4
    x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(a.shape[1], x1 + pad), min(a.shape[0], y1 + pad)
    reg = a[y0:y1, x0:x1]; b = bg[y0:y1, x0:x1]
    close = is_bg(reg, b, tol)
    h, w = close.shape
    outside = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x] and not outside[y, x]: outside[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not outside[y, x]: outside[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and close[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True; q.append((ny, nx))
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    rgba = np.dstack([reg.astype(np.uint8), alpha])
    return Image.fromarray(rgba, 'RGBA'), (x0, y0)


def slice_sheet(src, uid, bands_spec=None, target=52, debug=False, tol=26):
    im = Image.open(os.path.join(ROOT, src)).convert('RGB'); a = np.asarray(im).astype(int)
    bg = local_bg(a)
    boxes, fg, diff = find_frames(a, bg, tol=tol)
    bands = bands_of(boxes)
    print(f'{src}: {len(boxes)} frames in {len(bands)} bands:', ', '.join(f'band{i}={len(b["boxes"])}' for i, b in enumerate(bands)))
    if debug or not bands_spec:
        dbg = im.copy(); d = ImageDraw.Draw(dbg)
        for i, band in enumerate(bands):
            for j, b in enumerate(band['boxes']):
                d.rectangle(b[:4], outline=(0, 255, 0), width=2); d.text((b[0] + 2, b[1] + 2), f'{i}.{j}', fill=(255, 255, 0))
        out = os.path.join(SCRATCH, os.path.basename(src).split('.')[0] + '_frames.png'); dbg.save(out); print('debug ->', out)
    if not bands_spec: return
    # ---- map bands to animations ----
    spec = [[tuple(p.split(':')) for p in band.split('+')] for band in bands_spec.split(',')]
    if len(spec) != len(bands): raise SystemExit(f'--bands lists {len(spec)} bands but the sheet has {len(bands)}')
    frames = []   # (anim, index, image, origin, box)
    counters = {}   # an animation may continue on the next band (long death rows)
    for band, parts in zip(bands, spec):
        want = sum(int(c) for _, c in parts)
        bx = split_to_count(fg, band['boxes'], want)
        if len(bx) != want: print(f"  warning: band at y={band['y0']} has {len(bx)} frames, expected {want}")
        i = 0
        for name, count in parts:
            count = int(count)
            take = bx[i:i + count]; i += count
            if len(take) < count: print(f'  warning: band for {name} has only {len(take)} of {count} frames')
            for box in take:
                k = counters.get(name, 0); counters[name] = k + 1
                img, org = key_frame(a, bg, box, tol=tol)
                frames.append({'anim': name, 'i': k, 'img': img, 'org': org, 'box': box, 'band': band})
    # ---- common scale from the idle frame height ----
    idle = [f for f in frames if f['anim'] == 'idle'] or frames
    ref = np.asarray(idle[0]['img'])[..., 3] > 0
    ys = np.where(ref.any(axis=1))[0]; ref_h = ys.max() - ys.min() + 1
    factor = ref_h / target
    print(f'  idle frame {ref_h}px tall -> scale 1/{factor:.2f} -> {target}px')
    # ---- ground line per band (median bottom of opaque pixels in sheet coords) ----
    for band in bands:
        bottoms = []
        for f in frames:
            if f['band'] is band:
                al = np.asarray(f['img'])[..., 3] > 0; yy = np.where(al.any(axis=1))[0]
                if len(yy): bottoms.append(f['org'][1] + yy.max() + 1)
        band['ground'] = float(np.median(bottoms)) if bottoms else band['y1']
    # ---- downscale, trim, anchor ----
    out_frames = []
    for f in frames:
        img = f['img']
        w2, h2 = max(1, round(img.width / factor)), max(1, round(img.height / factor))
        small = img.resize((w2, h2), Image.BOX)
        arr = np.asarray(small).copy(); al = arr[..., 3] > 110
        arr[..., 3] = np.where(al, 255, 0)
        if not al.any(): continue
        yy, xx = np.where(al)
        x0, y0, x1, y1 = xx.min(), yy.min(), xx.max() + 1, yy.max() + 1
        arr = arr[y0:y1, x0:x1]
        # feet: centre of the opaque columns in the bottom quarter of the sprite
        foot = al[y0:y1, x0:x1][int((y1 - y0) * 0.75):]
        cols = np.where(foot.any(axis=0))[0]
        ax = int(round((cols.min() + cols.max()) / 2)) if len(cols) else (x1 - x0) // 2
        ground = (f['band']['ground'] - f['org'][1]) / factor - y0
        ay = int(round(ground))
        out_frames.append({'key': f"{f['anim']}{f['i']}", 'anim': f['anim'], 'img': Image.fromarray(arr, 'RGBA'), 'ax': ax, 'ay': ay})
    # ---- pack ----
    pad = 1; W = 1024
    out_frames.sort(key=lambda f: -f['img'].height)
    x = pad; y = pad; rowh = 0; placed = []
    for f in out_frames:
        w, h = f['img'].size
        if x + w + pad > W: x = pad; y += rowh + pad; rowh = 0
        placed.append((x, y)); x += w + pad; rowh = max(rowh, h)
    sheet = Image.new('RGBA', (W, y + rowh + pad), (0, 0, 0, 0))
    for f, (px, py) in zip(out_frames, placed): sheet.paste(f['img'], (px, py))
    race = {'h': 'human', 'd': 'demon', 'r': 'robot', 'm': 'mummy'}[uid[0]]
    out_dir = os.path.join(ROOT, 'assets', 'units', race); os.makedirs(out_dir, exist_ok=True)
    sheet.save(os.path.join(out_dir, uid + '.sheet.png'))
    anims = {}
    for f in out_frames: anims.setdefault(f['anim'], []).append(f['key'])
    for k in anims: anims[k].sort(key=lambda s: int(''.join(c for c in s[len(k):] if c.isdigit()) or 0))
    data = {'sheet': f'{race}/{uid}.sheet.png', 'ppu': 24, 'src': src, 'target': target,   # 24 = the game's world pixels per unit
            'frames': {f['key']: [px, py, f['img'].width, f['img'].height, f['ax'], f['ay']] for f, (px, py) in zip(out_frames, placed)},
            'anims': anims}
    json.dump(data, open(os.path.join(out_dir, uid + '.anim.json'), 'w'), indent=1)
    mpath = os.path.join(ROOT, 'assets', 'units', 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    entry = manifest.get(uid, {})
    idle0 = next(f for f in out_frames if f['key'] == anims.get('idle', [out_frames[0]['key']])[0])
    entry.update({'anim': f'{race}/{uid}.anim.json', 'w': idle0['img'].width, 'h': idle0['img'].height, 'ax': idle0['ax'], 'ay': idle0['ay'], 'ppu': data['ppu']})
    entry.setdefault('file', f'{race}/{uid}.png')
    manifest[uid] = entry
    json.dump(manifest, open(mpath, 'w'), indent=2)
    print(f'  wrote {uid}: {len(out_frames)} frames, sheet {sheet.size}, anims {{{", ".join(f"{k}:{len(v)}" for k, v in anims.items())}}}')


if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    opts = dict(zip(sys.argv[1::1], sys.argv[2::1]))
    slice_sheet(args[0], args[1], bands_spec=opts.get('--bands'), target=int(opts.get('--target', 52)), debug='--debug' in sys.argv, tol=int(opts.get('--tol', 26)))
