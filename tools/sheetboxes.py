"""Find character bounding boxes on a concept sheet: python tools/sheetboxes.py docs/human.jpg [tol]
Prints boxes (x0 y0 x1 y1) of large non-background blobs and writes <sheet>_boxes.png to the scratch dir for checking."""
import sys, os
import numpy as np
from PIL import Image, ImageDraw
src = sys.argv[1]; tol = int(sys.argv[2]) if len(sys.argv) > 2 else 14
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(int); h, w, _ = a.shape
# background = per-row median of the left/right margins (grey gradient)
bg = np.median(np.concatenate([a[:, :6], a[:, -6:]], axis=1), axis=1)[:, None, :]
mask = (np.abs(a - bg).max(axis=2) > tol)
# drop thin bright text: erode then dilate (opening) with a 3x3 window
def shift(m, dy, dx): return np.roll(np.roll(m, dy, 0), dx, 1)
er = mask.copy()
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1): er &= shift(mask, dy, dx)
dil = er.copy()
for _ in range(3):
    n = dil.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1): n |= shift(dil, dy, dx)
    dil = n
# connected components (BFS on a coarse grid for speed)
lab = np.zeros((h, w), int); boxes = []; cur = 0
from collections import deque
for y in range(h):
    for x in range(w):
        if dil[y, x] and not lab[y, x]:
            cur += 1; q = deque([(y, x)]); lab[y, x] = cur; x0 = x1 = x; y0 = y1 = y; area = 0
            while q:
                cy, cx = q.popleft(); area += 1
                x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and dil[ny, nx] and not lab[ny, nx]: lab[ny, nx] = cur; q.append((ny, nx))
            if area > 1500 and (y1 - y0) > 40: boxes.append((x0 - 2, y0 - 2, x1 + 3, y1 + 3, area))
boxes.sort(key=lambda b: (b[1] // 120, b[0]))
d = ImageDraw.Draw(im)
for i, (x0, y0, x1, y1, area) in enumerate(boxes):
    d.rectangle([x0, y0, x1, y1], outline=(0, 255, 0), width=2); d.text((x0 + 3, y0 + 3), str(i), fill=(255, 255, 0))
    print(i, x0, y0, x1, y1, 'area', area)
out = os.path.join(os.environ.get('SCRATCH', '.'), os.path.basename(src).split('.')[0] + '_boxes.png')
im.save(out); print('wrote', out)
