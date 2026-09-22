"""Slice an AI-generated animation sheet into game frames.

    python tools/sheetslice.py <sheet> <unitId> [--target 52] [--debug]
    python tools/sheetslice.py docs/human/king h_king --bands "idle:5,walk:8,run:8,atk:7,atk2:7,atk3:5,hurt:6,death:5"

The sheet has labelled rows of frames on a dark background. Frames are found
as connected blobs (text labels and tiny projectiles are dropped by size),
grouped into rows ("bands") and mapped to animation names through --bands,
one entry per band in reading order; a band holding two animations side by
side is written "idle:6+move:7", and frames the game cannot use (a lone
effect, a wide breath row) are counted under the name "skip" and left out. Every frame is keyed from its local
background, downscaled by one common factor so the idle frame is --target px
tall (this turns the soft "pixel look" into real pixels), anchored on the
band's ground line, and packed into assets/units/<race>/<id>.sheet.png with
assets/units/<race>/<id>.anim.json. The manifest entry gets `anim`.

Without --bands the tool only prints the bands it found (and writes a debug
image with --debug) so you can write the mapping.

A sheet laid out in two columns whose rows do not line up (the left column
has ten short rows, the right one eight tall ones) is read one column at a
time with --cols <x>: the bands of the left column come first, then the
right column's.
"""
import json, os, sys, time
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH = os.environ.get('SCRATCH', os.path.join(ROOT, 'assets', 'units'))


def local_bg(a, block=64, tol=30):
    """Per-pixel background estimate, anchored on the sheet's own flat background.

    Averaging the darkest 60% of every block drifts onto the art wherever a big
    dark shape fills the block - the Knight Banneret's brown horse pulled the
    estimate to [39 25 18] against a [40 40 44] sheet, so the keyer deleted the
    horse and left the rider floating. Find the flat background colour first (it
    is far and away the most common colour on these sheets) and average only the
    pixels close to it: that still follows a vignette but can never follow art."""
    h, w, _ = a.shape
    vals, counts = np.unique((a // 4).reshape(-1, 3), axis=0, return_counts=True)
    glob = vals[counts.argmax()] * 4 + 2
    near = np.abs(a - glob).max(axis=2) <= tol
    bh, bw = -(-h // block), -(-w // block)
    grid = np.zeros((bh, bw, 3))
    for by in range(bh):
        for bx in range(bw):
            sl = (slice(by * block, (by + 1) * block), slice(bx * block, (bx + 1) * block))
            blk = a[sl][near[sl]]
            grid[by, bx] = np.median(blk, axis=0) if len(blk) >= block * block * 0.05 else glob
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
    """Sheet background: a pixel within `tol` of the local background estimate.
    Never judge by colour alone: steel armour, sword blades and spear shafts are
    mid greys too, and a "grey means background" rule lets the border flood fill
    eat straight through them (holes in the sprite, worst on the plate units).

    On a chroma-key sheet (flat magenta) the rule above still holds for the
    art, but the generator also leaves key-coloured spill: pink glows under the
    feet, pink motion streaks, a pink wash inside a spin ring. Those share the
    key's hue, and nothing in the art does, so on such a sheet a pixel whose
    colour points the same way as the key is background as well."""
    close = np.abs(a - bg).max(axis=2) <= tol
    mean = bg.reshape(-1, 3).mean(axis=0)
    if mean.max() - mean.min() > 80:
        key = mean - mean.mean(); key /= np.linalg.norm(key)
        c = a - a.mean(axis=2, keepdims=True); n = np.linalg.norm(c, axis=2)
        close |= (n > 40) & ((c @ key) / np.maximum(n, 1e-6) > 0.9)
    return close


def find_frames(a, bg, tol=26, min_h=40, min_area=1200):
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
        w_, h_ = x1 - x0, y1 - y0
        long_side, short_side = max(w_, h_), max(1, min(w_, h_))
        # rules printed on the sheet (the left border, the column dividers, the
        # hairline under each label) are long, straight and hollow: their bounding
        # box is mostly empty. Decorative end caps make them a few px wide, so
        # judge them by shape rather than by width. Real thin art - a falling
        # arrow, a spear - is stubbier (aspect ~7) and fills more of its box.
        line = ((w_ <= 3 and h_ > 30) or (h_ <= 3 and w_ > 30)
                or (long_side > 30 and long_side / short_side >= 12 and n < 0.5 * w_ * h_))
        # some sheets box every animation in a rounded panel (a huge, almost
        # empty component) inside a solid margin that runs the whole sheet edge.
        # No sprite or effect is that hollow or spans most of the sheet.
        panel = (w_ > 150 and h_ > 60 and n < 0.12 * w_ * h_) or w_ > 0.6 * w or h_ > 0.6 * h
        if h_ <= 26 or n < 60 or line or panel: small.append(i)
    # the row labels printed on the sheet ("IDLE", "ATTACK 1") are blobs of this
    # kind; remember them so a frame box that reaches into a label does not key
    # the lettering in as part of the sprite
    litter = np.isin(components.labels, small) if small else np.zeros_like(fg)
    if small: fg &= ~litter
    rows = fg.sum(axis=1)
    bands = []; y = 0
    while y < h:
        if rows[y] == 0: y += 1; continue
        y0 = y
        while y < h and not (rows[y:y + 4] == 0).all(): y += 1
        y1 = y
        if y1 - y0 >= min_h: bands.append((y0, y1))
    # two rows whose effects reach the rule between them (a faint death cloud
    # under a hurt row) come out as one band twice as tall as the rest: cut
    # such a band at its emptiest interior row
    if len(bands) >= 3:
        med = sorted(b[1] - b[0] for b in bands)[len(bands) // 2]
        out = []
        for (y0, y1) in bands:
            while y1 - y0 > 1.6 * med:
                lo, hi = y0 + int((y1 - y0) * 0.3), y1 - int((y1 - y0) * 0.3)
                cut = lo + int(np.argmin(rows[lo:hi]))
                if rows[cut] > 0.05 * rows[y0:y1].max(): break   # one tall row (a giant ultimate), not two rows touching
                out.append((y0, cut)); y0 = cut
            out.append((y0, y1))
        bands = out
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
    return boxes, fg, diff, litter


def split_to_count(fg, boxes, want):
    """Frames whose effects touch their neighbour come out merged; split the widest
    boxes at their emptiest interior column until the expected count is reached."""
    boxes = [list(b) for b in boxes]
    # a merged box of k figures is cut off one figure at a time, at the emptiest
    # column near where the first figure should end. Searching the whole middle
    # of the box instead finds the gap between an axe head and its owner's body
    # and leaves a sliver
    single = sum(b[2] - b[0] for b in boxes) / max(1, want)
    while len(boxes) < want:
        boxes.sort(key=lambda b: b[0])
        i = max(range(len(boxes)), key=lambda k: boxes[k][2] - boxes[k][0])
        x0, y0, x1, y1, n = boxes[i][:5]; cuts = boxes[i][5] if len(boxes[i]) > 5 else set()
        cols = fg[y0:y1, x0:x1].sum(axis=0)
        k = max(2, round(len(cols) / single))
        mid = len(cols) / k
        lo, hi = max(1, int(mid - single * 0.3)), min(len(cols) - 1, int(mid + single * 0.3))
        if hi - lo < 4: break
        cut = lo + int(np.argmin(cols[lo:hi]))
        left = fg[y0:y1, x0:x0 + cut]; right = fg[y0:y1, x0 + cut:x1]
        # the pieces remember which side was cut: the neighbour sits right there,
        # so the keyer must neither pad nor grow across that edge
        def tight(sub, ox, sides):
            yy = np.where(sub.any(axis=1))[0]; xx = np.where(sub.any(axis=0))[0]
            return [ox + xx.min(), y0 + yy.min(), ox + xx.max() + 1, y0 + yy.max() + 1, int(sub.sum()), sides]
        boxes[i:i + 1] = [tight(left, x0, cuts | {'right'}), tight(right, x0 + cut, cuts | {'left'})]
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


def key_frame(a, bg, box, tol=26, litter=None, pad=4, ylim=None):
    """Cut one frame with alpha from the sheet: flood fill from the border through background-like pixels."""
    x0, y0, x1, y1 = box[:4]; cuts = box[5] if len(box) > 5 else set()
    x0, y0, x1, y1 = max(0, x0 - (0 if 'left' in cuts else pad)), max(0, y0 - pad), min(a.shape[1], x1 + (0 if 'right' in cuts else pad)), min(a.shape[0], y1 + pad)
    # the box was found at the wide tolerance, so a part drawn in nearly the
    # sheet colour (the Hellhound's rump on its run row) can lie outside it.
    # Cutting there would start the fill inside the body and hollow it out:
    # grow the cut on any side where art still touches the edge
    H, W = a.shape[:2]
    top, bottom = ylim if ylim else (0, H)   # never grow into the row above or below
    for _ in range(6):
        reg = a[y0:y1, x0:x1]; art = ~is_bg(reg, bg[y0:y1, x0:x1], tol)
        if litter is not None: art &= ~dilate(litter[y0:y1, x0:x1], 2)   # a rule or label the body touches must not drag the cut along itself
        art[art.mean(axis=1) >= 0.95, :] = False; art[:, art.mean(axis=0) >= 0.95] = False   # not a rule
        # only the body itself may pull the cut outwards - the next frame's
        # nose poking in at the edge is a separate blob and must not
        comps = components(art)
        if not comps: break
        main = components.labels == (max(range(len(comps)), key=lambda i: comps[i][4]) + 1)
        gx0, gx1, gy0, gy1 = main[:, :2].any() and x0 > 0 and 'left' not in cuts, main[:, -2:].any() and x1 < W and 'right' not in cuts, main[:2].any() and y0 > top, main[-2:].any() and y1 < bottom
        if not (gx0 or gx1 or gy0 or gy1): break
        if gx0: x0 = max(0, x0 - 4)
        if gx1: x1 = min(W, x1 + 4)
        if gy0: y0 = max(top, y0 - 4)
        if gy1: y1 = min(bottom, y1 + 4)
    reg = a[y0:y1, x0:x1]; b = bg[y0:y1, x0:x1]
    close = is_bg(reg, b, tol)
    # a printed rule crossing the whole padded region (the hairline between two
    # rows, a column divider) is background too: no sprite fills a full row
    close[(~close).mean(axis=1) >= 0.95, :] = True
    close[:, (~close).mean(axis=0) >= 0.95] = True
    # a shorter rule (the underline of a label, a hairline that stops at the
    # panel edge) is a long thin run with empty rows on both sides; art never is
    frac = (~close).mean(axis=1)
    for y in range(4, len(frac) - 4):
        if frac[y] >= 0.5 and frac[y - 4:y - 1].max() < 0.15 and frac[y + 2:y + 5].max() < 0.15: close[y - 1:y + 2] = True
    frac = (~close).mean(axis=0)
    for x in range(4, len(frac) - 4):
        if frac[x] >= 0.5 and frac[x - 4:x - 1].max() < 0.15 and frac[x + 2:x + 5].max() < 0.15: close[:, x - 1:x + 2] = True
    # and any long thin blob on its own (a divider that stops short of the edge)
    for i, (cx0, cy0, cx1, cy1, n) in enumerate(components(~close), 1):
        cw, ch = cx1 - cx0, cy1 - cy0
        if (cw <= 4 and ch >= 30) or (ch <= 4 and cw >= 30): close[components.labels == i] = True
    h, w = close.shape
    # A body drawn in nearly the sheet colour is safe only while its outline is
    # closed: one soft spot in the line and the fill pours in and eats the whole
    # torso (the Hellhound's run row). Thicken the art by one pixel before
    # filling, so gaps up to two pixels wide are sealed, then give the pixel
    # back so the edge stays where it was drawn.
    def fill(r):
        sealed = close & ~dilate(~close, r)
        out = np.zeros((h, w), bool); q = deque()
        for x in range(w):
            for y in (0, h - 1):
                if sealed[y, x] and not out[y, x]: out[y, x] = True; q.append((y, x))
        for y in range(h):
            for x in (0, w - 1):
                if sealed[y, x] and not out[y, x]: out[y, x] = True; q.append((y, x))
        while q:
            y, x = q.popleft()
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and sealed[ny, nx] and not out[ny, nx]:
                    out[ny, nx] = True; q.append((ny, nx))
        return dilate(out, r) & close
    outside = fill(1)
    if litter is not None: outside |= dilate(litter[y0:y1, x0:x1], 2)   # plus the fringe a narrower keying tolerance adds around a rule
    # a pocket the fill cannot reach (between the legs, inside a spin ring) is
    # sheet too when it is flat sheet colour; only a pocket with some shading
    # in it can be a body drawn in the sheet's own colour
    dist = np.abs(reg - b).max(axis=2)
    for i, c in enumerate(components(close & ~outside), 1):
        if c[4] >= 20:
            pocket = components.labels == i
            if np.median(dist[pocket]) <= 3: outside |= pocket
    # despill: on a saturated sheet (magenta) the anti-aliased rim of the sprite
    # is art mixed with sheet colour and would stay as a pink fringe. Any edge
    # pixel that sits much nearer the sheet colour than the art does is such a
    # mix: keep it (it is the sprite's edge) but repaint it from the pixels
    # just inside
    opaque = ~outside
    spill = np.zeros_like(opaque)
    for _ in range(2):
        rim = opaque & ~spill & dilate(~opaque | spill, 1)
        spill |= rim & (dist < 140)
    rgb = reg.astype(float)
    if spill.any(): rgb = inpaint(rgb, opaque & ~spill, steps=4)
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    rgba = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha])
    return Image.fromarray(rgba, 'RGBA'), (x0, y0)


def inpaint(rgb, valid, steps=12):
    """Give every pixel outside `valid` the colour of its nearest valid neighbour."""
    filled = valid.copy(); col = rgb * valid[..., None]
    for _ in range(steps):
        if filled.all(): break
        acc = np.zeros_like(col); cnt = np.zeros(valid.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(filled, (dy, dx), (0, 1)); sc = np.roll(col, (dy, dx), (0, 1))
            acc += sc * sh[..., None]; cnt += sh
        grow = ~filled & (cnt > 0)
        col[grow] = acc[grow] / cnt[grow][:, None]; filled |= grow
    if not filled.all() and valid.any(): col[~filled] = np.median(rgb[valid], axis=0)
    return col


def downscale(img, w2, h2):
    """BOX-downscale an RGBA frame without letting transparent pixels bleed colour.

    Pillow premultiplies alpha while resizing, so a keyed-out pixel counts as
    black. Where the keyer leaked into a body drawn in almost the sheet colour
    (the Hellhound, grey-purple on grey) the leak is later refilled as a
    pinhole - and came back as a black speck. Paint every transparent pixel
    with the colour of its nearest opaque neighbour first and scale colour and
    alpha as separate bands, so a refilled hole is fur, not soot, and edges do
    not darken."""
    rgba = np.asarray(img); rgb = rgba[..., :3].astype(float); a = rgba[..., 3] > 0
    col = inpaint(rgb, a)
    small_rgb = Image.fromarray(col.astype(np.uint8), 'RGB').resize((w2, h2), Image.BOX)
    small_a = Image.fromarray(rgba[..., 3], 'L').resize((w2, h2), Image.BOX)
    return Image.merge('RGBA', (*small_rgb.split(), small_a))


def erase_rules(a, bg, tol=8, min_len=100):
    """Paint the sheet's printed rules out before anything else looks at it.

    Hairlines under labels, row separators and column dividers are long thin
    runs with empty pixels on both sides along most of their length. Found
    that way they can be removed even where a sprite's foot or a drawn shadow
    touches them (the Infernal Sorcerer stood on the rule under its row, so
    every rule test that looked for a *separate* blob missed it). Only pixels
    near the rule's own colour are painted, so the touching foot keeps its
    pixels."""
    a = a.copy()
    art = ~is_bg(a, bg, tol)
    for axis in (0, 1):
        m = art if axis == 0 else art.T
        src = a if axis == 0 else a.transpose(1, 0, 2)
        bgs = bg if axis == 0 else bg.transpose(1, 0, 2)
        H, W = m.shape
        for y in range(3, H - 3):
            row = m[y]
            if row.sum() < min_len: continue
            x = 0
            while x < W:
                if not row[x]: x += 1; continue
                x0 = x
                while x < W and row[x]: x += 1
                if x - x0 < min_len: continue
                above = m[y - 3:y - 1, x0:x].mean(); below = m[y + 2:y + 4, x0:x].mean()
                if above > 0.15 or below > 0.15: continue
                colour = np.median(src[y, x0:x], axis=0)
                band = src[y - 1:y + 2, x0:x]
                near = np.abs(band - colour).max(axis=2) <= 40
                band[near] = bgs[y - 1:y + 2, x0:x][near]
    return a


def auto_tol(bg):
    """How far from the background a pixel must sit before it counts as art.

    A flat mid-grey sheet leaves plenty of room, so a wide tolerance can be used
    and it also swallows the soft ground shadow drawn under the character (the
    game draws its own). On a near-black sheet the dark parts of the art - a
    navy robe, a black outline - sit just as close to the background, and that
    same tolerance deletes the character's legs. So scale it with how bright the
    background is."""
    return int(min(26, max(10, round(bg.mean() * 0.52))))


def knee_tol(a, bg, box, litter, upper):
    """Lower the tolerance when it is eating the art itself.

    Brightness alone cannot tell a dark sprite from a dark sheet: the Hellhound
    is a grey-purple wolf on a grey-55 sheet, and at tol 26 the keyer deleted a
    third of its body (the legs and flanks vanished on the run row). Key the
    first frame at falling tolerances and stop where the count of kept pixels
    stops growing: the last few percent are anti-aliased edges and the drawn
    ground shadow, worth losing; a cliff is the body."""
    ref = (np.asarray(key_frame(a, bg, box, tol=8, litter=litter)[0])[..., 3] > 0).sum()
    for t in range(upper, 8, -2):
        n = (np.asarray(key_frame(a, bg, box, tol=t, litter=litter)[0])[..., 3] > 0).sum()
        if n >= 0.95 * ref: return t
    return 8


def slice_sheet(src, uid, bands_spec=None, target=52, debug=False, tol=None, col_cuts=None):
    im = Image.open(os.path.join(ROOT, src)).convert('RGB'); a = np.asarray(im).astype(int)
    bg = local_bg(a)
    a = erase_rules(a, bg)
    auto = tol is None
    keyed = bg.reshape(-1, 3).mean(axis=0); keyed = keyed.max() - keyed.min() > 80   # a chroma-key sheet (flat magenta): nothing drawn is near it
    if auto:
        tol = 40 if keyed else auto_tol(bg)
        auto = not keyed
        print(f'  background {bg.mean():.0f}{" (chroma key)" if keyed else ""} -> tol {tol}')
    cuts = [0] + sorted(col_cuts or []) + [a.shape[1]]
    boxes = []; bands = []; fg = np.zeros(a.shape[:2], bool); litter = fg.copy()
    for x0, x1 in zip(cuts, cuts[1:]):
        bx, cfg, _, clit = find_frames(a[:, x0:x1], bg[:, x0:x1], tol=tol)
        for b in bx: b[0] += x0; b[2] += x0
        fg[:, x0:x1] = cfg; litter[:, x0:x1] = clit
        boxes += bx; bands += bands_of(bx)
    # frames are FOUND at the wide tolerance (at a narrow one the sheet's rules,
    # vignette and drawn shadows join every row into one blob) and KEYED at the
    # narrow one, with a wider pad so parts the wide pass called background
    # (a dark leg below the box) are still inside the cut
    ktol, kpad = tol, 4
    if auto and boxes:
        knee = knee_tol(a, bg, bands[0]['boxes'][0], litter, tol)
        if knee < tol: print(f'  tol {tol} eats the art -> keying at {knee} (per frame)'); ktol, kpad = knee, 10
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
        widths = sorted(b[2] - b[0] for b in bx); med = widths[len(widths) // 2]
        for b in bx:
            if b[2] - b[0] < med * 0.4: print(f"  warning: suspicious narrow frame at x={b[0]} y={band['y0']} ({b[2] - b[0]}px wide) - check the frame counts for {[n for n, _ in parts]}")
        i = 0
        for name, count in parts:
            count = int(count)
            take = bx[i:i + count]; i += count
            if len(take) < count: print(f'  warning: band for {name} has only {len(take)} of {count} frames')
            if name == 'skip': continue   # frames the game has no use for (a lone flame, a wide breath row) are not packed
            for box in take:
                k = counters.get(name, 0); counters[name] = k + 1
                # the knee moves from frame to frame (a motion-blurred run row sits
                # even closer to the sheet colour than the idle), so find it per frame
                ft = knee_tol(a, bg, box, litter, ktol) if ktol < tol else ktol
                img, org = key_frame(a, bg, box, tol=ft, litter=litter, pad=kpad, ylim=(band['y0'] - 8, band['y1'] + 8))
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
        small = downscale(img, w2, h2)
        arr = np.asarray(small).copy(); al = arr[..., 3] > 110
        if not al.any(): continue
        # drop stray fragments: a small island that does not touch the body is a
        # piece of the neighbouring frame the split box caught (the next rider's
        # banner pole), never part of this pose
        comps = components(al); labels = components.labels
        if len(comps) > 1:
            main = max(range(len(comps)), key=lambda i: comps[i][4]); mn = comps[main][4]
            near = dilate(labels == main + 1, 2)
            # ... and so is a bigger detached island that sits on the left or
            # right edge of the box (the tip of the next frame's sword arc)
            edge = lambda c: c[0] == 0 or c[2] == al.shape[1]
            drop = [i + 1 for i, c in enumerate(comps)
                    if i != main and (c[4] < mn * 0.06 or (edge(c) and c[4] < mn * 0.3)) and not (near & (labels == i + 1)).any()]
            if drop: al &= ~np.isin(labels, drop)
        # close pinholes: a small transparent island the outside cannot reach is a
        # hole the downscale punched through the sprite. A big one is a gap the
        # artist drew - between the legs, under a rearing horse - and filling it
        # would paste a block of sheet background into the sprite
        gaps = components(~al); glabels = components.labels
        keep_open = {glabels[y, x] for y in (0, al.shape[0] - 1) for x in range(al.shape[1])}
        keep_open |= {glabels[y, x] for x in (0, al.shape[1] - 1) for y in range(al.shape[0])}
        limit = max(8, 0.02 * al.sum())
        sealed = [i + 1 for i, g in enumerate(gaps) if i + 1 not in keep_open and g[4] <= limit]
        if sealed: al |= np.isin(glabels, sealed)
        arr[..., 3] = np.where(al, 255, 0)
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
    data = {'sheet': f'{race}/{uid}.sheet.png', 'ppu': 24, 'src': src, 'target': target, 'bands': bands_spec, 'tol': int(tol), 'keyTol': int(ktol), 'rev': int(time.time()), **({'cols': col_cuts} if col_cuts else {}),   # 24 = the game's world pixels per unit
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
    slice_sheet(args[0], args[1], bands_spec=opts.get('--bands'), target=int(opts.get('--target', 52)), debug='--debug' in sys.argv, tol=int(opts['--tol']) if '--tol' in opts else None,
                col_cuts=[int(x) for x in opts['--cols'].split(',')] if '--cols' in opts else None)
