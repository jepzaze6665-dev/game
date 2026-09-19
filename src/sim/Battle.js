// The battle world: units, projectiles, bases, gold and the fixed-step update.
// It knows nothing about rendering; it emits plain event objects instead.
import { UNITS, RACE_UNITS, RACES, TEAM, ECONOMY, BASE_STATS, LANE } from '../data/units.js';
import { SpatialGrid } from './SpatialGrid.js';
import { updateUnit, updateAuras, separate, integrate } from './UnitAI.js';
import { updateProjectiles } from './Projectiles.js';

let nextId = 1;

export class Battle {
  constructor(config = {}) {
    this.config = config;
    this.races = [config.playerRace || 'human', config.enemyRace || 'demon'];
    for (const race of this.races) if (!RACES[race]) throw new RangeError(`Unknown race: ${race}`);
    this.time = 0;
    this.units = [];
    this.projectiles = [];
    this.events = [];
    this.spawnQueue = [];
    this.grid = new SpatialGrid(-LANE.halfLength - 2, LANE.halfLength + 2, -LANE.halfWidth - 3, LANE.halfWidth + 3, 2);
    this.gold = [ECONOMY.startGold, ECONOMY.startGold];
    this.regen = [ECONOMY.regenPerSec, ECONOMY.regenPerSec];
    this.counts = [0, 0];
    this.cooldowns = [{}, {}];
    this.stats = [
      { kills: 0, lost: 0, spent: 0, deployed: 0, squads: {} },
      { kills: 0, lost: 0, spent: 0, deployed: 0, squads: {} },
    ];
    const mk = (team, x) => ({ team, x, y: 0, hp: BASE_STATS.hp, maxHp: BASE_STATS.hp, flash: 0, isBase: true, type: { id: 'base', radius: 1, counterTags: [] }, race: this.races[team], style: RACES[this.races[team]].base });
    this.bases = [mk(TEAM.PLAYER, -BASE_STATS.x), mk(TEAM.ENEMY, BASE_STATS.x)];
    this.result = null;
    this.frontline = 0;
    this.roster = [config.playerRoster || RACE_UNITS[this.races[0]], config.enemyRoster || RACE_UNITS[this.races[1]]];
    this.enemyDamageScale = config.enemyDamageScale ?? 1;
    this.enemyIncomeScale = config.enemyIncomeScale ?? 1;
    this.playerIncomeScale = config.playerIncomeScale ?? 1;
    this.accumulator = 0;
    this.step = 1 / 60;
    this.auraT = 0;
    this.tickIndex = 0;
    this.overtime = 1;
  }

  damageScale(team) { return team === TEAM.ENEMY ? this.enemyDamageScale : 1; }
  addGold(team, n) { this.gold[team] = Math.min(ECONOMY.maxGold, this.gold[team] + n); }
  canAfford(team, id) { return this.gold[team] >= UNITS[id].cost; }
  cooldownLeft(team, id) { return Math.max(0, (this.cooldowns[team][id] || 0)); }
  armyFull(team) { return this.counts[team] + this.pendingCount(team) >= ECONOMY.maxUnitsPerTeam; }
  pendingCount(team) { let n = 0; for (const s of this.spawnQueue) if (s.team === team) n++; return n; }

  // Returns a reason string when the squad cannot be bought, or null on success.
  spawnSquad(team, id) {
    if (this.result) return 'over';
    const def = UNITS[id];
    if (!def || !this.roster[team].includes(id)) return 'locked';
    if (this.cooldownLeft(team, id) > 0) return 'cooldown';
    if (this.gold[team] < def.cost) return 'gold';
    if (this.counts[team] + this.pendingCount(team) + def.squad > ECONOMY.maxUnitsPerTeam) return 'full';
    this.gold[team] -= def.cost;
    this.cooldowns[team][id] = def.cooldown;
    const st = this.stats[team];
    st.spent += def.cost; st.deployed += def.squad; st.squads[id] = (st.squads[id] || 0) + 1;
    const spread = LANE.halfWidth * 0.85;
    const centerY = (Math.random() - 0.5) * spread * 1.2;
    for (let i = 0; i < def.squad; i++) {
      const laneY = Math.max(-spread, Math.min(spread, centerY + (i - (def.squad - 1) / 2) * (def.radius * 2.4) + (Math.random() - 0.5) * 0.5));
      this.spawnQueue.push({ team, id, delay: i * 0.11, laneY });
    }
    this.events.push({ type: 'deploy', team, id, count: def.squad, tier: def.tier });
    return null;
  }

  makeUnit(team, id, x, y) {
    const def = UNITS[id];
    const dir = team === TEAM.PLAYER ? 1 : -1;
    return {
      id: nextId++, type: def, team, dir, x, y, laneY: y,
      hp: def.hp, maxHp: def.hp, state: 'march', target: null, retargetT: Math.random() * 0.1,
      cd: 0, phase: null, phaseT: 0, anim: 'walk', animT: Math.random(), flash: 0, hitStun: 0, stunT: 0,
      vx: 0, vy: 0, kx: 0, ky: 0, chargeDist: 0, deadT: 0, spawnT: 0.25, attackingBase: false,
      reach: Math.random() * 1.6, speedMul: 0.93 + Math.random() * 0.14,
      formation: 0, shieldT: 0, shieldReduce: 0, rallyT: 0, rallyDmg: 0, burn: null, slow: null, engaged: 0, revived: false,
    };
  }

  spawnUnit(team, id, laneY) {
    const dir = team === TEAM.PLAYER ? 1 : -1;
    const x = -dir * BASE_STATS.spawnX + (Math.random() - 0.5) * 0.6;
    const u = this.makeUnit(team, id, x, laneY);
    this.units.push(u);
    this.counts[team]++;
    this.events.push({ type: 'spawn', x, y: laneY, team, kind: id });
    return u;
  }

  // Spawn a unit anywhere on the field (summons, death bursts, raised dead).
  spawnUnitAt(team, id, x, y, summoned = false) {
    if (!UNITS[id]) return null;
    if (summoned && this.armyFull(team)) return null;
    const u = this.makeUnit(team, id, x, Math.max(-LANE.halfWidth, Math.min(LANE.halfWidth, y)));
    u.spawnT = 0.35;
    this.units.push(u);
    this.counts[team]++;
    this.events.push({ type: 'spawn', x: u.x, y: u.y, team, kind: id, summoned });
    return u;
  }

  onBaseDestroyed(base) {
    if (this.result) return;
    this.result = { winner: 1 - base.team, time: this.time };
    this.events.push({ type: 'baseDestroyed', team: base.team, x: base.x, y: base.y });
  }

  update(dt) {
    this.accumulator += Math.min(dt, 4.0);
    let guard = 0;
    while (this.accumulator >= this.step && guard++ < 300) {
      this.tick(this.step);
      this.accumulator -= this.step;
    }
  }

  tick(dt) {
    this.time += dt;
    if (!this.result && this.time >= ECONOMY.timeLimit) {
      // Healthier base wins; with equal gates the stronger surviving army takes it.
      const lead = this.bases[0].hp / this.bases[0].maxHp - this.bases[1].hp / this.bases[1].maxHp;
      let winner = Math.abs(lead) < 0.00001 ? null : lead > 0 ? 0 : 1, tiebreak = false;
      if (winner === null) {
        const army = [0, 0];
        for (const u of this.units) if (u.state !== 'dead') army[u.team] += UNITS[u.type.id].cost / UNITS[u.type.id].squad * u.hp / u.maxHp;
        if (Math.abs(army[0] - army[1]) > 1) { winner = army[0] > army[1] ? 0 : 1; tiebreak = true; }
      }
      this.result = { winner, time: ECONOMY.timeLimit, reason: 'time', tiebreak };
      this.spawnQueue.length = 0;
    }
    // Late siege weakens both gates equally, but a unit must land the final hit.
    if (!this.result && this.time >= BASE_STATS.siege.collapseAt) {
      if (!this.collapsing) { this.collapsing = true; this.events.push({ type: 'siege' }); }
      for (const base of this.bases) base.hp = Math.max(1, base.hp - BASE_STATS.siege.decayPerSecond * dt);
    }
    // economy
    const growth = ECONOMY.regenGrowthPerMin * (this.time / 60);
    let ot = 1;
    for (const o of ECONOMY.overtime) if (this.time >= o.at) ot = o.mult;
    if (ot !== this.overtime) { this.overtime = ot; if (ot > 1) this.events.push({ type: 'overtime', mult: ot }); }
    const cb0 = 1 + ECONOMY.comebackBonus * Math.max(0, Math.min(1, -this.frontline / 20));
    const cb1 = 1 + ECONOMY.comebackBonus * Math.max(0, Math.min(1, this.frontline / 20));
    this.regen[0] = (ECONOMY.regenPerSec + growth) * this.playerIncomeScale * cb0 * ot;
    this.regen[1] = (ECONOMY.regenPerSec + growth) * this.enemyIncomeScale * cb1 * ot;
    if (!this.result) { this.addGold(0, this.regen[0] * dt); this.addGold(1, this.regen[1] * dt); }
    for (const team of [0, 1]) for (const k in this.cooldowns[team]) this.cooldowns[team][k] = Math.max(0, this.cooldowns[team][k] - dt);
    // spawn queue
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.spawnQueue[i];
      s.delay -= dt;
      if (s.delay <= 0) { this.spawnQueue.splice(i, 1); this.spawnUnit(s.team, s.id, s.laneY); }
    }
    // spatial grid
    this.grid.clear();
    for (const u of this.units) { if (u.state !== 'dead') this.grid.insert(u); u.engaged = 0; }
    // auras / formation a few times per second
    this.auraT -= dt;
    if (this.auraT <= 0) { this.auraT = 0.25; updateAuras(this); }
    // behaviour (alternate iteration order so neither side gets a first-strike bias)
    this.tickIndex++;
    const us = this.units, n = us.length, fwd = this.tickIndex & 1;
    for (let i = 0; i < n; i++) updateUnit(this, us[fwd ? i : n - 1 - i], dt);
    for (let i = 0; i < us.length; i++) separate(this, us[fwd ? i : us.length - 1 - i], dt);
    for (const u of us) integrate(this, u, dt);
    updateProjectiles(this, dt);
    for (const b of this.bases) { b.flash = Math.max(0, b.flash - dt * 4); this.towerFire(b, dt); }
    // remove finished corpses
    for (let i = this.units.length - 1; i >= 0; i--) if (this.units[i].state === 'dead' && this.units[i].deadT > 1.5) this.units.splice(i, 1);
    this.updateFrontline();
  }

  // Bases shoot arrows at the closest attacker so a defender is never completely helpless.
  towerFire(base, dt) {
    if (base.hp <= 0) return;
    base.towerT = (base.towerT || 0) - dt;
    if (base.towerT > 0) return;
    const t = BASE_STATS.tower;
    let best = null, bestD = t.range;
    this.grid.each(base.x, 0, t.range, (u) => {
      if (u.team === base.team || u.state === 'dead' || u.state === 'downed') return;
      const d = Math.abs(u.x - base.x);
      if (d < bestD) { bestD = d; best = u; }
    });
    if (!best) { base.towerT = 0.2; return; }
    base.towerT = t.interval;
    const dir = base.team === TEAM.PLAYER ? 1 : -1;
    const shooter = { type: { id: 'tower', damage: t.damage, strongAgainst: [], counterTags: [], damageType: 'pierce', projectile: 'arrow', bonus: 1 }, team: base.team, x: base.x, y: 0, dir, hp: 1, maxHp: 1, formation: 0, rallyT: 0 };
    const k = { speed: 16, arc: 0.6, hitRadius: 0.6, sprite: 'arrow' };
    this.projectiles.push({
      kind: 'arrow', k, team: base.team, shooter, target: best,
      x: base.x - dir * 1.5, y: 4.5, sx: base.x - dir * 1.5, sy: 4.5, tx: best.x + (best.vx || 0) * 0.3, ty: best.y,
      t: 0, life: Math.hypot(best.x - base.x, best.y - 4.5) / 16, arc: 0.6, hitRadius: 0.6, dir, z: 0, angle: 0,
    });
  }

  updateFrontline() {
    let pMax = -BASE_STATS.x, eMin = BASE_STATS.x;
    for (const u of this.units) {
      if (u.state === 'dead') continue;
      if (u.team === TEAM.PLAYER) { if (u.x > pMax) pMax = u.x; } else if (u.x < eMin) eMin = u.x;
    }
    const target = (pMax + eMin) / 2;
    this.frontline += (target - this.frontline) * 0.05;
  }

  // Composition summary used by the AI and the HUD (counts + gold value).
  composition(team) {
    const c = {};
    for (const u of this.units) if (u.team === team && u.state !== 'dead') c[u.type.id] = (c[u.type.id] || 0) + 1;
    for (const s of this.spawnQueue) if (s.team === team) c[s.id] = (c[s.id] || 0) + 1;
    return c;
  }
}
