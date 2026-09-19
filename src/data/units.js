// Unit database: 4 races × 12 units, plus shared battle constants.
// Simulation reads stats, rendering reads `look`, UI reads names/descriptions.
import { HUMAN_UNITS } from './roster/human.js';
import { DEMON_UNITS } from './roster/demon.js';
import { ROBOT_UNITS } from './roster/robot.js';
import { MUMMY_UNITS } from './roster/mummy.js';
import { normalise, setRosterLookup } from './balance.js';
export { RACES, RACE_ORDER, TAGS } from './races.js';

export const TEAM = { PLAYER: 0, ENEMY: 1 };

export const RACE_UNITS = {
  human: HUMAN_UNITS.map((u) => u.id),
  demon: DEMON_UNITS.map((u) => u.id),
  robot: ROBOT_UNITS.map((u) => u.id),
  mummy: MUMMY_UNITS.map((u) => u.id),
};

export const UNITS = {};
for (const list of [HUMAN_UNITS, DEMON_UNITS, ROBOT_UNITS, MUMMY_UNITS]) for (const u of list) UNITS[u.id] = u;

setRosterLookup((id) => UNITS[id]);   // summon prices use raw roster costs (normalise never changes cost)

// Deployment hotkeys for the 12 slots
export const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
for (const race in RACE_UNITS) RACE_UNITS[race].forEach((id, i) => {
  const u = UNITS[id];
  u.hotkey = HOTKEYS[i]; u.tier = i + 1;
  normalise(u, i);   // see balance.js: value-per-gold follows the tier curve
});

export function unitsOf(race) { return RACE_UNITS[race].map((id) => UNITS[id]); }

export const TEAM_COLORS = {
  [TEAM.PLAYER]: { main: '#3b82f6', dark: '#1e3a8a', light: '#93c5fd', name: 'Blue' },
  [TEAM.ENEMY]:  { main: '#ef4444', dark: '#7f1d1d', light: '#fca5a5', name: 'Red' },
};

export const ECONOMY = {
  startGold: 200,
  regenPerSec: 8,
  regenGrowthPerMin: 3,     // income climbs so late game stays explosive
  overtime: [{ at: 480, mult: 1.5 }, { at: 660, mult: 2 }, { at: 840, mult: 3 }],   // sudden-death income multipliers so matches end decisively
  killBounty: 1,
  comebackBonus: 0.25,       // extra income when the front line is deep in your half
  maxGold: 1500,
  maxUnitsPerTeam: 260,
  timeLimit: 1200,          // 20 minute cap; the healthier base (then the stronger army) wins
  waveEvery: 10,            // bought squads muster and march together every wave
};

export const BASE_STATS = {
  hp: 4200,
  x: 42,              // distance from battlefield centre to base wall (about 1.5 screens apart)
  hitRange: 3.6,      // units start hitting the base at |x| >= BASE.x - hitRange (plus a per-unit random reach)
  unitDamageScale: 0.6, // ordinary units chip at walls slowly; bonusVsBase units use their multiplier on top
  siege: { at: 360, rampSeconds: 90, maxMultiplier: 5, collapseAt: 720, decayPerSecond: 30 },
  spawnX: 39.5,
  tower: { range: 7.5, damage: 18, interval: 1.2 },   // each base shoots back at nearby attackers
};

export const LANE = {
  halfLength: 62,     // ground extends this far (behind bases, covers ultra-wide screens)
  halfWidth: 4.8,     // units keep within this y band
  groundHalfHeight: 14,
};
