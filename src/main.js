import { Game } from './core/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  const ui = document.getElementById('ui');
  try {
    window.GAME = new Game(canvas, ui);
  } catch (err) {
    console.error(err);
    ui.innerHTML = `<div class="screen dim"><div class="panel"><h2>Failed to start</h2><p>${err.message}</p></div></div>`;
  }
});
