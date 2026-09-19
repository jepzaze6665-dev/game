# Bannerfall: Four Realms

An original browser real-time lane strategy game with four distinct armies, procedural pixel art and large ThreeJS battles.

## Run
```
node tools/serve.mjs 8765
# open http://localhost:8765/index.html
```
No build step. `vendor/three.module.js` + `vendor/three.core.js` are the only dependency (copied from `node_modules/three/build`).

## Structure
- `src/data/` — unit roster, economy, lane geometry, campaign stages (pure data); `balance.js` tier curve + race power, `tuning.js` per-unit overrides
- `src/art/` — procedural pixel-art: unit rig, effects, bases (`PixelBuffer` software canvas)
- `src/sim/` — battle simulation: units, AI, combat, projectiles, spatial grid, enemy commander
- `src/render/` — ThreeJS pixel renderer: atlas, instanced sprite batch, terrain, effects, weather
- `src/ui/` — HUD and menu screens (HTML/CSS pixel UI kit in `css/style.css`)
- `src/audio/` — WebAudio chiptune synth (sfx + music sequencer)
- `src/core/Game.js` — orchestrator / state machine; `src/main.js` — entry
- `src/meta/Progression.js` — localStorage save (campaign, unlocks, settings)

## Tools
- `tools/simulate.mjs N raceA raceB diffA diffB` — headless AI-vs-AI balance runs
- `tools/pair.mjs raceA raceB [games] [difficulty]` — one seeded matchup; `VERBOSE=1` breaks down how games end, `MUTATE=file.mjs` patches data before the run
- `npm test` — simulation and data regression tests
- `npm run test:browser` — real browser interaction and mobile layout checks (start the server first)
- `npm run test:balance` — seeded full race matrix
- `tools/trace.mjs` — trace one match; `tools/perf.mjs` — sim tick cost
- `tools/atlas.html?s=6&f=_0_` — inspect generated sprite atlas
- `tools/mobile.html` — phone/tablet viewport harness
- `progress/index.html` — live development progress page

## Debug
Add `?bg=1` to keep the simulation running when the tab is hidden. `window.GAME` exposes `startBattle`, `deploy`, `autoplay`, `menus`, `speed`.
