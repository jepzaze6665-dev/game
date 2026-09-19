"""Turn a cut-out character PNG into a pixel-art sprite.
    python tools/pixelate.py assets/units/human/h_swordsman.png 48 [colors=20] [out.png]
Downscales to the target height with area averaging, snaps colours to a small
palette (median cut), re-inks a 1 px dark outline and hard alpha.
"""
import sys
import numpy as np
from PIL import Image

def pixelate(src, height, colors=20):
    im = Image.open(src).convert('RGBA')
    k = height / im.height
    w = max(1, round(im.width * k))
    small = im.resize((w, height), Image.BOX)
    a = np.asarray(small)
    alpha = a[..., 3] > 200          # drops soft glow halos
    # quantize the opaque colours only
    rgb = Image.fromarray(a[..., :3], 'RGB')
    mask = Image.fromarray((alpha * 255).astype(np.uint8), 'L')
    q = rgb.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    out = np.dstack([np.asarray(q), (alpha * 255).astype(np.uint8)])
    # 1 px dark outline: opaque pixels next to transparent become ink
    ink = np.array([27, 16, 38, 255], np.uint8)
    edge = alpha & ~(np.roll(alpha, 1, 0) & np.roll(alpha, -1, 0) & np.roll(alpha, 1, 1) & np.roll(alpha, -1, 1))
    out[edge] = ink
    return Image.fromarray(out, 'RGBA')

if __name__ == '__main__':
    src, height = sys.argv[1], int(sys.argv[2])
    colors = int(sys.argv[3]) if len(sys.argv) > 3 else 20
    out = sys.argv[4] if len(sys.argv) > 4 else src.replace('.png', f'_px{height}.png')
    pixelate(src, height, colors).save(out); print('wrote', out)
