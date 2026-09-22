// Projectiles, particles, digits and small icons drawn as pixel buffers.
import { PixelBuffer } from './PixelBuffer.js';
const PAL = { G: '#dfe4ec', g: '#8f98aa', B: '#a06a35', b: '#5e3a1c', Y: '#ffd43a', y: '#b8860b' };

const W = '#ffffff', K = '#1b1026';

function mk(w, h, fn) { const pb = new PixelBuffer(w, h); fn(pb); return pb; }

// 3x5 pixel digit font used for floating damage numbers
const DIGITS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  '!': ['010', '010', '010', '000', '010'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  x: ['000', '101', '010', '101', '000'],
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['110', '101', '101', '101', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '011', '001'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
};

export const SHADOW_SIZES = [[12, 5], [16, 6], [24, 9], [32, 12], [48, 18]];   // half-axes in atlas px (PPU 12)

export function buildFxFrames() {
  const out = [];
  const push = (key, pb, ax, ay) => out.push({ key, pb, ax: ax ?? pb.w / 2, ay: ay ?? pb.h / 2 });

  push('px', mk(1, 1, (p) => p.set(0, 0, W)));
  push('shadow', mk(9, 4, (p) => { p.ellipse(4, 1, 4, 1, 'rgba(10,6,20,0.45)'); p.hline(2, 6, 3, 'rgba(10,6,20,0.25)'); }), 4.5, 2);
  push('shadow_big', mk(17, 7, (p) => p.ellipse(8, 3, 8, 3, 'rgba(10,6,20,0.45)')), 8.5, 3.5);
  // larger ellipses for the animation-sheet units, so a wide sprite gets a
  // shadow drawn at its own pixel size instead of a 17 px one blown up 3x
  for (const [rx, ry] of SHADOW_SIZES) push(`shadow_${rx}`, mk(rx * 2 + 1, ry * 2 + 1, (p) => p.ellipse(rx, ry, rx, ry, 'rgba(10,6,20,0.45)')), rx + 0.5, ry + 0.5);

  // digits
  for (const ch of Object.keys(DIGITS)) {
    const rows = DIGITS[ch];
    push('d_' + ch, mk(3, 5, (p) => rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '1') p.set(x, y, W); }))), 0, 0);
  }

  // arrow (pointing right)
  push('arrow', mk(10, 3, (p) => { p.hline(0, 7, 1, PAL.B); p.set(8, 1, PAL.G); p.set(9, 1, W); p.set(0, 0, PAL.G); p.set(0, 2, PAL.G); p.set(1, 0, PAL.G); }));
  // fireball 3 frames
  for (let i = 0; i < 3; i++) {
    push('fireball' + i, mk(11, 9, (p) => {
      p.ellipse(6, 4, 4, 3, '#ff7a1a'); p.ellipse(7, 4, 3, 2, '#ffc14d'); p.set(7, 4, W); p.set(8, 4, W);
      p.set(1 - (i % 2), 3 + (i % 3) - 1, '#ff4d00'); p.set(2, 6 - i % 2, '#ffb000'); p.set(0, 5, '#ff7a1a');
      p.set(3 + i, 1, '#ffd23f');
    }));
  }
  // magic bolt
  push('bolt', mk(7, 3, (p) => { p.hline(0, 6, 1, '#b45cff'); p.hline(2, 6, 0, '#e2c0ff'); p.set(6, 1, W); }));
  // spark / star / plus
  push('spark', mk(3, 3, (p) => { p.set(1, 0, W); p.set(0, 1, W); p.set(1, 1, '#fff2a0'); p.set(2, 1, W); p.set(1, 2, W); }));
  push('star', mk(5, 5, (p) => { p.set(2, 0, W); p.set(2, 4, W); p.set(0, 2, W); p.set(4, 2, W); p.rect(1, 1, 3, 3, '#ffe36a'); p.set(2, 2, W); }));
  push('dot', mk(2, 2, (p) => p.rect(0, 0, 2, 2, W)));
  // dust puffs
  for (let i = 0; i < 3; i++) {
    const r = 2 + i;
    push('dust' + i, mk(r * 2 + 3, r * 2 + 3, (p) => {
      p.circle(r + 1, r + 1, r, 'rgba(226,214,180,0.85)'); p.circle(r + 1 - 1, r + 1 - 1, Math.max(1, r - 1), 'rgba(246,238,214,0.9)');
      p.set(r + 2, r + 2, 'rgba(180,160,120,0.8)');
    }));
  }
  // smoke
  for (let i = 0; i < 3; i++) {
    const r = 2 + i;
    push('smoke' + i, mk(r * 2 + 3, r * 2 + 3, (p) => { p.circle(r + 1, r + 1, r, 'rgba(60,50,70,0.8)'); p.circle(r, r, Math.max(1, r - 1), 'rgba(90,80,100,0.85)'); }));
  }
  // explosion rings
  for (let i = 0; i < 3; i++) {
    const r = 4 + i * 3;
    push('ring' + i, mk(r * 2 + 3, r * 2 + 3, (p) => {
      for (let a = 0; a < 64; a++) { const x = Math.round(r + 1 + Math.cos(a / 64 * 6.283) * r), y = Math.round(r + 1 + Math.sin(a / 64 * 6.283) * r); p.set(x, y, a % 3 ? '#ffb347' : W); }
    }));
  }
  // impact splash (melee hit)
  push('hit0', mk(7, 7, (p) => { p.set(3, 0, W); p.set(0, 3, W); p.set(6, 3, W); p.set(3, 6, W); p.rect(2, 2, 3, 3, '#ffe36a'); p.set(3, 3, W); }));
  push('hit1', mk(9, 9, (p) => { p.set(4, 0, W); p.set(0, 4, W); p.set(8, 4, W); p.set(4, 8, W); p.set(1, 1, '#ffe36a'); p.set(7, 1, '#ffe36a'); p.set(1, 7, '#ffe36a'); p.set(7, 7, '#ffe36a'); p.rect(3, 3, 3, 3, W); }));
  // poof (death)
  for (let i = 0; i < 3; i++) {
    const r = 3 + i * 2;
    push('poof' + i, mk(r * 2 + 3, r * 2 + 3, (p) => {
      p.circle(r + 1, r + 1, r, 'rgba(255,255,255,0.9)');
      p.circle(r + 1, r + 1, Math.max(1, r - 2), i === 2 ? 'rgba(255,255,255,0)' : 'rgba(230,230,255,0.9)');
    }));
  }
  push('skull', mk(7, 8, (p) => { p.rect(1, 0, 5, 5, W); p.rect(0, 1, 7, 3, W); p.set(2, 2, K); p.set(4, 2, K); p.rect(2, 5, 3, 2, W); p.set(2, 6, K); p.set(4, 6, K); p.set(3, 7, W); }));
  push('coin', mk(5, 5, (p) => { p.circle(2, 2, 2, PAL.Y); p.set(1, 1, '#fff2a0'); p.set(2, 2, PAL.y); p.set(2, 3, PAL.y); }));
  push('heart', mk(7, 6, (p) => { p.rect(1, 0, 2, 1, '#ff4d6d'); p.rect(4, 0, 2, 1, '#ff4d6d'); p.rect(0, 1, 7, 2, '#ff4d6d'); p.rect(1, 3, 5, 1, '#ff4d6d'); p.rect(2, 4, 3, 1, '#ff4d6d'); p.set(3, 5, '#ff4d6d'); p.set(1, 1, W); }));
  // flags (2 frames each) drawn generic white; tinted at draw time
  for (let i = 0; i < 2; i++) {
    push('flag' + i, mk(9, 12, (p) => {
      p.vline(0, 0, 11, PAL.b); p.set(0, 0, PAL.Y);
      for (let y = 0; y < 6; y++) { const wobble = (i ? (y % 2) : ((y + 1) % 2)); p.hline(1, 7 - Math.floor(y / 3) + wobble - 1, y + 1, W); }
    }), 0, 11);
  }
  // frontline banner marker
  push('marker', mk(7, 5, (p) => { p.hline(0, 6, 0, W); p.hline(1, 5, 1, W); p.hline(2, 4, 2, W); p.set(3, 3, W); p.set(3, 4, W); }));
  push('chev', mk(5, 7, (p) => { p.set(0, 0, W); p.set(1, 1, W); p.set(2, 2, W); p.set(3, 3, W); p.set(2, 4, W); p.set(1, 5, W); p.set(0, 6, W); p.set(1, 0, W); p.set(2, 1, W); p.set(3, 2, W); p.set(4, 3, W); p.set(3, 4, W); p.set(2, 5, W); p.set(1, 6, W); }));
  push('stuck_arrow', mk(5, 2, (p) => { p.hline(0, 3, 0, PAL.B); p.set(4, 0, PAL.G); p.set(0, 1, PAL.G); }));
  push('grave', mk(7, 8, (p) => { p.rect(1, 0, 5, 8, '#8a93a5'); p.rect(2, 0, 3, 1, '#b8c0d0'); p.rect(0, 2, 7, 6, '#8a93a5'); p.rect(2, 3, 3, 1, '#5a6274'); p.rect(3, 2, 1, 3, '#5a6274'); }), 3.5, 8);
  push('scrap', mk(7, 5, (p) => { p.rect(0, 2, 7, 3, '#5b6373'); p.rect(1, 0, 3, 2, '#8c95a8'); p.set(5, 1, '#8c95a8'); p.set(2, 3, '#38e0ff'); }), 3.5, 5);
  // ---- race projectiles ----
  push('bonearrow', mk(10, 3, (p) => { p.hline(0, 7, 1, '#f4f0e6'); p.set(8, 1, '#c9c2b0'); p.set(9, 1, W); p.set(0, 0, '#c9c2b0'); p.set(0, 2, '#c9c2b0'); }));
  push('firearrow', mk(11, 3, (p) => { p.hline(1, 8, 1, PAL.b); p.set(9, 1, '#ff7a1a'); p.set(10, 1, '#ffe066'); p.set(0, 0, '#ff5a1f'); p.set(0, 2, '#ff5a1f'); p.set(1, 0, '#ff7a1a'); }));
  push('bolt', mk(8, 3, (p) => { p.hline(0, 5, 1, PAL.b); p.set(6, 1, PAL.G); p.set(7, 1, W); p.set(0, 0, PAL.g); p.set(0, 2, PAL.g); }));
  for (let i = 0; i < 3; i++) {
    push('hellfire' + i, mk(11, 11, (p) => { p.ellipse(5, 5, 4, 4, '#ff3d1a'); p.ellipse(5, 5, 3, 3, '#ff7a1a'); p.ellipse(6, 5, 2, 2, '#ffe066'); p.set(6, 5, W); p.set(1 + i, 1 + (i % 2), '#ff3d1a'); p.set(9 - i, 9, '#ff7a1a'); p.set(2, 8 - i, '#ffb347'); }));
    push('sandball' + i, mk(11, 9, (p) => { p.ellipse(5, 4, 5, 3, '#d8b37a'); p.ellipse(5, 4, 3, 2, '#f0d090'); p.set(2 + i, 1, '#4fd0ff'); p.set(8 - i, 7, '#4fd0ff'); p.set(5, 4, W); p.set(0, 5 - i % 2, '#c9a66b'); }));
  }
  push('jar', mk(6, 7, (p) => { p.rect(1, 2, 4, 5, '#3a6f4a'); p.rect(0, 3, 6, 3, '#3a6f4a'); p.rect(2, 0, 2, 2, '#8a7a5a'); p.set(2, 3, '#8fff6a'); p.set(3, 4, '#8fff6a'); }));
  push('holybolt', mk(7, 7, (p) => { p.set(3, 0, W); p.set(3, 6, W); p.set(0, 3, W); p.set(6, 3, W); p.rect(2, 2, 3, 3, '#ffe9a0'); p.set(3, 3, W); }));
  push('darkbolt', mk(9, 5, (p) => { p.ellipse(4, 2, 4, 2, '#5a1f8f'); p.ellipse(4, 2, 2, 1, '#b45cff'); p.set(5, 2, W); p.set(0, 0, '#5a1f8f'); p.set(0, 4, '#5a1f8f'); }));
  push('zap', mk(7, 3, (p) => { p.hline(0, 6, 1, '#38e0ff'); p.hline(3, 6, 0, W); p.set(6, 1, W); }));
  push('rail', mk(14, 3, (p) => { p.hline(0, 13, 1, '#38e0ff'); p.hline(4, 13, 0, W); p.hline(4, 13, 2, W); }));
  push('rocket', mk(9, 4, (p) => { p.rect(2, 1, 5, 2, PAL.G); p.set(7, 1, '#ff3d3d'); p.set(7, 2, '#ff3d3d'); p.set(8, 1, '#ff3d3d'); p.set(1, 0, PAL.g); p.set(1, 3, PAL.g); p.set(0, 1, '#ff7a1a'); p.set(0, 2, '#ffe066'); }));
  push('shell', mk(7, 4, (p) => { p.rect(1, 1, 5, 2, '#5b6373'); p.set(6, 1, '#8f98aa'); p.set(6, 2, '#8f98aa'); p.set(0, 1, '#ff7a1a'); }));
  // status icons
  push('ico_burn', mk(5, 6, (p) => { p.set(2, 0, '#ffe066'); p.rect(1, 1, 3, 2, '#ff7a1a'); p.rect(0, 3, 5, 2, '#ff5a1f'); p.hline(1, 3, 5, '#ff3d1a'); p.set(2, 3, '#ffe066'); }));
  push('ico_slow', mk(5, 5, (p) => { p.rect(0, 0, 5, 5, '#8fff6a'); p.rect(1, 1, 3, 3, '#3a6f4a'); p.set(2, 2, '#8fff6a'); }));
  push('ico_shield', mk(5, 6, (p) => { p.rect(0, 0, 5, 4, '#38e0ff'); p.hline(1, 3, 4, '#38e0ff'); p.set(2, 5, '#38e0ff'); p.rect(1, 1, 3, 2, W); }));
  push('ico_heal', mk(5, 5, (p) => { p.rect(2, 0, 1, 5, '#8fff6a'); p.rect(0, 2, 5, 1, '#8fff6a'); p.set(2, 2, W); }));
  push('ico_rage', mk(5, 5, (p) => { p.set(0, 0, '#ff3d3d'); p.set(4, 0, '#ff3d3d'); p.rect(1, 1, 3, 3, '#ff3d3d'); p.set(2, 4, '#ff3d3d'); p.set(1, 2, W); p.set(3, 2, W); }));
  push('ico_rally', mk(5, 6, (p) => { p.vline(0, 0, 5, PAL.b); p.rect(1, 0, 4, 3, PAL.Y); p.set(2, 1, '#ff4d6d'); }));
  push('ico_form', mk(7, 5, (p) => { p.rect(0, 1, 2, 3, W); p.rect(5, 1, 2, 3, W); p.rect(2, 0, 3, 5, PAL.Y); p.set(3, 2, W); }));
  push('ico_stun', mk(5, 5, (p) => { p.set(0, 1, PAL.Y); p.set(1, 0, PAL.Y); p.set(2, 1, PAL.Y); p.set(3, 0, PAL.Y); p.set(4, 1, PAL.Y); p.set(2, 3, PAL.Y); p.set(2, 4, PAL.Y); }));
  // race emblems 16x16
  push('emblem_shield', mk(16, 16, (p) => { p.rect(2, 1, 12, 9, '#5b8def'); p.rect(3, 10, 10, 2, '#5b8def'); p.rect(4, 12, 8, 1, '#5b8def'); p.rect(6, 13, 4, 1, '#5b8def'); p.set(7, 14, '#5b8def'); p.set(8, 14, '#5b8def'); p.rect(2, 1, 12, 1, W); p.rect(7, 3, 2, 8, PAL.Y); p.rect(5, 5, 6, 2, PAL.Y); p.set(4, 9, W); p.set(11, 9, W); }));
  push('emblem_horns', mk(16, 16, (p) => { p.rect(5, 6, 6, 7, '#3a1a2a'); p.rect(4, 8, 8, 4, '#3a1a2a'); p.set(6, 9, '#ff5a1f'); p.set(9, 9, '#ff5a1f'); p.set(6, 12, W); p.set(9, 12, W); p.line(4, 7, 1, 2, '#f4f0e6'); p.line(11, 7, 14, 2, '#f4f0e6'); p.set(1, 1, '#ffb347'); p.set(14, 1, '#ffb347'); p.set(7, 14, '#ff3d1a'); p.set(8, 15, '#ffe066'); }));
  push('emblem_gear', mk(16, 16, (p) => { p.circle(8, 8, 6, '#8c95a8'); for (let a = 0; a < 8; a++) { const x = Math.round(8 + Math.cos(a * Math.PI / 4) * 7), y = Math.round(8 + Math.sin(a * Math.PI / 4) * 7); p.rect(x - 1, y - 1, 2, 2, '#8c95a8'); } p.circle(8, 8, 3, '#2a2f3a'); p.circle(8, 8, 2, '#38e0ff'); p.set(8, 8, W); p.set(5, 4, W); }));
  push('emblem_ankh', mk(16, 16, (p) => { p.circle(8, 4, 3, PAL.Y); p.circle(8, 4, 1, '#0f0f1e'); p.rect(7, 7, 2, 8, PAL.Y); p.rect(3, 8, 10, 2, PAL.Y); p.set(4, 4, W); p.set(8, 12, '#4fd0ff'); p.set(3, 9, '#4fd0ff'); p.set(12, 9, '#4fd0ff'); }));
  return out;
}

