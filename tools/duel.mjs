// Equal-gold duel lab: node tools/duel.mjs [raceA] [raceB] [gold=300]
// Spawns `gold` worth of unit A (team 0) vs `gold` worth of unit B (team 1) near the centre and reports who wins.
import { Battle } from '../src/sim/Battle.js';
import { UNITS, RACE_UNITS } from '../src/data/units.js';

function duel(a, b, gold) {
  const bt = new Battle({ playerRace: UNITS[a].race, enemyRace: UNITS[b].race });
  bt.regen = [0, 0]; bt.playerIncomeScale = 0; bt.enemyIncomeScale = 0;
  const spawnWorth = (team, id, x) => {
    const d = UNITS[id];
    const squads = Math.max(1, Math.round(gold / d.cost));
    let n = 0;
    for (let s = 0; s < squads; s++) for (let i = 0; i < d.squad; i++) { bt.spawnUnitAt(team, id, x + (Math.random() - 0.5) * 2 - (team ? -1 : 1) * Math.floor(n / 6) * 0.8, (i - d.squad / 2) * 0.8 + (s % 3 - 1) * 1.5); n++; }
    return n;
  };
  const na = spawnWorth(0, a, -6), nb = spawnWorth(1, b, 6);
  const dt = 1 / 30;
  let t = 0;
  while (t < 90) {
    bt.tick(dt); bt.events.length = 0; t += dt;
    if (bt.counts[0] === 0 || bt.counts[1] === 0) break;
    bt.gold = [0, 0];
  }
  const hpA = bt.units.filter(u => u.team === 0 && u.state !== 'dead').reduce((s, u) => s + u.hp / u.maxHp, 0) / na;
  const hpB = bt.units.filter(u => u.team === 1 && u.state !== 'dead').reduce((s, u) => s + u.hp / u.maxHp, 0) / nb;
  return hpA - hpB; // >0 A wins
}

const [,, raceA = 'human', raceB = 'demon', goldArg = '300'] = process.argv;
const gold = +goldArg;
const A = RACE_UNITS[raceA], B = RACE_UNITS[raceB];
console.log(`${raceA} (rows) vs ${raceB} (cols), ${gold} gold each. + = row wins, - = col wins`);
console.log(''.padEnd(15) + B.map(id => UNITS[id].name.slice(0, 5).padStart(6)).join('') + '   avg');
for (const a of A) {
  let sum = 0;
  const row = B.map(b => { const r = duel(a, b, gold); sum += r; return (r > 0.05 ? '+' : r < -0.05 ? '-' : '=') + Math.abs(r).toFixed(1); });
  console.log(UNITS[a].name.slice(0, 14).padEnd(15) + row.map(x => x.padStart(6)).join('') + '  ' + (sum / B.length).toFixed(2));
}
