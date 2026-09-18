import { Battle } from '../src/sim/Battle.js';
import { EnemyAI } from '../src/sim/EnemyAI.js';
for (const pers of ['demon', 'human', 'robot', 'mummy']) {
  let w = 0; const n = 6;
  for (let g = 0; g < n; g++) {
    const b = new Battle({ playerRace: 'demon', enemyRace: 'human' });
    const a = new EnemyAI(b, 'normal', pers, 0), e = new EnemyAI(b, 'normal', null, 1); const dt = 1 / 30;
    while (!b.result && b.time < 720) { b.update(dt); if (g % 2) { e.update(dt); a.update(dt); } else { a.update(dt); e.update(dt); } b.events.length = 0; }
    if (b.result && b.result.winner === 0) w++;
  }
  console.log('demon with personality', pers, 'wins', w, '/', n);
}
