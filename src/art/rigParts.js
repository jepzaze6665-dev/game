// Shared drawing helpers for the unit rig: palette resolution, head gear and
// weapons. Every part is parametric so 48 units share one consistent style.
import { shade } from './PixelBuffer.js';
import { TEAM_COLORS } from '../data/units.js';

export const K = '#1b1026';
export const W = '#ffffff';
export const METAL = '#dfe4ec', METAL_D = '#8f98aa', METAL_DD = '#5a6274';
export const WOOD = '#a06a35', WOOD_D = '#5e3a1c';
export const GOLD = '#ffd43a', GOLD_D = '#b8860b';
export const BONE = '#f4f0e6', BONE_D = '#c9c2b0';
const d2r = Math.PI / 180;
const R = Math.round;

export function teamPal(team) { const c = TEAM_COLORS[team]; return { T: c.main, t: c.dark, L: c.light }; }

// Resolve a palette value that may be a team token.
export function col(c, tp) { return c === 'T' ? tp.T : c === 't' ? tp.t : c === 'L' ? tp.L : c; }
export function resolvePal(pal, tp) {
  const out = {};
  for (const k in pal) out[k] = col(pal[k], tp);
  return out;
}

// ---------- head gear (hy = top row of the head, head spans cx-hw .. cx+hw-1) ----------
export function drawHeadgear(pb, kind, cx, hy, hw, P, tp) {
  const acc = P.accent, ad = shade(acc, -0.35), al = shade(acc, 0.35);
  const L = cx - hw, Rr = cx + hw - 1;             // head left/right columns
  const hair = P.hair || '#2a1f14';
  switch (kind) {
    case 'cap':
      pb.rect(L, hy, hw * 2, 2, WOOD); pb.hline(L, Rr, hy + 1, WOOD_D); pb.set(Rr + 1, hy + 1, WOOD);
      break;
    case 'helm':
      pb.rect(L, hy, hw * 2, 3, METAL); pb.hline(L, Rr, hy + 2, METAL_D); pb.set(cx + 1, hy + 4, METAL_D);
      pb.rect(cx - 1, hy - 2, 2, 2, tp.T); pb.set(cx - 2, hy - 1, tp.T);
      break;
    case 'kettle':
      pb.rect(L, hy, hw * 2, 2, METAL); pb.hline(L - 1, Rr + 1, hy + 2, METAL_D); pb.set(cx, hy - 1, METAL);
      break;
    case 'greathelm':
      pb.rect(L, hy, hw * 2, 6, METAL); pb.hline(L, Rr, hy + 2, METAL_DD); pb.set(cx + 1, hy + 3, K); pb.set(cx + 2, hy + 3, K);
      pb.hline(L, Rr, hy + 5, METAL_D); pb.rect(cx - 1, hy - 2, 2, 2, tp.T); pb.set(cx - 2, hy - 1, tp.T);
      break;
    case 'winged':
      pb.rect(L, hy, hw * 2, 3, METAL); pb.hline(L, Rr, hy + 2, METAL_D);
      pb.set(L - 1, hy, W); pb.set(L - 2, hy - 1, W); pb.set(L - 1, hy - 1, W); pb.set(Rr + 1, hy, W); pb.set(Rr + 2, hy - 1, W); pb.set(Rr + 1, hy - 1, W);
      break;
    case 'crownhelm':
      pb.rect(L, hy, hw * 2, 6, METAL); pb.hline(L, Rr, hy + 2, METAL_DD); pb.set(cx + 1, hy + 3, K); pb.set(cx + 2, hy + 3, K);
      pb.hline(L, Rr, hy - 1, GOLD); pb.set(L, hy - 2, GOLD); pb.set(cx, hy - 2, GOLD); pb.set(Rr, hy - 2, GOLD);
      break;
    case 'crown':
      pb.rect(L, hy, hw * 2, 2, hair);
      pb.hline(L, Rr, hy - 1, GOLD); pb.set(L, hy - 2, GOLD); pb.set(cx, hy - 3, GOLD); pb.set(cx, hy - 2, GOLD); pb.set(Rr, hy - 2, GOLD); pb.set(cx, hy - 1, '#ff4d6d');
      break;
    case 'hood':
      pb.rect(L, hy, hw * 2, 3, P.armor); pb.set(L - 1, hy + 1, P.armor); pb.set(L - 1, hy + 2, shade(P.armor, -0.3)); pb.set(L - 2, hy + 2, shade(P.armor, -0.3));
      pb.set(L, hy + 3, P.armor); pb.set(L, hy + 4, P.armor); pb.set(Rr, hy + 3, shade(P.armor, -0.3)); pb.hline(L + 1, Rr - 1, hy, shade(P.armor, 0.3));
      break;
    case 'mitre':
      pb.rect(cx - 2, hy - 5, 4, 6, '#f4f0ff'); pb.set(cx - 1, hy - 6, '#f4f0ff'); pb.set(cx, hy - 6, '#f4f0ff'); pb.vline(cx, hy - 5, hy - 1, GOLD); pb.hline(L, Rr, hy, GOLD);
      break;
    case 'wizard':
      pb.set(cx + 2, hy - 6, ad); pb.hline(cx + 1, cx + 2, hy - 5, P.cloth); pb.hline(cx, cx + 2, hy - 4, P.cloth);
      pb.hline(cx - 1, cx + 2, hy - 3, P.cloth); pb.hline(cx - 2, cx + 3, hy - 2, P.cloth); pb.hline(cx - 2, cx + 3, hy - 1, shade(P.cloth, 0.3));
      pb.hline(L - 2, Rr + 2, hy, shade(P.cloth, -0.35)); pb.set(cx, hy - 3, GOLD);
      break;
    case 'witch':
      pb.set(cx + 1, hy - 7, K); pb.hline(cx, cx + 1, hy - 6, '#2a1420'); pb.hline(cx - 1, cx + 1, hy - 5, '#2a1420'); pb.hline(cx - 1, cx + 2, hy - 4, '#2a1420');
      pb.hline(cx - 2, cx + 2, hy - 3, '#2a1420'); pb.hline(cx - 2, cx + 3, hy - 2, '#2a1420'); pb.hline(cx - 2, cx + 3, hy - 1, tp.T);
      pb.hline(L - 3, Rr + 3, hy, '#2a1420'); pb.hline(L - 2, Rr + 2, hy + 1, '#3a1f2e');
      pb.vline(L - 1, hy + 2, hy + 6, P.hair || '#ff5a1f'); pb.vline(Rr + 1, hy + 2, hy + 5, P.hair || '#ff5a1f');
      break;
    case 'horns':
      pb.rect(L, hy, hw * 2, 2, hair);
      pb.set(L - 1, hy - 1, BONE); pb.set(L - 1, hy - 2, BONE); pb.set(L - 2, hy - 3, BONE); pb.set(Rr + 1, hy - 1, BONE); pb.set(Rr + 1, hy - 2, BONE); pb.set(Rr + 2, hy - 3, BONE);
      break;
    case 'bighorns':
      pb.rect(L, hy, hw * 2, 2, hair);
      pb.line(L, hy - 1, L - 3, hy - 5, BONE); pb.set(L - 1, hy - 1, BONE); pb.line(Rr, hy - 1, Rr + 3, hy - 5, BONE); pb.set(Rr + 1, hy - 1, BONE);
      pb.set(L - 3, hy - 6, BONE_D); pb.set(Rr + 3, hy - 6, BONE_D);
      break;
    case 'crownhorns':
      pb.rect(L, hy, hw * 2, 2, hair); pb.hline(L, Rr, hy - 1, GOLD); pb.set(cx, hy - 2, '#ff4d6d');
      pb.line(L - 1, hy - 2, L - 4, hy - 7, BONE); pb.line(Rr + 1, hy - 2, Rr + 4, hy - 7, BONE); pb.set(L - 4, hy - 8, BONE_D); pb.set(Rr + 4, hy - 8, BONE_D);
      break;
    case 'hoodhorns':
      pb.rect(L, hy, hw * 2, 3, P.armor); pb.set(L - 1, hy + 1, P.armor); pb.set(L - 1, hy + 2, shade(P.armor, -0.3));
      pb.set(L, hy - 1, BONE); pb.set(L - 1, hy - 2, BONE); pb.set(Rr, hy - 1, BONE); pb.set(Rr + 1, hy - 2, BONE);
      break;
    case 'visor': {
      // boxy robot head with a glowing visor
      pb.rect(L, hy, hw * 2, 6, P.skin); pb.hline(L, Rr, hy, shade(P.skin, 0.3)); pb.hline(L, Rr, hy + 5, shade(P.skin, -0.3));
      pb.hline(L + 1, Rr, hy + 3, P.glow); pb.set(Rr + 1, hy + 3, P.glow);
      pb.set(cx - 1, hy - 1, METAL_D); pb.set(cx - 1, hy - 2, P.glow);
      break;
    }
    case 'mono':
      pb.rect(L, hy + 1, hw * 2, 5, P.skin); pb.hline(L, Rr, hy + 1, shade(P.skin, 0.3));
      pb.rect(cx, hy + 2, 3, 3, K); pb.rect(cx + 1, hy + 3, 1, 1, P.accent); pb.set(cx + 2, hy + 3, P.accent);
      break;
    case 'dome':
      pb.rect(L, hy + 1, hw * 2, 5, P.skin); pb.hline(L + 1, Rr - 1, hy, P.skin); pb.hline(L + 1, Rr - 1, hy + 2, P.glow); pb.set(cx, hy + 1, P.glow);
      break;
    case 'coil':
      pb.rect(L, hy + 1, hw * 2, 5, P.skin); pb.hline(L, Rr, hy + 3, P.glow);
      pb.rect(cx - 1, hy - 4, 2, 5, METAL_D); pb.rect(cx - 2, hy - 5, 4, 2, P.accent); pb.set(cx - 3, hy - 6, P.accent); pb.set(cx + 2, hy - 6, P.accent);
      break;
    case 'bandage':
      pb.rect(L, hy, hw * 2, 6, P.skin); pb.hline(L, Rr, hy + 1, shade(P.skin, -0.25)); pb.hline(L, Rr, hy + 4, shade(P.skin, -0.25));
      pb.set(cx + 2, hy + 3, P.glow); pb.set(L - 1, hy + 2, P.skin); pb.set(L - 2, hy + 3, shade(P.skin, -0.25));
      break;
    case 'skull':
      pb.rect(L, hy, hw * 2, 6, BONE); pb.hline(L, Rr, hy + 5, BONE_D);
      pb.set(cx, hy + 3, K); pb.set(cx + 2, hy + 3, K); pb.set(cx + 1, hy + 4, K); pb.set(cx + 1, hy + 5, BONE_D);
      break;
    case 'wrapmask':
      pb.rect(L, hy, hw * 2, 6, P.cloth); pb.hline(L, Rr, hy + 2, shade(P.cloth, -0.3)); pb.set(cx, hy + 3, P.glow); pb.set(cx + 2, hy + 3, P.glow);
      pb.hline(L - 3, L - 1, hy + 3, P.cloth); pb.set(L - 4, hy + 4, shade(P.cloth, -0.3));
      break;
    case 'jackalmask':
    case 'jackal': {
      // long jackal snout facing right, tall ears
      const dark = kind === 'jackal' ? P.skin : '#2a1f14';
      pb.rect(L, hy, hw * 2, 6, dark); pb.rect(Rr + 1, hy + 2, 3, 3, dark); pb.set(Rr + 3, hy + 3, K);
      pb.rect(L, hy - 3, 2, 3, dark); pb.rect(Rr - 1, hy - 3, 2, 3, dark); pb.set(L, hy - 2, GOLD); pb.set(Rr, hy - 2, GOLD);
      pb.set(cx + 1, hy + 2, GOLD); pb.hline(L, Rr, hy + 5, GOLD);
      break;
    }
    case 'nemes':
    case 'nemesgold': {
      const base = kind === 'nemesgold' ? GOLD : P.cloth, stripe = kind === 'nemesgold' ? '#1f3a6f' : GOLD;
      pb.rect(L - 1, hy - 1, hw * 2 + 2, 3, base); pb.hline(L - 1, Rr + 1, hy, stripe);
      pb.rect(L - 2, hy + 2, 2, 6, base); pb.set(L - 2, hy + 4, stripe); pb.set(L - 2, hy + 6, stripe);
      pb.rect(Rr + 1, hy + 2, 2, 5, base); pb.set(Rr + 1, hy + 4, stripe);
      pb.set(cx, hy - 2, GOLD); pb.set(cx, hy - 3, '#4fd0ff');
      break;
    }
    default: break;
  }
}

// ---------- weapons: drawn from the hand (hx,hy) at `angle` degrees ----------
export function drawWeapon(pb, kind, hx, hy, angle, pose, P, tp) {
  const ca = Math.cos(angle * d2r), sa = Math.sin(angle * d2r);
  const Pt = (len) => [R(hx + ca * len), R(hy + sa * len)];
  const slashArc = (tx, ty, colA, colB) => { for (let i = -3; i <= 3; i++) pb.set(R(tx + 2 - Math.abs(i) * 0.4), R(ty + i * 1.3), i % 2 ? colA : colB); };
  switch (kind) {
    case 'shortsword': { const [bx, by] = Pt(1), [tx, ty] = Pt(4); pb.line(bx, by, tx, ty, METAL); pb.set(tx, ty, W); pb.set(R(hx - sa), R(hy + ca), WOOD_D); if (pose.slash) slashArc(tx, ty, tp.L, W); break; }
    case 'sword': { const [bx, by] = Pt(1), [tx, ty] = Pt(6); pb.line(bx, by, tx, ty, METAL); pb.set(tx, ty, W); pb.set(R(hx - sa), R(hy + ca), GOLD); pb.set(R(hx + sa), R(hy - ca), GOLD); if (pose.slash) slashArc(tx, ty, tp.L, W); break; }
    case 'greatsword': { const [bx, by] = Pt(1), [tx, ty] = Pt(9); pb.line(bx, by, tx, ty, METAL, 2); pb.line(R(hx + ca * 3), R(hy + sa * 3), tx, ty, W); pb.set(R(hx - sa * 2), R(hy + ca * 2), GOLD); pb.set(R(hx + sa * 2), R(hy - ca * 2), GOLD); if (pose.slash) { slashArc(tx, ty, tp.L, W); slashArc(tx + 1, ty, GOLD, W); } break; }
    case 'flamesword': { const [bx, by] = Pt(1), [tx, ty] = Pt(9); pb.line(bx, by, tx, ty, '#2a1420', 2); pb.line(R(hx + ca * 2), R(hy + sa * 2), tx, ty, '#ff7a1a'); pb.set(tx, ty, '#ffe066'); pb.set(R(hx - sa * 2), R(hy + ca * 2), GOLD); if (pose.slash) { slashArc(tx, ty, '#ff7a1a', '#ffe066'); } break; }
    case 'jagged': { const [bx, by] = Pt(1), [tx, ty] = Pt(6); pb.line(bx, by, tx, ty, '#8f98aa'); pb.set(tx, ty, W); pb.set(R(hx + ca * 3 - sa), R(hy + sa * 3 + ca), '#8f98aa'); pb.set(R(hx + ca * 5 - sa), R(hy + sa * 5 + ca), '#8f98aa'); if (pose.slash) slashArc(tx, ty, '#ff7a1a', W); break; }
    case 'halberd': { const [bx, by] = Pt(-4), [tx, ty] = Pt(9); pb.line(bx, by, tx, ty, WOOD); const [gx, gy] = Pt(7); pb.line(gx, gy, tx, ty, METAL); pb.set(tx, ty, W); pb.set(R(gx - sa), R(gy + ca), METAL); pb.set(R(gx - sa * 2), R(gy + ca * 2), METAL_D); const [rx, ry] = Pt(5); pb.set(rx, ry, tp.T); if (pose.slash) { pb.set(tx + 2, ty, W); pb.set(tx + 3, ty - 1, tp.L); pb.set(tx + 3, ty + 1, tp.L); } break; }
    case 'lavaspear': { const [bx, by] = Pt(-3), [tx, ty] = Pt(9); pb.line(bx, by, tx, ty, '#3a1f2e'); const [gx, gy] = Pt(7); pb.line(gx, gy, tx, ty, '#ff7a1a'); pb.set(tx, ty, '#ffe066'); pb.set(R(gx - sa), R(gy + ca), '#ff5a1f'); if (pose.slash) { pb.set(tx + 2, ty, '#ffe066'); pb.set(tx + 3, ty - 1, '#ff7a1a'); pb.set(tx + 3, ty + 1, '#ff7a1a'); } break; }
    case 'chainhook': { const [tx, ty] = Pt(pose.slash ? 9 : 5); for (let i = 1; i < (pose.slash ? 9 : 5); i += 2) { const [cx2, cy2] = Pt(i); pb.set(cx2, cy2, METAL_D); } pb.set(tx, ty, METAL); pb.set(R(tx - sa), R(ty + ca), METAL); pb.set(R(tx - sa) + 1, R(ty + ca) - 1, W); break; }
    case 'daggers':
    case 'khopeshes': { const [tx, ty] = Pt(4); pb.line(hx, hy, tx, ty, kind === 'khopeshes' ? GOLD : METAL); pb.set(tx, ty, W); if (kind === 'khopeshes') pb.set(R(tx - sa), R(ty + ca), GOLD); if (pose.slash) { pb.set(tx + 2, ty - 1, tp.L); pb.set(tx + 2, ty + 1, tp.L); pb.set(tx + 3, ty, W); } break; }
    case 'khopesh': { const [bx, by] = Pt(1), [tx, ty] = Pt(6); pb.line(bx, by, tx, ty, GOLD); pb.set(R(tx - sa), R(ty + ca), GOLD); pb.set(R(tx - sa * 2), R(ty + ca * 2), W); pb.set(hx, hy, WOOD_D); if (pose.slash) slashArc(tx, ty, GOLD, W); break; }
    case 'axes': { const [bx, by] = Pt(1), [tx, ty] = Pt(5); pb.line(bx, by, tx, ty, WOOD); pb.rect(R(tx - sa), R(ty + ca) - 1, 2, 3, METAL); pb.set(R(tx - sa) + 1, R(ty + ca), W); if (pose.slash) slashArc(tx + 1, ty, '#ff7a1a', W); break; }
    case 'hammer': { const [bx, by] = Pt(1), [tx, ty] = Pt(6); pb.line(bx, by, tx, ty, WOOD); pb.rect(R(tx) - 1, R(ty) - 2, 3, 4, METAL); pb.hline(R(tx) - 1, R(tx) + 1, R(ty) - 2, W); pb.set(R(tx), R(ty), GOLD); if (pose.slash) { pb.set(tx + 3, ty, GOLD); pb.set(tx + 3, ty - 2, W); pb.set(tx + 3, ty + 2, W); pb.set(tx + 4, ty - 1, GOLD); pb.set(tx + 4, ty + 1, GOLD); } break; }
    case 'mace': { const [bx, by] = Pt(1), [tx, ty] = Pt(6); pb.line(bx, by, tx, ty, WOOD); pb.circle(tx, ty, 1, METAL_D); pb.set(tx, ty, METAL); pb.set(tx + 2, ty, METAL); pb.set(tx - 2, ty, METAL); pb.set(tx, ty - 2, METAL); pb.set(tx, ty + 2, METAL); if (pose.slash) slashArc(tx, ty, tp.L, W); break; }
    case 'spikedclub': { const [bx, by] = Pt(0), [tx, ty] = Pt(10); pb.line(bx, by, tx, ty, '#3a1f2e', 2); pb.circle(tx, ty, 2, '#5a2a3a'); pb.set(tx - 3, ty, METAL); pb.set(tx + 3, ty, METAL); pb.set(tx, ty - 3, METAL); pb.set(tx, ty + 3, METAL); pb.set(tx, ty, '#ff7a1a'); if (pose.slam) { for (let i = 0; i < 4; i++) { pb.set(tx - 3 + i * 2, ty + 3, W); pb.set(tx - 4 + i * 3, ty + 4, '#ff7a1a'); } } break; }
    case 'club': { const [bx, by] = Pt(0), [tx, ty] = Pt(9); pb.line(bx, by, tx, ty, WOOD, 2); pb.circle(tx, ty, 2, WOOD_D); pb.set(tx, ty, WOOD); if (pose.slam) { for (let i = 0; i < 4; i++) { pb.set(tx - 3 + i * 2, ty + 3, W); } } break; }
    case 'trident': { const [bx, by] = Pt(-4), [tx, ty] = Pt(11); pb.line(bx, by, tx, ty, '#1a0a12'); pb.line(R(hx + ca * 8), R(hy + sa * 8), tx, ty, GOLD); pb.set(R(tx - sa * 2), R(ty + ca * 2), GOLD); pb.set(R(tx + sa * 2), R(ty - ca * 2), GOLD); pb.set(R(tx - sa * 2 + ca), R(ty + ca * 2 + sa), '#ffe066'); pb.set(R(tx + sa * 2 + ca), R(ty - ca * 2 + sa), '#ffe066'); pb.set(tx + R(ca), ty + R(sa), '#ffe066'); if (pose.slam) { pb.set(tx + 3, ty, '#ffe066'); pb.set(tx + 4, ty - 2, '#ff7a1a'); pb.set(tx + 4, ty + 2, '#ff7a1a'); } break; }
    case 'wasscepter': { const [bx, by] = Pt(-3), [tx, ty] = Pt(8); pb.line(bx, by, tx, ty, '#1f3a6f'); pb.rect(R(tx) - 1, R(ty) - 1, 3, 2, GOLD); pb.set(R(tx) + 1, R(ty) - 2, GOLD); pb.set(R(bx), R(by), GOLD); if (pose.slash) slashArc(tx, ty, '#4fd0ff', W); break; }
    case 'crook': { const [bx, by] = Pt(-4), [tx, ty] = Pt(7); pb.line(bx, by, tx, ty, GOLD); pb.set(R(tx - sa), R(ty + ca), GOLD); pb.set(R(tx - sa * 2), R(ty + ca * 2 - ca), GOLD); for (let i = -3; i < 7; i += 2) { const [sx, sy] = Pt(i); pb.set(sx, sy, '#1f3a6f'); } if (pose.cast) { pb.set(tx + 2, ty - 2, '#4fd0ff'); pb.set(tx + 3, ty, '#4fd0ff'); pb.set(tx + 2, ty + 2, '#4fd0ff'); } break; }
    case 'bow': {
      const bx = hx + 1;
      const arc = [[bx - 1, hy - 5], [bx, hy - 4], [bx + 1, hy - 3], [bx + 2, hy - 2], [bx + 2, hy - 1], [bx + 2, hy], [bx + 2, hy + 1], [bx + 2, hy + 2], [bx + 1, hy + 3], [bx, hy + 4], [bx - 1, hy + 5]];
      const bowCol = P.skeleton ? BONE : WOOD;
      for (const [x, y] of arc) pb.set(x, y, bowCol);
      pb.set(bx + 2, hy, shade(bowCol, -0.3));
      const pull = pose.draw ? 3 : 0;
      pb.line(bx - 1, hy - 5, bx - 1 - pull, hy, METAL); pb.line(bx - 1 - pull, hy, bx - 1, hy + 5, METAL);
      if (pose.draw) { pb.hline(bx - 1 - pull, bx + 3, hy, WOOD); pb.set(bx + 3, hy, P.accent === '#ff5a1f' ? '#ff7a1a' : W); pb.set(bx - 1 - pull, hy - 1, P.trim); }
      break;
    }
    case 'crossbow': {
      // held horizontally, stock under the arm
      pb.hline(hx - 3, hx + 5, hy, WOOD); pb.hline(hx - 2, hx + 2, hy + 1, WOOD_D);
      pb.vline(hx + 3, hy - 3, hy + 3, METAL); pb.set(hx + 2, hy - 3, METAL_D); pb.set(hx + 2, hy + 3, METAL_D);
      pb.line(hx + 3, hy - 3, hx - (pose.draw ? 1 : 0), hy, METAL_D); pb.line(hx + 3, hy + 3, hx - (pose.draw ? 1 : 0), hy, METAL_D);
      if (pose.draw) { pb.set(hx + 5, hy, W); }
      break;
    }
    case 'staff': {
      const [bx, by] = Pt(-5), [tx, ty] = Pt(7);
      pb.line(bx, by, tx, ty, WOOD_D); pb.line(R(hx + ca * 2), R(hy + sa * 2), tx, ty, WOOD);
      const gem = P.staffGem || P.accent;
      const glow = pose.cast ? 2 : 1;
      pb.circle(tx, ty, glow, gem); pb.set(tx, ty, W);
      if (pose.cast) { pb.set(tx + 3, ty, W); pb.set(tx - 3, ty, W); pb.set(tx, ty - 3, W); pb.set(tx, ty + 3, W); }
      break;
    }
    case 'claws': { const [tx, ty] = Pt(3); pb.line(hx, hy, tx, ty, BONE); pb.set(R(tx - sa), R(ty + ca), BONE); if (pose.slash) { pb.set(tx + 2, ty - 1, '#ff7a1a'); pb.set(tx + 2, ty + 1, '#ff7a1a'); pb.set(tx + 3, ty, W); } break; }
    case 'buzzblade': { const [bx, by] = Pt(1), [tx, ty] = Pt(5); pb.line(bx, by, tx, ty, METAL_D, 2); pb.circle(tx, ty, 2, METAL); pb.set(tx, ty, K); if (pose.slash) { for (let a = 0; a < 6; a++) pb.set(R(tx + Math.cos(a) * 3), R(ty + Math.sin(a) * 3), P.glow); } break; }
    case 'laser': { pb.hline(hx - 2, hx + 5, hy, METAL_D); pb.hline(hx - 1, hx + 4, hy - 1, METAL); pb.set(hx + 5, hy, P.accent); pb.set(hx + 6, hy, pose.cast ? W : P.accent); if (pose.cast) { pb.hline(hx + 7, hx + 12, hy, P.accent); pb.hline(hx + 8, hx + 12, hy - 1, W); } break; }
    case 'pods': { pb.rect(hx - 6, hy - 8, 5, 4, METAL_D); pb.hline(hx - 5, hx - 2, hy - 7, K); pb.hline(hx - 5, hx - 2, hy - 5, K); pb.set(hx - 2, hy - 7, P.accent); pb.set(hx - 2, hy - 5, P.accent); pb.hline(hx, hx + 4, hy, METAL); pb.set(hx + 5, hy, K); if (pose.cast) { pb.set(hx - 1, hy - 9, '#ff7a1a'); pb.set(hx - 3, hy - 9, '#ffe066'); } break; }
    case 'rail': { pb.hline(hx - 3, hx + 9, hy, METAL_D); pb.hline(hx - 2, hx + 8, hy - 1, METAL); pb.rect(hx - 1, hy - 3, 4, 2, K); pb.set(hx, hy - 3, P.accent); pb.set(hx + 9, hy, P.accent); if (pose.cast) { pb.hline(hx + 10, hx + 14, hy, W); pb.set(hx + 12, hy - 1, P.accent); pb.set(hx + 12, hy + 1, P.accent); } break; }
    case 'flamer': { pb.hline(hx - 2, hx + 6, hy, METAL_D, 1); pb.rect(hx - 2, hy - 1, 3, 3, METAL); pb.set(hx + 6, hy, '#ff7a1a'); pb.rect(hx - 5, hy - 5, 3, 5, METAL_D); pb.set(hx - 4, hy - 4, '#ff7a1a'); if (pose.cast) { for (let i = 0; i < 6; i++) { pb.set(hx + 7 + i, hy - 1 + (i % 3) - 1, i % 2 ? '#ffe066' : '#ff7a1a'); pb.set(hx + 7 + i, hy + 1 - (i % 2), '#ff5a1f'); } } break; }
    case 'tesla': { pb.rect(hx, hy - 2, 3, 5, METAL_D); pb.set(hx + 1, hy, P.accent); pb.set(hx + 3, hy - 3, P.accent); pb.set(hx + 3, hy + 3, P.accent); if (pose.cast) { pb.line(hx + 3, hy, hx + 8, hy - 2, W); pb.line(hx + 8, hy - 2, hx + 11, hy + 1, P.accent); } break; }
    case 'fist': { pb.rect(R(hx) - 1, R(hy) - 2, 4, 4, P.armor); pb.hline(R(hx) - 1, R(hx) + 2, R(hy) - 2, shade(P.armor, 0.3)); pb.set(R(hx) + 2, R(hy), P.glow); if (pose.slam) { pb.set(hx + 4, hy, W); pb.set(hx + 5, hy - 2, P.glow); pb.set(hx + 5, hy + 2, P.glow); } break; }
    case 'cannonarm': { pb.rect(R(hx) - 2, R(hy) - 2, 9, 4, P.armor); pb.hline(R(hx) - 2, R(hx) + 6, R(hy) - 2, shade(P.armor, 0.3)); pb.rect(R(hx) + 7, R(hy) - 1, 2, 2, K); pb.set(R(hx) + 7, R(hy), P.glow); pb.set(R(hx) + 2, R(hy), P.glow); if (pose.cast) { pb.hline(hx + 9, hx + 16, hy, P.glow); pb.hline(hx + 10, hx + 16, hy - 1, W); pb.hline(hx + 10, hx + 15, hy + 1, W); } break; }
    case 'lance': { const [bx, by] = Pt(-2), [tx, ty] = Pt(13); pb.line(bx, by, tx, ty, '#e6c993'); const [gx, gy] = Pt(11); pb.line(gx, gy, tx, ty, METAL); pb.set(tx, ty, W); const [fx, fy] = Pt(8); pb.set(fx, fy - 1, tp.T); pb.set(fx, fy - 2, tp.T); pb.set(fx - 1, fy - 1, tp.L); if (pose.slash) { pb.set(tx + 2, ty, W); pb.set(tx + 3, ty - 1, tp.L); pb.set(tx + 3, ty + 1, tp.L); } break; }
    case 'none': default: break;
  }
}

// Shields drawn on the back (left) side of the body.
export function drawShield(pb, kind, x, y, P, tp) {
  switch (kind) {
    case 'wood': pb.ellipse(x, y + 2, 1, 2, WOOD); pb.rect(x - 1, y, 2, 5, WOOD); pb.set(x - 1, y + 2, METAL_D); break;
    case 'kite': pb.rect(x - 1, y, 2, 5, tp.T); pb.set(x - 1, y + 5, tp.T); pb.set(x, y, tp.L); pb.set(x - 1, y + 2, GOLD); break;
    case 'tower': pb.rect(x - 2, y - 2, 3, 9, METAL); pb.vline(x - 2, y - 2, y + 6, METAL_D); pb.rect(x - 1, y + 1, 1, 3, tp.T); pb.set(x - 1, y + 2, GOLD); break;
    case 'round': pb.ellipse(x, y + 2, 1, 2, GOLD); pb.rect(x - 1, y, 2, 5, GOLD); pb.set(x - 1, y + 2, '#4fd0ff'); pb.set(x, y, W); break;
    case 'energy': pb.rect(x - 2, y - 2, 2, 9, P.glow); pb.set(x - 1, y - 3, P.glow); pb.set(x - 1, y + 7, P.glow); pb.vline(x - 3, y - 1, y + 5, P.glow); break;
    default: break;
  }
}
