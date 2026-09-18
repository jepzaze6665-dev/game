// Ambient battlefield particles per theme: petals, sand, snow, embers, fireflies.
import { LANE } from '../data/units.js';

const PRESETS = {
  meadow:   { n: 40, frame: 'dot', tints: [[1, 0.55, 0.65], [1, 0.95, 0.5], [0.7, 1, 0.6]], vx: [-0.6, -0.2], vy: [-0.5, -0.1], wobble: 1.2, alpha: 0.8, scale: 1 },
  desert:   { n: 60, frame: 'dot', tints: [[1, 0.9, 0.6], [0.95, 0.8, 0.5]], vx: [2.5, 4.5], vy: [-0.2, 0.2], wobble: 0.2, alpha: 0.5, scale: 1 },
  snow:     { n: 90, frame: 'dot', tints: [[1, 1, 1], [0.85, 0.92, 1]], vx: [-0.4, 0.4], vy: [-1.2, -0.5], wobble: 1.5, alpha: 0.9, scale: 1 },
  volcanic: { n: 50, frame: 'spark', tints: [[1, 0.5, 0.15], [1, 0.75, 0.3]], vx: [-0.3, 0.3], vy: [0.6, 1.6], wobble: 1.0, alpha: 0.9, scale: 0.7 },
  swamp:    { n: 35, frame: 'dot', tints: [[0.8, 1, 0.4], [0.6, 1, 0.7]], vx: [-0.3, 0.3], vy: [-0.2, 0.3], wobble: 2.5, alpha: 0.7, scale: 1, blink: true },
};

function rnd(a, b) { return a + Math.random() * (b - a); }

export class Weather {
  constructor() { this.items = []; this.preset = null; this.time = 0; }

  setTheme(themeId, worldW, worldH) {
    this.preset = PRESETS[themeId] || PRESETS.meadow;
    this.w = worldW; this.h = worldH;
    this.items = [];
    for (let i = 0; i < this.preset.n; i++) this.items.push(this.make(true));
  }

  make(anywhere) {
    const p = this.preset;
    return {
      x: rnd(-this.w / 2, this.w / 2), y: anywhere ? rnd(-this.h / 2, this.h / 2) : (p.vy[0] < 0 ? this.h / 2 + 1 : -this.h / 2 - 1),
      vx: rnd(p.vx[0], p.vx[1]), vy: rnd(p.vy[0], p.vy[1]), phase: Math.random() * 6.28, tint: p.tints[Math.floor(Math.random() * p.tints.length)],
      z: rnd(0, 1),
    };
  }

  update(dt, worldW, worldH) {
    if (!this.preset) return;
    this.time += dt;
    this.w = worldW; this.h = worldH;
    for (const it of this.items) {
      it.x += (it.vx + Math.sin(this.time * 1.3 + it.phase) * this.preset.wobble * 0.4) * dt;
      it.y += it.vy * dt;
      if (it.y < -this.h / 2 - 1 || it.y > this.h / 2 + 1 || it.x < -this.w / 2 - 1 || it.x > this.w / 2 + 1) {
        Object.assign(it, this.make(false));
        if (Math.abs(it.vx) > Math.abs(it.vy)) { it.x = it.vx > 0 ? -this.w / 2 - 1 : this.w / 2 + 1; it.y = rnd(-this.h / 2, this.h / 2); }
      }
    }
  }

  draw(batch, camY) {
    if (!this.preset) return;
    const p = this.preset;
    for (const it of this.items) {
      let alpha = p.alpha;
      if (p.blink) alpha *= 0.4 + 0.6 * Math.abs(Math.sin(this.time * 2 + it.phase));
      // keep the lane centre clean: fade particles that drift over the fighting area
      if (Math.abs(it.y - camY) < LANE.halfWidth) alpha *= 0.45;
      batch.push(p.frame, it.x, it.y + camY, 5 + it.z * 0.1, { tint: it.tint, alpha, scale: p.scale });
    }
  }
}
