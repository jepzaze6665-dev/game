// Procedural top-down pixel terrain: one canvas texture per battlefield theme.
import * as THREE from '../../vendor/three.module.js';
import { LANE } from '../data/units.js';

export const THEMES = {
  meadow: {
    name: 'Green Meadow',
    grass: ['#5fae4a', '#69b953', '#57a244', '#74c25c'], dirt: ['#c9a16a', '#bf9560', '#d3ab74'], dirtEdge: '#a67d4a',
    stone: ['#9da3a8', '#7e858c'], flower: ['#ff6b8a', '#ffe66d', '#ffffff', '#8fd3ff'], tree: ['#2f7a3a', '#3f9448', '#5bb35f'], water: null,
    sky: '#1b2a3a',
  },
  desert: {
    name: 'Sun Dunes',
    grass: ['#e3c37d', '#dcb96f', '#ecd08d', '#d6b064'], dirt: ['#c98f52', '#bf8449', '#d29a5b'], dirtEdge: '#a56a34',
    stone: ['#b8a58a', '#8f7d63'], flower: ['#8fbf6a', '#ff8a5c'], tree: ['#7a9f4a', '#8fb85a', '#a5cc6a'], water: '#4fb7d6',
    sky: '#3a2a1b',
  },
  snow: {
    name: 'Frost Pass',
    grass: ['#dfe9f2', '#d3e0ec', '#eef4f9', '#c6d6e6'], dirt: ['#8e9db4', '#8290a6', '#9aa8bd'], dirtEdge: '#5f6d85',
    stone: ['#6f7d8f', '#556275'], flower: ['#8fd3ff', '#ffffff'], tree: ['#2c5a4a', '#3a7360', '#4d8c74'], water: '#6fc3ff',
    sky: '#1a2236',
  },
  volcanic: {
    name: 'Ash Wastes',
    grass: ['#4a3a40', '#523f46', '#42343a', '#5b464d'], dirt: ['#6e5058', '#634650', '#7a5a62'], dirtEdge: '#3d2b32',
    stone: ['#8a7480', '#5c4b55'], flower: ['#ff5a1f', '#ffb347'], tree: ['#3a2a30', '#4a3438', '#5c3f45'], water: '#ff5a1f',
    sky: '#1a0f14',
  },
  swamp: {
    name: 'Murk Hollow',
    grass: ['#4f7a3d', '#587f45', '#456f36', '#638b4d'], dirt: ['#7d6a4a', '#736040', '#877454'], dirtEdge: '#4f4230',
    stone: ['#7d8578', '#5c645a'], flower: ['#c9ff6a', '#ffe66d'], tree: ['#264d2e', '#31633a', '#3f7a48'], water: '#3d6f7a',
    sky: '#0f1c17',
  },
};

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export class Ground {
  constructor(ppu) {
    this.ppu = ppu;
    this.w = LANE.halfLength * 2 * ppu;
    this.h = LANE.groundHalfHeight * 2 * ppu;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter; this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false; this.texture.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(LANE.halfLength * 2, LANE.groundHalfHeight * 2);
    const mat = new THREE.MeshBasicMaterial({ map: this.texture });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.z = 0;
    this.theme = null;
  }

  // world -> canvas pixel
  px(x) { return Math.round((x + LANE.halfLength) * this.ppu); }
  py(y) { return Math.round((LANE.groundHalfHeight - y) * this.ppu); }

  generate(themeId = 'meadow', seed = 1) {
    const t = THEMES[themeId] || THEMES.meadow;
    this.theme = t;
    const ctx = this.ctx, rnd = seeded(seed * 7919 + 17), W = this.w, H = this.h, ppu = this.ppu;
    const laneTop = this.py(LANE.halfWidth + 0.6), laneBot = this.py(-LANE.halfWidth - 0.6);
    const A = W / 624;   // density scale relative to the original lane width
    // base grass: 2x2 dither cells
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const n = rnd();
      ctx.fillStyle = t.grass[n < 0.55 ? 0 : n < 0.8 ? 1 : n < 0.93 ? 2 : 3];
      ctx.fillRect(x, y, 2, 2);
    }
    // grass tufts
    for (let i = 0; i < 900 * A; i++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
      if (y > laneTop - 4 && y < laneBot + 4) continue;
      ctx.fillStyle = t.grass[3]; ctx.fillRect(x, y, 1, 2); ctx.fillRect(x + 2, y + 1, 1, 1);
      ctx.fillStyle = t.grass[2]; ctx.fillRect(x + 1, y + 2, 1, 1);
    }
    // dirt lane with ragged edges
    for (let x = 0; x < W; x++) {
      const wob = Math.sin(x * 0.07) * 3 + Math.sin(x * 0.19) * 2;
      const top = laneTop + Math.round(wob), bot = laneBot - Math.round(Math.sin(x * 0.11 + 2) * 3);
      for (let y = top; y < bot; y++) {
        const n = rnd();
        ctx.fillStyle = t.dirt[n < 0.7 ? 0 : n < 0.9 ? 1 : 2];
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = t.dirtEdge; ctx.fillRect(x, top, 1, 1); ctx.fillRect(x, bot - 1, 1, 1);
      if (x % 3 === 0) { ctx.fillStyle = t.grass[2]; ctx.fillRect(x, top - 1, 1, 1); ctx.fillRect(x, bot, 1, 1); }
    }
    // trampled centre line + wheel ruts
    for (let x = 0; x < W; x += 1) {
      if (rnd() < 0.35) { ctx.fillStyle = t.dirt[1]; ctx.fillRect(x, this.py(0) + Math.round(Math.sin(x * 0.05) * 6), 1, 1); }
      if (rnd() < 0.5) { ctx.fillStyle = t.dirtEdge; ctx.fillRect(x, this.py(2.6) + (x % 7 === 0 ? 1 : 0), 1, 1); ctx.fillRect(x, this.py(-2.6) + (x % 5 === 0 ? 1 : 0), 1, 1); }
    }
    // pebbles and stones in the lane
    for (let i = 0; i < 220 * A; i++) {
      const x = Math.floor(rnd() * W), y = laneTop + 4 + Math.floor(rnd() * (laneBot - laneTop - 8));
      ctx.fillStyle = t.stone[rnd() < 0.6 ? 0 : 1]; ctx.fillRect(x, y, 2, 1); ctx.fillStyle = t.stone[1]; ctx.fillRect(x, y + 1, 2, 1);
    }
    // flowers outside the lane
    for (let i = 0; i < 260 * A; i++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
      if (y > laneTop - 6 && y < laneBot + 6) continue;
      ctx.fillStyle = t.flower[Math.floor(rnd() * t.flower.length)]; ctx.fillRect(x, y, 1, 1); if (rnd() < 0.5) ctx.fillRect(x + 1, y - 1, 1, 1);
    }
    // bushes / trees (top-down canopies) outside the lane
    for (let i = 0; i < 70 * A; i++) {
      const x = Math.floor(rnd() * W), r = 4 + Math.floor(rnd() * 6);
      const above = rnd() < 0.5;
      const y = above ? Math.floor(rnd() * (laneTop - r - 8)) + 2 : laneBot + r + 8 + Math.floor(rnd() * (H - laneBot - r - 12));
      this.blob(x + 2, y + 2, r, 'rgba(0,0,0,0.25)', rnd);
      this.blob(x, y, r, t.tree[0], rnd);
      this.blob(x - 1, y - 1, r - 2, t.tree[1], rnd);
      this.blob(x - 2, y - 2, Math.max(1, r - 4), t.tree[2], rnd);
    }
    // boulders
    for (let i = 0; i < 26 * A; i++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
      if (y > laneTop - 8 && y < laneBot + 8) continue;
      const r = 2 + Math.floor(rnd() * 3);
      this.blob(x + 1, y + 1, r, 'rgba(0,0,0,0.3)', rnd); this.blob(x, y, r, t.stone[1], rnd); this.blob(x - 1, y - 1, r - 1, t.stone[0], rnd);
    }
    // water / lava pools in far corners
    if (t.water) {
      for (const [cx, cy] of [[W * 0.5, 10], [W * 0.5, H - 10]]) {
        this.blob(cx, cy, 14, t.water, rnd); this.blob(cx - 3, cy - 2, 8, 'rgba(255,255,255,0.25)', rnd);
      }
    }
    // cobbled courtyards in front of each base
    for (const bx of [this.px(-23), this.px(18)]) {
      for (let y = laneTop; y < laneBot; y += 3) for (let x = bx; x < bx + 5 * ppu; x += 4) {
        const off = ((y / 3) % 2) ? 2 : 0;
        if (rnd() < 0.85) { ctx.fillStyle = t.stone[rnd() < 0.5 ? 0 : 1]; ctx.fillRect(x + off, y, 3, 2); }
      }
    }
    // vignette rows (top-down darkness far from the lane)
    for (let y = 0; y < H; y++) {
      const d = Math.min(Math.abs(y - this.py(0)) / (H / 2), 1);
      const a = Math.max(0, d - 0.45) * 0.55;
      if (a > 0) { ctx.fillStyle = `rgba(10,8,20,${a.toFixed(3)})`; ctx.fillRect(0, y, W, 1); }
    }
    this.texture.needsUpdate = true;
  }

  blob(cx, cy, r, color, rnd) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)) + (rnd() < 0.4 ? 0 : 0.6));
      ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
    }
  }
}
