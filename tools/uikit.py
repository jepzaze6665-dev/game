"""Generate the pixel UI kit (9-slice frames, buttons, ornaments) into assets/ui/.

Everything is drawn at 1x and scaled by CSS `border-image` with
`image-rendering: pixelated`, so all art here is plain flat pixels.

    python tools/uikit.py
"""
from PIL import Image
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'ui')
os.makedirs(OUT, exist_ok=True)

INK = (13, 11, 20, 255)
T = (0, 0, 0, 0)

# light, mid, dark, deep - one ramp per material
RAMPS = {
    'gold':    ((255, 241, 168), (245, 197, 66), (212, 146, 27), (143, 90, 16)),
    'slate':   ((141, 147, 184), (92, 98, 140), (58, 62, 104), (30, 32, 58)),
    'human':   ((160, 214, 255), (74, 144, 226), (36, 94, 168), (18, 51, 94)),
    'demon':   ((255, 154, 122), (232, 69, 44), (165, 43, 28), (77, 20, 16)),
    'robot':   ((176, 246, 255), (56, 217, 234), (26, 142, 160), (14, 74, 85)),
    'mummy':   ((255, 224, 138), (224, 178, 60), (163, 122, 28), (77, 56, 16)),
    'green':   ((178, 255, 178), (79, 208, 98), (40, 140, 70), (18, 70, 40)),
}


def px(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), c if len(c) == 4 else c + (255,))


def ring(im, i, c):
    """Draw the i-th concentric ring (0 = outermost)."""
    w, h = im.size
    for x in range(i, w - i):
        px(im, x, i, c); px(im, x, h - 1 - i, c)
    for y in range(i, h - i):
        px(im, i, y, c); px(im, w - 1 - i, y, c)


def frame(name, ramp, size=30, corner=True):
    """Ornate 9-slice frame: ink, light, mid, mid, dark, ink; square corner studs."""
    light, mid, dark, deep = ramp
    im = Image.new('RGBA', (size, size), T)
    ring(im, 0, INK)
    ring(im, 1, light)
    ring(im, 2, mid)
    ring(im, 3, mid)
    ring(im, 4, dark)
    ring(im, 5, INK)
    # bottom/right edges sit in shadow
    for x in range(1, size - 1):
        px(im, x, size - 2, dark)
    for y in range(1, size - 1):
        px(im, size - 2, y, dark)
    if corner:
        for (cx, cy) in [(0, 0), (size - 9, 0), (0, size - 9), (size - 9, size - 9)]:
            # 9x9 stud: ink outline, light top-left bevel, dark bottom-right, deep rivet
            for y in range(9):
                for x in range(9):
                    px(im, cx + x, cy + y, INK)
            for y in range(1, 8):
                for x in range(1, 8):
                    px(im, cx + x, cy + y, mid)
            for k in range(1, 8):
                px(im, cx + k, cy + 1, light); px(im, cx + 1, cy + k, light)
                px(im, cx + k, cy + 7, dark); px(im, cx + 7, cy + k, dark)
            for (x, y) in [(4, 3), (3, 4), (5, 4), (4, 5)]:
                px(im, cx + x, cy + y, deep)
            px(im, cx + 4, cy + 4, INK)
    im.save(os.path.join(OUT, f'frame_{name}.png'))


def thin(name, ramp, size=12):
    """Plain 9-slice border for inner boxes: ink, mid, ink (dark on the shadow sides)."""
    light, mid, dark, deep = ramp
    im = Image.new('RGBA', (size, size), T)
    ring(im, 0, INK)
    ring(im, 1, mid)
    ring(im, 2, INK)
    for x in range(1, size - 1):
        px(im, x, size - 2, dark)
    for y in range(1, size - 1):
        px(im, size - 2, y, dark)
    im.save(os.path.join(OUT, f'thin_{name}.png'))


def button(name, ramp, trim=RAMPS['gold'], size=24):
    """Button face with a gold trim: ink, trim, ink, face (highlight top, shade bottom)."""
    light, mid, dark, deep = ramp
    tl, tm, td, _ = trim
    im = Image.new('RGBA', (size, size), mid + (255,))
    ring(im, 0, INK)
    ring(im, 1, tm)
    ring(im, 2, INK)
    for x in range(2, size - 2):
        px(im, x, 1, tl)          # trim highlight on top
        px(im, x, size - 2, td)   # trim shade at the bottom
        px(im, x, 3, light); px(im, x, 4, light)
        px(im, x, size - 4, dark); px(im, x, size - 5, dark); px(im, x, size - 6, dark)
    for y in range(3, size - 3):
        px(im, 3, y, light)
        px(im, size - 4, y, dark)
    px(im, 3, 3, light); px(im, 3, 4, light)
    im.save(os.path.join(OUT, f'btn_{name}.png'))


def chip(name, ramp, size=12):
    """Small bevelled tile for HUD chips / tags: ink, mid, deep fill."""
    light, mid, dark, deep = ramp
    im = Image.new('RGBA', (size, size), deep + (255,))
    ring(im, 0, INK)
    ring(im, 1, mid)
    for x in range(1, size - 1):
        px(im, x, size - 2, dark)
    for y in range(1, size - 1):
        px(im, size - 2, y, dark)
    im.save(os.path.join(OUT, f'chip_{name}.png'))


def sprite(name, rows, pal):
    im = Image.new('RGBA', (len(rows[0]), len(rows)), T)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                px(im, x, y, pal[ch])
    im.save(os.path.join(OUT, name + '.png'))


def gold_pal(extra=None):
    l, m, d, deep = RAMPS['gold']
    p = {'x': INK, 'l': l, 'm': m, 'd': d, 'D': deep}
    if extra:
        p.update(extra)
    return p


def ornaments():
    sprite('crown', [
        '..........x...........',
        '.........xrx..........',
        '..x.......x.......x...',
        '.xlx.....xlx.....xlx..',
        '.xmx.....xmx.....xmx..',
        '.xmxx...xxmxx...xxmx..',
        '.xmmmx.xmmmmmx.xmmmx..',
        '.xmmmmxmmmmmmmxmmmmx..',
        '.xmmmmmmmmmmmmmmmmmx..',
        '.xddddddddddddddddx...',
        '.xlmlmlmlmlmlmlmlmx...',
        '.xmmmmmmmmmmmmmmmmx...',
        '.xxxxxxxxxxxxxxxxxx...',
    ], gold_pal({'r': (232, 69, 44)}))
    steel = {'s': (236, 240, 248), 'S': (176, 186, 204), 'k': (102, 112, 138)}
    sprite('sword', [
        '..................................',
        '...xx....x........................',
        '...xmx..xxx.......................',
        '..xxmmxxxsssssssssssssssssssssx...',
        '.xmmmmmmxSSSSSSSSSSSSSSSSSSSSSSSx.',
        '..xxmmxxxkkkkkkkkkkkkkkkkkkkkkx...',
        '...xmx..xxx.......................',
        '...xx....x........................',
        '..................................',
    ], gold_pal(steel))
    sprite('diamond', [
        '....x....',
        '...xlx...',
        '..xllmx..',
        '.xllmmdx.',
        'xllmmmddx',
        '.xmmmddx.',
        '..xmddx..',
        '...xdx...',
        '....x....',
    ], gold_pal())
    star_rows = [
        '.....x.....',
        '....xlx....',
        '....xlx....',
        'xxxxxlmxxxx',
        '.xllllmmdx.',
        '..xllmmdx..',
        '...xmmdx...',
        '..xmmdmdx..',
        '.xmdxxxdmx.',
        'xdx.....xdx',
        'x.........x',
    ]
    sprite('star_on', star_rows, gold_pal())
    l, m, d, deep = RAMPS['slate']
    sprite('star_off', star_rows, {'x': INK, 'l': m, 'm': d, 'd': deep})
    sprite('coin', [
        '..xxxxx..',
        '.xllmmmx.',
        'xllmmmmdx',
        'xlmmxmmdx',
        'xlmmxmmdx',
        'xlmmxmmdx',
        'xmmmmmddx',
        '.xmmdddx.',
        '..xxxxx..',
    ], gold_pal())
    sprite('lock', [
        '..xxxx..',
        '.xDllDx.',
        '.xD..Dx.',
        'xxxxxxxx',
        'xmmmmmmx',
        'xmmxxmmx',
        'xddxxddx',
        'xxxxxxxx',
    ], gold_pal())
    sprite('close', [
        'xx.....xx',
        'xlx...xlx',
        '.xlx.xlx.',
        '..xlxlx..',
        '...xlx...',
        '..xlxlx..',
        '.xlx.xlx.',
        'xlx...xlx',
        'xx.....xx',
    ], {'x': INK, 'l': (240, 236, 255)})


def circle(im, cx, cy, r, c):
    for y in range(-r, r + 1):
        for x in range(-r, r + 1):
            if x * x + y * y <= r * r + r * 0.5:
                px(im, cx + x, cy + y, c)


def rect(im, x, y, w, h, c):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            px(im, xx, yy, c)


def line(im, x0, y0, x1, y1, c):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        px(im, round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)


def outline(im, c=INK):
    """Ink outline around every opaque pixel (4-neighbour)."""
    src = im.copy()
    for y in range(im.height):
        for x in range(im.width):
            if src.getpixel((x, y))[3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < im.width and 0 <= ny < im.height and src.getpixel((nx, ny))[3] and src.getpixel((nx, ny)) != c:
                        px(im, x, y, c); break


def emblems():
    """24x24 race crests for the army cards: shield, crossed swords, gear, ankh."""
    import math
    gl, gm, gd, gD = RAMPS['gold']
    W = (244, 244, 255)
    # HUMAN: blue heater shield with a gold cross
    hl, hm, hd, hD = RAMPS['human']
    im = Image.new('RGBA', (24, 24), T)
    for y in range(3, 21):
        half = 9 if y < 12 else 9 - (y - 11)   # heater: full width, then tapering to a point
        rect(im, 12 - half, y, half * 2, 1, hm)
    rect(im, 4, 3, 16, 2, hl); line(im, 4, 3, 4, 11, hl)
    for y in range(12, 20): px(im, 12 + (9 - (y - 11)) - 1, y, hd)
    line(im, 19, 4, 19, 11, hd)
    rect(im, 11, 6, 2, 11, gm); rect(im, 8, 9, 8, 2, gm)
    rect(im, 11, 6, 2, 1, gl); px(im, 8, 9, gl); rect(im, 11, 16, 2, 1, gd); px(im, 15, 10, gd)
    outline(im); im.save(os.path.join(OUT, 'emblem_human.png'))
    # DEMON: two crossed blades, red-hot edges, gold guards
    dl, dm, dd, dD = RAMPS['demon']
    im = Image.new('RGBA', (24, 24), T)
    line(im, 3, 3, 20, 20, W); line(im, 20, 3, 3, 20, W)
    line(im, 4, 3, 20, 19, dl); line(im, 19, 3, 3, 19, dl)
    line(im, 3, 4, 19, 20, dm); line(im, 20, 4, 4, 20, dm)
    rect(im, 5, 16, 5, 2, gm); rect(im, 14, 16, 5, 2, gm)
    rect(im, 3, 18, 3, 3, dd); rect(im, 18, 18, 3, 3, dd)
    px(im, 12, 12, dl)
    outline(im); im.save(os.path.join(OUT, 'emblem_demon.png'))
    # ROBOT: steel gear with a cyan core
    rl, rm, rd, rD = RAMPS['robot']
    st, sm, sd = (216, 222, 236), (150, 160, 184), (92, 100, 128)
    im = Image.new('RGBA', (24, 24), T)
    for a in range(8):
        ang = a * math.pi / 4
        cx, cy = round(11.5 + math.cos(ang) * 9), round(11.5 + math.sin(ang) * 9)
        rect(im, cx - 1, cy - 1, 3, 3, sm)
    circle(im, 12, 12, 7, sm)
    for y in range(24):
        for x in range(24):
            if im.getpixel((x, y))[3] and (x + y) < 20: px(im, x, y, st)
    circle(im, 12, 12, 4, sd); circle(im, 12, 12, 3, rm); circle(im, 12, 12, 1, rl); px(im, 11, 11, W)
    outline(im); im.save(os.path.join(OUT, 'emblem_robot.png'))
    # MUMMY: gold ankh with a turquoise eye
    ml, mm, md, mD = RAMPS['mummy']
    im = Image.new('RGBA', (24, 24), T)
    circle(im, 12, 6, 4, mm); circle(im, 12, 6, 2, T)
    rect(im, 11, 10, 3, 11, mm); rect(im, 5, 11, 15, 3, mm)
    line(im, 9, 3, 12, 2, ml); px(im, 8, 5, ml); rect(im, 5, 11, 6, 1, ml); rect(im, 11, 10, 1, 9, ml)
    rect(im, 12, 14, 2, 7, md); rect(im, 15, 13, 5, 1, md); px(im, 15, 8, md)
    px(im, 12, 12, (79, 208, 255)); px(im, 12, 19, (79, 208, 255))
    outline(im); im.save(os.path.join(OUT, 'emblem_mummy.png'))


def sky():
    """Night-sky band for screen headers: navy gradient with a sprinkle of stars, tiles horizontally."""
    import random
    rnd = random.Random(7)
    w, h = 160, 72
    im = Image.new('RGBA', (w, h), T)
    top, bot = (28, 30, 66), (13, 12, 26)
    for y in range(h):
        t = y / (h - 1)
        c = tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        rect(im, 0, y, w, 1, c)
    for _ in range(44):
        x, y = rnd.randrange(w), rnd.randrange(h - 8)
        k = rnd.random()
        if k < 0.6: px(im, x, y, (120, 126, 180))
        elif k < 0.9: px(im, x, y, (200, 204, 240))
        else:
            px(im, x, y, (255, 250, 220)); px(im, x - 1, y, (170, 172, 210)); px(im, x + 1, y, (170, 172, 210)); px(im, x, y - 1, (170, 172, 210)); px(im, x, y + 1, (170, 172, 210))
    for _ in range(6):
        x, y = rnd.randrange(w), rnd.randrange(h - 8)
        px(im, x, y, RAMPS['gold'][1])
    # tiles that CSS repeats are saved pre-scaled 2x: Chromium paints stray copies of a
    # repeated background that is scaled with background-size + image-rendering: pixelated
    im.resize((w * 2, h * 2), Image.NEAREST).save(os.path.join(OUT, 'sky.png'))


def castles():
    """Ruined castle silhouette (left edge; the CSS mirrors it for the right)."""
    import math
    w, h = 120, 40
    im = Image.new('RGBA', (w, h), T)
    far, near = (34, 32, 66), (22, 20, 44)
    win = (255, 190, 70)
    for x in range(w):
        hh = int(10 + 8 * math.sin(x / 30)) if x < 90 else max(0, int(18 - (x - 90) * 0.6))
        rect(im, x, h - hh, 1, hh, far)
    def tower(x, y, tw, th, c):
        rect(im, x, y, tw, th, c)
        for i in range(0, tw, 4): rect(im, x + i, y - 3, 2, 3, c)
    tower(4, 8, 10, 32, far); tower(30, 14, 8, 26, far)
    tower(12, 16, 22, 24, near); tower(40, 6, 12, 34, near); tower(56, 20, 24, 20, near); tower(84, 12, 10, 28, near)
    for i in range(6): rect(im, 40 + i, 6 - i, 12 - i * 2, 1, near)
    for (x, y) in ((45, 16), (45, 24), (18, 24), (64, 28), (88, 20)):
        px(im, x, y, win); px(im, x + 1, y, win)
    im.save(os.path.join(OUT, 'castles.png'))


def misc():
    gl, gm, gd, gD = RAMPS['gold']
    # rule: a gold hairline with an ink shadow, tiled by CSS
    im = Image.new('RGBA', (4, 3), T)
    rect(im, 0, 0, 4, 1, gm); rect(im, 0, 1, 4, 1, INK)
    im.resize((8, 6), Image.NEAREST).save(os.path.join(OUT, 'rule.png'))
    sprite('check', [
        '.......xx',
        '......xlx',
        '.....xlx.',
        'xx..xlx..',
        'xlx.xlx..',
        '.xlxlx...',
        '..xlx....',
        '...x.....',
    ], {'x': INK, 'l': RAMPS['green'][0]})
    sprite('arrow', [
        'x.......',
        'xx......',
        'xlx.....',
        'xllx....',
        'xlllx...',
        'xllllx..',
        'xlllllx.',
        'xllllllx',
        'xlllllx.',
        'xllllx..',
        'xlllx...',
        'xllx....',
        'xlx.....',
        'xx......',
        'x.......',
    ], {'x': INK, 'l': gm})
    sprite('skull', [
        '..xxxxx..',
        '.xllllllx',
        'xlllllllx',
        'xlxxlxxlx',
        'xlxxlxxlx',
        'xlllllllx',
        '.xlxlxlx.',
        '.xlxlxlx.',
        '..xxxxx..',
    ], {'x': INK, 'l': (232, 228, 240)})
    sprite('trophy', [
        'xxxxxxxxxxx',
        'xlmmmmmmmdx',
        'xxlmmmmmdxx',
        'x.xlmmmdx.x',
        'xx.xmmmx.xx',
        '.xxxxmxxxx.',
        '....xmx....',
        '...xmmmx...',
        '..xdddddx..',
        '..xxxxxxx..',
    ], gold_pal())
    sprite('clock', [
        '..xxxxx..',
        '.xllllmx.',
        'xllxlllmx',
        'xllxllmmx',
        'xllxxlmmx',
        'xlllllmmx',
        'xmlllmmmx',
        '.xmmmmmx.',
        '..xxxxx..',
    ], {'x': INK, 'l': (236, 240, 248), 'm': (150, 160, 184)})


def dither():
    """4x4 panel texture tile: two navy tones in a checker so big panels are not flat."""
    a, b = (22, 26, 46, 255), (19, 22, 40, 255)
    im = Image.new('RGBA', (4, 4), a)
    for y in range(4):
        for x in range(4):
            if (x + y) % 2 == 0:
                px(im, x, y, b)
    im.resize((8, 8), Image.NEAREST).save(os.path.join(OUT, 'dither.png'))


if __name__ == '__main__':
    for k, r in RAMPS.items():
        frame(k, r)
        thin(k, r)
        button(k, r)
        chip(k, r)
    frame('gold_plain', RAMPS['gold'], corner=False)
    ornaments()
    emblems()
    sky()
    castles()
    misc()
    dither()
    print('ok', sorted(os.listdir(OUT)))
