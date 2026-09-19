// Per-unit behaviour: targeting, marching, engaging, attacking, statuses and
// passive/aura bookkeeping. Data driven: every decision reads the unit def.
import { BASE_STATS, LANE } from '../data/units.js';
import { applyDamage, splashDamage, lineDamage, healUnit, killUnit, rageSpeedMultiplier, counterMultiplier } from './Combat.js';
import { fireProjectile } from './Projectiles.js';

const ACQUIRE_PAD = 2.2;

function edgeDist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y) - a.type.radius - b.type.radius; }
function alive(u) { return u.state !== 'dead' && u.state !== 'downed'; }
function prefers(def, o) { return def.prefers && def.prefers.some((t) => o.type.counterTags.includes(t)); }

export function acquireTarget(battle, u) {
  const def = u.type;
  const melee = !def.projectile;
  const reach = Math.max(def.attackRange, 1.2) + ACQUIRE_PAD + (def.slip ? 7 : 0);
  let best = null, bestScore = 1e9;
  battle.grid.each(u.x, u.y, reach, (o) => {
    if (o.team === u.team || !alive(o)) return;
    const dx = o.x - u.x;
    if (dx * u.dir < -1.5) return;                       // don't chase things behind us
    const d = edgeDist(u, o);
    if (d > reach) return;
    let score = d;
    if (def.slip) score += prefers(def, o) ? -6 : 1.5;   // hunters dive for the backline
    if (melee && o.engaged >= 4) score += 2.5;           // spread attackers over the enemy front
    if (!melee && def.strongAgainst.some((t) => o.type.counterTags.includes(t))) score -= 1.2; // ranged units focus what they counter
    if (score < bestScore) { bestScore = score; best = o; }
  });
  u.target = best;
  u.retargetT = 0.12 + Math.random() * 0.1;
}

function baseInReach(battle, u) {
  const base = battle.bases[1 - u.team];
  if (base.hp <= 0) return false;
  const edge = base.x - u.dir * (BASE_STATS.hitRange + u.type.radius + u.reach);
  return u.dir > 0 ? u.x >= edge : u.x <= edge;
}

// Starts a swing. `u.swing` tells the renderer which animation fits: a charge
// hit, a counter ("heavy") hit, or alternating main/alt swings. Pure cosmetics.
function beginAttack(u) {
  u.state = 'attack'; u.phase = 'windup'; u.phaseT = 0; u.anim = 'atk'; u.animT = 0;
  u.swings = (u.swings || 0) + 1;
  const def = u.type, tgt = u.target;
  if (def.chargeBonus && u.chargeDist > 3.5) u.swing = 'charge';
  else if (tgt && !u.attackingBase && counterMultiplier(def, tgt) > 1.01) u.swing = 'heavy';
  else u.swing = u.swings % 2 ? 'main' : 'alt';
}

function resolveHit(battle, u) {
  const def = u.type;
  const tgt = u.target;
  if (u.attackingBase) {
    const base = battle.bases[1 - u.team];
    if (def.projectile && def.projectile !== 'beam' && def.projectile !== 'lightning') {
      // ranged units shoot the walls
      applyDamage(battle, u, base, 1);
      battle.events.push({ type: 'shoot', kind: def.projectile, x: u.x, y: u.y, team: u.team, dir: u.dir, atBase: true });
      battle.events.push({ type: 'melee', x: base.x - u.dir * 1.2, y: u.y + 0.5 + Math.random(), kind: def.id, team: u.team, base: true });
      return;
    }
    applyDamage(battle, u, base, 1);
    battle.events.push({ type: 'melee', x: base.x - u.dir * 1.2, y: u.y + 0.5, kind: def.id, team: u.team, base: true });
    return;
  }
  if (!tgt || !alive(tgt)) return;
  if (def.projectile) { fireProjectile(battle, u, tgt); return; }
  if (def.splash) {
    const hx = u.x + u.dir * (def.radius + 0.4), hy = u.y;
    splashDamage(battle, u, hx, hy, def.splash, 1, { knockback: def.knockback || 0, stun: 0.12, stunFor: def.stun || 0 });
    battle.events.push({ type: def.cone ? 'flame' : 'slam', x: hx, y: hy, team: u.team, radius: def.splash, dir: u.dir, big: def.mass >= 5 });
    return;
  }
  let mult = 1, charge = false;
  if (def.chargeBonus && u.chargeDist > 3.5) { mult = def.chargeBonus; charge = true; }
  u.chargeDist = 0;
  applyDamage(battle, u, tgt, mult, { charge, knockback: charge ? 1.2 : 0, stunFor: def.stun || 0 });
  battle.events.push({ type: 'melee', x: tgt.x, y: tgt.y, kind: def.id, team: u.team, dir: u.dir });
}

// Periodic signature abilities (nova, orbital beam, raise dead).
function updateAbilities(battle, u, dt) {
  const def = u.type;
  if (!def.nova && !def.beam && !def.raise) return;
  u.abilityT = (u.abilityT == null ? 3 : u.abilityT) - dt;
  if (u.abilityT > 0) return;
  if (def.nova) {
    let enemies = 0;
    battle.grid.each(u.x, u.y, def.nova.radius, (o) => { if (o.team !== u.team && alive(o)) enemies++; });
    if (!enemies) { u.abilityT = 0.5; return; }
    u.abilityT = def.nova.every;
    const saved = def.damage; // reuse applyDamage with the nova's own damage
    u.type = { ...def, damage: def.nova.damage, burn: def.nova.burn, splash: 0 };
    splashDamage(battle, u, u.x, u.y, def.nova.radius, 1, { knockback: 1.0, stun: 0.2 });
    u.type = def;
    battle.events.push({ type: 'nova', x: u.x, y: u.y, radius: def.nova.radius, team: u.team });
    u.anim = 'atk'; u.animT = 0; u.state = 'attack'; u.phase = 'recover'; u.phaseT = 0;
    void saved;
  } else if (def.beam) {
    let enemies = 0;
    battle.grid.each(u.x + u.dir * def.beam.length / 2, u.y, def.beam.length / 2, (o) => { if (o.team !== u.team && alive(o)) enemies++; });
    if (!enemies) { u.abilityT = 0.5; return; }
    u.abilityT = def.beam.every;
    u.type = { ...def, damage: def.beam.damage, splash: 0, burn: { dps: 6, dur: 2 } };
    lineDamage(battle, u, u.x, u.y, u.dir, def.beam.length, def.beam.width, 1, { stun: 0.2 });
    u.type = def;
    battle.events.push({ type: 'orbital', x0: u.x + u.dir * 0.5, y: u.y, x1: u.x + u.dir * def.beam.length, team: u.team, width: def.beam.width });
    u.anim = 'atk'; u.animT = 0; u.state = 'attack'; u.phase = 'recover'; u.phaseT = 0;
  } else if (def.raise) {
    u.abilityT = def.raise.every;
    let n = 0;
    for (let i = 0; i < def.raise.count && !battle.armyFull(u.team); i++) { battle.spawnUnitAt(u.team, def.raise.unit, u.x - u.dir * (0.8 + i * 0.6), u.y + (i - 1) * 0.9, true); n++; }
    battle.grid.each(u.x, u.y, def.raise.radius, (o) => { if (o.team === u.team && alive(o) && o.type.counterTags.includes('UNDEAD')) healUnit(o, o.maxHp * def.raise.heal); });
    battle.events.push({ type: 'raise', x: u.x, y: u.y, radius: def.raise.radius, team: u.team, count: n });
  }
}

function tickStatuses(battle, u, dt) {
  const def = u.type;
  u.flash = Math.max(0, u.flash - dt * 6);
  u.hitStun = Math.max(0, u.hitStun - dt);
  u.stunT = Math.max(0, (u.stunT || 0) - dt);
  if (u.shieldT > 0) u.shieldT -= dt;
  if (u.rallyT > 0) u.rallyT -= dt;
  if (u.burn) {
    u.burn.t -= dt;
    u.burnTick = (u.burnTick || 0) + dt;
    if (u.burnTick >= 0.5) {
      u.burnTick -= 0.5;
      const d = Math.max(1, Math.round(u.burn.dps * 0.5));
      u.hp -= d;
      battle.events.push({ type: 'burnTick', x: u.x, y: u.y, team: u.team });
      if (u.hp <= 0) { u.hp = 0; killUnit(battle, u, u.burn.src && alive(u.burn.src) ? u.burn.src : null); return; }
    }
    if (u.burn.t <= 0) u.burn = null;
  }
  if (u.slow) { u.slow.t -= dt; if (u.slow.t <= 0) u.slow = null; }
  // regeneration / self heal
  const regen = (def.regen || 0) + (def.selfHeal || 0);
  if (regen > 0 && u.hp < u.maxHp) healUnit(u, regen * dt);
}

export function updateUnit(battle, u, dt) {
  const def = u.type;
  if (u.state === 'dead') { u.deadT += dt; return; }
  if (u.state === 'downed') {
    u.downT -= dt;
    if (u.downT <= 0) { u.state = 'march'; u.hp = Math.round(u.maxHp * 0.4); u.flash = 1; battle.events.push({ type: 'revive', x: u.x, y: u.y, team: u.team }); }
    return;
  }
  if (battle.result) return endgameBehaviour(battle, u, dt);
  tickStatuses(battle, u, dt);
  if (u.state === 'dead') return;
  u.cd = Math.max(0, u.cd - dt);
  u.retargetT -= dt;
  if (u.spawnT > 0) { u.spawnT -= dt; u.anim = 'walk'; u.animT += dt; }
  if (u.stunT > 0) { u.vx = 0; u.vy = 0; u.anim = 'idle'; if (u.state === 'attack') { u.state = 'engage'; } return; }
  updateAbilities(battle, u, dt);

  // attack cycle (locked until it finishes)
  if (u.state === 'attack') {
    u.phaseT += dt; u.animT += dt;
    u.vx = 0; u.vy = 0;
    if (u.phase === 'windup' && u.phaseT >= def.windup) {
      u.phase = 'recover'; u.phaseT = 0;
      resolveHit(battle, u);
      const cycle = 1 / (def.attackSpeed * rageSpeedMultiplier(u));
      u.cd = Math.max(0, cycle - def.windup - def.recover);
    } else if (u.phase === 'recover' && u.phaseT >= def.recover) {
      u.state = 'engage'; u.anim = 'idle'; u.animT = 0;
    }
    return;
  }

  if (u.retargetT <= 0) acquireTarget(battle, u);
  const tgt = u.target;
  u.attackingBase = false;
  const slowMul = (u.slow ? 1 - u.slow.pct : 1) * (u.hitStun > 0 ? 0.3 : 1);

  // reached the enemy base?
  if ((!tgt || edgeDist(u, tgt) > def.attackRange + 0.5) && baseInReach(battle, u)) {
    u.attackingBase = true;
    u.vx = 0; u.vy = 0; u.anim = 'idle';
    if (u.cd <= 0) beginAttack(u);
    return;
  }

  if (tgt && alive(tgt)) {
    const d = edgeDist(u, tgt);
    if (d <= def.attackRange) {
      u.state = 'engage';
      u.vx = 0; u.vy = 0; u.anim = 'idle';
      if (!def.projectile) tgt.engaged = (tgt.engaged || 0) + 1;
      if (!def.chargeBonus) u.chargeDist = 0;
      if (u.cd <= 0 && u.hitStun <= 0) beginAttack(u);
      return;
    }
    let dx = tgt.x - u.x, dy = tgt.y - u.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const spd = def.movementSpeed * u.speedMul * slowMul;
    u.vx = dx * spd; u.vy = dy * spd;
    if (def.projectile && d < def.attackRange * 0.5 && !def.slip) { u.vx *= -0.35; u.vy *= 0.3; } // ranged kite a little
    u.state = 'engage';
    u.anim = 'walk'; u.animT += dt;
    if (def.chargeBonus) u.chargeDist += spd * dt;
    return;
  }

  // march toward the enemy base, drifting back to our own lane row
  const spd = def.movementSpeed * u.speedMul * slowMul;
  u.vx = u.dir * spd;
  u.vy = (u.laneY - u.y) * 0.8;
  u.state = 'march';
  u.anim = 'walk'; u.animT += dt;
  if (def.chargeBonus) u.chargeDist += spd * dt;
}

// After the battle: winners cheer in place, losers run for the hills.
function endgameBehaviour(battle, u, dt) {
  u.flash = Math.max(0, u.flash - dt * 6);
  if (battle.result.winner === null) { u.state = 'idle'; u.anim = 'idle'; u.vx = 0; u.vy = 0; return; }
  if (u.team === battle.result.winner) {
    u.state = 'cheer'; u.vx = 0; u.vy = 0; u.anim = 'idle';
    u.cheerT = (u.cheerT || Math.random() * 0.8) + dt;
    return;
  }
  u.state = 'flee'; u.anim = 'walk'; u.animT += dt;
  u.vx = -u.dir * u.type.movementSpeed * 1.4; u.vy = (u.laneY - u.y) * 0.5;
  if (Math.abs(u.x) > 24) { u.state = 'dead'; u.deadT = 10; }
}

// Auras and formation are recomputed a few times per second for all units.
export function updateAuras(battle) {
  for (const u of battle.units) {
    if (!alive(u)) continue;
    const def = u.type;
    // formation: count distinct allied unit types nearby (excluding own type)
    if (def.passive === 'formation') {
      const seen = new Set();
      battle.grid.each(u.x, u.y, 2.5, (o) => { if (o !== u && o.team === u.team && alive(o) && o.type.id !== def.id && o.type.passive === 'formation') seen.add(o.type.id); });
      u.formation = Math.min(3, seen.size);
    }
    if (def.healAura) battle.grid.each(u.x, u.y, def.healAura.radius, (o) => { if (o.team === u.team && alive(o) && o.hp < o.maxHp) { healUnit(o, def.healAura.rate * 0.25); o.healedT = 0.3; } });
    if (def.shieldAura) battle.grid.each(u.x, u.y, def.shieldAura.radius, (o) => { if (o.team === u.team && alive(o)) { o.shieldT = 0.35; o.shieldReduce = def.shieldAura.reduce; } });
    if (def.rally) battle.grid.each(u.x, u.y, def.rally.radius, (o) => { if (o.team === u.team && alive(o) && o !== u) { o.rallyT = 0.35; o.rallyDmg = def.rally.dmg; } });
  }
}

// Soft collision keeps armies in readable fronts without tunnelling or stacking.
export function separate(battle, u, dt) {
  if (!alive(u)) return;
  const def = u.type;
  let px = 0, py = 0, n = 0;
  const r = def.radius + 1.0;
  battle.grid.each(u.x, u.y, r, (o) => {
    if (o === u || !alive(o)) return;
    let dx = u.x - o.x, dy = u.y - o.y;
    const minD = (def.radius + o.type.radius) * 1.15;
    let d2 = dx * dx + dy * dy;
    if (d2 >= minD * minD) return;
    if (d2 < 1e-4) { dx = (Math.random() - 0.5) * 0.1; dy = (Math.random() - 0.5) * 0.1; d2 = dx * dx + dy * dy; }
    const d = Math.sqrt(d2);
    const overlap = (minD - d) / minD;
    let w = overlap;
    if (o.team !== u.team) w *= def.slip ? 0.35 : 1.6;   // enemies block harder, hunters slip
    const massRatio = o.type.mass / (o.type.mass + def.mass);
    px += dx / d * w * massRatio; py += dy / d * w * massRatio;
    n++;
  });
  if (n > 0) {
    const k = 14 * dt;
    u.x += px * k; u.y += py * k * 1.6;
  }
}

export function integrate(battle, u, dt) {
  if (u.state === 'dead') return;
  u.x += (u.vx + u.kx) * dt;
  u.y += (u.vy + u.ky) * dt;
  u.kx *= Math.pow(0.02, dt); u.ky *= Math.pow(0.02, dt);
  if (u.y > LANE.halfWidth) u.y = LANE.halfWidth;
  if (u.y < -LANE.halfWidth) u.y = -LANE.halfWidth;
  const lim = BASE_STATS.x - 0.9;
  if (u.x > lim) u.x = lim; if (u.x < -lim) u.x = -lim;
}
