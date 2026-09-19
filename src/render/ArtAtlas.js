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
    this.rigs = {};        // unitId -> { skeleton, parts: [{ name, parent, pivot, key }] } for cut-out puppets
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
    const loadImage = (src) => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = this.base + src; });
    const images = await Promise.all(entries.map(([, e]) => loadImage(e.file)));
    // items to pack: the whole sprite of every unit, plus every part of rigged units
    const items = entries.map(([id, e], i) => ({ key: id, im: images[i], sx: 0, sy: 0, w: images[i].naturalWidth, h: images[i].naturalHeight, ax: e.ax, ay: e.ay, ppu: e.ppu || 75 }));
    await Promise.all(entries.map(async ([id, e]) => {
      if (!e.rig) return;
      try {
        const rig = await (await fetch(this.base + e.rig, { cache: 'no-store' })).json();
        const sheet = await loadImage(rig.sheet);
        this.rigs[id] = { skeleton: rig.skeleton, legSwing: rig.legSwing, parts: rig.parts.map((p) => ({ name: p.name, parent: p.parent, pivot: p.pivot, key: `${id}/${p.name}` })) };
        for (const p of rig.parts) items.push({ key: `${id}/${p.name}`, im: sheet, sx: p.rect[0], sy: p.rect[1], w: p.rect[2], h: p.rect[3], ax: p.pivot[0] - p.off[0], ay: p.pivot[1] - p.off[1], ppu: e.ppu || 75 });
      } catch (err) { console.warn('ArtAtlas: rig failed for', id, err); }
    }));
    // shelf packing, tallest first, 2 px gutter so linear filtering never bleeds
    items.sort((a, b) => b.h - a.h);
    const pad = 2;
    let x = pad, y = pad, rowH = 0;
    for (const it of items) {
      const { w, h } = it;
      if (x + w + pad > this.size) { x = pad; y += rowH + pad; rowH = 0; }
      if (y + h + pad > this.size) throw new Error('ArtAtlas overflow');
      this.ctx.drawImage(it.im, it.sx, it.sy, w, h, x, y, w, h);
      this.frames[it.key] = { x, y, w, h, ax: it.ax, ay: it.ay, ppu: it.ppu, u0: x / this.size, v0: y / this.size, u1: (x + w) / this.size, v1: (y + h) / this.size };
      x += w + pad; rowH = Math.max(rowH, h);
    }
    this.usedHeight = y + rowH;
    this.texture.needsUpdate = true;
    this.ready = true;
  }
}
