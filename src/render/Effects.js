// VFXSystem: particles, floating numbers, beams and screen shake. Fed by battle events.
import { TEAM } from '../data/units.js';

const TEAM_TINT = { [TEAM.PLAYER]: [0.55, 0.75, 1.0], [TEAM.ENEMY]: [1.0, 0.55, 0.55] };
const WHITE = [1, 1, 1];
const YELLOW = [1, 0.9, 0.35];
const ORANGE = [1, 0.6, 0.2];
const RED = [1, 0.35, 0.35];
const CYAN = [0.3, 0.9, 1];
const GREEN = [0.6, 1, 0.45];
const PURPLE = [0.75, 0.4, 1];
const SAND = [0.95, 0.85, 0.55];

function hexTint(h) { if (!h || h[0] !== '#') return null; return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }

export class Effects {
  constructor(settings) {
    this.settings = settings;
    this.particles = [];
    this.numbers = [];
    this.decals = [];
    this.beams = [];
    this.trauma = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.flashes = [];
    this.time = 0;
  }

  clear() { this.particles.length = 0; this.numbers.length = 0; this.decals.length = 0; this.beams.length = 0; this.trauma = 0; }
  shake(amount) { if (this.settings.shake) this.trauma = Math.min(1, this.trauma + amount); }

  spawn(p) {
    if (this.particles.length > 1800) this.particles.shift();
    this.particles.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, life: 0.5, age: 0, tint: WHITE, scale: 1, rot: 0, rotV: 0, frames: null, frame: 'spark', fade: true, flip: false, ...p });
  }

  number(text, x, y, opts = {}) {
    if (!this.settings.numbers && !opts.force) return;
    if (this.numbers.length > 60) this.numbers.shift();
    this.numbers.push({ text: String(text), x, y, vy: 2.2, life: opts.life || 0.8, age: 0, tint: opts.tint || WHITE, scale: opts.scale || 1, vx: (Math.random() - 0.5) * 0.6 });
  }

  burst(x, y, n, opts) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (opts.speed || 3) * (0.4 + Math.random() * 0.8);
      this.spawn({ x, y, z: opts.z || 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5, vz: (opts.up || 3) * (0.5 + Math.random()), g: opts.g != null ? opts.g : -9, life: (opts.life || 0.5) * (0.6 + Math.random() * 0.8), tint: opts.tint || WHITE, frame: opts.frame || 'spark', scale: opts.scale || 1, frames: opts.frames || null });
    }
  }

  ring(x, y, scale, tint) { this.spawn({ x, y, z: 0.3, life: 0.35, frames: ['ring0', 'ring1', 'ring2'], scale, tint, fade: false }); }

  beam(x0, y0, x1, y1, tint, width = 0.25, life = 0.18) { this.beams.push({ x0, y0, x1, y1, tint, width, life, age: 0 }); }

  firework(x, y) {
    const tints = [[1, 0.85, 0.3], [0.6, 0.8, 1], [1, 0.5, 0.6], [0.6, 1, 0.6], [1, 1, 1]];
    const tint = tints[Math.floor(Math.random() * tints.length)];
    this.ring(x, y, 1.2, tint);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2, s = 3 + Math.random() * 2;
      this.spawn({ x, y, z: 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 0, g: -2.5, life: 0.9 + Math.random() * 0.4, frame: i % 3 ? 'dot' : 'spark', tint, fade: true });
    }
  }

  trail(kind, x, y) {
    switch (kind) {
      case 'fire': this.spawn({ x, y, z: 0, vz: 0.8, vx: (Math.random() - 0.5), g: 0, life: 0.3, frame: 'dot', tint: [1, 0.6, 0.2] }); break;
      case 'smoke': this.spawn({ x, y, z: 0, vz: 0.4, vx: (Math.random() - 0.5) * 0.5, g: 0, life: 0.5, frames: ['smoke0', 'smoke1'], scale: 0.6, tint: [1.3, 1.3, 1.3] }); break;
      case 'holy': this.spawn({ x, y, z: 0, vz: 0.3, g: 0, life: 0.25, frame: 'dot', tint: [1, 0.95, 0.6] }); break;
      case 'dark': this.spawn({ x, y, z: 0, vz: 0.2, g: 0, life: 0.3, frame: 'dot', tint: PURPLE }); break;
      case 'sand': this.spawn({ x, y, z: 0, vz: 0.3, vx: (Math.random() - 0.5), g: 0, life: 0.3, frame: 'dot', tint: SAND }); break;
      case 'rail': this.spawn({ x, y, z: 0, g: 0, life: 0.15, frame: 'dot', tint: CYAN }); break;
    }
  }

  handle(ev) {
    switch (ev.type) {
      case 'spawn':
        for (let i = 0; i < 3; i++) this.spawn({ x: ev.x + (Math.random() - 0.5) * 0.6, y: ev.y - 0.1, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 0.4, vz: 0.6, life: 0.45, frames: ['dust0', 'dust1', 'dust2'], scale: 1, fade: true });
        if (ev.summoned) { this.ring(ev.x, ev.y + 0.3, 0.8, ev.team === TEAM.PLAYER ? [0.6, 0.8, 1] : PURPLE); this.burst(ev.x, ev.y, 6, { speed: 2, up: 3, life: 0.5, frame: 'dot', tint: PURPLE }); }
        break;
      case 'deploy': break;
      case 'melee':
        this.spawn({ x: ev.x + (ev.dir || 0) * -0.2, y: ev.y + 0.6, z: 0.1, life: 0.16, frames: ['hit0', 'hit1'], scale: ev.base ? 1.6 : 1, fade: false });
        this.burst(ev.x, ev.y + 0.5, ev.base ? 6 : 2, { speed: 3, up: 3, life: 0.35, frame: 'dot', tint: ev.base ? ORANGE : YELLOW });
        break;
      case 'hit':
        if (ev.counter || ev.big || ev.charge) {
          const t = ev.charge ? ORANGE : ev.counter ? YELLOW : WHITE;
          this.number(ev.dmg + (ev.counter || ev.charge ? '!' : ''), ev.x, ev.y + 0.5, { tint: t, scale: ev.big ? 2 : 1.5 });
        } else if (ev.blocked && Math.random() < 0.3) {
          this.spawn({ x: ev.x, y: ev.y + 0.2, z: 0.1, life: 0.2, frame: 'ico_shield', tint: [0.8, 0.9, 1], fade: true, scale: 1.2 });
        }
        if (ev.magic && !ev.splash) this.spawn({ x: ev.x, y: ev.y, z: 0.2, life: 0.2, frame: 'spark', tint: PURPLE });
        if (ev.big) this.shake(0.12);
        break;
      case 'death':
        this.burst(ev.x, ev.y + 0.4, ev.big ? 16 : 4, { speed: ev.big ? 5 : 3, up: 3.5, life: 0.5, frame: 'dot', tint: ev.mech ? [0.7, 0.75, 0.85] : TEAM_TINT[ev.team] });
        this.spawn({ x: ev.x, y: ev.y + 0.3, z: 0.2, life: 0.32, frames: ['poof0', 'poof1', 'poof2'], scale: ev.big ? 1.6 : 0.7, fade: false });
        if (ev.mech) this.burst(ev.x, ev.y + 0.3, ev.big ? 8 : 3, { speed: 2, up: 2, life: 1.0, frames: ['smoke0', 'smoke1', 'smoke2'], g: -1 });
        if (ev.big) { this.shake(0.45); this.number(ev.elite ? 'DESTROYED' : 'CRUSHED', ev.x, ev.y + 1.5, { tint: YELLOW, scale: 1, life: 1.2, force: true }); }
        this.decals.push({ x: ev.x, y: ev.y, life: 6, age: 0, frame: Math.random() < 0.35 ? (ev.mech ? 'scrap' : 'grave') : null, team: ev.team });
        break;
      case 'downed':
        this.burst(ev.x, ev.y + 0.3, 5, { speed: 1.5, up: 1.5, life: 0.5, frame: 'dot', tint: SAND });
        break;
      case 'revive':
        this.ring(ev.x, ev.y + 0.3, 0.9, CYAN);
        this.burst(ev.x, ev.y + 0.3, 8, { speed: 2, up: 3, life: 0.5, frame: 'spark', tint: CYAN });
        this.number('RISE', ev.x, ev.y + 1.3, { tint: CYAN, scale: 1, life: 0.9, force: true });
        break;
      case 'summon':
        this.ring(ev.x, ev.y + 0.3, 0.8, PURPLE);
        break;
      case 'shoot':
        if (ev.kind === 'fireball' || ev.kind === 'hellfire') this.spawn({ x: ev.x + 0.5 * ev.dir, y: ev.y + 1.2, life: 0.15, frames: ['hit0', 'hit1'], tint: ORANGE, fade: false });
        if (ev.kind === 'shell' || ev.kind === 'rocket') { this.burst(ev.x + 1.2 * ev.dir, ev.y + 0.8, 4, { speed: 1, up: 1.5, life: 0.6, frames: ['smoke0', 'smoke1'], g: -0.5, scale: 0.7, tint: [1.3, 1.3, 1.3] }); if (ev.kind === 'shell') this.shake(0.1); }
        break;
      case 'explode': {
        const style = ev.style || 'fire';
        const tint = style === 'fire' ? ORANGE : style === 'sand' ? SAND : style === 'plague' ? GREEN : [1, 0.8, 0.5];
        this.ring(ev.x, ev.y + 0.3, ev.radius / 1.3, style === 'boom' ? WHITE : tint);
        this.burst(ev.x, ev.y + 0.2, 16, { speed: 5, up: 5, life: 0.55, frame: 'dot', tint });
        this.burst(ev.x, ev.y + 0.2, 6, { speed: 2, up: 2, life: 0.9, frames: ['smoke0', 'smoke1', 'smoke2'], g: -1, scale: 1, tint: style === 'plague' ? [0.6, 1, 0.6] : style === 'sand' ? [1.6, 1.4, 1] : undefined });
        this.burst(ev.x, ev.y, 5, { speed: 3, up: 1, life: 0.4, frame: 'spark', tint: YELLOW });
        this.shake(style === 'boom' ? 0.35 : 0.3);
        break;
      }
      case 'slam':
        this.spawn({ x: ev.x, y: ev.y + 0.1, z: 0.1, life: 0.3, frames: ['ring0', 'ring1'], scale: ev.big ? 1.4 : 1.0, tint: [0.9, 0.8, 0.6], fade: false });
        this.burst(ev.x, ev.y, ev.big ? 12 : 6, { speed: 4, up: 2.5, life: 0.5, frames: ['dust0', 'dust1', 'dust2'], g: -6 });
        this.shake(ev.big ? 0.35 : 0.15);
        break;
      case 'flame':
        for (let i = 0; i < 10; i++) this.spawn({ x: ev.x + ev.dir * Math.random() * 1.6, y: ev.y + (Math.random() - 0.5) * 1.2, z: 0.3, vx: ev.dir * (2 + Math.random() * 3), vz: 0.5, g: 0, life: 0.35, frame: i % 2 ? 'dot' : 'spark', tint: i % 3 ? ORANGE : YELLOW });
        break;
      case 'beam':
        this.beam(ev.x0, ev.y0, ev.x1, ev.y1, hexTint(ev.color) || CYAN, 0.2, 0.16);
        this.burst(ev.x1, ev.y1, 5, { speed: 2, up: 2, life: 0.3, frame: 'spark', tint: hexTint(ev.color) || CYAN });
        break;
      case 'chain':
        for (let i = 1; i < ev.points.length; i++) { const [ax, ay] = ev.points[i - 1], [bx, by] = ev.points[i]; this.beam(ax, ay, bx, by, CYAN, 0.15, 0.14); this.burst(bx, by, 3, { speed: 2, up: 2, life: 0.25, frame: 'spark', tint: CYAN }); }
        break;
      case 'orbital':
        this.beam(ev.x0, ev.y + 0.6, ev.x1, ev.y + 0.6, [0.5, 0.95, 1], ev.width, 0.5);
        for (let i = 0; i < 14; i++) this.spawn({ x: ev.x0 + (ev.x1 - ev.x0) * Math.random(), y: ev.y + (Math.random() - 0.5) * ev.width, z: 0.2, vz: 3 + Math.random() * 3, g: -6, life: 0.6, frame: 'spark', tint: CYAN });
        this.shake(0.5);
        break;
      case 'nova':
        this.ring(ev.x, ev.y + 0.3, ev.radius / 1.1, ORANGE);
        this.ring(ev.x, ev.y + 0.3, ev.radius / 1.6, YELLOW);
        for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; this.spawn({ x: ev.x, y: ev.y + 0.3, z: 0.2, vx: Math.cos(a) * 5, vy: Math.sin(a) * 2.5, vz: 1, g: -2, life: 0.6, frame: i % 2 ? 'dot' : 'spark', tint: i % 3 ? ORANGE : YELLOW }); }
        this.shake(0.5);
        this.number('INFERNO', ev.x, ev.y + 2.2, { tint: ORANGE, scale: 1.2, life: 1, force: true });
        break;
      case 'raise':
        this.ring(ev.x, ev.y + 0.3, ev.radius / 1.3, CYAN);
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; this.spawn({ x: ev.x + Math.cos(a) * ev.radius * 0.6, y: ev.y + Math.sin(a) * ev.radius * 0.3, z: 0, vz: 2, g: 0, life: 0.7, frame: 'spark', tint: CYAN }); }
        this.number('RISE!', ev.x, ev.y + 2.2, { tint: CYAN, scale: 1.2, life: 1, force: true });
        break;
      case 'burnTick':
        if (Math.random() < 0.5) this.spawn({ x: ev.x + (Math.random() - 0.5) * 0.5, y: ev.y + 0.4, z: 0.2, vz: 1.2, g: 0, life: 0.35, frame: 'dot', tint: ORANGE });
        break;
      case 'miss':
        this.decals.push({ x: ev.x, y: ev.y, life: 4, age: 0, frame: ev.kind === 'arrow' || ev.kind === 'bonearrow' ? 'stuck_arrow' : null, flip: ev.dir < 0 });
        this.spawn({ x: ev.x, y: ev.y, life: 0.3, frames: ['dust0', 'dust1'], scale: 0.7 });
        break;
      case 'baseHit':
        if (ev.heavy) this.number(ev.dmg, ev.x, ev.y + 4.5, { tint: ev.team === TEAM.PLAYER ? RED : YELLOW, scale: 2.5, force: true, life: 1 });
        this.burst(ev.x, ev.y + 1.5, ev.heavy ? 14 : 3, { speed: 4, up: 5, life: 0.7, frame: 'dot', tint: [0.7, 0.7, 0.8], g: -12 });
        this.burst(ev.x, ev.y + 2, 3, { speed: 1.5, up: 2, life: 1.1, frames: ['smoke0', 'smoke1', 'smoke2'], g: -1 });
        this.shake(ev.heavy ? 0.5 : 0.08);
        break;
      case 'baseDestroyed':
        this.shake(1);
        for (let i = 0; i < 6; i++) setTimeout(() => {
          this.spawn({ x: ev.x + (Math.random() - 0.5) * 4, y: ev.y + 1 + Math.random() * 4, z: 0.5, life: 0.45, frames: ['ring0', 'ring1', 'ring2'], scale: 1.5 + Math.random(), fade: false });
          this.burst(ev.x, ev.y + 2, 20, { speed: 6, up: 7, life: 1.0, frame: 'dot', tint: i % 2 ? ORANGE : [0.7, 0.7, 0.8], g: -12 });
          this.burst(ev.x, ev.y + 2, 8, { speed: 3, up: 3, life: 1.6, frames: ['smoke0', 'smoke1', 'smoke2'], g: -1, scale: 1.5 });
          this.shake(0.8);
        }, i * 220);
        this.flashes.push({ life: 0.5, age: 0, tint: ev.team === TEAM.PLAYER ? [1, 0.3, 0.3] : [1, 1, 0.8] });
        break;
    }
  }

  update(dt) {
    this.time += dt;
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) { ps.splice(i, 1); continue; }
      p.vz += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
      p.rot += p.rotV * dt;
    }
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.age += dt; n.y += n.vy * dt; n.x += n.vx * dt; n.vy *= Math.pow(0.05, dt);
      if (n.age >= n.life) this.numbers.splice(i, 1);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) { const d = this.decals[i]; d.age += dt; if (d.age >= d.life) this.decals.splice(i, 1); }
    for (let i = this.beams.length - 1; i >= 0; i--) { const bm = this.beams[i]; bm.age += dt; if (bm.age >= bm.life) this.beams.splice(i, 1); }
    for (let i = this.flashes.length - 1; i >= 0; i--) { const f = this.flashes[i]; f.age += dt; if (f.age >= f.life) this.flashes.splice(i, 1); }
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma;
    this.shakeX = (Math.random() * 2 - 1) * s * 0.9;
    this.shakeY = (Math.random() * 2 - 1) * s * 0.6;
  }

  draw(batch, ppu) {
    for (const d of this.decals) {
      if (!d.frame) continue;
      const a = d.age > d.life - 1 ? (d.life - d.age) : 1;
      batch.push(d.frame, d.x, d.y, 0.05, { alpha: a * 0.9, flip: d.flip });
    }
    // beams: a rotated 'px' strip from (x0,y0) to (x1,y1)
    for (const bm of this.beams) {
      const f = bm.age / bm.life;
      const len = Math.hypot(bm.x1 - bm.x0, bm.y1 - bm.y0);
      const rot = Math.atan2(bm.y1 - bm.y0, bm.x1 - bm.x0);
      const w = bm.width * (1 - f * 0.7);
      batch.push('px', bm.x0, bm.y0, 3.5, { sx: len, sy: w, ax: 0, ay: 0.5, rot, tint: bm.tint, alpha: 1 - f * f });
      batch.push('px', bm.x0, bm.y0, 3.51, { sx: len, sy: w * 0.4, ax: 0, ay: 0.5, rot, tint: WHITE, alpha: 1 - f });
    }
    for (const p of this.particles) {
      const f = p.age / p.life;
      const key = p.frames ? p.frames[Math.max(0, Math.min(p.frames.length - 1, Math.floor(f * p.frames.length)))] : p.frame;
      const alpha = p.fade ? 1 - f * f : 1;
      batch.push(key, p.x, p.y + p.z, 3 - p.y * 0.001 + p.z * 0.01, { alpha, tint: p.tint, scale: p.scale, rot: p.rot });
    }
    for (const n of this.numbers) {
      const f = n.age / n.life;
      const alpha = f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4;
      const w = 4 * n.scale / ppu;
      let x = n.x - (n.text.length * w) / 2;
      const y = n.y + (f < 0.15 ? f / 0.15 * 0.1 : 0.1);
      const pop = f < 0.12 ? 1 + (0.12 - f) * 3 : 1;
      for (const ch of n.text) {
        const key = 'd_' + ch;
        if (batch.atlas.frames[key]) batch.push(key, x, y, 4, { alpha, tint: n.tint, scale: n.scale * pop, ax: 0, ay: 0 });
        else if (ch !== ' ') batch.push('dot', x, y, 4, { alpha, tint: n.tint, scale: n.scale, ax: 0, ay: 0 });
        x += w;
      }
    }
  }
}
