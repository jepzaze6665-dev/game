import { TUNE } from './tuning.js';

// Centralised balance curve. Every unit's HP and damage are normalised at load
// time so its "combat value per gold" follows the tier curve below. Designers
// tune the roster files for feel (ranges, speeds, abilities, ratios) and this
// file guarantees no tier is strictly better than another per gold spent.

// Rough combat value of a unit definition (higher = more fighting power per squad).
export function combatValue(d) {
  // Regen only pays off for units that survive an engagement, and a revive
  // brings back 40% HP some of the time, so both are valued modestly.
  let effHP = d.hp * (1 + (d.armor || 0) / 12) * (1 + (d.regen || 0) / 25) * (1 + (d.revive || 0) * 0.4);
  const splash = d.splash ? (1 + d.splash * 0.9) : 1;
  const multi = d.multishot ? d.multishot * 0.8 : 1;
  const chain = d.chain ? 1 + d.chain.jumps * 0.5 : 1;
  const line = d.pierceLine ? 1.8 : 1;
  let effDPS = d.damage * d.attackSpeed * splash * multi * chain * line * (1 + Math.max(0, d.attackRange - 1) * 0.05) * (d.armorPiercing ? 1.15 : 1) * (d.lifesteal ? 1.2 : 1);
  // race passives that the raw stats do not show
  if (d.passive === 'formation') { effHP *= 1.1; effDPS *= 1.1; }   // typical mixed-squad bonus
  if (d.passive === 'rage') effDPS *= 1.1;                           // averaged over a unit's life
  // free units are gold: value them at their squad price over a ~45 s life
  let summoned = 0;
  if (d.raise) summoned += summonGold(d.raise.unit) * d.raise.count / d.raise.every * 45;
  if (d.summonOnKill) summoned += summonGold(d.summonOnKill.unit) * d.summonOnKill.chance * 6;   // a handful of kills
  if (d.spawnOnDeath) summoned += summonGold(d.spawnOnDeath.unit) * d.spawnOnDeath.count;
  const summonMult = 1 + summoned / (d.cost * 2);
  return Math.sqrt(effHP * effDPS) * summonMult * d.squad / d.cost;
}

// Gold price of one summoned body. Rosters are loaded lazily to avoid an import cycle.
let rosterLookup = null;
export function setRosterLookup(fn) { rosterLookup = fn; }
function summonGold(id) { const u = rosterLookup && rosterLookup(id); return u ? u.cost / u.squad : 20; }

// Target value-per-gold by tier (1..12). Cheap units are efficient but get
// countered by area damage; support and area tiers are valued for their effects.
export const TIER_VALUE = [2.6, 2.4, 2.0, 1.5, 1.3, 1.8, 1.8, 1.8, 0.9, 0.9, 1.8, 1.8];
const CLAMP = { support: [0.85, 1.3], normal: [0.6, 1.6] };

// Per-race power knob (applied on top of the tier curve) tuned with tools/matrix.mjs
// so every race wins roughly half of its AI-vs-AI matches.
export const RACE_POWER = { human: 0.98, demon: 1.07, robot: 0.88, mummy: 1.04 };

export function normalise(unit, tierIndex) {
  const target = TIER_VALUE[tierIndex] * (RACE_POWER[unit.race] || 1);
  const v = combatValue(unit);
  const range = (tierIndex === 8 || tierIndex === 9) ? CLAMP.support : CLAMP.normal;
  const k = Math.max(range[0], Math.min(range[1], target / v)) * (TUNE[unit.id] || 1);
  unit.hp = Math.round(unit.hp * k);
  unit.damage = Math.max(1, Math.round(unit.damage * k));
  unit.balanceK = k;
  return k;
}
