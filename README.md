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
- `src/ui/` — HUD and menu screens (ornate pixel UI kit: `assets/ui/` 9-slices + `css/style.css`)
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
- `tools/uikit.py` — paints the pixel UI kit (9-slice frames, buttons, chips, crests, ornaments) into `assets/ui/`; `css/style.css` scales it 2x with `border-image`
- `tools/sheetslice.py <sheet> <unitId> --target 52 --bands "idle:6,walk:7,..."` — cuts an AI-generated animation sheet (`docs/human/`, `docs/Demon/`) into `assets/units/<race>/<id>.sheet.png` + `.anim.json`; run without `--bands` to see the rows it found, `--cols x` for two-column sheets whose rows do not line up, `skip:N` for frames the game cannot use
- `tools/screens.mjs` — captures every screen into `docs/screens/` for the screen bible (start the server on 8766 first)
- `tools/atlas.html?s=6&f=_0_` — inspect generated sprite atlas
- `tools/mobile.html` — phone/tablet viewport harness
- `progress/index.html` — live development progress page
- `docs/graphic-bible.html` — art, animation and UI standard, rendered live from the game code (palettes, every sprite, HUD kit, crowd tests)
- `docs/screen-bible.html` — every character portrait (live) and every screen of the game (captures in `docs/screens/`), plus the art-v2 coverage table

## Battle rules (current)
Units bought during a wave muster at the gate and march together every 10 s (both sides). Bases sit 84 units apart (about 1.5 screens; the camera follows the front line - drag, wheel, A/D, Space to re-follow, minimap click). Siege damage rises at 6:00, both gates crumble from 12:00, 20-minute cap.

## Debug
Add `?bg=1` to keep the simulation running when the tab is hidden. `window.GAME` exposes `startBattle`, `deploy`, `autoplay`, `menus`, `speed`.
