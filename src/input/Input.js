// PlayerController: keyboard shortcuts. Pointer input lives on the HUD cards.
import { UNITS } from '../data/units.js';

export class Input {
  constructor(game) {
    this.game = game;
    window.addEventListener('keydown', (e) => this.onKey(e));
  }
  onKey(e) {
    const g = this.game;
    if (e.repeat) return;
    const k = e.key;
    if (g.state === 'battle' && g.battle) {
      const id = g.battle.roster[0].find((uid) => UNITS[uid].hotkey === k);
      if (id) { g.deploy(id); e.preventDefault(); return; }
      if (k === 'Escape' || k === 'p' || k === 'P') { if (g.paused) g.resume(); else g.pause(); e.preventDefault(); return; }
      if (k === 'f' || k === 'F' || k === 'Tab') { g.toggleSpeed(); e.preventDefault(); return; }
      if (k === 'm' || k === 'M') { g.toggleSound(); return; }
    }
  }
}
