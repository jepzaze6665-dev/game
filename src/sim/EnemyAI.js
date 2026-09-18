// BattleAI: a reactive commander for any race. It weighs the opponent's army
// by gold value, scores every unit by how well it counters (and is countered
// by) that army, keeps a sensible frontline/backline mix, saves for expensive
// answers, times pushes and makes deliberate mistakes on lower difficulties.
import { UNITS, TEAM } from '../data/units.js';
import { counterMultiplier } from './Combat.js';

export const DIFFICULTIES = {
  easy:   { name: 'Easy',   openingDelay: 8,   thinkEvery: 1.6, mistake: 0.35, saveChance: 0.15, incomeScale: 0.7,  damageScale: 0.85,  aggression: 0.7, desc: 'A relaxed commander. Slow to react, spends carelessly.' },
  normal: { name: 'Normal', openingDelay: 5,   thinkEvery: 1.0, mistake: 0.18, saveChance: 0.4,  incomeScale: 0.85, damageScale: 0.95,  aggression: 1.0, desc: 'Reads your army and answers with counters. Fair fight.' },
  hard:   { name: 'Hard',   openingDelay: 2.5, thinkEvery: 0.7, mistake: 0.08, saveChance: 0.6,  incomeScale: 1.0,  damageScale: 1.0,  aggression: 1.2, desc: 'Fast, sharp counters and timed pushes. Bring a plan.' },
  brutal: { name: 'Brutal', openingDelay: 1.5, thinkEvery: 0.5, mistake: 0.03, saveChance: 0.75, incomeScale: 1.1,  damageScale: 1.05, aggression: 1.4, desc: 'Relentless. Every mistake you make gets punished.' },
};

// Race personalities: how the commander likes to spend.
export const PERSONALITIES = {
  human: { name: 'Adaptive', tierBias: [1, 1, 1.1, 1, 1, 1, 1, 1, 1.1, 1, 1, 1], pushEvery: 32, saveMul: 1.0, mixWeight: 1.4, wave: 170, desc: 'Balanced and adaptive: mixes squads for formation bonuses.' },
  demon: { name: 'Pressure', tierBias: [1.2, 1.2, 1, 1, 1.2, 1.2, 1.2, 1, 0.9, 1, 1, 1], pushEvery: 20, saveMul: 0.7, mixWeight: 0.8, wave: 130, desc: 'Aggressive: constant cheap pressure and early pushes.' },
  robot: { name: 'Buildup', tierBias: [0.8, 0.9, 1.1, 1.2, 1.2, 0.9, 1, 1.3, 1.1, 1.2, 1.2, 1.2], pushEvery: 45, saveMul: 1.5, mixWeight: 1.0, wave: 240, desc: 'Slow buildup, then overwhelming ranged firepower.' },
  mummy: { name: 'Attrition', tierBias: [1.3, 1.3, 1, 1.1, 1, 0.9, 1, 1, 1.2, 1, 1, 1.1], pushEvery: 28, saveMul: 0.9, mixWeight: 1.0, wave: 150, desc: 'Swarms and regeneration: floods the lane and grinds you down.' },
};

export class EnemyAI {
  constructor(battle, difficulty = 'normal', personality = null, team = TEAM.ENEMY) {
    this.battle = battle;
    this.team = team;
    this.foe = 1 - team;
    this.race = battle.races[team];
    this.diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
    this.pers = PERSONALITIES[personality || this.race] || PERSONALITIES.human;
    this.timer = this.diff.openingDelay || 1.5;
    this.saving = null;
    this.savingSince = 0;
    this.pushTimer = this.pers.pushEvery * (0.8 + Math.random() * 0.4) / this.diff.aggression;
    this.lastDecision = '';
    this.roster = battle.roster[team];
  }

  update(dt) {
    if (this.battle.result) return;
    this.timer -= dt;
    this.pushTimer -= dt;
    if (this.timer > 0) return;
    this.timer = this.diff.thinkEvery * (0.7 + Math.random() * 0.6);
    this.think();
  }

  // Enemy units close to our gate while we have little in front of it.
  underSiege() {
    const b = this.battle;
    const sign = this.team === TEAM.ENEMY ? 1 : -1;   // our base sits at +x for the enemy team
    let near = 0, mine = 0;
    for (const u of b.units) {
      if (u.state === 'dead') continue;
      if (u.x * sign > 10) { if (u.team === this.team) mine++; else near++; }
    }
    return near > mine + 2;
  }

  // Gold-weighted composition: elites matter more than their unit count suggests.
  weighted(team) {
    const comp = this.battle.composition(team);
    const w = {};
    let total = 0;
    for (const id in comp) { const v = comp[id] * UNITS[id].cost / UNITS[id].squad; w[id] = v; total += v; }
    for (const id in w) w[id] /= Math.max(1, total);
    return { w, total };
  }

  scoreTable() {
    const b = this.battle;
    const foe = this.weighted(this.foe);
    const mine = this.weighted(this.team);
    const mineComp = b.composition(this.team);
    const totalM = Object.values(mineComp).reduce((a, c) => a + c, 0);
    let frontline = 0, ranged = 0;
    for (const id in mineComp) { const d = UNITS[id]; if (d.projectile) ranged += mineComp[id]; else frontline += mineComp[id] * (d.mass >= 5 ? 3 : 1); }
    const scores = {};
    this.roster.forEach((id, i) => {
      const def = UNITS[id];
      let s = 1;
      for (const fid in foe.w) {
        const share = foe.w[fid];
        const fdef = UNITS[fid];
        const victim = { type: fdef };
        s += (counterMultiplier(def, victim) - 1) * 4.5 * share;        // we counter them
        s -= (counterMultiplier(fdef, { type: def }) - 1) * 3.5 * share; // they counter us
        // armour matters: how much of our damage actually lands, and how much of theirs we shrug off
        const physical = (d) => (d.damageType === 'physical' || d.damageType === 'pierce') && !d.armorPiercing;
        if (physical(def) && fdef.armor > 0) s += (Math.max(0.45, 1 - fdef.armor / def.damage) - 1) * 3.0 * share;
        if (physical(fdef) && def.armor > 0) s += (1 - Math.max(0.45, 1 - def.armor / fdef.damage)) * 2.0 * share;
      }
      // keep a frontline in front of the ranged backline
      if (def.projectile && frontline < ranged * 1.2) s -= 0.9;
      if (!def.projectile && frontline > ranged * 3 + 6 && totalM > 8) s -= 0.4;
      // diversity: penalise stacking one unit (by head count); humans love mixing (formation)
      const share = (mineComp[id] || 0) / Math.max(1, totalM);
      s -= share * 2.4 * this.pers.mixWeight;
      // early game: cheap units are fine, late game: prefer heavier tiers
      const minutes = b.time / 60;
      s += Math.min(1.1, 0.2 + minutes * 0.3) * (i / 11);
      if (i <= 1) s -= Math.min(1.2, minutes * 0.35);
      s *= this.pers.tierBias[i] || 1;
      scores[id] = s;
    });
    return scores;
  }

  think() {
    const b = this.battle;
    const gold = b.gold[this.team];
    const scores = this.scoreTable();
    const ids = this.roster.filter((id) => b.cooldownLeft(this.team, id) <= 0);
    if (!ids.length) return;
    let ranked = ids.slice().sort((x, y) => scores[y] - scores[x]);
    if (Math.random() < this.diff.mistake) {
      const i = Math.floor(Math.random() * Math.min(3, ranked.length));
      [ranked[0], ranked[i]] = [ranked[i], ranked[0]];
      this.lastDecision = 'mistake';
    }
    const best = ranked[0];
    const bestDef = UNITS[best];
    // timed push: dump everything, best units first
    if (this.pushTimer <= 0) {
      let spent = 0;
      for (const id of ranked) { if (!b.spawnSquad(this.team, id)) spent++; if (spent >= 5) break; }
      this.pushTimer = this.pers.pushEvery * (0.8 + Math.random() * 0.5) / this.diff.aggression;
      this.saving = null;
      this.lastDecision = 'push';
      return;
    }
    // Waves: bank gold until a wave budget is reached, then spend it in one burst
    // (best-scored units first) so squads arrive together instead of trickling in.
    const minutes = b.time / 60;
    const budget = this.pers.wave * (1 + Math.min(1.5, minutes * 0.2));
    const critical = this.underSiege();
    const mineN = b.counts[this.team] + b.pendingCount(this.team);
    if (gold < budget && !critical && !(mineN < 3 && b.time > 8)) { this.lastDecision = 'bank'; return; }
    if (critical || (mineN < 3 && b.time > 8)) {
      const affordable = ranked.find((id) => UNITS[id].cost <= gold);
      if (affordable) { b.spawnSquad(this.team, affordable); this.lastDecision = 'emergency:' + affordable; }
      if (gold < budget) return;
    }
    // spend the wave: walk the ranking, buying each pick at most twice
    let bought = 0;
    for (let pass = 0; pass < 2 && bought < 6; pass++) {
      for (const id of ranked) {
        if (UNITS[id].cost > b.gold[this.team]) continue;
        if (!b.spawnSquad(this.team, id)) { bought++; this.lastDecision = 'wave:' + id; }
        if (bought >= 6 || b.gold[this.team] < 35) break;
      }
    }
    return;
  }
}
