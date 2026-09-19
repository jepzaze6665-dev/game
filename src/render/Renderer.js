// ThreeJS orthographic pixel renderer. The world is drawn at an integer pixel
// scale into a low-resolution canvas that CSS stretches with nearest filtering.
import * as THREE from '../../vendor/three.module.js';
import { Atlas } from './Atlas.js';
import { ArtAtlas } from './ArtAtlas.js';
import { SpriteBatch } from './SpriteBatch.js';
import { Ground } from './Ground.js';
import { Weather } from './Weather.js';
import { TEAM, LANE } from '../data/units.js';
import { unitCell } from '../art/rig.js';
import { SKELETONS, attackStyle } from '../art/skeletons.js';
import { PROJECTILES } from '../sim/Projectiles.js';

export const PPU = 12;                 // authoring scale of the procedural pixel art (px per world unit)
const MIN_VIRTUAL_WIDTH = 660;         // pixel mode: enough to see the whole lane incl. both bases
// Pixel mode (default): the world is drawn at WORLD_PPU pixels per unit into a
// low-resolution canvas that is upscaled by an integer, so sprite pixels stay
// square. Frame-animated sprites are authored at WORLD_PPU; the procedural rig
// (PPU) is doubled. ?hires=1 switches to the native-resolution mode used for
// the hand-drawn puppet art.
export const HI_RES = /[?&]hires=1/.test(location.search);
export const WORLD_PPU = 24;
const VISIBLE_UNITS = 56;
const GROUND_PPU = 24;

const TEAM_TINT = { [TEAM.PLAYER]: [0.23, 0.51, 0.96], [TEAM.ENEMY]: [0.94, 0.27, 0.27] };
const TEAM_LIGHT = { [TEAM.PLAYER]: [0.58, 0.77, 0.99], [TEAM.ENEMY]: [0.99, 0.65, 0.65] };
const SHADOW_TINT = { [TEAM.PLAYER]: [0.35, 0.55, 1.0], [TEAM.ENEMY]: [1.0, 0.35, 0.35] };

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 50);
    this.camera.position.z = 20;
    this.atlas = new Atlas();
    this.art = new ArtAtlas();
    this.atlas.art = this.art;           // HUD/menus draw hand-drawn icons through the same handle
    this.ppu = PPU;
    this.batch = new SpriteBatch(this.atlas, 10000, PPU, this.ppu);
    this.artBatch = new SpriteBatch(this.art, 16000, 75, this.ppu);
    this.ground = new Ground(GROUND_PPU);
    this.weather = new Weather();
    this.scene.add(this.ground.mesh);
    this.scene.add(this.batch.mesh);
    this.scene.add(this.artBatch.mesh);
    this.scale = 1;
    this.vw = 0; this.vh = 0;
    this.insets = { top: 0, bottom: 0 };
    this.time = 0;
    this.camOffsetY = 0;
    this.resize();
  }

  setTheme(theme, seed) { this.ground.generate(theme, seed); this.scene.background = new THREE.Color(this.ground.theme.sky); this.weather.setTheme(theme, this.worldWidth, this.worldHeight); }
  setInsets(top, bottom) { this.insets.top = top; this.insets.bottom = bottom; this.resize(); }

  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    let s = 1;
    if (HI_RES) {
      this.ppu = Math.max(16, Math.min(48, Math.round(W / VISIBLE_UNITS)));
    } else {
      s = Math.max(1, Math.round(W / (VISIBLE_UNITS * WORLD_PPU)));
      while (s > 1 && (H / s) < 300) s--;
      this.ppu = WORLD_PPU;
    }
    this.batch.setSnap(this.ppu); this.artBatch.setSnap(this.ppu);
    this.scale = s;
    this.vw = Math.ceil(W / s); this.vh = Math.ceil(H / s);
    this.renderer.setSize(this.vw, this.vh, false);
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
    const wu = this.vw / this.ppu, hu = this.vh / this.ppu;
    this.camera.left = -wu / 2; this.camera.right = wu / 2; this.camera.top = hu / 2; this.camera.bottom = -hu / 2;
    this.camera.updateProjectionMatrix();
    const freeCenter = this.insets.top + (H - this.insets.top - this.insets.bottom) / 2;
    this.camOffsetY = (freeCenter - H / 2) / (this.ppu * s);
    this.worldWidth = wu; this.worldHeight = hu;
  }

  worldToScreen(x, y) {
    const W = window.innerWidth, H = window.innerHeight;
    return { x: W / 2 + (x - this.camera.position.x) * this.ppu * this.scale, y: H / 2 - (y - this.camera.position.y) * this.ppu * this.scale };
  }

  frameFor(u) {
    const id = u.type.id, t = u.team;
    if (u.state === 'dead' || u.state === 'downed') return `${id}_${t}_hurt`;
    if (u.hitStun > 0 && u.state !== 'attack') return `${id}_${t}_hurt`;
    if (u.stunT > 0) return `${id}_${t}_hurt`;
    if (u.anim === 'atk') {
      if (u.phase === 'windup') return `${id}_${t}_atk0`;
      return u.phaseT < u.type.recover * 0.45 ? `${id}_${t}_atk1` : `${id}_${t}_atk2`;
    }
    const body = u.type.look.body;
    if (u.anim === 'walk' || body === 'flyer') {
      const fps = 6 + u.type.movementSpeed * 1.6;
      return `${id}_${t}_walk${Math.floor(u.animT * fps) % 4}`;
    }
    const ph = (this.time * 0.9 + (u.id % 17) * 0.37) % 1.6;
    return ph < 0.12 ? `${id}_${t}_walk1` : `${id}_${t}_idle`;
  }

  render(battle, effects, dt, opts = {}) {
    this.time += dt;
    const b = this.batch;
    b.begin(); this.artBatch.begin();
    if (battle && !battle.result && opts.showFrontline !== false) {
      const fx = battle.frontline;
      const lead = fx > 0.5 ? TEAM.PLAYER : fx < -0.5 ? TEAM.ENEMY : null;
      const tint = lead == null ? [1, 1, 1] : TEAM_LIGHT[lead];
      for (let y = -LANE.halfWidth - 0.4; y < LANE.halfWidth + 0.4; y += 0.6) b.rect(fx - 1 / PPU, y, 0.02, 2 / PPU, 0.3, tint, 0.45);
      b.push('marker', fx, LANE.halfWidth + 1.0, 0.03, { tint, alpha: 0.9 });
      b.push('marker', fx, -LANE.halfWidth - 0.7, 0.03, { tint, alpha: 0.9, rot: Math.PI });
    }
    if (battle) {
      this.drawBases(battle);
      this.drawUnits(battle, dt);
      this.drawProjectiles(battle);
    }
    if (effects) effects.draw(b, PPU);
    this.weather.update(dt, this.worldWidth, this.worldHeight);
    this.weather.draw(b, this.camOffsetY);
    b.end(); this.artBatch.end();
    let sx = 0, sy = 0;
    if (effects) { sx = Math.round(effects.shakeX * 4) / this.ppu; sy = Math.round(effects.shakeY * 4) / this.ppu; }
    this.camera.position.x = sx;
    this.camera.position.y = this.camOffsetY + sy;
    this.renderer.render(this.scene, this.camera);
  }

  drawBases(battle) {
    const b = this.batch;
    for (const base of battle.bases) {
      const isP = base.team === TEAM.PLAYER;
      const pct = base.hp / base.maxHp;
      const level = base.hp <= 0 ? 3 : pct > 0.66 ? 0 : pct > 0.33 ? 1 : 2;
      const key = `base_${base.style}_${level}`;
      const bx = base.x + (isP ? -2.2 : 2.2);
      const by = -3.2;
      const shakeX = base.flash > 0 ? (Math.random() - 0.5) * 0.15 : 0;
      b.push(key, bx + shakeX, by, 0.5, { flash: Math.min(0.35, base.flash * 0.5), flip: !isP });
      if (base.hp > 0) {
        const f = 'flag' + (Math.floor(Math.abs(this.time) * 5) % 2);
        const tint = TEAM_TINT[base.team];
        for (const dx of [-2.6, 1.9]) b.push(f, bx + dx * (isP ? 1 : -1) + (isP ? 0 : -0.2), by + 5.0, 0.6, { tint, flip: !isP });
        if (level >= 1 && Math.random() < 0.3 * level) this.fireAt(bx + (Math.random() - 0.5) * 3, by + 2 + Math.random() * 3);
        if (this.onAmbient && Math.random() < 0.08) {
          if (base.style === 'castle') this.onAmbient('smoke', bx + 0.9 * (isP ? 1 : -1), by + 6.3);
          else if (base.style === 'fortress') this.onAmbient('ember', bx + (Math.random() - 0.5) * 4, by + 0.5 + Math.random() * 2);
          else if (base.style === 'factory') this.onAmbient('smoke', bx + (Math.random() < 0.5 ? 0.6 : -0.7) * (isP ? 1 : -1), by + 6.4);
          else this.onAmbient('sand', bx + (Math.random() - 0.5) * 5, by + 0.4 + Math.random() * 2);
        }
        const g = 0.6 + 0.4 * Math.sin(this.time * 9 + (isP ? 0 : 2));
        const glow = base.style === 'castle' ? [1, 0.85, 0.4] : base.style === 'fortress' ? [1, 0.45, 0.2] : base.style === 'factory' ? [0.3, 0.9, 1] : [0.4, 0.85, 1];
        const spots = base.style === 'factory' ? [[0, 4.3], [-2.6, 3.6], [1.9, 3.6]] : base.style === 'temple' ? [[0, 4.0], [-2.8, 4.6], [2.3, 4.6]] : [[-0.8, 4.0], [0.7, 4.0], [-2.6, 3.0], [1.9, 3.0]];
        for (const [dx, dy] of spots) b.push('dot', bx + dx * (isP ? 1 : -1), by + dy, 0.55, { tint: glow, alpha: g * 0.8, scale: 0.6 });
      }
    }
  }

  fireAt(x, y) { if (this.onFire) this.onFire(x, y); }

  // Paper-doll pose for a hand-drawn unit: the whole sprite bobs, tilts,
  // squashes and lunges from its feet anchor. Returns { dx, dy, rot, sx, sy }.
  dollPose(u) {
    const def = u.type, dir = u.dir;
    let dx = 0, dy = 0, rot = 0, sx = 1, sy = 1;
    if (u.state === 'attack' || u.anim === 'atk') {
      if (u.phase === 'windup') {
        const k = Math.min(1, u.phaseT / Math.max(0.05, def.windup));
        rot = -dir * 0.14 * k; sx = 1 - 0.06 * k; sy = 1 + 0.04 * k; dx = -dir * 0.08 * k;
      } else {
        const strike = Math.max(0, 1 - u.phaseT / Math.max(0.05, def.recover * 0.45));
        rot = dir * 0.16 * strike; sx = 1 + 0.10 * strike; sy = 1 - 0.06 * strike; dx = dir * 0.28 * strike;
      }
    } else if (u.anim === 'walk') {
      const ph = u.animT * (4 + def.movementSpeed * 1.3) * Math.PI;
      dy = Math.abs(Math.sin(ph)) * 0.07; rot = Math.sin(ph) * 0.05 * dir;
      sy = 1 + Math.sin(ph * 2) * 0.025; sx = 1 - Math.sin(ph * 2) * 0.025;
    } else {
      const ph = this.time * 2.2 + (u.id % 13) * 0.5;
      sy = 1 + Math.sin(ph) * 0.012; sx = 1 - Math.sin(ph) * 0.008;
    }
    if (u.hitStun > 0 && u.state !== 'attack') { rot += -dir * 0.12; sx *= 0.96; }
    return { dx, dy, rot, sx, sy };
  }

  // Frame key for a frame-animated sprite in the unit's current state.
  animFrame(u, anims) {
    const pick = (list, t) => list[Math.max(0, Math.min(list.length - 1, Math.floor(t)))];
    const cyc = (list, t) => list[((Math.floor(t) % list.length) + list.length) % list.length];
    if (u.state === 'dead') { const d = anims.death || anims.hurt || anims.idle; return pick(d, u.deadT / 0.7 * d.length); }
    if (u.state === 'downed') { const d = anims.death || anims.hurt || anims.idle; return d[Math.min(d.length - 1, Math.floor(d.length * 0.6))]; }
    if (u.anim === 'atk' && anims.atk) {
      // charge hits, counter hits and every second swing use the sheet's extra attacks when it has them
      const a = (u.swing === 'charge' && (anims.charge || anims.atk3)) || (u.swing === 'heavy' && (anims.heavy || anims.atk2)) || (u.swing === 'alt' && anims.atk2) || anims.atk;
      const split = Math.max(1, Math.round(a.length * 0.45));
      if (u.phase === 'windup') return pick(a, u.phaseT / Math.max(0.05, u.type.windup) * split);
      return pick(a, split + u.phaseT / Math.max(0.05, u.type.recover) * (a.length - split));
    }
    if (u.stunT > 0 || (u.hitStun > 0 && u.state !== 'attack')) {
      // shielded units and tower shields take arrows in a block pose
      if (anims.block && (u.shieldT > 0 || (u.type.rangedResist && u.lastHitRanged))) return pick(anims.block, (1 - u.flash) * anims.block.length);
      const h = anims.hurt || anims.idle; return pick(h, (1 - u.flash) * h.length);
    }
    if (u.state === 'cheer' && anims.victory) return cyc(anims.victory, u.cheerT * 5);
    if (u.anim === 'walk' || u.state === 'flee') {
      const charging = u.chargeDist > 3.5 || u.state === 'flee';
      const w = (charging && (anims.run || anims.charge)) || anims.walk || anims.idle;
      return cyc(w, u.animT * (8 + u.type.movementSpeed * 1.5));
    }
    if (u.shieldT > 0 && anims.block) return cyc(anims.block, this.time * 5);
    const idle = anims.idle || anims.walk;
    return cyc(idle, this.time * 6 + (u.id % 7));
  }

  drawAnimUnit(u, anims, z) {
    const ab = this.artBatch, sc = u.type.look.scale || 1, flip = u.dir < 0;
    const key = this.animFrame(u, anims);
    let hop = u.spawnT > 0 ? Math.sin((0.35 - u.spawnT) / 0.35 * Math.PI) * 0.35 : 0;
    if (u.state === 'cheer') hop = Math.abs(Math.sin(u.cheerT * 7)) * 0.5;
    const x = u.x, y = u.y + hop;
    const rim = 1 / this.ppu, tint = TEAM_TINT[u.team];
    for (const [ox, oy] of [[rim, 0], [-rim, 0], [0, rim], [0, -rim]]) ab.push(key, x + ox, y + oy, z - 0.002, { flip, flash: 1, tint, alpha: 0.75, scale: sc });
    const bodyTint = u.burn ? [1, 0.75, 0.55] : u.slow ? [0.75, 1, 0.75] : undefined;
    ab.push(key, x, y, z, { flip, flash: u.flash * 0.5, tint: bodyTint, scale: sc });
    return key;
  }

  drawArtUnit(u, dt) {
    const b = this.batch, ab = this.artBatch;
    const f = this.art.frame(u.type.id);
    const sc = u.type.look.scale || 1;
    const wUnits = f.w / f.ppu * sc;            // sprite width in world units
    const z = 1 + (LANE.halfWidth - u.y) * 0.01;
    const flip = u.dir < 0;
    const shadowScale = wUnits / (17 / PPU) * 0.9;
    const anims = this.art.anims[u.type.id];
    if (anims && (u.state === 'dead' || u.state === 'downed')) {
      const alpha = u.state === 'downed' ? 0.7 + 0.3 * Math.sin(this.time * 10) : u.deadT < 1.0 ? 1 : Math.max(0, 1 - (u.deadT - 1.0) / 0.5);
      b.push('shadow_big', u.x, u.y, 0.2, { alpha: alpha * 0.8, scale: shadowScale, tint: SHADOW_TINT[u.team] });
      ab.push(this.animFrame(u, anims), u.x, u.y, z, { flip, alpha, flash: u.flash * 0.5, scale: sc });
      return null;
    }
    if (u.state === 'dead') {
      const t = Math.min(1, u.deadT / 0.3);
      const rot = -u.dir * t * Math.PI * 0.5;
      const alpha = u.deadT < 0.45 ? 1 : Math.max(0, 1 - (u.deadT - 0.45) / 0.45);
      b.push('shadow_big', u.x, u.y, 0.2, { alpha: alpha * 0.8, scale: shadowScale, tint: SHADOW_TINT[u.team] });
      ab.push(u.type.id, u.x, u.y, z, { flip, rot, alpha, flash: u.flash, scale: sc });
      return null;
    }
    if (u.state === 'downed') {
      b.push('shadow_big', u.x, u.y, 0.2, { alpha: 0.6, scale: shadowScale, tint: SHADOW_TINT[u.team] });
      ab.push(u.type.id, u.x, u.y, z, { flip, rot: -u.dir * Math.PI * 0.5, alpha: 0.7 + 0.3 * Math.sin(this.time * 10), scale: sc });
      return null;
    }
    b.push('shadow_big', u.x, u.y - 0.05, 0.2, { scale: shadowScale, tint: SHADOW_TINT[u.team], alpha: 0.9 });
    if (anims) { const key = this.drawAnimUnit(u, anims, z); const af = this.art.frame(key); return { top: u.y + af.ay / af.ppu * sc + 0.15, w: Math.max(0.8, Math.min(2.4, wUnits * 0.8)), big: wUnits > 1.8 }; }
    const rig = this.art.rigs[u.type.id];
    if (rig) { this.drawPuppet(u, rig, f, z); return { top: u.y + f.h / f.ppu * sc + 0.15, w: Math.max(0.8, Math.min(2.4, wUnits * 0.8)), big: wUnits > 1.8 }; }
    const pose = this.dollPose(u);
    let hop = u.spawnT > 0 ? Math.sin((0.35 - u.spawnT) / 0.35 * Math.PI) * 0.35 : 0;
    if (u.state === 'cheer') hop = Math.abs(Math.sin(u.cheerT * 7)) * 0.5;
    const jitter = u.hitStun > 0 ? (Math.random() - 0.5) * 0.12 : 0;
    const x = u.x + pose.dx + jitter, y = u.y + pose.dy + hop;
    const sx = f.w * pose.sx * sc, sy = f.h * pose.sy * sc;
    // thin team-coloured rim: solid silhouettes offset by ~1.5 screen px behind the sprite
    const rim = 1.5 / this.ppu, tint = TEAM_TINT[u.team];
    for (const [ox, oy] of [[rim, 0], [-rim, 0], [0, rim], [0, -rim]]) ab.push(u.type.id, x + ox, y + oy, z - 0.002, { flip, rot: pose.rot, sx, sy, flash: 1, tint, alpha: 0.75 });
    const flash = u.flash * 0.6;   // big hand-drawn sprites need a softer hit flash
    const bodyTint = u.burn ? [1, 0.75, 0.55] : u.slow ? [0.75, 1, 0.75] : undefined;
    ab.push(u.type.id, x, y, z, { flip, rot: pose.rot, sx, sy, flash, tint: bodyTint });
    if (u.anim === 'walk' && this.onDust && u.state !== 'flee') {
      const heavy = wUnits > 1.8;
      if (Math.random() < (heavy ? 0.25 : 0.03) * dtScale(dt)) this.onDust(u.x - u.dir * (heavy ? 0.9 : 0.4), u.y - 0.1, heavy ? 1 : 0.6);
    }
    return { top: u.y + f.h / f.ppu * sc + 0.15, w: Math.max(0.8, Math.min(2.4, wUnits * 0.8)), big: wUnits > 1.8 };
  }

  // Cut-out puppet: every part rotates about its pivot, children follow their
  // parent (torso -> head/arms). Angles come from the skeleton's pose function.
  drawPuppet(u, rig, f, z) {
    const ab = this.artBatch, def = u.type, dir = u.dir, flip = dir < 0;
    const sc = def.look.scale || 1, ppu = f.ppu / sc;
    const pose = SKELETONS[rig.skeleton].pose({
      anim: u.anim, state: u.state, phase: u.phase, phaseT: u.phaseT, windup: def.windup, recover: def.recover,
      animT: u.animT, speed: def.movementSpeed, time: this.time, seed: (u.id % 13) * 0.5, hit: u.hitStun > 0 && u.state !== 'attack', style: attackStyle(def.look.weapon),
    });
    if (rig.legSwing != null) { pose.angles.legF *= rig.legSwing; pose.angles.legB *= rig.legSwing; }   // robes sway less than legs
    let hop = u.spawnT > 0 ? Math.sin((0.35 - u.spawnT) / 0.35 * Math.PI) * 0.35 : 0;
    if (u.state === 'cheer') hop = Math.abs(Math.sin(u.cheerT * 7)) * 0.5;
    const jitter = u.hitStun > 0 ? (Math.random() - 0.5) * 0.12 : 0;
    const rootX = u.x + pose.dx * dir + jitter, rootY = u.y + pose.dy + hop;
    const byName = {}; for (const p of rig.parts) byName[p.name] = p;
    const world = {};
    const place = (p) => {
      if (world[p.name]) return world[p.name];
      const a = pose.angles[p.name] || 0;
      let w;
      if (p.parent && byName[p.parent]) {
        const par = place(byName[p.parent]);
        const dx = (p.pivot[0] - byName[p.parent].pivot[0]) / ppu * dir, dy = -(p.pivot[1] - byName[p.parent].pivot[1]) / ppu;
        const c = Math.cos(par.ang), s = Math.sin(par.ang);
        w = { x: par.x + dx * c - dy * s, y: par.y + dx * s + dy * c, ang: par.ang + a * dir };
      } else {
        w = { x: rootX + (p.pivot[0] - f.ax) / ppu * dir, y: rootY - (p.pivot[1] - f.ay) / ppu, ang: a * dir };
      }
      return (world[p.name] = w);
    };
    const rim = 1.5 / this.ppu, tint = TEAM_TINT[u.team];
    const flash = u.flash * 0.6;   // big hand-drawn sprites need a softer hit flash
    const bodyTint = u.burn ? [1, 0.75, 0.55] : u.slow ? [0.75, 1, 0.75] : undefined;
    for (const p of rig.parts) { const w = place(p); for (const [ox, oy] of [[rim, 0], [-rim, 0], [0, rim], [0, -rim]]) ab.push(p.key, w.x + ox, w.y + oy, z - 0.002, { flip, rot: w.ang, flash: 1, tint, alpha: 0.75, scale: sc }); }
    for (const p of rig.parts) { const w = world[p.name]; ab.push(p.key, w.x, w.y, z, { flip, rot: w.ang, flash, tint: bodyTint, scale: sc }); }
  }

  drawUnits(battle, dt) {
    const b = this.batch;
    for (const u of battle.units) {
      const look = u.type.look;
      let big = look.body === 'giant' || look.body === 'big' || look.body === 'vehicle';
      const sc = look.scale || 1;
      const z = 1 + (LANE.halfWidth - u.y) * 0.01;
      const flip = u.dir < 0;
      let top, barW;
      if (this.art.has(u.type.id)) {
        const r = this.drawArtUnit(u, dt);
        if (!r) continue;
        top = r.top; barW = r.w; big = r.big;
      } else {
      const key = this.frameFor(u);
      const shadowKey = big ? 'shadow_big' : 'shadow';
      const shadowScale = look.body === 'mount' || look.body === 'mech' || look.body === 'quad' ? 1.5 : look.body === 'bug' || look.body === 'small' ? 0.8 : 1;
      if (u.state === 'dead') {
        const t = Math.min(1, u.deadT / 0.3);
        const rot = -u.dir * t * Math.PI * 0.5 * (look.body === 'mount' || look.body === 'vehicle' ? 0.5 : 1);
        const alpha = u.deadT < 0.45 ? 1 : Math.max(0, 1 - (u.deadT - 0.45) / 0.45);
        b.push(shadowKey, u.x, u.y, 0.2, { alpha: alpha * 0.8, scale: shadowScale * sc, tint: SHADOW_TINT[u.team] });
        b.push(key, u.x, u.y, z, { flip, rot, alpha, flash: u.flash, scale: sc });
        continue;
      }
      if (u.state === 'downed') {
        b.push(shadowKey, u.x, u.y, 0.2, { alpha: 0.6, scale: shadowScale * sc, tint: SHADOW_TINT[u.team] });
        b.push(key, u.x, u.y, z, { flip, rot: -u.dir * Math.PI * 0.5, alpha: 0.7 + 0.3 * Math.sin(this.time * 10), scale: sc });
        continue;
      }
      // team-coloured shadow: instant friend/foe readability even in a scrum
      b.push(shadowKey, u.x, u.y - 0.05, 0.2, { scale: shadowScale * sc, tint: SHADOW_TINT[u.team], alpha: 0.9 });
      let hop = u.spawnT > 0 ? Math.sin((0.35 - u.spawnT) / 0.35 * Math.PI) * 0.35 : 0;
      if (u.state === 'cheer') hop = Math.abs(Math.sin(u.cheerT * 7)) * 0.5;
      const hover = look.body === 'flyer' ? 0.3 + Math.sin(this.time * 4 + u.id) * 0.12 : 0;
      const jitter = u.hitStun > 0 ? (Math.random() - 0.5) * 0.12 : 0;
      const flash = u.flash * 0.6;   // big hand-drawn sprites need a softer hit flash
      const tint = u.burn ? [1, 0.75, 0.55] : u.slow ? [0.75, 1, 0.75] : undefined;
      b.push(key, u.x + jitter, u.y + hop + hover, z, { flip, flash, scale: sc, tint });
      // marching dust
      if (u.anim === 'walk' && this.onDust && u.state !== 'flee' && look.body !== 'flyer') {
        const heavy = big || look.body === 'mount';
        if (Math.random() < (heavy ? 0.25 : 0.03) * dtScale(dt)) this.onDust(u.x - u.dir * (heavy ? 0.9 : 0.4), u.y - 0.1, heavy ? 1 : 0.6);
      }
      const cell = unitCell(u.type.id);
      top = u.y + (cell.fy - 6) / PPU * sc + 0.2;
      barW = big ? 2.2 : look.body === 'mount' || look.body === 'mech' ? 1.6 : look.body === 'bug' || look.body === 'small' ? 0.8 : 1.0;
      }
      if (u.type.passive === 'rage' && u.hp / u.maxHp < 0.5 && this.onRage && Math.random() < 0.25 * dtScale(dt)) this.onRage(u.x + (Math.random() - 0.5) * 0.6, u.y + 0.6);
      // hp bar for wounded units + status icons
      if (u.hp < u.maxHp) {
        const w = barW;
        const yb = top + 0.05;
        const px = 1 / this.ppu;   // one screen pixel in world units, so bars stay thin at any scale
        b.rect(u.x - w / 2 - px, yb - px, 2.5, w + 2 * px, 5 * px, [0.1, 0.06, 0.15], 0.9);
        b.rect(u.x - w / 2, yb, 2.6, w * Math.max(0, u.hp / u.maxHp), 3 * px, TEAM_LIGHT[u.team]);
        let ix = u.x - w / 2;
        const icon = (k) => { b.push(k, ix, yb + 7 * px, 2.7, { ax: 0, ay: 0 }); ix += 0.45; };
        if (u.burn) icon('ico_burn');
        if (u.slow) icon('ico_slow');
        if (u.stunT > 0) icon('ico_stun');
        if (u.shieldT > 0) icon('ico_shield');
        if (u.healedT > 0) { icon('ico_heal'); u.healedT -= dt; }
        if (u.formation >= 2) icon('ico_form');
        if (u.rallyT > 0) icon('ico_rally');
        if (u.type.passive === 'rage' && u.hp / u.maxHp < 0.5) icon('ico_rage');
      } else if (u.healedT > 0) u.healedT -= dt;
      if (u.type.chargeBonus && u.chargeDist > 3.5 && u.anim === 'walk') b.push('chev', u.x + u.dir * 1.6, u.y + 1.2, 2.7, { flip, tint: [1, 0.85, 0.3], alpha: 0.5 + 0.5 * Math.sin(this.time * 20) });
      // elite/legendary star so big threats read at a glance
      if (u.type.tier >= 11) b.push('star', u.x, top + 0.5, 2.7, { tint: u.type.tier === 12 ? [1, 0.85, 0.3] : [1, 1, 1], alpha: 0.7 + 0.3 * Math.sin(this.time * 6), scale: u.type.tier === 12 ? 1.2 : 0.9 });
    }
  }

  drawProjectiles(battle) {
    const b = this.batch;
    for (const p of battle.projectiles) {
      const k = p.k || PROJECTILES[p.kind];
      const f = p.t / p.life;
      b.push('shadow', p.x, p.y - 0.9, 0.2, { alpha: 0.35, scale: 0.6 });
      const sprite = k.sprite || 'arrow';
      if (k.anim) {
        b.push(sprite + (Math.floor(Math.abs(this.time) * 14) % k.anim), p.x, p.y + p.z, 2.8, { flip: p.dir < 0 });
        if (k.trail && this.onTrail && Math.random() < 0.6) this.onTrail(k.trail, p.x, p.y + p.z);
      } else {
        const slope = k.arc > 0.5 ? Math.cos(f * Math.PI) * 0.6 : 0;
        const rot = k.arc > 0.5 ? (p.dir < 0 ? -slope : slope) : (p.dir < 0 ? -Math.atan2(p.ty - p.sy, Math.abs(p.tx - p.sx)) : Math.atan2(p.ty - p.sy, Math.abs(p.tx - p.sx)));
        b.push(sprite, p.x, p.y + p.z, 2.8, { rot, flip: p.dir < 0 });
        if (k.trail && this.onTrail && Math.random() < 0.5) this.onTrail(k.trail, p.x, p.y + p.z);
      }
    }
  }
}

function dtScale(dt) { return Math.min(3, dt * 60); }
