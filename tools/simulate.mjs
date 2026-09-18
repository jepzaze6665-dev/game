// Headless balance harness: node tools/simulate.mjs [matches] [raceA] [raceB] [diffA] [diffB]
import { Battle } from '../src/sim/Battle.js';
import { EnemyAI } from '../src/sim/EnemyAI.js';
import { RACE_UNITS, UNITS } from '../src/data/units.js';

const [,, nArg = '6', raceA = 'human', raceB = 'demon', diffA = 'normal', diffB = 'normal'] = process.argv;
const n = +nArg;
const results = [];
for (let i = 0; i < n; i++) {
  const b = new Battle({ playerRace: raceA, enemyRace: raceB });
  const a = new EnemyAI(b, diffA, null, 0), e = new EnemyAI(b, diffB, null, 1);
  const dt = 1 / 30;
  let maxUnits = 0;
  while (!b.result && b.time < 900) {
    b.update(dt); if (i % 2) { e.update(dt); a.update(dt); } else { a.update(dt); e.update(dt); } b.events.length = 0;
    maxUnits = Math.max(maxUnits, b.units.length);
  }
  results.push({ winner: b.result ? b.result.winner : -1, time: b.time, maxUnits, squads: [b.stats[0].squads, b.stats[1].squads], hp: [b.bases[0].hp, b.bases[1].hp] });
}
const wins = [0, 0, 0];
for (const r of results) wins[r.winner == null || r.winner < 0 ? 2 : r.winner]++;
const avgT = results.reduce((s, r) => s + r.time, 0) / n;
console.log(`${raceA}(${diffA}) ${wins[0]} : ${wins[1]} ${raceB}(${diffB})  draws ${wins[2]}  avg ${(avgT / 60).toFixed(1)} min  max units ${Math.max(...results.map(r => r.maxUnits))}`);
for (const t of [0, 1]) {
  const usage = {};
  for (const r of results) for (const k in r.squads[t]) usage[k] = (usage[k] || 0) + r.squads[t][k];
  const race = t === 0 ? raceA : raceB;
  console.log('  ' + race + ': ' + RACE_UNITS[race].map((id) => `${UNITS[id].name.split(' ')[0]}:${usage[id] || 0}`).join(' '));
}
console.log('  times: ' + results.map(r => (r.time / 60).toFixed(1)).join(' '));
