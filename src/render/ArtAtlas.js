// Hand-drawn unit art: loads assets/units/manifest.json + PNGs and packs them
// into one linear-filtered texture. Units that have an entry here are drawn
// as paper-doll sprites instead of the procedural pixel rig.
import * as THREE from '../../vendor/three.module.js';

export class ArtAtlas {
  constructor(base = 'assets/units/') {
    this.base = base;
    this.size = 2048;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    this.frames = {};
    this.ready = false;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.generateMipmaps = true;
    // NoColorSpace: the batch shader writes texels straight to the canvas; an
    // sRGB-tagged texture would be decoded to linear and render far too dark.
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.flipY = false;
    this.loading = this.load().catch((e) => { console.warn('ArtAtlas: no hand-drawn art loaded', e); });
  }

  has(id) { return this.ready && !!this.frames[id]; }
  frame(id) { const f = this.frames[id]; if (!f) throw new Error('Missing art ' + id); return f; }

  async load() {
    const res = await fetch(this.base + 'manifest.json', { cache: 'no-store' });
    if (!res.ok) return;
    const manifest = await res.json();
    const entries = Object.entries(manifest);
    const images = await Promise.all(entries.map(([, e]) => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = this.base + e.file; })));
    // shelf packing, tallest first, 2 px gutter so linear filtering never bleeds
    const order = entries.map((e, i) => i).sort((a, b) => entries[b][1].h - entries[a][1].h);
    const pad = 2;
    let x = pad, y = pad, rowH = 0;
    for (const i of order) {
      const [id, e] = entries[i], im = images[i];
      const w = im.naturalWidth, h = im.naturalHeight;
      if (x + w + pad > this.size) { x = pad; y += rowH + pad; rowH = 0; }
      if (y + h + pad > this.size) throw new Error('ArtAtlas overflow');
      this.ctx.drawImage(im, x, y);
      this.frames[id] = { x, y, w, h, ax: e.ax, ay: e.ay, ppu: e.ppu || 75, u0: x / this.size, v0: y / this.size, u1: (x + w) / this.size, v1: (y + h) / this.size };
      x += w + pad; rowH = Math.max(rowH, h);
    }
    this.usedHeight = y + rowH;
    this.texture.needsUpdate = true;
    this.ready = true;
  }
}
