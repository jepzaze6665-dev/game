// ProjectileSystem: every ranged attack type is described by a small table.
// Projectiles fly to a predicted impact point and resolve on arrival; instant
// kinds (beams, lightning) resolve immediately and only emit a visual event.
import { applyDamage, splashDamage, lineDamage, chainDamage } from './Combat.js';

export const PROJECTILES = {
  arrow:     { speed: 16, arc: 1.4, hitRadius: 0.55, sprite: 'arrow' },
  bonearrow: { speed: 16, arc: 1.4, hitRadius: 0.55, sprite: 'bonearrow' },
  firearrow: { speed: 16, arc: 1.2, hitRadius: 0.55, sprite: 'firearrow', trail: 'fire' },
  bolt:      { speed: 22, arc: 0.3, hitRadius: 0.5, sprite: 'bolt' },
  fireball:  { speed: 9, arc: 0.8, hitRadius: 0.4, sprite: 'fireball', anim: 3, trail: 'fire', explode: 'fire' },
  hellfire:  { speed: 8, arc: 1.6, hitRadius: 0.4, sprite: 'hellfire', anim: 3, trail: 'fire', explode: 'fire' },
  sandstorm: { speed: 8, arc: 1.2, hitRadius: 0.4, sprite: 'sandball', anim: 3, trail: 'sand', explode: 'sand' },
  plague:    { speed: 9, arc: 1.6, hitRadius: 0.4, sprite: 'jar', explode: 'plague' },
  holy:      { speed: 14, arc: 0.4, hitRadius: 0.45, sprite: 'holybolt', trail: 'holy' },
  darkbolt:  { speed: 12, arc: 0.2, hitRadius: 0.45, sprite: 'darkbolt', trail: 'dark' },
  zap:       { speed: 20, arc: 0.0, hitRadius: 0.45, sprite: 'zap' },
  rail:      { speed: 40, arc: 0.0, hitRadius: 0.5, sprite: 'rail', trail: 'rail' },
  rocket:    { speed: 11, arc: 0.9, hitRadius: 0.4, sprite: 'rocket', trail: 'smoke', explode: 'boom' },
  shell:     { speed: 12, arc: 2.2, hitRadius: 0.4, sprite: 'shell', trail: 'smoke', explode: 'boom' },
  beam:      { instant: true },
  lightning: { instant: true },
};

function launch(battle, shooter, target, kindName, k) {
  const dx0 = target.x - shooter.x, dy0 = target.y - shooter.y;
  const t = Math.hypot(dx0, dy0) / k.speed;
  const tx = target.x + (target.vx || 0) * t * 0.8, ty = target.y + (target.vy || 0) * t * 0.8;
  const dx = tx - shooter.x, dy = ty - shooter.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const h = shooter.type.look && shooter.type.look.body === 'vehicle' ? 0.7 : 0.9;
  battle.projectiles.push({
    kind: kindName, k, team: shooter.team, shooter, target,
    x: shooter.x, y: shooter.y + h, sx: shooter.x, sy: shooter.y + h, tx, ty,
    t: 0, life: dist / k.speed, arc: k.arc, hitRadius: k.hitRadius, dir: Math.sign(dx) || shooter.dir, z: 0,
    angle: Math.atan2(dy, dx),
  });
}

export function fireProjectile(battle, shooter, target) {
  const def = shooter.type;
  const kindName = def.projectile;
  const k = PROJECTILES[kindName];
  if (!k) return;
  if (k.instant) {
    if (def.chain) {
      const points = chainDamage(battle, shooter, target, def.chain.jumps, def.chain.falloff);
      battle.events.push({ type: 'chain', points: [[shooter.x, shooter.y + 1.2], ...points], team: shooter.team });
    } else {
      const len = def.pierceLine || 4;
      const dir = Math.sign(target.x - shooter.x) || shooter.dir;
      lineDamage(battle, shooter, shooter.x, target.y, dir, Math.max(len, Math.abs(target.x - shooter.x) + 0.5), 0.9, 1, {});
      battle.events.push({ type: 'beam', x0: shooter.x + dir * 0.6, y0: shooter.y + 0.9, x1: shooter.x + dir * Math.max(len, Math.abs(target.x - shooter.x) + 0.5), y1: target.y + 0.6, team: shooter.team, color: def.look && def.look.pal ? def.look.pal.accent : null });
    }
    return;
  }
  if (def.multishot) {
    // pick up to N distinct targets near the primary one
    const targets = [target];
    battle.grid.each(target.x, target.y, 3, (u) => {
      if (targets.length >= def.multishot || u.team === shooter.team || u.state === 'dead' || u.state === 'downed' || targets.includes(u)) return;
      targets.push(u);
    });
    while (targets.length < def.multishot) targets.push(target);
    targets.forEach((tg, i) => launch(battle, shooter, tg, kindName, { ...k, speed: k.speed * (1 - i * 0.08) }));
  } else launch(battle, shooter, target, kindName, k);
  battle.events.push({ type: 'shoot', kind: kindName, x: shooter.x, y: shooter.y, team: shooter.team, dir: shooter.dir });
}

export function updateProjectiles(battle, dt) {
  const list = battle.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.t += dt;
    const f = Math.min(1, p.t / p.life);
    p.x = p.sx + (p.tx - p.sx) * f; p.y = p.sy + (p.ty - p.sy) * f;
    p.z = Math.sin(f * Math.PI) * p.arc;
    if (f >= 1) { list.splice(i, 1); resolve(battle, p); }
  }
}

function resolve(battle, p) {
  const shooter = p.shooter;
  const def = shooter.type;
  if (def.splash && p.k.explode) {
    const n = splashDamage(battle, shooter, p.tx, p.ty, def.splash, 1, { stun: 0.1 });
    battle.events.push({ type: 'explode', x: p.tx, y: p.ty, team: p.team, radius: def.splash, hits: n, style: p.k.explode });
    return;
  }
  // direct hit: intended target if still there, otherwise anything at the landing spot
  let victim = null;
  if (p.target && p.target.state !== 'dead' && p.target.state !== 'downed' && Math.hypot(p.target.x - p.tx, p.target.y - p.ty) <= p.hitRadius + p.target.type.radius) victim = p.target;
  if (!victim) {
    let best = 1e9;
    battle.grid.each(p.tx, p.ty, 1, (u) => {
      if (u.team === p.team || u.state === 'dead' || u.state === 'downed') return;
      const d = Math.hypot(u.x - p.tx, u.y - p.ty) - u.type.radius;
      if (d < p.hitRadius && d < best) { best = d; victim = u; }
    });
  }
  if (victim) {
    applyDamage(battle, shooter, victim, 1, { stun: 0.04 });
    if (def.splash) splashDamage(battle, shooter, victim.x, victim.y, def.splash, 0.5, { noStatus: true });
  } else battle.events.push({ type: 'miss', x: p.tx, y: p.ty, kind: p.kind, dir: p.dir });
}
