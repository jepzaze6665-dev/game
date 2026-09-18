// Player castle and enemy fortress, drawn in a 3/4 top-down pixel style with
// three damage states plus a destroyed rubble state.
import { PixelBuffer, shade } from './PixelBuffer.js';


const K = '#1b1026', W = '#ffffff';
const CELL = { w: 76, h: 84 };

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function stoneWall(pb, x, y, w, h, base, dark, light, rnd) {
  pb.rect(x, y, w, h, base);
  for (let row = 0; row < h; row += 3) {
    const off = (row / 3) % 2 ? 2 : 0;
    pb.hline(x, x + w - 1, y + row + 2, dark);
    for (let cx = x + off; cx < x + w; cx += 5) pb.set(cx, y + row + 1, dark);
    for (let cx = x + off + 2; cx < x + w; cx += 5) if (rnd() < 0.25) pb.set(cx, y + row, light);
  }
}

function cracks(pb, x, y, w, h, level, rnd) {
  for (let i = 0; i < level * 3; i++) {
    let cx = x + Math.floor(rnd() * w), cy = y + Math.floor(rnd() * h);
    const len = 4 + Math.floor(rnd() * 6);
    for (let j = 0; j < len; j++) { pb.set(cx, cy, K); cx += rnd() < 0.5 ? 1 : (rnd() < 0.5 ? -1 : 0); cy += 1; }
  }
  if (level >= 2) for (let i = 0; i < level; i++) { const hx = x + 3 + Math.floor(rnd() * (w - 8)), hy = y + 3 + Math.floor(rnd() * (h - 8)); pb.ellipse(hx, hy, 2, 1 + (i % 2), K); pb.set(hx, hy - 2, '#2d2038'); }
}

function playerCastle(pb, level) {
  const rnd = seeded(7);
  const S = '#a9bad6', Sd = '#6f83a6', Sl = '#d6e2f5', roof = '#3b82f6', roofD = '#1e3a8a', roofL = '#93c5fd';
  const gx = 38, gy = 80;   // ground centre / baseline
  // courtyard ground
  pb.ellipse(gx, gy - 4, 34, 6, '#6f7f9a'); pb.ellipse(gx, gy - 5, 30, 4, '#8a9ab8');
  if (level >= 3) { // rubble
    pb.ellipse(gx, gy - 8, 26, 7, Sd); pb.ellipse(gx - 4, gy - 11, 14, 5, S); pb.ellipse(gx + 10, gy - 10, 9, 4, S);
    for (let i = 0; i < 40; i++) pb.set(gx - 30 + Math.floor(rnd() * 60), gy - 16 + Math.floor(rnd() * 14), rnd() < 0.5 ? Sd : Sl);
    pb.rect(gx - 8, gy - 22, 6, 12, S); pb.rect(gx - 7, gy - 24, 3, 3, roof);
    pb.rect(gx + 12, gy - 20, 5, 9, S); pb.set(gx + 13, gy - 21, Sl);
    pb.rect(gx - 2, gy - 15, 5, 6, '#5e3a1c');
    pb.outline(K); return;
  }
  // outer wall
  stoneWall(pb, 10, 48, 56, 24, S, Sd, Sl, rnd);
  for (let x = 10; x < 66; x += 4) pb.rect(x, 45, 2, 3, S);
  pb.hline(10, 65, 48, Sl);
  // side towers
  for (const tx of [6, 58]) {
    stoneWall(pb, tx, 30, 12, 44, S, Sd, Sl, rnd);
    pb.rect(tx - 1, 28, 14, 3, S); for (let x = tx - 1; x < tx + 13; x += 3) pb.rect(x, 26, 2, 2, S);
    // conical roof
    for (let r = 0; r < 9; r++) pb.hline(tx + 6 - (r * 7 / 9), tx + 5 + (r * 7 / 9), 18 + r, r % 3 === 0 ? roofL : roof);
    pb.hline(tx - 1, tx + 12, 26, roofD);
    pb.set(tx + 5, 17, roofD); pb.set(tx + 6, 17, roofD);
    pb.rect(tx + 4, 38, 3, 5, '#2d2038'); pb.set(tx + 5, 39, '#ffd23f'); pb.set(tx + 5, 40, '#ffb000');
    pb.rect(tx + 4, 56, 3, 4, '#2d2038'); pb.set(tx + 5, 57, '#ffd23f');
  }
  // keep (centre)
  stoneWall(pb, 24, 20, 28, 34, S, Sd, Sl, rnd);
  for (let x = 24; x < 52; x += 4) pb.rect(x, 17, 2, 3, S);
  pb.hline(24, 51, 20, Sl);
  // keep roof (pitched, seen from above)
  for (let r = 0; r < 8; r++) pb.hline(31 - r, 44 + r, 4 + r, r % 3 === 1 ? roofL : roof);
  pb.rect(31, 2, 14, 2, roofD);
  pb.hline(23, 52, 12, roofD);
  // keep windows + banner
  pb.rect(28, 26, 3, 5, '#2d2038'); pb.set(29, 27, '#ffd23f'); pb.set(29, 28, '#ffb000');
  pb.rect(45, 26, 3, 5, '#2d2038'); pb.set(46, 27, '#ffd23f'); pb.set(46, 28, '#ffb000');
  pb.rect(35, 24, 6, 11, roof); pb.rect(36, 25, 4, 9, roofL); pb.rect(37, 27, 2, 4, roof); pb.set(35, 35, roof); pb.set(40, 35, roof); // banner with emblem
  pb.set(37, 34, roofD); pb.set(38, 34, roofD);
  // gate
  pb.rect(33, 58, 10, 14, '#2d2038');
  pb.rect(34, 60, 8, 12, '#8a5a34'); pb.hline(34, 41, 60, '#a06a35');
  for (let y = 62; y < 72; y += 3) pb.hline(34, 41, y, '#5e3a1c');
  pb.vline(38, 60, 71, '#5e3a1c');
  pb.rect(32, 56, 12, 2, Sd); pb.set(33, 57, Sl);
  // stone path to the lane
  pb.rect(44, 72, 30, 8, '#8a9ab8'); for (let x = 46; x < 74; x += 4) pb.set(x, 74 + (x % 8 ? 0 : 2), '#a9bad6');
  // damage overlays
  if (level >= 1) { cracks(pb, 24, 22, 28, 30, level, rnd); cracks(pb, 10, 50, 56, 20, level, rnd); }
  if (level >= 2) { pb.rect(40, 10, 5, 3, K); pb.rect(26, 48, 4, 4, K); pb.set(60, 22, K); pb.rect(58, 24, 4, 3, K); }
  pb.outline(K);
}

function enemyFortress(pb, level) {
  const rnd = seeded(13);
  const S = '#6b5470', Sd = '#41323f', Sl = '#8f7796', roof = '#ef4444', roofD = '#5a1414', roofL = '#ff8a5c';
  const gx = 38, gy = 80;
  // scorched ground + lava cracks
  pb.ellipse(gx, gy - 4, 34, 6, '#4a3a44'); pb.ellipse(gx, gy - 5, 30, 4, '#5a4a56');
  for (let i = 0; i < 6; i++) { const lx = gx - 28 + i * 10, ly = gy - 7 + (i % 2) * 2; pb.hline(lx, lx + 3, ly, '#ff5a1f'); pb.set(lx + 1, ly, '#ffb347'); }
  if (level >= 3) {
    pb.ellipse(gx, gy - 8, 26, 7, Sd); pb.ellipse(gx - 6, gy - 11, 13, 5, S); pb.ellipse(gx + 9, gy - 10, 10, 4, S);
    for (let i = 0; i < 40; i++) pb.set(gx - 30 + Math.floor(rnd() * 60), gy - 16 + Math.floor(rnd() * 14), rnd() < 0.5 ? Sd : Sl);
    pb.rect(gx + 4, gy - 24, 6, 14, S); pb.set(gx + 6, gy - 26, roof); pb.set(gx + 6, gy - 25, roof);
    pb.rect(gx - 14, gy - 19, 5, 8, S);
    for (let i = 0; i < 5; i++) pb.set(gx - 20 + i * 9, gy - 13 + (i % 2), '#ff5a1f');
    pb.outline(K); return;
  }
  // outer wall with spikes
  stoneWall(pb, 10, 48, 56, 24, S, Sd, Sl, rnd);
  for (let x = 11; x < 66; x += 5) { pb.rect(x, 45, 2, 3, S); pb.set(x, 44, Sl); }
  pb.hline(10, 65, 48, Sl);
  // side towers with spiked roofs
  for (const tx of [6, 58]) {
    stoneWall(pb, tx, 28, 12, 46, S, Sd, Sl, rnd);
    pb.rect(tx - 1, 26, 14, 3, S);
    for (let r = 0; r < 11; r++) pb.hline(tx + 6 - Math.floor(r * 7 / 11), tx + 5 + Math.floor(r * 7 / 11), 15 + r, r % 3 === 0 ? roofL : roof);
    pb.hline(tx - 1, tx + 12, 26, roofD);
    pb.vline(tx + 5, 11, 15, roofD); pb.set(tx + 5, 10, roofL);
    pb.rect(tx + 4, 36, 3, 5, '#2d2038'); pb.set(tx + 5, 37, '#ff5a1f'); pb.set(tx + 5, 38, '#ff2a00');
    pb.rect(tx + 4, 56, 3, 4, '#2d2038'); pb.set(tx + 5, 57, '#ff5a1f');
  }
  // keep
  stoneWall(pb, 24, 18, 28, 36, S, Sd, Sl, rnd);
  for (let x = 25; x < 52; x += 5) { pb.rect(x, 15, 2, 3, S); pb.set(x, 14, Sl); }
  pb.hline(24, 51, 18, Sl);
  // jagged roof
  for (let r = 0; r < 10; r++) pb.hline(31 - r, 44 + r, 2 + r, r % 3 === 1 ? roofL : roof);
  pb.set(37, 0, roofL); pb.set(38, 0, roofL); pb.rect(37, 1, 2, 1, roof);
  pb.hline(23, 52, 12, roofD);
  pb.set(28, 8, roofD); pb.set(47, 8, roofD);
  // skull banner
  pb.rect(34, 22, 8, 13, '#2a1a2e'); pb.rect(35, 23, 6, 11, '#3a2340');
  pb.rect(36, 25, 4, 4, '#f4f0ff'); pb.rect(35, 26, 6, 2, '#f4f0ff'); pb.set(36, 27, K); pb.set(39, 27, K); pb.rect(36, 29, 4, 2, '#f4f0ff'); pb.set(37, 30, K); pb.set(38, 30, K);
  pb.set(34, 35, roof); pb.set(41, 35, roof);
  // windows glowing red
  pb.rect(27, 24, 3, 5, '#2d2038'); pb.set(28, 25, '#ff5a1f'); pb.set(28, 26, '#ff2a00');
  pb.rect(46, 24, 3, 5, '#2d2038'); pb.set(47, 25, '#ff5a1f'); pb.set(47, 26, '#ff2a00');
  // gate (portcullis)
  pb.rect(33, 58, 10, 14, '#1a0f1f');
  for (let x = 34; x < 43; x += 2) pb.vline(x, 59, 71, '#5a4a56');
  for (let y = 61; y < 72; y += 3) pb.hline(34, 41, y, '#5a4a56');
  pb.set(38, 64, '#ff5a1f'); pb.set(38, 65, '#ff5a1f');
  pb.rect(32, 56, 12, 2, Sd); pb.set(33, 57, Sl);
  // path
  pb.rect(44, 72, 30, 8, '#5a4a56'); for (let x = 46; x < 74; x += 4) pb.set(x, 74 + (x % 8 ? 0 : 2), '#6b5470');
  if (level >= 1) { cracks(pb, 24, 20, 28, 30, level, rnd); cracks(pb, 10, 50, 56, 20, level, rnd); }
  if (level >= 2) { pb.rect(30, 10, 5, 3, K); pb.rect(46, 46, 4, 4, K); pb.set(12, 30, K); pb.rect(12, 32, 4, 3, K); }
  pb.outline(K);
}

function robotFactory(pb, level) {
  const rnd = seeded(29);
  const S = '#8c95a8', Sd = '#5b6373', Sl = '#c3cad6', glow = '#38e0ff', dark = '#2a2f3a';
  const gx = 38, gy = 80;
  pb.ellipse(gx, gy - 4, 34, 6, '#3a4150'); pb.ellipse(gx, gy - 5, 30, 4, '#4a5160');
  for (let x = gx - 30; x < gx + 30; x += 6) { pb.hline(x, x + 2, gy - 6, '#ffd43a'); }
  if (level >= 3) {
    pb.ellipse(gx, gy - 8, 26, 7, Sd); pb.ellipse(gx - 5, gy - 11, 14, 5, S); pb.ellipse(gx + 10, gy - 10, 9, 4, dark);
    for (let i = 0; i < 40; i++) pb.set(gx - 30 + Math.floor(rnd() * 60), gy - 16 + Math.floor(rnd() * 14), rnd() < 0.5 ? Sd : Sl);
    pb.rect(gx - 6, gy - 24, 5, 14, S); pb.set(gx - 4, gy - 25, glow); pb.rect(gx + 10, gy - 20, 7, 9, Sd);
    for (let i = 0; i < 4; i++) pb.set(gx - 20 + i * 12, gy - 13, glow);
    pb.outline(K); return;
  }
  // main plant: wide low block with plated walls
  pb.rect(10, 44, 56, 28, S);
  for (let y = 46; y < 72; y += 6) { pb.hline(10, 65, y, Sd); for (let x = 12; x < 66; x += 8) pb.set(x, y + 3, Sd); }
  pb.hline(10, 65, 44, Sl);
  pb.rect(10, 40, 56, 4, Sd); for (let x = 12; x < 66; x += 4) pb.set(x, 41, '#ffd43a'); for (let x = 14; x < 66; x += 4) pb.set(x, 41, dark);
  // side towers: cylinders with dish / antenna
  for (const tx of [6, 58]) {
    pb.rect(tx, 26, 12, 48, S); pb.vline(tx, 26, 73, Sl); pb.vline(tx + 11, 26, 73, Sd);
    for (let y = 30; y < 70; y += 8) { pb.rect(tx + 3, y, 6, 2, dark); pb.rect(tx + 4, y, 4, 1, glow); }
    pb.rect(tx - 1, 22, 14, 4, Sd); pb.rect(tx + 1, 18, 10, 4, S);
    pb.rect(tx + 5, 8, 2, 10, Sd); pb.set(tx + 5, 7, '#ff3d3d'); pb.hline(tx + 2, tx + 9, 12, Sd); pb.set(tx + 2, 11, S); pb.set(tx + 9, 11, S);
  }
  // central core reactor
  pb.rect(24, 14, 28, 30, Sd); pb.rect(26, 16, 24, 26, S); pb.hline(26, 49, 16, Sl);
  pb.rect(30, 20, 16, 16, dark); pb.circle(38, 28, 6, glow); pb.circle(38, 28, 3, '#ffffff'); pb.circle(38, 28, 1, glow);
  for (let a = 0; a < 8; a++) pb.set(Math.round(38 + Math.cos(a * 0.785) * 8), Math.round(28 + Math.sin(a * 0.785) * 8), Sl);
  pb.rect(28, 38, 20, 3, dark); for (let x = 29; x < 48; x += 3) pb.set(x, 39, glow);
  // chimneys
  pb.rect(44, 4, 4, 12, Sd); pb.rect(45, 3, 2, 1, dark); pb.rect(28, 6, 4, 10, Sd); pb.rect(29, 5, 2, 1, dark);
  // gate: blast door
  pb.rect(32, 56, 12, 16, dark); pb.rect(33, 57, 10, 14, '#3a4150');
  pb.rect(33, 57, 5, 14, Sd); pb.rect(38, 57, 5, 14, Sd); pb.vline(37, 57, 70, glow); pb.vline(38, 57, 70, glow);
  for (let y = 59; y < 70; y += 4) { pb.set(34, y, '#ffd43a'); pb.set(41, y, '#ffd43a'); }
  pb.rect(31, 54, 14, 2, Sl);
  // conveyor path to the lane
  pb.rect(44, 72, 30, 8, '#4a5160'); for (let x = 46; x < 74; x += 3) pb.vline(x, 73, 78, '#5b6373');
  if (level >= 1) { cracks(pb, 26, 16, 24, 26, level, rnd); cracks(pb, 10, 46, 56, 24, level, rnd); pb.set(38, 28, '#ff7a1a'); }
  if (level >= 2) { pb.rect(40, 8, 5, 3, K); pb.rect(14, 48, 4, 4, K); pb.rect(58, 30, 4, 3, K); pb.circle(38, 28, 3, '#ff7a1a'); }
  pb.outline(K);
}

function mummyTemple(pb, level) {
  const rnd = seeded(41);
  const S = '#d9b97a', Sd = '#a8834a', Sl = '#f0d8a0', gold = '#ffd43a', blue = '#4fd0ff', dark = '#5a4a2a';
  const gx = 38, gy = 80;
  pb.ellipse(gx, gy - 4, 34, 6, '#c9a66b'); pb.ellipse(gx, gy - 5, 30, 4, '#d9b97a');
  if (level >= 3) {
    pb.ellipse(gx, gy - 8, 26, 7, Sd); pb.ellipse(gx - 4, gy - 11, 14, 5, S); pb.ellipse(gx + 10, gy - 10, 9, 4, S);
    for (let i = 0; i < 40; i++) pb.set(gx - 30 + Math.floor(rnd() * 60), gy - 16 + Math.floor(rnd() * 14), rnd() < 0.5 ? Sd : Sl);
    pb.rect(gx - 8, gy - 26, 5, 16, S); pb.rect(gx + 12, gy - 20, 5, 9, S); pb.set(gx - 6, gy - 27, gold);
    for (let i = 0; i < 3; i++) pb.set(gx - 12 + i * 12, gy - 13, blue);
    pb.outline(K); return;
  }
  // stepped pyramid
  const steps = [[8, 60, 60], [12, 50, 52], [16, 40, 44], [20, 30, 36], [24, 22, 28], [28, 14, 20], [32, 8, 12]];
  for (const [x, y, w] of steps) { pb.rect(x, y, w, 12, S); pb.hline(x, x + w - 1, y, Sl); pb.hline(x, x + w - 1, y + 11, Sd); for (let xx = x + 2; xx < x + w; xx += 6) pb.set(xx, y + 5, Sd); }
  pb.rect(36, 4, 4, 4, gold); pb.set(37, 2, blue); pb.set(38, 2, blue); pb.set(37, 3, gold); pb.set(38, 3, gold);
  // obelisks
  for (const ox of [4, 66]) { pb.rect(ox, 24, 6, 50, S); pb.vline(ox, 24, 73, Sl); pb.vline(ox + 5, 24, 73, Sd); pb.set(ox + 2, 22, gold); pb.set(ox + 3, 22, gold); pb.hline(ox + 1, ox + 4, 23, gold); for (let y = 30; y < 70; y += 8) { pb.set(ox + 2, y, dark); pb.set(ox + 3, y + 2, dark); pb.set(ox + 2, y + 4, blue); } }
  // hieroglyph band
  pb.rect(12, 62, 52, 4, gold); for (let x = 14; x < 64; x += 5) { pb.set(x, 63, dark); pb.set(x + 1, 64, dark); pb.set(x + 2, 63, dark); }
  // eye emblem
  pb.rect(30, 28, 16, 8, dark); pb.ellipse(38, 32, 5, 2, gold); pb.circle(38, 32, 1, blue); pb.set(38, 32, W); pb.hline(33, 43, 35, gold);
  // gate: tomb door with glowing seams
  pb.rect(32, 58, 12, 14, dark); pb.rect(33, 59, 10, 12, '#3a2a1a');
  pb.vline(38, 59, 70, blue); pb.hline(33, 42, 64, blue); pb.rect(31, 56, 14, 2, gold);
  for (let y = 60; y < 70; y += 3) { pb.set(35, y, gold); pb.set(41, y, gold); }
  // path (sandstone slabs)
  pb.rect(44, 72, 30, 8, '#c9a66b'); for (let x = 46; x < 74; x += 5) pb.rect(x, 74 + (x % 10 ? 0 : 2), 3, 1, '#d9b97a');
  // torches
  pb.set(28, 56, '#ff7a1a'); pb.set(48, 56, '#ff7a1a'); pb.set(28, 55, '#ffe066'); pb.set(48, 55, '#ffe066'); pb.vline(28, 57, 60, dark); pb.vline(48, 57, 60, dark);
  if (level >= 1) { cracks(pb, 12, 30, 52, 30, level, rnd); }
  if (level >= 2) { pb.rect(40, 16, 4, 3, K); pb.rect(18, 52, 4, 4, K); pb.rect(50, 42, 5, 3, K); }
  pb.outline(K);
}

export function buildBaseFrames() {
  const out = [];
  const styles = { castle: playerCastle, fortress: enemyFortress, factory: robotFactory, temple: mummyTemple };
  for (const style in styles) for (let level = 0; level < 4; level++) {
    const p = new PixelBuffer(CELL.w, CELL.h); styles[style](p, level);
    out.push({ key: `base_${style}_${level}`, pb: p, ax: 38, ay: 76 });
  }
  return out;
}
