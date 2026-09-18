// Full race matrix: node tools/matrix.mjs [games=6] [difficulty=normal]
import { Battle } from '../src/sim/Battle.js';
import { EnemyAI } from '../src/sim/EnemyAI.js';
import { seeded } from './random.mjs';
const races = ['human', 'demon', 'robot', 'mummy'];
const n = +(process.argv[2] || 6), diff = process.argv[3] || 'normal';
const wins = {}; const times = [];
for (const r of races) wins[r] = { w: 0, g: 0 };
const cell = {};
for (let i = 0; i < races.length; i++) for (let j = i + 1; j < races.length; j++) {
  const A = races[i], B = races[j]; let wa = 0, wb = 0, unfinished = 0;
  for (let g = 0; g < n; g++) {
    Math.random = seeded(3000 + i * 1000 + j * 100 + g);
    const flip = g % 2; const pa = flip ? B : A, pb = flip ? A : B;
    const b = new Battle({ playerRace: pa, enemyRace: pb });
    const a1 = new EnemyAI(b, diff, null, 0), a2 = new EnemyAI(b, diff, null, 1); const dt = 1 / 30;
    while (!b.result && b.time < 720) { b.update(dt); if (Math.floor(g / 2) % 2) { a2.update(dt); a1.update(dt); } else { a1.update(dt); a2.update(dt); } b.events.length = 0; }
    times.push(b.time);
    const winner = b.result && b.result.winner !== null ? (b.result.winner === 0 ? pa : pb) : null;
    if (winner === A) wa++;
    if (winner === B) wb++;
    if (!winner) unfinished++;
    wins[A].g++; wins[B].g++; if (winner) wins[winner].w++;
  }
  cell[A + '-' + B] = wa;
  console.log(`${A} ${wa} : ${wb} ${B}; unfinished ${unfinished}`);
}
console.log('win rate:', races.map(r => `${r} ${(wins[r].w / wins[r].g * 100).toFixed(0)}%`).join('  '));
console.log('avg time', (times.reduce((a, b) => a + b, 0) / times.length / 60).toFixed(1), 'min; >10min:', times.filter(t => t > 600).length);
