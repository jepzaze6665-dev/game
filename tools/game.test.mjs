import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/sim/Battle.js';
import { UNITS, RACE_UNITS, ECONOMY } from '../src/data/units.js';
import { applyDamage, rageMultiplier, counterMultiplier } from '../src/sim/Combat.js';
import { updateAuras } from '../src/sim/UnitAI.js';
import { SpriteBatch } from '../src/render/SpriteBatch.js';

test('four complete, distinct rosters with 12 structured units each', () => {
  const fields = 'id race name role description cost hp armor damage attackSpeed attackRange movementSpeed targetType damageType counterTags weakAgainst strongAgainst ability passive cooldown unlockRequirement'.split(' ');
  assert.equal(Object.keys(RACE_UNITS).length, 4);
  assert.equal(Object.keys(UNITS).length, 48);
  for (const [race, ids] of Object.entries(RACE_UNITS)) {
    assert.equal(ids.length, 12);
    for (const id of ids) { const u = UNITS[id]; for (const k of fields) assert.ok(k in u, `${id}: ${k}`); assert.equal(u.race, race); assert.ok(u.weakAgainst.length); assert.ok(u.hp > 0 && u.damage > 0); }
  }
});
test('purchases reserve full squads and reject cooldown, foreign units and overspending', () => {
  const b = new Battle(); const id = RACE_UNITS.human[0], d = UNITS[id];
  const gold = b.gold[0]; assert.equal(b.spawnSquad(0, id), null);
  assert.equal(b.gold[0], gold - d.cost); assert.equal(b.pendingCount(0), d.squad);
  assert.equal(b.spawnSquad(0, id), 'cooldown'); assert.equal(b.spawnSquad(0, RACE_UNITS.robot[0]), 'locked');
  b.cooldowns[0] = {}; b.gold[0] = 999; b.counts[0] = ECONOMY.maxUnitsPerTeam - b.pendingCount(0) - 1;
  assert.equal(b.spawnSquad(0, id), 'full'); b.counts[0] = 0; b.gold[0] = 0; assert.equal(b.spawnSquad(0, id), 'gold');
});
test('formation rewards nearby variety and rage rewards low health', () => {
  const b = new Battle(); const ids = RACE_UNITS.human.slice(0, 4);
  for (const id of ids) { const u = b.spawnUnitAt(0, id, 0, 0); b.grid.insert(u); }
  updateAuras(b); assert.equal(b.units[0].formation, 3);
  const rage = Object.values(UNITS).find(u => u.passive === 'rage');
  assert.equal(rageMultiplier({ type: rage, hp: 100, maxHp: 100 }), 1);
  assert.ok(rageMultiplier({ type: rage, hp: 10, maxHp: 100 }) > 1);
});
test('armor blocks physical damage, specialist bypass and tag counters work', () => {
  const b = new Battle(); const a = b.makeUnit(0, 'h_swordsman', 0, 0), v = b.makeUnit(1, 'r_combat', 0, 0);
  a.type = { ...a.type, damage: 30, strongAgainst: [] };
  v.type = { ...v.type, armor: 12 };
  const physical = applyDamage(b, a, v); v.hp = v.maxHp;
  a.type = { ...a.type, armorPiercing: true }; assert.ok(applyDamage(b, a, v) > physical);
  assert.ok(counterMultiplier({ strongAgainst: ['ARMORED'], bonus: 1.5 }, b.makeUnit(1, 'r_tank', 0, 0)) > 1);
  // a victim's listed weaknesses are real, and race-wide tags give only a small bonus
  assert.ok(counterMultiplier({ strongAgainst: [], counterTags: ['MAGIC'] }, v) > 1);
  assert.ok(counterMultiplier({ strongAgainst: ['UNDEAD'], bonus: 2 }, b.makeUnit(1, 'm_mummy', 0, 0)) < 1.5);
});
test('zero income is honored and summoned units obey capacity', () => {
  const b = new Battle({ playerIncomeScale: 0, enemyIncomeScale: 0 });
  b.tick(1); assert.deepEqual(b.gold, [ECONOMY.startGold, ECONOMY.startGold]);
  b.counts[0] = ECONOMY.maxUnitsPerTeam; assert.equal(b.spawnUnitAt(0, 'h_squire', 0, 0, true), null);
});
test('time limit handles a draw and a healthier-base victory without later damage', () => {
  for (const winner of [null, 0, 1]) {
    const b = new Battle(); if (winner !== null) b.bases[1 - winner].hp = 100;
    b.time = ECONOMY.timeLimit - .01; b.tick(.02); assert.equal(b.result.winner, winner);
    const hp = b.bases[1].hp; applyDamage(b, b.makeUnit(0, 'h_swordsman', 0, 0), b.bases[1]); assert.equal(b.bases[1].hp, hp);
    assert.equal(b.spawnSquad(0, 'h_squire'), 'over');
  }
  // equal gates: the side with the stronger surviving army takes it
  const b = new Battle(); b.spawnUnitAt(1, 'h_knight', 5, 0, true); b.time = ECONOMY.timeLimit - .01; b.tick(.02);
  assert.equal(b.result.winner, 1); assert.ok(b.result.tiebreak);
});
test('health-bar rectangles keep world dimensions when converted to pixels', () => {
  let args; SpriteBatch.prototype.rect.call({ ppu: 12, push: (...a) => { args = a; } }, 1, 2, 2.6, 1.5, .25, [1, 0, 0]);
  assert.equal(args[3], 2.6); assert.equal(args[4].sx, 18); assert.equal(args[4].sy, 3);
});
