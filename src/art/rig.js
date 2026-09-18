// Procedural pixel-art rig for every unit body type. Each unit's `look` picks a
// body, palette, head gear, weapon and extras; the rig draws all animation
// frames from the same parts so the roster stays visually consistent.
import { PixelBuffer, shade } from './PixelBuffer.js';
import { UNITS, TEAM } from '../data/units.js';
import { K, W, METAL, METAL_D, METAL_DD, WOOD, WOOD_D, GOLD, BONE, BONE_D, teamPal, resolvePal, drawHeadgear, drawWeapon, drawShield } from './rigParts.js';

const d2r = Math.PI / 180;
const R = Math.round;

// Cell sizes per body (sprite anchored at feet = (cx, fy)).
const CELLS = {
  small:    { w: 24, h: 24, cx: 11, fy: 21 },
  humanoid: { w: 30, h: 32, cx: 14, fy: 29 },
  big:      { w: 40, h: 40, cx: 18, fy: 37 },
  giant:    { w: 52, h: 52, cx: 24, fy: 48 },
  quad:     { w: 32, h: 24, cx: 15, fy: 21 },
  bug:      { w: 20, h: 16, cx: 10, fy: 14 },
  flyer:    { w: 24, h: 28, cx: 12, fy: 26 },
  vehicle:  { w: 44, h: 30, cx: 21, fy: 27 },
  mech:     { w: 34, h: 26, cx: 17, fy: 23 },
  mount:    { w: 44, h: 36, cx: 20, fy: 33 },
};
export function unitCell(id) { const look = UNITS[id].look; return CELLS[look.body] || CELLS.humanoid; }
export function bodyOf(id) { return UNITS[id].look.body; }

// Size presets for the humanoid drawer: [torsoW, torsoH, headW, headH, legW, legH]
const SIZES = { small: [4, 4, 5, 5, 1, 3], humanoid: [6, 5, 6, 6, 2, 4], big: [8, 7, 8, 8, 3, 6] };

// ---------- humanoid (small / normal / big) ----------
function drawHumanoid(pb, cx, fy, look, P, pose, tp, sizeKey) {
  const [tw, th, hw, hh, lw, lh] = SIZES[sizeKey];
  const lean = pose.lean | 0, bob = pose.bob | 0, stride = pose.stride | 0;
  const T = P.cloth, t = shade(T, -0.4), Lc = shade(T, 0.4);
  const skin = P.skin;
  const legC = look.robot ? shade(P.skin, -0.25) : look.skeleton ? BONE : (look.pants === 'T' ? tp.t : (look.pants || t));
  const half = tw / 2;
  // legs (or a long robe that hides them)
  const liftB = stride < 0 ? 1 : 0, liftF = stride > 0 ? 1 : 0;
  const s = sizeKey === 'big' ? stride * 2 : stride;
  const legGap = sizeKey === 'big' ? 1 : 0;
  const ty0 = fy - lh - th - bob, hy0 = ty0 - hh;
  const bx = cx + lean;
  if (look.robe) {
    const rc = look.robe === 'T' ? tp.T : look.robe;
    const flare = stride ? 1 : 0;
    pb.rect(cx - half, ty0 + th - 1, tw, lh + 1, rc);
    pb.rect(cx - half - flare, fy - 2, tw + flare * 2, 2, rc);
    pb.hline(cx - half - flare, cx + half - 1 + flare, fy - 1, shade(rc, -0.35));
    pb.set(cx + half - 1, ty0 + th, shade(rc, 0.25)); pb.vline(cx - 1, ty0 + th, fy - 2, shade(rc, -0.2));
    if (look.robeTrim) pb.hline(cx - half - flare, cx + half - 1 + flare, fy - 3, look.robeTrim === 'T' ? tp.T : look.robeTrim);
  } else {
    pb.rect(cx - lw - legGap - s, fy - lh, lw, lh - liftB, legC);
    pb.rect(cx + legGap + s, fy - lh, lw, lh - liftF, legC);
    const bootC = look.robot ? METAL_DD : look.skeleton ? BONE_D : WOOD_D;
    pb.hline(cx - lw - legGap - s, cx - 1 - legGap - s, fy - 1 - liftB, bootC);
    pb.hline(cx + legGap + s, cx + legGap + s + lw - 1, fy - 1 - liftF, bootC);
    if (look.stilts) { pb.vline(cx - lw - s, fy - lh - 3, fy - lh, METAL_D); pb.vline(cx + s + lw - 1, fy - lh - 3, fy - lh, METAL_D); }
  }
  // wings (behind)
  if (look.wings) {
    const wc = look.wings === 'big' ? '#2a1420' : '#5a1f2f';
    const span = look.wings === 'big' ? 7 : 3, up = look.wings === 'big' ? 6 : 3;
    for (let i = 0; i < span; i++) { pb.vline(bx - half - 1 - i, ty0 - up + Math.floor(i * 0.6) + (stride ? 1 : 0), ty0 + 1 - Math.floor(i * 0.3), wc); pb.vline(bx + half + i, ty0 - up + Math.floor(i * 0.6) + (stride ? 1 : 0), ty0 + 1 - Math.floor(i * 0.3), wc); }
    pb.set(bx - half - span, ty0 - up + 1, '#ff5a1f'); pb.set(bx + half + span - 1, ty0 - up + 1, '#ff5a1f');
  }
  // cape
  if (look.cape) { const cc = look.cape === 'T' ? tp.T : look.cape; pb.rect(bx - half - 2, ty0, 2, th + 1 + (stride ? 1 : 0), cc); pb.set(bx - half - 3, ty0 + th, cc); }
  // tail
  if (look.tail) { pb.line(bx - half - 1, ty0 + th - 1, bx - half - 4, ty0 + th + 2 - (stride ? 1 : 0), P.skin); pb.set(bx - half - 5, ty0 + th + 2, '#ff5a1f'); }
  // shield (back side)
  if (look.shield) drawShield(pb, look.shield, bx - half - 2, ty0, P, tp);
  // back arm
  pb.vline(bx - half - 1, ty0, ty0 + 2, look.robot ? P.skin : T); pb.set(bx - half - 1, ty0 + 3, look.robot ? METAL_D : skin);
  // torso
  pb.rect(bx - half, ty0, tw, th, T);
  pb.hline(bx - half, bx + half - 1, ty0 + th - 1, t);
  pb.set(bx - half + 1, ty0 + 1, Lc); pb.set(bx - half + 2, ty0 + 1, Lc);
  if (look.pauldrons) { pb.rect(bx - half - 1, ty0 - 1, 2, 2, P.armor); pb.rect(bx + half - 1, ty0 - 1, 2, 2, P.armor); }
  if (look.armorPlate) { pb.rect(bx - half, ty0, tw, Math.max(2, th - 3), P.armor); pb.hline(bx - half, bx + half - 1, ty0 + Math.max(2, th - 3), shade(P.armor, -0.35)); pb.set(bx - half + 1, ty0 + 1, shade(P.armor, 0.3)); }
  if (look.robot) { pb.rect(bx - half, ty0, tw, th, P.skin); pb.hline(bx - half, bx + half - 1, ty0, shade(P.skin, 0.3)); pb.hline(bx - half, bx + half - 1, ty0 + th - 1, shade(P.skin, -0.3)); pb.rect(bx - 1, ty0 + 1, 2, 2, P.glow); pb.set(bx - half, ty0 + th - 2, P.glow); }
  if (look.bandaged) { for (let y = ty0; y < ty0 + th; y += 2) pb.hline(bx - half, bx + half - 1, y, shade(P.skin, -0.2)); pb.rect(bx - half, ty0 + th - 2, tw, 2, T); }
  if (look.skeleton) { pb.rect(bx - half, ty0, tw, th, BONE); for (let y = ty0 + 1; y < ty0 + th; y += 2) pb.hline(bx - half + 1, bx + half - 2, y, BONE_D); pb.rect(bx - half, ty0 + th - 1, tw, 1, T); }
  if (look.banner) { pb.vline(bx - half - 3, ty0 - 10, ty0 + 2, WOOD_D); pb.rect(bx - half - 2, ty0 - 10, 4, 6, tp.T); pb.rect(bx - half - 1, ty0 - 9, 2, 3, GOLD); pb.set(bx - half - 3, ty0 - 11, GOLD); }
  if (look.quiver) { pb.rect(bx - half - 2, ty0 - 2, 2, 4, look.skeleton ? BONE_D : WOOD); pb.set(bx - half - 2, ty0 - 3, METAL); pb.set(bx - half - 1, ty0 - 3, METAL); }
  // head
  const hL = bx - hw / 2;
  pb.rect(hL, hy0, hw, hh, look.robot ? P.skin : skin);
  if (!look.robot) pb.hline(hL, hL + hw - 1, hy0 + hh - 1, shade(skin, -0.25));
  const eyeY = hy0 + Math.floor(hh / 2);
  if (pose.hurt) { pb.set(bx - 1, eyeY, K); pb.set(bx + 1, eyeY, K); pb.set(bx, eyeY + 1, K); pb.set(bx + 2, eyeY + 1, K); }
  else if (!look.robot) { const ec = look.eyes || K; pb.set(bx, eyeY, ec); pb.set(bx + 2, eyeY, ec); }
  if (look.beard) { pb.rect(bx - 2, hy0 + hh - 1, 4, 2, W); pb.hline(bx - 1, bx, hy0 + hh + 1, W); }
  drawHeadgear(pb, look.hat, bx, hy0, hw / 2, P, tp);
  // front arm + weapon
  const shx = bx + half - 1, shy = ty0 + 1;
  const arm = pose.arm != null ? pose.arm : 75;
  const ext = pose.ext != null ? pose.ext : (sizeKey === 'big' ? 4 : 3);
  const hx = R(shx + Math.cos(arm * d2r) * ext), hy = R(shy + Math.sin(arm * d2r) * ext);
  pb.line(shx, shy, hx, hy, look.robot ? P.skin : T, sizeKey === 'big' ? 2 : 1);
  pb.set(hx, hy, look.robot ? METAL_D : skin);
  const wep = look.weapon || 'none';
  drawWeapon(pb, wep, hx, hy, pose.wep != null ? pose.wep : restAngle(wep, arm), pose, { ...P, skeleton: look.skeleton }, tp);
  if (wep === 'daggers' || wep === 'khopeshes' || wep === 'axes' || wep === 'claws') { // off-hand copy
    const ox = bx - half - 1, oy = ty0 + 3;
    pb.line(ox, oy, ox + (pose.slash ? 4 : 2), oy - (pose.slash ? 1 : 2), wep === 'khopeshes' ? GOLD : wep === 'claws' ? BONE : METAL);
  }
}

const REST = { sword: (a) => a - 55, shortsword: (a) => a - 55, greatsword: (a) => a - 70, flamesword: (a) => a - 70, jagged: (a) => a - 55, halberd: () => -78, lavaspear: () => -78, daggers: (a) => a - 30, khopeshes: (a) => a - 30, khopesh: (a) => a - 55, axes: (a) => a - 40, hammer: (a) => a - 60, mace: (a) => a - 55, staff: () => -84, club: (a) => a + 5, spikedclub: (a) => a + 5, trident: () => -80, wasscepter: () => -80, crook: () => -84, lance: () => 8, chainhook: (a) => a + 10, claws: (a) => a, buzzblade: (a) => a - 20, laser: () => 0, pods: () => 0, rail: () => 0, flamer: () => 0, tesla: () => 0, fist: (a) => a, cannonarm: () => 0, bow: (a) => a, crossbow: () => 0, none: (a) => a };
function restAngle(wep, arm) { return (REST[wep] || REST.none)(arm); }

// ---------- quadruped (hound) ----------
function drawQuad(pb, cx, fy, look, P, pose, tp) {
  const g = pose.stride | 0, bob = pose.bob | 0;
  const S = P.skin, Sd = shade(S, -0.35), Sl = shade(S, 0.25);
  const by = fy - 7 - bob;
  const legs = [[cx - 6, -g], [cx - 3, g], [cx + 2, g], [cx + 5, -g]];
  for (const [lx, o] of legs) { pb.rect(lx + o, by + 3, 2, 4 - Math.abs(o) * 0.5, Sd); pb.hline(lx + o, lx + o + 1, by + 6, K); }
  pb.rect(cx - 7, by, 13, 4, S); pb.hline(cx - 6, cx + 4, by, Sl);
  pb.line(cx - 8, by + 1, cx - 11, by - 2 - (g > 0 ? 1 : 0), Sd);   // tail
  if (look.spikes) for (let x = cx - 5; x < cx + 4; x += 2) pb.set(x, by - 1, BONE);
  // head with open jaws
  pb.rect(cx + 6, by - 3, 5, 4, S); pb.rect(cx + 9, by - 1, 4, 2, S);
  pb.set(cx + 7, by - 4, Sd); pb.set(cx + 9, by - 4, Sd);          // ears
  pb.set(cx + 8, by - 2, P.glow); pb.set(cx + 9, by - 2, P.glow);   // glowing eyes (team)
  pb.set(cx + 12, by, W); pb.set(cx + 10, by, W);                    // teeth
  if (pose.slash) { pb.rect(cx + 10, by + 1, 4, 2, S); pb.set(cx + 13, by + 1, W); pb.set(cx + 14, by, '#ff7a1a'); pb.set(cx + 14, by + 2, '#ff7a1a'); }
  if (pose.hurt) { pb.set(cx + 8, by - 2, K); pb.set(cx + 9, by - 2, K); }
}

// ---------- bug (scarab) ----------
function drawBug(pb, cx, fy, look, P, pose, tp) {
  const g = pose.stride | 0;
  const S = P.skin, Sd = shade(S, -0.35), Sl = shade(S, 0.3);
  const by = fy - 5;
  for (let i = 0; i < 3; i++) { const lx = cx - 3 + i * 3, o = (i % 2 ? g : -g); pb.set(lx + o, by + 4, Sd); pb.set(lx + o - 1, by + 5, Sd); pb.set(lx - o + 1, by - 2, Sd); }
  pb.ellipse(cx, by + 1, 4, 3, S);
  pb.hline(cx - 3, cx + 2, by - 1, Sl);
  pb.vline(cx, by - 1, by + 3, P.trim);                             // team stripe down the shell
  pb.rect(cx + 4, by, 3, 3, Sd); pb.set(cx + 6, by, K); pb.set(cx + 7, by + 1, BONE); pb.set(cx + 7, by + 2, BONE); // head + mandibles
  if (pose.slash) { pb.set(cx + 8, by, W); pb.set(cx + 8, by + 2, W); }
  if (look.accentGem) pb.set(cx - 1, by + 1, P.accent);
}

// ---------- flyer (drone) ----------
function drawFlyer(pb, cx, fy, look, P, pose, tp) {
  const bob = (pose.frame || 0) % 2;
  const by = fy - 12 - bob;
  const S = P.skin, Sd = shade(S, -0.35), Sl = shade(S, 0.3);
  // rotors
  const spin = (pose.frame || 0) % 2;
  for (const rx of [cx - 5, cx + 5]) { pb.hline(rx - 3 + spin, rx + 3 - spin, by - 3, METAL_D); pb.set(rx, by - 2, METAL_DD); }
  pb.rect(cx - 6, by - 2, 13, 1, METAL_DD);                        // arms
  pb.ellipse(cx, by, 5, 2, S); pb.hline(cx - 3, cx + 3, by - 2, Sl); pb.hline(cx - 4, cx + 4, by + 2, Sd);
  pb.rect(cx - 1, by - 1, 3, 2, P.glow);                            // core
  pb.set(cx + 4, by, P.accent);                                     // eye
  pb.rect(cx - 1, by + 3, 2, 2, METAL_DD); pb.set(cx + 2, by + 4, pose.cast ? W : METAL_D); // gun
  if (pose.cast) pb.hline(cx + 3, cx + 6, by + 4, P.glow);
  if (pose.hurt) { pb.set(cx + 4, by, K); pb.set(cx - 2, by + 1, '#ff7a1a'); }
}

// ---------- vehicle (tank) ----------
function drawVehicle(pb, cx, fy, look, P, pose, tp) {
  const S = P.skin, Sd = shade(S, -0.35), Sl = shade(S, 0.25);
  const ty = fy - 6;
  // treads
  pb.rect(cx - 12, ty, 24, 6, METAL_DD);
  for (let x = cx - 12 + ((pose.frame || 0) % 3); x < cx + 12; x += 3) pb.vline(x, ty, ty + 5, METAL_D);
  pb.hline(cx - 12, cx + 11, ty + 5, K);
  // hull
  pb.rect(cx - 11, ty - 5, 22, 5, S); pb.hline(cx - 10, cx + 9, ty - 5, Sl); pb.hline(cx - 11, cx + 10, ty - 1, Sd);
  pb.rect(cx - 9, ty - 3, 3, 1, P.glow); pb.rect(cx + 6, ty - 3, 3, 1, P.glow);   // team lights
  // turret + barrel (recoil on attack)
  const rec = pose.recoil || 0;
  pb.rect(cx - 5, ty - 10, 10, 5, S); pb.hline(cx - 4, cx + 3, ty - 10, Sl); pb.set(cx - 4, ty - 8, P.glow);
  pb.rect(cx + 5 - rec, ty - 8, 12, 2, Sd); pb.set(cx + 16 - rec, ty - 8, K); pb.set(cx + 16 - rec, ty - 7, K);
  if (pose.cast) { pb.set(cx + 18, ty - 8, W); pb.set(cx + 19, ty - 9, '#ff7a1a'); pb.set(cx + 19, ty - 6, '#ff7a1a'); pb.set(cx + 20, ty - 8, '#ffe066'); }
  pb.set(cx - 3, ty - 11, METAL_D); pb.set(cx - 3, ty - 12, P.accent); // antenna
  if (pose.hurt) { pb.set(cx, ty - 12, '#4a4a4a'); pb.set(cx + 1, ty - 13, '#6a6a6a'); }
}

// ---------- mech (spider) ----------
function drawMech(pb, cx, fy, look, P, pose, tp) {
  const g = pose.stride | 0;
  const S = P.skin, Sd = shade(S, -0.35), Sl = shade(S, 0.3);
  const by = fy - 9;
  // legs: two pairs each side, animated
  const legs = [[-1, -7, -g], [-1, -4, g], [1, 4, g], [1, 7, -g]];
  for (const [side, off, o] of legs) {
    const kx = cx + off * 1.3 + o * side, ky = by + 2 - Math.abs(o);
    pb.line(cx + side * 3, by + 3, kx, ky, Sd); pb.line(kx, ky, cx + off * 1.6 + o, fy, Sd); pb.set(cx + off * 1.6 + o, fy, K);
  }
  pb.ellipse(cx, by + 2, 6, 4, S); pb.hline(cx - 4, cx + 3, by - 1, Sl); pb.hline(cx - 5, cx + 4, by + 5, Sd);
  pb.rect(cx - 3, by + 1, 2, 2, P.glow);
  pb.rect(cx + 3, by, 3, 3, K); pb.set(cx + 4, by + 1, P.accent); pb.set(cx + 5, by + 1, pose.cast || pose.slash ? W : P.accent);   // eye
  pb.line(cx + 6, by + 3, cx + 9 + (pose.slash ? 3 : 0), by + 4, METAL); pb.set(cx + 9 + (pose.slash ? 3 : 0), by + 4, W); // claw
  if (pose.slash) { pb.set(cx + 13, by + 2, P.accent); pb.set(cx + 13, by + 6, P.accent); }
  if (pose.hurt) { pb.set(cx + 4, by + 1, K); pb.set(cx, by - 2, '#6a6a6a'); }
}

// ---------- mounted rider ----------
function drawMount(pb, cx, fy, look, P, pose, tp) {
  const gallop = pose.stride | 0, bob = pose.bob | 0, lean = pose.lean | 0;
  const H = look.mountSkin || '#9a6238', Hd = shade(H, -0.4), Hl = shade(H, 0.3);
  const by = fy - 9 - bob;
  const legs = [[cx - 7, -gallop], [cx - 4, gallop], [cx + 2, gallop], [cx + 5, -gallop]];
  for (const [lx, g] of legs) { const lift = g < 0 ? 1 : 0; pb.rect(lx + g, by + 4, 2, 5 - lift, Hd); pb.hline(lx + g, lx + g + 1, by + 8 - lift, K); }
  pb.rect(cx - 8, by, 14, 5, H);
  pb.set(cx - 8, by, Hd); pb.set(cx + 5, by, Hd); pb.set(cx - 8, by + 4, Hd); pb.set(cx + 5, by + 4, Hd);
  pb.hline(cx - 6, cx + 3, by, Hl);
  pb.line(cx - 9, by + 1, cx - 11, by + 5 + (gallop > 0 ? 1 : 0), Hd); pb.set(cx - 9, by + 2, Hd);
  if (look.mountFlame) { pb.line(cx - 9, by + 1, cx - 12, by - 2, '#ff7a1a'); pb.set(cx - 12, by - 3, '#ffe066'); }
  pb.line(cx + 5, by, cx + 8, by - 5, H, 3);
  pb.rect(cx + 7, by - 8, 5, 4, H); pb.rect(cx + 11, by - 7, 3, 3, H); pb.set(cx + 13, by - 5, Hd);
  pb.set(cx + 8, by - 9, Hd); pb.set(cx + 10, by - 9, Hd);
  pb.set(cx + 10, by - 7, look.mountFlame ? '#ffe066' : K);
  if (look.mountFlame) { pb.set(cx + 9, by - 10, '#ff7a1a'); pb.set(cx + 7, by - 10, '#ff5a1f'); pb.set(cx + 6, by - 6, '#ff7a1a'); }
  else { pb.vline(cx + 6, by - 6, by - 2, Hd); pb.vline(cx + 5, by - 3, by - 1, Hd); }
  // caparison / barding
  if (look.barding) { pb.rect(cx - 7, by, 12, 4, METAL); pb.hline(cx - 7, cx + 4, by + 3, METAL_D); pb.rect(cx - 6, by + 1, 10, 2, tp.T); pb.rect(cx + 7, by - 8, 5, 2, METAL); }
  else { pb.rect(cx - 6, by + 1, 11, 3, tp.T); pb.hline(cx - 6, cx + 4, by + 3, tp.t); }
  pb.set(cx - 5, by + 4, tp.t); pb.set(cx + 3, by + 4, tp.t);
  // rider
  const rx = cx - 1 + lean, ry0 = by - 5;
  pb.rect(rx - 4, ry0, 2, 6, tp.t);
  pb.rect(rx + 1, by + 1, 2, 3, tp.t); pb.hline(rx + 1, rx + 2, by + 3, WOOD_D);
  pb.rect(rx - 2, ry0, 5, 5, P.cloth);
  pb.rect(rx - 2, ry0, 5, 2, P.armor); pb.hline(rx - 2, rx + 2, ry0 + 2, shade(P.armor, -0.35));
  pb.set(rx - 1, ry0 + 3, shade(P.cloth, 0.4));
  pb.rect(rx - 2, ry0 - 6, 5, 6, P.skin);
  drawHeadgear(pb, look.hat, rx, ry0 - 6, 2.5, P, tp);
  if (look.shield) drawShield(pb, look.shield, rx - 5, ry0 + 1, P, tp);
  const arm = pose.arm != null ? pose.arm : 20, ext = pose.ext != null ? pose.ext : 3;
  const hx = R(rx + 2 + Math.cos(arm * d2r) * ext), hy = R(ry0 + 2 + Math.sin(arm * d2r) * ext);
  pb.line(rx + 2, ry0 + 2, hx, hy, P.cloth); pb.set(hx, hy, P.skin);
  drawWeapon(pb, look.weapon || 'lance', hx, hy, pose.wep != null ? pose.wep : restAngle(look.weapon || 'lance', arm), pose, P, tp);
}

// ---------- giant (brute / golem / titan / omega / satan) ----------
function drawGiant(pb, cx, fy, look, P, pose, tp) {
  const stride = pose.stride | 0, bob = pose.bob | 0, lean = pose.lean | 0;
  const S = P.skin, s = shade(S, -0.35), Sl = shade(S, 0.2), T = P.cloth, t = shade(T, -0.4);
  const liftB = stride < 0 ? 1 : 0, liftF = stride > 0 ? 1 : 0;
  const gs = stride * 2;
  pb.rect(cx - 6 - gs, fy - 8, 5, 8 - liftB, s);
  pb.rect(cx + 1 + gs, fy - 8, 5, 8 - liftF, s);
  const bootC = look.robot ? METAL_DD : look.golem ? shade(S, -0.5) : WOOD_D;
  pb.hline(cx - 6 - gs, cx - 2 - gs, fy - 1 - liftB, bootC);
  pb.hline(cx + 1 + gs, cx + 5 + gs, fy - 1 - liftF, bootC);
  const bx = cx + lean, ty0 = fy - 21 - bob;
  if (look.wings) { for (let i = 0; i < 9; i++) { pb.vline(bx - 10 - i, ty0 - 8 + Math.floor(i * 0.7), ty0 + 4 - Math.floor(i * 0.5), '#2a1420'); pb.vline(bx + 9 + i, ty0 - 8 + Math.floor(i * 0.7), ty0 + 4 - Math.floor(i * 0.5), '#2a1420'); } pb.set(bx - 19, ty0 - 8, '#ff5a1f'); pb.set(bx + 18, ty0 - 8, '#ff5a1f'); }
  if (look.cape) { pb.rect(bx - 10, ty0 + 2, 3, 12, look.cape); }
  if (look.tail) { pb.line(bx - 8, fy - 9, bx - 13, fy - 5, S); pb.set(bx - 14, fy - 5, '#ff5a1f'); }
  // loincloth / belt in team colour
  pb.rect(bx - 7, fy - 10 - bob, 14, 4, T); pb.hline(bx - 7, bx + 6, fy - 10 - bob, t);
  // torso / belly
  if (look.robot) {
    pb.rect(bx - 8, ty0, 16, 12, S); pb.hline(bx - 8, bx + 7, ty0, Sl); pb.hline(bx - 8, bx + 7, ty0 + 11, s);
    pb.rect(bx - 2, ty0 + 3, 4, 4, P.glow); pb.rect(bx - 1, ty0 + 4, 2, 2, W);
    pb.rect(bx - 8, ty0 + 8, 16, 1, s); pb.set(bx - 7, ty0 + 10, P.glow); pb.set(bx + 6, ty0 + 10, P.glow);
    if (look.omega) { pb.rect(bx - 6, ty0 - 4, 12, 4, S); pb.hline(bx - 6, bx + 5, ty0 - 4, Sl); pb.rect(bx - 4, ty0 - 3, 8, 1, P.glow); }
  } else {
    pb.ellipse(bx, ty0 + 7, 8, 7, S);
    pb.rect(bx - 8, ty0 + 2, 16, 8, S);
    pb.ellipse(bx + 1, ty0 + 8, 5, 4, Sl);
    if (look.golem) { pb.rect(bx - 3, ty0 + 3, 6, 4, P.accent); pb.rect(bx - 2, ty0 + 4, 4, 2, W); pb.line(bx - 6, ty0 + 3, bx - 4, ty0 + 9, s); pb.line(bx + 5, ty0 + 2, bx + 7, ty0 + 7, s); }
    else pb.set(bx + 1, ty0 + 9, s);
  }
  // shoulder pads (team) + back arm
  pb.rect(bx - 12, ty0 + 3, 4, 8, S); pb.rect(bx - 12, ty0 + 11, 4, 3, s);
  pb.rect(bx - 12, ty0 + 1, 6, 3, look.robot ? P.armor : T); pb.set(bx - 12, ty0, look.robot ? s : t); pb.set(bx - 7, ty0, look.robot ? s : t);
  pb.rect(bx + 6, ty0 + 1, 6, 3, look.robot ? P.armor : T);
  if (look.robot) { pb.set(bx - 10, ty0 + 2, P.glow); pb.set(bx + 8, ty0 + 2, P.glow); }
  // head (small)
  const hy0 = ty0 - 5;
  pb.rect(bx - 3, hy0, 8, 7, look.robot ? P.armor : S);
  pb.hline(bx - 3, bx + 4, hy0 + 6, s);
  if (look.robot) { pb.hline(bx - 2, bx + 4, hy0 + 2, P.glow); pb.set(bx + 5, hy0 + 2, P.glow); }
  else { pb.set(bx, hy0 + 3, look.eyes || K); pb.set(bx + 3, hy0 + 3, look.eyes || K); if (look.tusks) { pb.set(bx - 1, hy0 + 6, W); pb.set(bx + 3, hy0 + 6, W); } pb.set(bx + 4, hy0 + 4, s); }
  if (pose.hurt && !look.robot) { pb.set(bx + 1, hy0 + 2, K); pb.set(bx + 4, hy0 + 2, K); }
  drawHeadgear(pb, look.hat, bx + 1, hy0, 4, P, tp);
  if (look.golem) { pb.rect(bx - 3, hy0 - 2, 8, 2, GOLD); pb.set(bx + 1, hy0 - 3, P.accent); }
  // front arm + weapon
  const arm = pose.arm != null ? pose.arm : 70, ext = pose.ext != null ? pose.ext : 7;
  const shx = bx + 8, shy = ty0 + 3;
  const hx = R(shx + Math.cos(arm * d2r) * ext), hy = R(shy + Math.sin(arm * d2r) * ext);
  pb.line(shx, shy, hx, hy, S, 3);
  pb.rect(hx - 1, hy - 1, 3, 3, s);
  const wep = look.weapon || 'club';
  drawWeapon(pb, wep, hx, hy, pose.wep != null ? pose.wep : restAngle(wep, arm), pose, P, tp);
}

// ---------- animation tables ----------
const WALK = [{ stride: 1, bob: 0, arm: 100, frame: 0 }, { stride: 0, bob: 1, arm: 85, frame: 1 }, { stride: -1, bob: 0, arm: 65, frame: 2 }, { stride: 0, bob: 1, arm: 85, frame: 3 }];
const IDLE = { stride: 0, bob: 0, frame: 0 };
const HURT = { stride: 0, bob: 0, lean: -1, arm: -60, wep: -110, ext: 3, hurt: true };
const ATTACK = {
  swing:  [{ arm: -120, wep: -110, lean: -1, ext: 3 }, { arm: 0, wep: 10, lean: 1, ext: 4, slash: true }, { arm: 50, wep: 60, ext: 3 }],
  thrust: [{ arm: 160, wep: 0, lean: -1, ext: 2 }, { arm: 0, wep: 0, lean: 1, ext: 5, slash: true }, { arm: 20, wep: 0, ext: 3 }],
  stab:   [{ arm: -70, wep: -60, lean: -1, ext: 3 }, { arm: 0, wep: 5, lean: 1, ext: 4, slash: true }, { arm: 40, wep: 20, ext: 3 }],
  bow:    [{ arm: 0, ext: 3, draw: true, lean: -1 }, { arm: 0, ext: 4, lean: 1 }, { arm: 10, ext: 3 }],
  gun:    [{ arm: 0, ext: 3, lean: -1 }, { arm: 0, ext: 3, lean: 0, cast: true }, { arm: 0, ext: 3 }],
  cast:   [{ arm: -80, wep: -70, ext: 3, lean: -1 }, { arm: -30, wep: -35, ext: 4, lean: 1, cast: true }, { arm: 40, wep: -60, ext: 3 }],
  smash:  [{ arm: -95, wep: -80, ext: 7, lean: -1 }, { arm: 35, wep: 40, ext: 8, lean: 2, slam: true }, { arm: 55, wep: 50, ext: 7 }],
  punch:  [{ arm: 150, ext: 5, lean: -1, wep: 0 }, { arm: 0, ext: 9, lean: 2, wep: 0, slam: true }, { arm: 20, ext: 7, wep: 0 }],
  bite:   [{ stride: 0, lean: -1 }, { stride: 0, lean: 1, slash: true }, { stride: 0 }],
  fire:   [{ frame: 0 }, { frame: 1, cast: true, recoil: 2 }, { frame: 2, recoil: 1 }],
  lance:  [{ arm: 20, ext: 1, lean: -1, wep: 8 }, { arm: 5, ext: 5, lean: 1, wep: 6, slash: true }, { arm: 15, ext: 3, wep: 8 }],
  beamarm: [{ arm: 0, ext: 6, lean: -1, wep: 0 }, { arm: 0, ext: 8, lean: 1, wep: 0, cast: true }, { arm: 0, ext: 7, wep: 0 }],
};
const ATTACK_BY_WEAPON = {
  sword: 'swing', shortsword: 'swing', greatsword: 'swing', flamesword: 'swing', jagged: 'swing', khopesh: 'swing', axes: 'swing', hammer: 'swing', mace: 'swing', wasscepter: 'swing',
  halberd: 'thrust', lavaspear: 'thrust', chainhook: 'thrust', daggers: 'stab', khopeshes: 'stab', claws: 'stab', buzzblade: 'stab',
  bow: 'bow', crossbow: 'gun', laser: 'gun', pods: 'gun', rail: 'gun', flamer: 'gun', tesla: 'gun',
  staff: 'cast', crook: 'cast', club: 'smash', spikedclub: 'smash', trident: 'smash', fist: 'punch', cannonarm: 'beamarm', lance: 'lance', none: 'swing',
};

function attackSet(look) {
  if (look.body === 'quad' || look.body === 'bug' || look.body === 'mech') return ATTACK.bite;
  if (look.body === 'flyer' || look.body === 'vehicle') return ATTACK.fire;
  return ATTACK[ATTACK_BY_WEAPON[look.weapon || (look.body === 'mount' ? 'lance' : 'none')] || 'swing'];
}

export function drawUnitFrame(id, team, pose) {
  const def = UNITS[id];
  const look = def.look;
  const cell = CELLS[look.body] || CELLS.humanoid;
  const pb = new PixelBuffer(cell.w, cell.h);
  const tp = teamPal(team);
  const P = resolvePal(look.pal, tp);
  P.staffGem = look.staffGem;
  switch (look.body) {
    case 'small': drawHumanoid(pb, cell.cx, cell.fy, look, P, pose, tp, 'small'); break;
    case 'big': drawHumanoid(pb, cell.cx, cell.fy, look, P, pose, tp, 'big'); break;
    case 'giant': drawGiant(pb, cell.cx, cell.fy, look, P, pose, tp); break;
    case 'quad': drawQuad(pb, cell.cx, cell.fy, look, P, pose, tp); break;
    case 'bug': drawBug(pb, cell.cx, cell.fy, look, P, pose, tp); break;
    case 'flyer': drawFlyer(pb, cell.cx, cell.fy, look, P, pose, tp); break;
    case 'vehicle': drawVehicle(pb, cell.cx, cell.fy, look, P, pose, tp); break;
    case 'mech': drawMech(pb, cell.cx, cell.fy, look, P, pose, tp); break;
    case 'mount': drawMount(pb, cell.cx, cell.fy, look, P, pose, tp); break;
    default: drawHumanoid(pb, cell.cx, cell.fy, look, P, pose, tp, 'humanoid');
  }
  pb.outline(K);
  return { pb, ax: cell.cx, ay: cell.fy };
}

// Returns [{ key, pb, ax, ay }] for every animation frame of one unit/team.
export function buildUnitFrames(id, team) {
  const look = UNITS[id].look;
  const out = [];
  const push = (key, pose) => { const f = drawUnitFrame(id, team, pose); out.push({ key, ...f }); };
  push(`${id}_${team}_idle`, IDLE);
  WALK.forEach((p, i) => push(`${id}_${team}_walk${i}`, p));
  attackSet(look).forEach((p, i) => push(`${id}_${team}_atk${i}`, p));
  push(`${id}_${team}_hurt`, HURT);
  return out;
}

export { CELLS };
