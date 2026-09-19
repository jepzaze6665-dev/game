// Game orchestrator: screens, battle lifecycle, event routing between the
// simulation, renderer, effects, audio and UI.
import { Battle } from '../sim/Battle.js';
import { EnemyAI, DIFFICULTIES } from '../sim/EnemyAI.js';
import { Renderer } from '../render/Renderer.js';
import { Effects } from '../render/Effects.js';
import { Ground, THEMES } from '../render/Ground.js';
import { Audio } from '../audio/Audio.js';
import { HUD } from '../ui/HUD.js';
import { Menus } from '../ui/Menus.js';
import { Input } from '../input/Input.js';
import { Progression } from '../meta/Progression.js';
import { STAGES } from '../data/stages.js';
import { UNITS, RACE_UNITS, RACES, RACE_ORDER, TEAM } from '../data/units.js';
import { counterMultiplier } from '../sim/Combat.js';

export class Game {
  constructor(canvas, uiRoot) {
    this.prog = new Progression();
    this.settings = this.prog.settings;
    this.renderer = new Renderer(canvas);
    this.effects = new Effects(this.settings);
    this.audio = new Audio(this.settings);
    this.hud = new HUD(uiRoot, this.renderer.atlas, {
      deploy: (id) => this.deploy(id),
      lookAt: (x) => this.renderer.lookAt(x),
      pause: () => this.pause(),
      toggleSpeed: () => this.toggleSpeed(),
      toggleSound: () => this.toggleSound(),
    });
    this.hud.cam = () => ({ x: this.renderer.camX, halfW: this.renderer.worldWidth / 2 });
    this.menus = new Menus(uiRoot, this.renderer.atlas, this.prog, {
      click: () => this.audio.play('click'),
      startCampaign: (stage) => this.pickRaceThen({ stage }),
      startSkirmish: (cfg) => this.pickRaceThen(cfg),
      resume: () => this.resume(),
      restart: () => this.restart(),
      quit: () => this.quitToMenu(),
      nextStage: () => this.nextStage(),
      changeRace: () => this.pickRaceThen(this.config),
      currentRace: () => (this.config && this.config.race) || this.prog.data.lastRace,
      settingsChanged: () => this.applySettings(),
      themePreview: (theme) => this.themePreview(theme),
      reveal: () => this.audio.play('unlock'),
    });
    this.input = new Input(this);
    this.state = 'title';
    this.battle = null;
    this.ai = null;
    this.demoAI = null;
    this.speed = 1;
    this.paused = false;
    this.last = performance.now();
    this.config = null;
    this.ending = 0;
    this.renderer.onFire = (x, y) => this.effects.spawn({ x, y, z: 0.2, vz: 1.5, vx: (Math.random() - 0.5) * 0.5, g: 0, life: 0.5, frames: ['dust0', 'dust1'], tint: [1, 0.55, 0.2], scale: 0.8 });
    this.renderer.onDust = (x, y, sc) => this.effects.spawn({ x, y, z: 0, vz: 0.5, vx: (Math.random() - 0.5) * 0.6, g: 0, life: 0.5, frames: ['dust0', 'dust1', 'dust2'], scale: sc, fade: true });
    this.renderer.onRage = (x, y) => this.effects.spawn({ x, y, z: 0, vz: 1.4, vx: (Math.random() - 0.5) * 0.6, g: 0, life: 0.4, frame: 'dot', tint: [1, 0.35, 0.2], fade: true });
    this.renderer.onTrail = (kind, x, y) => this.effects.trail(kind, x, y);
    this.renderer.onAmbient = (kind, x, y) => {
      if (kind === 'smoke') this.effects.spawn({ x, y, z: 0, vz: 1.2, vx: 0.3 + Math.random() * 0.3, g: 0, life: 1.8, frames: ['smoke0', 'smoke1', 'smoke2'], tint: [1.6, 1.6, 1.7], scale: 0.8, fade: true });
      else if (kind === 'sand') this.effects.spawn({ x, y, z: 0, vz: 0.6, vx: (Math.random() - 0.5) * 1.5, g: 0, life: 1.2, frame: 'dot', tint: [0.95, 0.85, 0.55], fade: true });
      else this.effects.spawn({ x, y, z: 0, vz: 1.5 + Math.random(), vx: (Math.random() - 0.5) * 0.8, g: 0, life: 1.2, frame: 'dot', tint: [1, 0.5 + Math.random() * 0.3, 0.15], fade: true });
    };
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
    this.unlockAudio = () => { this.audio.unlock(); this.audio.applySettings(); if (this.state === 'title' || this.state === 'menu') this.audio.startMusic('menu'); };
    window.addEventListener('pointerdown', this.unlockAudio, { passive: true });
    window.addEventListener('keydown', this.unlockAudio);
    this.showTitle();
    this.rafPending = false;
    this.lastFrame = performance.now();
    this.scheduleFrame();
    this.background = new URLSearchParams(location.search).has('bg');
    setInterval(() => { const now = performance.now(); if (now - this.lastFrame > 120) this.loop(now, true); }, 50);
    document.addEventListener('visibilitychange', () => { if (document.hidden && !this.background) this.pause(); });
  }

  scheduleFrame() {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame((t) => { this.rafPending = false; this.loop(t); });
  }

  onResize() {
    const z = Math.max(0.8, Math.min(1.6, Math.min(window.innerWidth / 1400, window.innerHeight / 800)));
    this.uiScale = z;
    this.hud.zoom = z;
    document.getElementById('ui').style.zoom = z;
    const cs = getComputedStyle(document.documentElement);
    const top = (parseFloat(cs.getPropertyValue('--hud-top')) || 90) * z;
    const bottom = (parseFloat(cs.getPropertyValue('--hud-bottom')) || 120) * z;
    const inBattle = this.state === 'battle' || this.state === 'results';
    this.renderer.setInsets(inBattle ? top : 0, inBattle ? bottom : 0);
  }

  applySettings() { this.audio.applySettings(); this.hud.setSound(this.settings.sfx > 0); }

  // ---------- title / demo ----------
  showTitle() {
    this.state = 'title';
    this.hud.hide();
    this.menus.title();
    this.startDemo();
    this.onResize();
    if (this.audio.unlocked) this.audio.startMusic('menu');
  }

  startDemo() {
    const themes = Object.keys(THEMES);
    const pick = () => RACE_ORDER[Math.floor(Math.random() * RACE_ORDER.length)];
    this.renderer.setTheme(themes[Math.floor(Math.random() * themes.length)], Math.floor(Math.random() * 1000));
    this.battle = new Battle({ playerRace: pick(), enemyRace: pick() });
    this.battle.gold = [400, 400];
    this.ai = new EnemyAI(this.battle, 'normal', null, TEAM.ENEMY);
    this.demoAI = new EnemyAI(this.battle, 'normal', null, TEAM.PLAYER);
    this.demo = true;
    this.effects.clear();
  }

  themePreview(theme) {
    const g = new Ground(4);
    g.generate(theme, 3);
    g.canvas.style.width = '100%'; g.canvas.style.height = '100%';
    return g.canvas;
  }

  // ---------- battle lifecycle ----------
  pickRaceThen(cfg) {
    const enemyRace = cfg.stage ? cfg.stage.enemyRace : (cfg.enemyRace === 'random' || !cfg.enemyRace ? null : cfg.enemyRace);
    this.menus.raceSelect({
      mode: 'pick', enemyRace,
      onBack: () => cfg.stage ? this.menus.campaign() : this.menus.skirmishMenu(),
      onPick: (race) => {
        this.prog.data.lastRace = race; this.prog.save();
        const c = { ...cfg, race };
        if (!this.prog.data.seenHowto) this.menus.howto(() => { this.prog.data.seenHowto = true; this.prog.save(); this.startBattle(c); });
        else this.startBattle(c);
      },
    });
  }

  startBattle(cfg) {
    this.config = cfg;
    const stage = cfg.stage;
    const difficulty = stage ? stage.difficulty : cfg.difficulty;
    const theme = THEMES[stage ? stage.theme : cfg.theme] ? (stage ? stage.theme : cfg.theme) : 'meadow';
    const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
    const race = cfg.race || this.prog.data.lastRace || 'human';
    let enemyRace = stage ? stage.enemyRace : cfg.enemyRace;
    if (!enemyRace || enemyRace === 'random') enemyRace = RACE_ORDER[Math.floor(Math.random() * RACE_ORDER.length)];
    cfg.resolvedEnemyRace = enemyRace;
    const playerRoster = RACE_UNITS[race];
    const enemyRoster = stage ? RACE_UNITS[enemyRace].slice(0, stage.enemyTiers) : RACE_UNITS[enemyRace];
    this.renderer.setTheme(theme, stage ? stage.id * 13 : Math.floor(Math.random() * 1000));
    this.battle = new Battle({ playerRace: race, enemyRace, playerRoster, enemyRoster, enemyDamageScale: diff.damageScale, enemyIncomeScale: diff.incomeScale });
    this.ai = new EnemyAI(this.battle, difficulty, null, TEAM.ENEMY);
    this.demoAI = null; this.demo = false; this.autoAI = null;
    this.effects.clear();
    this.hud.setRoster(playerRoster, race, enemyRace);
    this.hud.clearBanner(); this.hud.hideHint();
    this.speed = 1; this.hud.setSpeed(1); this.hud.setSound(this.settings.sfx > 0);
    this.paused = false;
    this.state = 'battle';
    this.phase = 'intro';
    this.ending = 0; this.endBanner = false;
    this.hud.show();
    this.onResize();
    this.audio.stopMusic();
    const name = stage ? stage.name : `${diff.name} Skirmish`;
    const sub = stage ? `STAGE ${stage.id} · ${THEMES[theme].name}` : THEMES[theme].name;
    this.menus.intro(name, stage ? stage.tip : RACES[enemyRace].identity, sub, [race, enemyRace]);
    this.introT = 0;
    this.countShown = 3;
    this.audio.play('countdown');
  }

  beginFight() {
    this.phase = 'fight';
    this.menus.close();
    this.hud.showBanner('FIGHT!', 'gold', '', 900);
    this.audio.play('go');
    this.audio.startMusic('battle');
    if (!this.prog.data.seenTutorial) {
      this.hud.showHint('CLICK A UNIT CARD (OR PRESS ITS KEY) TO DEPLOY A SQUAD');
      this.tutorialPending = true;
    }
  }

  autoplay(difficulty = 'normal', personality = null) {
    this.autoAI = this.battle ? new EnemyAI(this.battle, difficulty, personality, TEAM.PLAYER) : null;
  }

  deploy(id) {
    if (this.state !== 'battle' || this.phase !== 'fight' || this.paused) return;
    const reason = this.battle.spawnSquad(TEAM.PLAYER, id);
    this.hud.deployFeedback(id, reason);
    if (!reason) {
      this.audio.play(UNITS[id].tier >= 11 ? 'unlock' : 'deploy');
      const d = UNITS[id];
      this.effects.number(`${d.name.toUpperCase()} X${d.squad}`, -19 + 1.5, 4.2, { tint: [0.6, 0.8, 1], scale: 1, life: 1.1, force: true });
      if (this.tutorialPending) { this.tutorialPending = false; this.hud.hideHint(); this.prog.data.seenTutorial = true; this.prog.save(); }
    } else if (reason !== 'cooldown') this.audio.play('error');
  }

  toggleSpeed() { this.speed = this.speed === 1 ? 2 : 1; this.hud.setSpeed(this.speed); this.audio.play('click'); }
  toggleSound() {
    this.settings.sfx = this.settings.sfx > 0 ? 0 : 0.8;
    this.settings.music = this.settings.sfx > 0 ? (this.settings.music || 0.5) : 0;
    this.prog.save(); this.applySettings();
    if (this.settings.music <= 0) this.audio.stopMusic(); else if (this.state === 'battle') this.audio.startMusic('battle');
  }

  pause() {
    if (this.state !== 'battle' || this.phase !== 'fight' || this.paused) return;
    this.paused = true;
    this.menus.pause();
    this.audio.play('click');
  }
  resume() { if (!this.paused) return; this.paused = false; this.menus.close(); }
  restart() { this.menus.close(); this.startBattle(this.config); }
  quitToMenu() { this.menus.close(); this.showTitle(); }
  nextStage() {
    const idx = STAGES.indexOf(this.config.stage);
    const next = STAGES[idx + 1];
    if (next) this.pickRaceThen({ stage: next }); else this.quitToMenu();
  }

  finishBattle() {
    const b = this.battle;
    const won = b.result.winner === TEAM.PLAYER;
    const draw = b.result.winner === null;
    const st = b.stats[0];
    const hpPct = b.bases[0].hp / b.bases[0].maxHp;
    const stars = won ? (hpPct > 0.7 ? 3 : hpPct > 0.35 ? 2 : 1) : 0;
    let mvpId = null, mvpN = 0;
    for (const id in st.squads) if (st.squads[id] > mvpN) { mvpN = st.squads[id]; mvpId = id; }
    let next = false;
    if (this.config.stage && won) { this.prog.completeStage(this.config.stage, stars); next = STAGES.indexOf(this.config.stage) < STAGES.length - 1; }
    this.prog.recordResult(won, st.kills, b.races[0], draw);
    let hintText = null;
    if (!won) {
      const comp = b.composition(TEAM.ENEMY);
      let dom = null, n = 0; for (const id in comp) if (comp[id] * UNITS[id].cost / UNITS[id].squad > n) { n = comp[id] * UNITS[id].cost / UNITS[id].squad; dom = id; }
      if (dom) {
        const victim = { type: UNITS[dom] };
        const counters = b.roster[0].filter((id) => counterMultiplier(UNITS[id], victim) > 1.2).map((id) => UNITS[id].name);
        const minutes = b.result.time / 60;
        hintText = `${RACES[b.races[1]].name} ${UNITS[dom].name}s did the damage${minutes < 1.5 ? ' before you had an army' : ''}.` + (counters.length ? ` Your ${counters.slice(0, 3).join(', ')} counter them.` : ' Try magic or armour-piercing units.');
      }
    }
    this.state = 'results';
    if (b.result.reason === 'time') hintText = draw ? 'Time limit reached. Equal base health and equal armies: a draw. Try more siege pressure.' : b.result.tiebreak ? 'Time limit reached with equal base health. The stronger surviving army wins.' : 'Time limit reached. The healthier base wins.';
    this.hud.hide();
    this.menus.results({ won, draw, stars, time: b.result.time, kills: st.kills, lost: st.lost, spent: st.spent, deployed: st.deployed, favourite: mvpId ? UNITS[mvpId].name : null, mvpId, mvpN, next, hintText, race: b.races[0], enemyRace: b.races[1] });
  }

  // ---------- event routing ----------
  handleEvents() {
    const evs = this.battle.events;
    for (const ev of evs) {
      this.effects.handle(ev);
      if (this.demo) continue;
      switch (ev.type) {
        case 'overtime': this.hud.showBanner('OVERTIME', 'warn', `${ev.mult}x income · siege damage rising`, 2200); break;
        case 'siege': this.hud.showBanner('GATES ARE CRUMBLING', 'warn', 'Both bases lose health. Land the finishing blow!', 3000); break;
        case 'spawn': this.audio.play('spawn'); break;
        case 'wave': if (ev.team === TEAM.PLAYER && ev.count) this.hud.showBanner('WAVE ' + ev.wave, 'gold', ev.count + ' units march', 900); break;
        case 'melee': this.audio.play(ev.base ? 'hit' : 'sword', { volume: ev.base ? 0.8 : 0.6 }); break;
        case 'hit': if (ev.counter) this.audio.play('counter', { volume: 0.5 }); if (ev.charge) this.audio.play('charge'); this.audio.play('hit', { volume: 0.5 }); break;
        case 'death': this.audio.play(ev.big ? 'bigDeath' : 'death', { volume: 0.6 }); break;
        case 'shoot': this.audio.play(ev.kind === 'fireball' || ev.kind === 'hellfire' || ev.kind === 'sandstorm' ? 'fireball' : ev.kind === 'shell' ? 'slam' : ev.kind === 'rail' || ev.kind === 'zap' ? 'zap' : 'arrow', { volume: 0.5 }); break;
        case 'explode': this.audio.play('explode'); break;
        case 'slam': this.audio.play('slam'); break;
        case 'flame': this.audio.play('fireball', { volume: 0.4 }); break;
        case 'beam': case 'orbital': this.audio.play('laser'); break;
        case 'chain': this.audio.play('zap'); break;
        case 'nova': this.audio.play('explode'); this.hud.showBanner('INFERNO NOVA!', 'warn', '', 1200); break;
        case 'raise': case 'revive': this.audio.play('revive'); break;
        case 'miss': this.audio.play('arrowHit', { volume: 0.25 }); break;
        case 'baseHit': this.audio.play('baseHit', { volume: ev.heavy ? 1 : 0.7 }); this.hud.baseHitFeedback(ev.team); break;
        case 'baseDestroyed': this.audio.play('baseDestroyed'); this.audio.stopMusic(); this.hud.flash.classList.remove('go'); void this.hud.flash.offsetWidth; this.hud.flash.classList.add('go'); break;
        case 'deploy': if (ev.team === TEAM.ENEMY && ev.tier >= 11) { const d = UNITS[ev.id]; this.hud.showBanner(`ENEMY ${d.name.toUpperCase()}!`, 'warn', d.weakAgainst.length ? 'Weak vs ' + d.weakAgainst.join(', ') : '', 2000); this.audio.play('warn'); } break;
      }
    }
    evs.length = 0;
  }

  // ---------- main loop ----------
  loop(now, fromWatchdog = false) {
    if (!fromWatchdog) this.scheduleFrame();
    this.lastFrame = now;
    const dt = Math.max(0, Math.min(fromWatchdog ? (this.background ? 1.0 : 0.25) : 0.1, (now - this.last) / 1000));
    this.last = now;
    if (this.state === 'title' || this.state === 'menu') {
      if (this.battle) {
        this.battle.update(dt);
        this.ai.update(dt); this.demoAI.update(dt);
        if (this.battle.result) this.startDemo();
        this.handleEvents();
      }
      this.effects.update(dt);
      this.renderer.render(this.battle, this.effects, dt, { showFrontline: false });
      return;
    }
    if (this.state === 'battle') {
      if (this.phase === 'intro') {
        this.introT += dt;
        const left = 3 - Math.floor(this.introT);
        if (left !== this.countShown && left > 0) { this.countShown = left; this.menus.setCount(String(left)); this.audio.play('countdown'); }
        if (this.introT >= 3) this.beginFight();
        this.effects.update(dt);
        this.renderer.render(this.battle, this.effects, dt);
        this.hud.update(this.battle, dt);
        return;
      }
      if (!this.paused) {
        const slow = this.battle.result && this.ending < 1.4 ? 0.25 : 1;
        const sdt = dt * this.speed * slow;
        this.battle.update(sdt);
        this.ai.update(sdt);
        if (this.autoAI && this.autoAI.battle === this.battle) this.autoAI.update(sdt);
        this.handleEvents();
        this.effects.update(sdt);
        this.hud.update(this.battle, dt);
        if (this.battle.result) {
          this.ending += dt;
          if (this.ending > 0.05 && !this.endBanner) {
            this.endBanner = true;
            const won = this.battle.result.winner === TEAM.PLAYER;
            const timed = this.battle.result.reason === 'time';
            this.hud.showBanner(timed ? 'TIME LIMIT' : won ? 'ENEMY BASE DESTROYED!' : 'YOUR BASE HAS FALLEN!', won ? 'gold big' : 'warn big', timed ? (this.battle.result.tiebreak ? 'Equal base health · Stronger army wins' : 'Healthier base wins') : '', 3000);
            setTimeout(() => this.audio.play(won ? 'victory' : 'defeat'), 900);
          }
          if (this.ending > 3.2) { this.endBanner = false; this.finishBattle(); }
        }
      }
      this.renderer.render(this.battle, this.effects, dt);
      return;
    }
    if (this.state === 'results') {
      this.battle.update(dt * 0.4);
      this.handleEvents();
      this.fireworkT = (this.fireworkT || 0) - dt;
      if (this.fireworkT <= 0 && this.battle.result.winner !== null) {
        this.fireworkT = 0.35 + Math.random() * 0.5;
        const base = this.battle.bases[this.battle.result.winner];
        this.effects.firework(base.x + (Math.random() - 0.5) * 8, 4 + Math.random() * 4);
        if (this.battle.result.winner === TEAM.PLAYER) this.audio.play('coin', { volume: 0.3 });
      }
      this.effects.update(dt);
      this.renderer.render(this.battle, this.effects, dt);
    }
  }
}
