// CounterSystem + CombatSystem: tag counters, armour, race passives, status
// effects, lifesteal, kills, revives and death-spawns. Fully data driven —
// no unit ids appear in here.
import { ECONOMY, BASE_STATS, UNITS } from '../data/units.js';

const ARMOR_TYPES = new Set(['physical', 'pierce']);   // damage types reduced by armour

// Fraction of a physical hit that gets through `armor`. Heavy blows punch
// through, small hits are blunted, but never below the floor - so swarm races
// are weakened by armour without becoming useless against it.
export function armorFactor(dmg, armor) {
  if (!(armor > 0)) return 1;
  return Math.max(0.45, 1 - armor / (armor + dmg + 6));
}

// Tags every unit of a race carries. A counter against one of these hits the
// whole enemy roster, so it is capped well below a normal role counter.
const RACE_WIDE_TAGS = new Set(['UNDEAD', 'MECHANICAL']);
const RACE_WIDE_BONUS = 1.2;

const WEAKNESS_BONUS = 1.3;   // a unit's listed weaknesses are real: those attackers hit it harder

// Tag-based multiplier of attacker definition against a victim (unit or base).
// Uses the attacker's strongAgainst list and the victim's weakAgainst list
// (the larger applies), so every unit has a counter the codex can show honestly.
export function counterMultiplier(def, victim) {
  if (victim.isBase) return def.bonusVsBase || 1;
  const vdef = victim.type;
  const tags = vdef.counterTags;
  let m = 1;
  for (const t of def.strongAgainst) if (tags.includes(t)) { m = Math.max(m, RACE_WIDE_TAGS.has(t) ? Math.min(RACE_WIDE_BONUS, def.bonus || 1.5) : (def.bonus || 1.5)); }
  if (m < WEAKNESS_BONUS && vdef.weakAgainst && def.counterTags) for (const t of vdef.weakAgainst) if (def.counterTags.includes(t)) { m = WEAKNESS_BONUS; break; }
  return m;
}

// Rage: demon passive — more damage as HP drops below half.
export function rageMultiplier(u) {
  if (u.type.passive !== 'rage') return 1;
  const missing = 1 - u.hp / u.maxHp;
  const k = Math.max(0, Math.min(1, (missing - 0.5) / 0.5));   // 0 at 50% hp .. 1 at 0% hp
  return 1 + k * (u.type.rageStrong ? 1.2 : 0.6);
}
export function rageSpeedMultiplier(u) {
  if (u.type.passive !== 'rage') return 1;
  const missing = 1 - u.hp / u.maxHp;
  return 1 + Math.max(0, Math.min(1, (missing - 0.5) / 0.5)) * 0.3;
}

// Outgoing damage multiplier from passives/auras on the attacker.
export function offenseMultiplier(u) {
  let m = rageMultiplier(u);
  if (u.formation) m *= 1 + 0.05 * u.formation;
  if (u.rallyT > 0) m *= 1 + u.rallyDmg;
  return m;
}

// Incoming damage multiplier from the victim's passives/auras.
export function defenseMultiplier(victim, attackerDef, ranged) {
  let m = 1;
  if (victim.formation) m *= 1 - 0.05 * victim.formation;
  if (victim.shieldT > 0) m *= 1 - victim.shieldReduce;
  if (ranged && victim.type.rangedResist) m *= 1 - victim.type.rangedResist;
  return m;
}

// Apply damage from attacker unit to victim (unit or base). Returns damage dealt.
export function applyDamage(battle, attacker, victim, extraMult = 1, opts = {}) {
  if (battle.result) return 0;
  if (!victim || victim.hp <= 0 || victim.state === 'dead' || victim.state === 'downed') return 0;
  const def = attacker.type;
  const counter = counterMultiplier(def, victim);
  let dmg = def.damage * counter * extraMult * battle.damageScale(attacker.team) * offenseMultiplier(attacker);
  const ranged = !!def.projectile;
  if (victim.isBase) {
    const siege = BASE_STATS.siege;
    const siegeMult = Math.min(siege.maxMultiplier, 1 + Math.max(0, battle.time - siege.at) / siege.rampSeconds);
    dmg *= BASE_STATS.unitDamageScale * siegeMult;
    if (def.counterTags.includes('SWARM') || def.counterTags.includes('LIGHT')) dmg *= 0.6;   // chaff makes poor siege
    dmg = Math.max(1, Math.round(dmg));
    victim.hp -= dmg; victim.flash = Math.min(1, victim.flash + 0.5);
    battle.events.push({ type: 'baseHit', team: victim.team, x: victim.x, y: victim.y, dmg, heavy: dmg >= 25 });
    if (victim.hp <= 0) { victim.hp = 0; battle.onBaseDestroyed(victim); }
    return dmg;
  }
  // armour core: flat reduction for physical/pierce unless the attack pierces armour
  const armor = victim.type.armor || 0;
  let blocked = false;
  if (armor > 0 && ARMOR_TYPES.has(def.damageType) && !def.armorPiercing) {
    const after = dmg * armorFactor(dmg, armor);
    blocked = after < dmg * 0.8;
    dmg = after;
  }
  dmg *= defenseMultiplier(victim, def, ranged);
  dmg = Math.max(1, dmg);   // fractional: rounding would punish low-damage swarm units twice
  victim.hp -= dmg;
  victim.flash = 1;
  victim.hitStun = Math.max(victim.hitStun, opts.stun || 0.05);
  victim.lastHitBy = attacker.team;
  victim.lastHitRanged = ranged;
  if (opts.knockback) {
    const dir = Math.sign(victim.x - attacker.x) || attacker.dir;
    const k = opts.knockback / Math.max(0.5, victim.type.mass);
    victim.kx += dir * k * 2; victim.ky += (Math.random() - 0.5) * k;
  }
  if (opts.stunFor) victim.stunT = Math.max(victim.stunT, opts.stunFor);
  if (def.burn && !opts.noStatus) victim.burn = { dps: def.burn.dps, t: def.burn.dur, src: attacker };
  if (def.slow && !opts.noStatus) victim.slow = { pct: def.slow.pct, t: def.slow.dur };
  if (def.lifesteal) healUnit(attacker, dmg * def.lifesteal);
  battle.events.push({
    type: 'hit', x: victim.x, y: victim.y + 0.6, dmg: Math.round(dmg), team: victim.team, kind: def.id,
    counter: counter > 1.01, charge: !!opts.charge, big: dmg >= 40 || !!opts.charge, splash: !!opts.splash, blocked, magic: !ARMOR_TYPES.has(def.damageType),
  });
  if (victim.hp <= 0) { victim.hp = 0; killUnit(battle, victim, attacker); }
  return dmg;
}

export function healUnit(u, amount) {
  if (u.state === 'dead' || u.state === 'downed') return;
  u.hp = Math.min(u.maxHp, u.hp + amount);
}

export function killUnit(battle, victim, killer) {
  if (victim.state === 'dead' || victim.state === 'downed') return;
  const def = victim.type;
  // undeath: chance to rise again once
  if (def.revive && !victim.revived && Math.random() < def.revive) {
    victim.state = 'downed'; victim.downT = 1.6; victim.revived = true; victim.target = null;
    battle.events.push({ type: 'downed', x: victim.x, y: victim.y, team: victim.team });
    return;
  }
  victim.state = 'dead';
  victim.deadT = 0;
  victim.target = null;
  battle.counts[victim.team]--;
  const killerTeam = killer ? killer.team : 1 - victim.team;
  battle.stats[killerTeam].kills++;
  battle.stats[victim.team].lost++;
  if (killer) battle.addGold(killer.team, ECONOMY.killBounty);
  const big = def.mass >= 5 || def.tier >= 11;
  battle.events.push({ type: 'death', x: victim.x, y: victim.y, team: victim.team, kind: def.id, dir: killer ? Math.sign(victim.x - killer.x) || 1 : -victim.dir, big, elite: def.tier >= 11, mech: def.counterTags.includes('MECHANICAL') });
  // death spawns (scarab swarm) and kill summons (warlock, pharaoh mage)
  if (def.spawnOnDeath) for (let i = 0; i < def.spawnOnDeath.count; i++) battle.spawnUnitAt(victim.team, def.spawnOnDeath.unit, victim.x + (Math.random() - 0.5) * 1.2, victim.y + (Math.random() - 0.5) * 1.2, true);
  if (killer && killer.type.summonOnKill && Math.random() < killer.type.summonOnKill.chance && !battle.armyFull(killer.team)) {
    battle.spawnUnitAt(killer.team, killer.type.summonOnKill.unit, victim.x, victim.y, true);
    battle.events.push({ type: 'summon', x: victim.x, y: victim.y, team: killer.team });
  }
}

// Splash damage around (x,y) against enemies of attacker.team.
export function splashDamage(battle, attacker, x, y, radius, mult = 1, opts = {}) {
  let n = 0;
  battle.grid.each(x, y, radius, (u) => {
    if (u.team === attacker.team || u.state === 'dead' || u.state === 'downed') return;
    const dx = u.x - x, dy = u.y - y;
    if (dx * dx + dy * dy <= (radius + u.type.radius) * (radius + u.type.radius)) {
      applyDamage(battle, attacker, u, mult, { ...opts, splash: true });
      n++;
    }
  });
  return n;
}

// Damage every enemy inside a corridor starting at (x,y) heading `dir` for `length`.
export function lineDamage(battle, attacker, x, y, dir, length, width, mult = 1, opts = {}) {
  let n = 0;
  battle.grid.each(x + dir * length / 2, y, length / 2 + 1, (u) => {
    if (u.team === attacker.team || u.state === 'dead' || u.state === 'downed') return;
    const along = (u.x - x) * dir;
    if (along < -0.3 || along > length) return;
    if (Math.abs(u.y - y) > width / 2 + u.type.radius) return;
    applyDamage(battle, attacker, u, mult, { ...opts, splash: true });
    n++;
  });
  return n;
}

// Chain lightning: hit target then jump to nearby enemies.
export function chainDamage(battle, attacker, first, jumps, falloff) {
  const hit = new Set([first]);
  const points = [[first.x, first.y + 0.6]];
  applyDamage(battle, attacker, first, 1, {});
  let cur = first, mult = 1;
  for (let j = 0; j < jumps; j++) {
    mult *= falloff;
    let next = null, best = 2.8;
    battle.grid.each(cur.x, cur.y, 2.8, (u) => {
      if (u.team === attacker.team || u.state === 'dead' || u.state === 'downed' || hit.has(u)) return;
      const d = Math.hypot(u.x - cur.x, u.y - cur.y);
      if (d < best) { best = d; next = u; }
    });
    if (!next) break;
    hit.add(next); points.push([next.x, next.y + 0.6]);
    applyDamage(battle, attacker, next, mult, { splash: true });
    cur = next;
  }
  return points;
}

export function unitDef(id) { return UNITS[id]; }
