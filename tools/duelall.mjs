import { Battle } from '../src/sim/Battle.js';
import { UNITS, RACE_UNITS } from '../src/data/units.js';
const gold = +(process.argv[2] || 300);
function duel(a, b) {
  const bt = new Battle({ playerRace: UNITS[a].race, enemyRace: UNITS[b].race });
  bt.playerIncomeScale = 0; bt.enemyIncomeScale = 0;
  const spawnWorth = (team, id, x) => { const d = UNITS[id]; const squads = Math.max(1, Math.round(gold / d.cost)); let n = 0; for (let s = 0; s < squads; s++) for (let i = 0; i < d.squad; i++) { bt.spawnUnitAt(team, id, x - (team ? -1 : 1) * Math.floor(n / 6) * 0.8, (i - d.squad / 2) * 0.8 + (s % 3 - 1) * 1.5); n++; } return n; };
  const na = spawnWorth(0, a, -6), nb = spawnWorth(1, b, 6);
  let t = 0; while (t < 90) { bt.tick(1 / 30); bt.events.length = 0; t += 1 / 30; bt.gold = [0, 0]; if (bt.counts[0] === 0 || bt.counts[1] === 0) break; }
  const hpA = bt.units.filter(u => u.team === 0 && u.state !== 'dead').reduce((s, u) => s + u.hp / u.maxHp, 0) / na;
  const hpB = bt.units.filter(u => u.team === 1 && u.state !== 'dead').reduce((s, u) => s + u.hp / u.maxHp, 0) / nb;
  return hpA - hpB;
}
const all = Object.values(RACE_UNITS).flat();
const res = {};
for (const a of all) { let s = 0; for (const b of all) s += duel(a, b); res[a] = s / all.length; }
for (const race in RACE_UNITS) console.log(race.padEnd(6) + RACE_UNITS[race].map(id => `${UNITS[id].name.slice(0, 7).padEnd(7)}${(res[id] >= 0 ? '+' : '') + res[id].toFixed(2)}`).join(' | '));
