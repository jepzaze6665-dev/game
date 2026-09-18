import { Battle } from '../src/sim/Battle.js';
import { RACE_UNITS } from '../src/data/units.js';
const b = new Battle({ playerRace: 'mummy', enemyRace: 'robot' });
b.gold = [99999, 99999];
for (let i = 0; i < 40; i++) for (const t of [0, 1]) { b.cooldowns[t] = {}; b.spawnSquad(t, RACE_UNITS[b.races[t]][i % 12]); }
for (let i = 0; i < 120; i++) b.tick(1 / 60);
console.log('units', b.units.length);
const t0 = performance.now();
let nan = 0;
for (let i = 0; i < 600; i++) { b.tick(1 / 60); b.events.length = 0; for (const u of b.units) if (Number.isNaN(u.x) || Number.isNaN(u.hp)) nan++; }
console.log('avg tick ms', ((performance.now() - t0) / 600).toFixed(3), 'units now', b.units.length, 'NaN', nan);
