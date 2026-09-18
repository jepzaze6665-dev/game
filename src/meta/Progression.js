// ProgressSystem: persistent campaign progress, stars, settings and stats.
// Every race and unit is available from the start — progression is about
// mastery (stars, stage clears, records), never about buying power.
import { STAGES } from '../data/stages.js';

const KEY = 'miragine.save.v2';

const DEFAULT = {
  stagesCleared: 0,          // highest stage index cleared (1-based count)
  stars: {},                 // stageId -> 1..3
  settings: { sfx: 0.8, music: 0.5, shake: true, numbers: true, speed: 1 },
  stats: { wins: 0, losses: 0, kills: 0, played: 0, raceWins: {} },
  seenTutorial: false,
  seenHowto: false,
  lastRace: 'human',
  lastEnemyRace: 'demon',
};

export class Progression {
  constructor() {
    this.data = structuredClone(DEFAULT);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...structuredClone(DEFAULT), ...parsed, settings: { ...DEFAULT.settings, ...(parsed.settings || {}) }, stats: { ...DEFAULT.stats, ...(parsed.stats || {}) } };
      }
    } catch (e) { /* ignore */ }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } }
  reset() { this.data = structuredClone(DEFAULT); this.save(); }

  get settings() { return this.data.settings; }
  stageAvailable(index) { return index <= this.data.stagesCleared; }
  totalStars() { return Object.values(this.data.stars).reduce((a, b) => a + b, 0); }

  completeStage(stage, stars) {
    const idx = STAGES.indexOf(stage);
    if (idx + 1 > this.data.stagesCleared) this.data.stagesCleared = idx + 1;
    if (!this.data.stars[stage.id] || this.data.stars[stage.id] < stars) this.data.stars[stage.id] = stars;
    this.save();
    return [];
  }
  recordResult(won, kills, race, draw = false) {
    const s = this.data.stats;
    s.played++; if (won) { s.wins++; s.raceWins[race] = (s.raceWins[race] || 0) + 1; } else if (draw) s.draws = (s.draws || 0) + 1; else s.losses++; s.kills += kills;
    this.save();
  }
}
