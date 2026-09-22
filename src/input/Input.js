// PlayerController: keyboard shortcuts. Pointer input lives on the HUD cards.
import { UNITS } from '../data/units.js';

function g_state(game) { return game.state; }

export class Input {
  constructor(game) {
    this.game = game;
    window.addEventListener('keydown', (e) => this.onKey(e));
    // battlefield scrolling: drag, wheel, arrow keys; the camera follows the fight again after a pause
    const canvas = game.renderer.canvas;
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, moved: false }; });
    window.addEventListener('pointermove', (e) => {
      if (!drag || g_state(game) !== 'battle') return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 6) return;
      drag.moved = true; drag.x = e.clientX;
      game.renderer.scrollBy(-dx / (game.renderer.ppu * game.renderer.scale));
    });
    window.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('wheel', (e) => { if (g_state(game) === 'battle') { game.renderer.scrollBy((e.deltaY + e.deltaX) * 0.02); e.preventDefault(); } }, { passive: false });
  }
  onKey(e) {
    const g = this.game;
    const k = e.key;
    if (g.state === 'battle' && g.battle) {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { g.renderer.scrollBy(-3); e.preventDefault(); return; }
      if (k === 'ArrowRight' || k === 'd' || k === 'D') { g.renderer.scrollBy(3); e.preventDefault(); return; }
      if (k === ' ') { g.renderer.recenter(); e.preventDefault(); return; }
    }
    if (e.repeat) return;
    if (g.state === 'battle' && g.battle) {
      const id = g.battle.roster[0].find((uid) => UNITS[uid].hotkey === k);
      if (id) { g.deploy(id); e.preventDefault(); return; }
      if (k === 'Escape' || k === 'p' || k === 'P') { if (g.paused) g.resume(); else g.pause(); e.preventDefault(); return; }
      if (k === 'f' || k === 'F' || k === 'Tab') { g.toggleSpeed(); e.preventDefault(); return; }
      if (k === 'm' || k === 'M') { g.toggleSound(); return; }
    }
  }
}
