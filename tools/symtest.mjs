import { Battle } from '../src/sim/Battle.js';
import { EnemyAI } from '../src/sim/EnemyAI.js';
import { RACE_ORDER } from '../src/data/races.js';
import { seeded } from './random.mjs';
const n = Number(process.argv[2] || 24);
for (const race of RACE_ORDER) {
  const wins = [0, 0]; let unfinished = 0;
  for (let i = 0; i < n; i++) {
    Math.random = seeded(1000 + i);
    const b = new Battle({ playerRace: race, enemyRace: race });
    const a = new EnemyAI(b, 'normal', race, 0), e = new EnemyAI(b, 'normal', race, 1);
    const dt = 1 / 30;
    while (!b.result && b.time < 1300) { b.update(dt); if (i % 2) { e.update(dt); a.update(dt); } else { a.update(dt); e.update(dt); } b.events.length = 0; }
    if (b.result && b.result.winner !== null) wins[b.result.winner]++; else unfinished++;
  }
  console.log(`${race} mirror: left ${wins[0]}, right ${wins[1]}, unfinished ${unfinished} (${n} seeds; diagnostic, not an assertion)`);
}
