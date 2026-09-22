// Focused pair test: node tools/pair.mjs raceA raceB [games=12] [difficulty=normal]
// Same seeding scheme as matrix.mjs, sides alternate. Optional env MUTATE=path.mjs
// imports a module whose default export edits UNITS before the games run.
import { Battle } from '../src/sim/Battle.js';
import { EnemyAI } from '../src/sim/EnemyAI.js';
import { UNITS } from '../src/data/units.js';
import { seeded } from './random.mjs';
import { pathToFileURL } from 'node:url';
const [,, A = 'human', B = 'mummy', nArg = '12', diff = 'normal'] = process.argv;
if (process.env.MUTATE) (await import(pathToFileURL(process.env.MUTATE).href)).default(UNITS);
const n = +nArg; let wa = 0, wb = 0, times = []; const reasons = {};
for (let g = 0; g < n; g++) {
  Math.random = seeded(7000 + g);
  const flip = g % 2; const pa = flip ? B : A, pb = flip ? A : B;
  const b = new Battle({ playerRace: pa, enemyRace: pb });
  const a1 = new EnemyAI(b, diff, null, 0), a2 = new EnemyAI(b, diff, null, 1); const dt = 1 / 30;
  while (!b.result && b.time < 1300) { b.update(dt); if (Math.floor(g / 2) % 2) { a2.update(dt); a1.update(dt); } else { a1.update(dt); a2.update(dt); } b.events.length = 0; }
  const winner = b.result && b.result.winner !== null ? (b.result.winner === 0 ? pa : pb) : null;
  if (winner === A) wa++; else if (winner === B) wb++;
  times.push(b.time);
  const key = (winner || 'draw') + ':' + (b.result ? b.result.reason || 'base' : 'none'); reasons[key] = (reasons[key] || 0) + 1;
}
console.log(`${A} ${wa} : ${wb} ${B}  (${n} games, avg ${(times.reduce((a, b) => a + b, 0) / n / 60).toFixed(1)} min)`, process.env.VERBOSE ? reasons : '');
