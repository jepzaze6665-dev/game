import { Battle } from '../src/sim/Battle.js';
import { EnemyAI } from '../src/sim/EnemyAI.js';
import { UNITS } from '../src/data/units.js';
const [,, raceA = 'human', raceB = 'robot'] = process.argv;
const b = new Battle({ playerRace: raceA, enemyRace: raceB });
const a = new EnemyAI(b, 'normal', null, 0), e = new EnemyAI(b, 'normal', null, 1); const dt = 1 / 30;
let last = -10;
const short = (c) => Object.entries(c).map(([k, v]) => UNITS[k].name.split(' ')[0] + ':' + v).join(' ');
while (!b.result && b.time < 600) { b.update(dt); a.update(dt); e.update(dt); b.events.length = 0;
  if (b.time - last >= 20) { last = b.time;
    const sc = a.scoreTable(); const top = Object.entries(sc).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => UNITS[k].name.split(' ')[0] + ':' + v.toFixed(1)).join(' ');
    console.log(`t=${b.time.toFixed(0).padStart(3)} front=${b.frontline.toFixed(1).padStart(6)} hp=${b.bases[0].hp.toFixed(0)}/${b.bases[1].hp.toFixed(0)} A[${short(b.composition(0))}] B[${short(b.composition(1))}] Atop{${top}} gold=${b.gold[0].toFixed(0)}`); } }
console.log('winner', b.result && b.result.winner, 'time', b.time.toFixed(0), 'kills', b.stats[0].kills, b.stats[1].kills);
