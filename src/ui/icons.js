// Helpers that draw atlas frames into HUD canvases at crisp integer scales.
import { TEAM } from '../data/units.js';

export function unitIcon(atlas, id, team = TEAM.PLAYER, scale = 2, frame = 'idle', flip = false) {
  const f = atlas.frame(`${id}_${team}_${frame}`);
  const c = document.createElement('canvas');
  c.width = f.w * scale; c.height = f.h * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(atlas.canvas, f.x, f.y, f.w, f.h, 0, 0, f.w * scale, f.h * scale);
  c.style.width = c.width + 'px'; c.style.height = c.height + 'px';
  return c;
}

// Cropped icon: trims the empty cell padding so the unit fills a square box.
export function unitIconFit(atlas, id, team, box, frame = 'idle', flip = false) {
  const f = atlas.frame(`${id}_${team}_${frame}`);
  const b = trimBounds(atlas, f);
  const fit = box / Math.max(b.w, b.h);
  const scale = fit < 1 ? fit : Math.floor(fit);
  const c = document.createElement('canvas');
  c.width = box; c.height = box;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const dx = Math.floor((box - b.w * scale) / 2), dy = Math.floor((box - b.h * scale) / 2);
  if (flip) { ctx.translate(box, 0); ctx.scale(-1, 1); }
  ctx.drawImage(atlas.canvas, b.x, b.y, b.w, b.h, dx, dy, b.w * scale, b.h * scale);
  c.style.width = box + 'px'; c.style.height = box + 'px';
  c.dataset.scale = scale;
  return c;
}

const trimCache = new Map();
function trimBounds(atlas, f) {
  const key = f.x + ',' + f.y;
  if (trimCache.has(key)) return trimCache.get(key);
  const data = atlas.ctx.getImageData(f.x, f.y, f.w, f.h).data;
  let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    if (data[(y * f.w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  const r = { x: f.x + x0, y: f.y + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  trimCache.set(key, r);
  return r;
}

export function frameIcon(atlas, key, scale = 2, tint = null) {
  const f = atlas.frame(key);
  const c = document.createElement('canvas');
  c.width = f.w * scale; c.height = f.h * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas.canvas, f.x, f.y, f.w, f.h, 0, 0, f.w * scale, f.h * scale);
  if (tint) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = tint; ctx.fillRect(0, 0, c.width, c.height); }
  c.style.width = c.width + 'px'; c.style.height = c.height + 'px';
  return c;
}

// Animated preview: cycles walk frames on a canvas. Returns a stop() function.
export function animatedUnit(atlas, canvas, id, team, scale, flip = false) {
  const ctx = canvas.getContext('2d');
  let t = 0, raf = 0, last = performance.now(), stopped = false;
  const frames = ['walk0', 'walk1', 'walk2', 'walk3'];
  const draw = (now) => {
    if (stopped) return;
    t += (now - last) / 1000; last = now;
    if (!Number.isFinite(t)) t = 0;
    const index = ((Math.floor(t * 7) % frames.length) + frames.length) % frames.length;
    const f = atlas.frame(`${id}_${team}_${frames[index]}`);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (flip) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    const fit = Math.min(scale, canvas.width / f.w, canvas.height / f.h);
    const dx = Math.floor((canvas.width - f.w * fit) / 2), dy = Math.floor((canvas.height - f.h * fit) / 2);
    ctx.drawImage(atlas.canvas, f.x, f.y, f.w, f.h, dx, dy, f.w * fit, f.h * fit);
    ctx.restore();
    if (!stopped) raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}
