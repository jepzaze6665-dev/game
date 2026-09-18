import { UNITS, RACE_UNITS } from '../src/data/units.js';
export function value(d) {
  const effHP = d.hp * (1 + (d.armor || 0) / 12) * (1 + (d.regen || 0) / 10) * (d.revive ? 1.2 : 1);
  const splash = d.splash ? (1 + d.splash * 0.9) : 1;
  const multi = d.multishot ? d.multishot * 0.8 : 1;
  const chain = d.chain ? 1 + d.chain.jumps * 0.5 : 1;
  const line = d.pierceLine ? 1.8 : 1;
  const effDPS = d.damage * d.attackSpeed * splash * multi * chain * line * (1 + Math.max(0, d.attackRange - 1) * 0.05) * (d.armorPiercing ? 1.15 : 1) * (d.lifesteal ? 1.2 : 1);
  return Math.sqrt(effHP * effDPS) * d.squad / d.cost;
}
if (process.argv[1].endsWith('values.mjs')) for (const race in RACE_UNITS) {
  console.log(race + ': ' + RACE_UNITS[race].map((id) => `${UNITS[id].name.slice(0, 8).padEnd(8)}${value(UNITS[id]).toFixed(2)}`).join(' | '));
}
