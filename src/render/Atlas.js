// Packs every generated pixel-art frame into one texture atlas.
import * as THREE from '../../vendor/three.module.js';
import { buildUnitFrames } from '../art/rig.js';
import { buildFxFrames } from '../art/fxSprites.js';
import { buildBaseFrames } from '../art/baseSprites.js';
import { UNITS, TEAM } from '../data/units.js';

export class Atlas {
  constructor() {
    this.size = 2048;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    this.frames = {};
    this.build();
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;
  }

  build() {
    const all = [];
    for (const id in UNITS) for (const team of [TEAM.PLAYER, TEAM.ENEMY]) all.push(...buildUnitFrames(id, team));
    all.push(...buildFxFrames());
    all.push(...buildBaseFrames());
    // shelf packing, tallest first
    all.sort((a, b) => b.pb.h - a.pb.h);
    const pad = 1;
    let x = pad, y = pad, rowH = 0;
    for (const f of all) {
      const w = f.pb.w, h = f.pb.h;
      if (x + w + pad > this.size) { x = pad; y += rowH + pad; rowH = 0; }
      if (y + h + pad > this.size) throw new Error('Atlas overflow');
      f.pb.blit(this.ctx, x, y);
      this.frames[f.key] = {
        x, y, w, h, ax: f.ax, ay: f.ay,
        u0: x / this.size, v0: y / this.size, u1: (x + w) / this.size, v1: (y + h) / this.size,
      };
      x += w + pad; rowH = Math.max(rowH, h);
    }
    this.usedHeight = y + rowH;
  }

  frame(key) {
    const f = this.frames[key];
    if (!f) throw new Error('Missing frame ' + key);
    return f;
  }

  // Draw a frame onto a 2D canvas at integer scale (used by the HUD for icons).
  drawTo(ctx, key, dx, dy, scale = 1) {
    const f = this.frame(key);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, f.x, f.y, f.w, f.h, dx, dy, f.w * scale, f.h * scale);
  }
}
