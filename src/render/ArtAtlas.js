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
    this.anims = {};       // unitId -> { idle: [frameKeys], walk, run, atk, hurt, death, ... } for frame-animated sprites
    this.ready = false;
    this.texture = new THREE.CanvasTexture(this.canvas);
    // pixel art: nearest filtering, no mipmaps (the renderer draws at an integer scale)
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
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
    const images = await Promise.all(entries.map(([, e]) => e.file && !e.anim ? loadImage(e.file).catch(() => null) : null));   // an animation sheet supersedes the single drawing
    // items to pack: the whole sprite of every unit, plus every part of rigged units and every frame of animated ones
    const items = [];
    entries.forEach(([id, e], i) => { if (images[i]) items.push({ key: id, im: images[i], sx: 0, sy: 0, w: images[i].naturalWidth, h: images[i].naturalHeight, ax: e.ax, ay: e.ay, ppu: e.ppu || 75 }); });
    await Promise.all(entries.map(async ([id, e]) => {
      if (e.anim) {
        try {
          const anim = await (await fetch(this.base + e.anim, { cache: 'no-store' })).json();
          const sheet = await loadImage(anim.sheet + '?v=' + (anim.rev || Date.now()));   // the sheet is repacked whenever it is re-sliced: never pair a cached one with fresh frame boxes
          for (const key in anim.frames) { const [x, y, w, h, ax, ay] = anim.frames[key]; items.push({ key: `${id}#${key}`, im: sheet, sx: x, sy: y, w, h, ax, ay, ppu: anim.ppu || 24 }); }
          const map = {}; for (const a in anim.anims) map[a] = anim.anims[a].map((k) => `${id}#${k}`);
          // some sheets draw a near-static walk row (the Royal Guard and the
          // Lightbringer barely move a leg); the manifest can point one animation
          // at another so those units march with their run cycle instead
          if (e.animAlias) for (const a in e.animAlias) if (map[e.animAlias[a]]) map[a] = map[e.animAlias[a]];
          this.anims[id] = map;
          if (!images[entries.findIndex(([k]) => k === id)]) { const [x, y, w, h, ax, ay] = anim.frames[anim.anims.idle ? anim.anims.idle[0] : Object.keys(anim.frames)[0]]; items.push({ key: id, im: sheet, sx: x, sy: y, w, h, ax, ay, ppu: anim.ppu || 24 }); }
        } catch (err) { console.warn('ArtAtlas: animation sheet failed for', id, err); }
      }
      if (!e.rig || e.anim) return;
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
