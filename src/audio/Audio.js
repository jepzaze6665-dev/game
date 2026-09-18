// Procedural chiptune audio: every sound is synthesised with WebAudio so the
// game needs no asset downloads. Sounds are rate limited so massive battles
// stay punchy instead of turning into noise.
export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.last = {};
    this.music = null;
    this.noiseBuf = null;
    this.unlocked = false;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.master);
    this.applySettings();
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.unlocked = true;
  }

  applySettings() {
    if (!this.ctx) return;
    this.sfxGain.gain.value = this.settings.sfx;
    this.musicGain.gain.value = this.settings.music * 0.55;
  }

  now() { return this.ctx.currentTime; }

  tone({ type = 'square', f = 440, f2 = null, t = 0.1, a = 0.005, d = null, g = 0.3, delay = 0, curve = 'exp' }) {
    const c = this.ctx, o = c.createOscillator(), gn = c.createGain();
    const t0 = this.now() + delay;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2 != null) { if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t); else o.frequency.linearRampToValueAtTime(f2, t0 + t); }
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(g, t0 + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + (d || t));
    o.connect(gn); gn.connect(this.sfxGain);
    o.start(t0); o.stop(t0 + (d || t) + 0.02);
  }

  noise({ t = 0.1, g = 0.3, hp = 200, lp = 8000, lp2 = null, delay = 0, a = 0.002 }) {
    const c = this.ctx, s = c.createBufferSource(), gn = c.createGain(), hpf = c.createBiquadFilter(), lpf = c.createBiquadFilter();
    s.buffer = this.noiseBuf;
    const t0 = this.now() + delay;
    hpf.type = 'highpass'; hpf.frequency.value = hp;
    lpf.type = 'lowpass'; lpf.frequency.setValueAtTime(lp, t0);
    if (lp2 != null) lpf.frequency.exponentialRampToValueAtTime(Math.max(40, lp2), t0 + t);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(g, t0 + a); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    s.connect(hpf); hpf.connect(lpf); lpf.connect(gn); gn.connect(this.sfxGain);
    s.start(t0, Math.random() * 0.8); s.stop(t0 + t + 0.02);
  }

  play(name, opts = {}) {
    if (!this.ctx || this.settings.sfx <= 0) return;
    const lim = LIMITS[name] || 0.04;
    const t = performance.now();
    if (this.last[name] && t - this.last[name] < lim * 1000) return;
    this.last[name] = t;
    const v = opts.volume != null ? opts.volume : 1;
    const fn = SOUNDS[name];
    if (fn) fn(this, v, opts);
  }

  // ---- music: a tiny looping sequencer ----
  startMusic(kind = 'battle') {
    if (!this.ctx) return;
    if (this.music && this.music.kind === kind) return;
    this.stopMusic();
    const song = SONGS[kind];
    const state = { kind, step: 0, timer: null, nextTime: this.now() + 0.05 };
    const stepDur = 60 / song.bpm / 4;
    const schedule = () => {
      if (!this.music || this.music !== state) return;
      while (state.nextTime < this.now() + 0.25) {
        const i = state.step % song.length;
        const bass = song.bass[i % song.bass.length];
        const lead = song.lead[i % song.lead.length];
        const t0 = state.nextTime;
        if (bass) this.mtone('triangle', bass, t0, stepDur * 0.9, 0.22);
        if (lead) this.mtone(song.leadType || 'square', lead, t0, stepDur * 0.6, 0.07);
        if (song.perc && song.perc[i % song.perc.length]) this.mnoise(t0, song.perc[i % song.perc.length] === 2 ? 0.08 : 0.03, song.perc[i % song.perc.length] === 2 ? 0.12 : 0.05);
        state.nextTime += stepDur;
        state.step++;
      }
      state.timer = setTimeout(schedule, 100);
    };
    this.music = state;
    schedule();
  }
  stopMusic() { if (this.music) { clearTimeout(this.music.timer); this.music = null; } }
  mtone(type, f, t0, dur, g) {
    const c = this.ctx, o = c.createOscillator(), gn = c.createGain();
    o.type = type; o.frequency.value = f;
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(g, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn); gn.connect(this.musicGain); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  mnoise(t0, dur, g) {
    const c = this.ctx, s = c.createBufferSource(), gn = c.createGain(), f = c.createBiquadFilter();
    s.buffer = this.noiseBuf; f.type = 'bandpass'; f.frequency.value = dur > 0.06 ? 900 : 5000;
    gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(gn); gn.connect(this.musicGain); s.start(t0, Math.random()); s.stop(t0 + dur + 0.02);
  }
}

const LIMITS = { laser: 0.08, zap: 0.06, revive: 0.2, sword: 0.05, hit: 0.05, arrow: 0.06, arrowHit: 0.05, death: 0.07, fireball: 0.1, explode: 0.12, slam: 0.15, baseHit: 0.12, deploy: 0.08, counter: 0.1, click: 0.03, spawn: 0.05, coin: 0.1 };

const N = (n) => 440 * Math.pow(2, (n - 69) / 12);

const SOUNDS = {
  click: (a, v) => a.tone({ type: 'square', f: 880, f2: 1200, t: 0.05, g: 0.12 * v }),
  hover: (a, v) => a.tone({ type: 'square', f: 600, t: 0.03, g: 0.05 * v }),
  error: (a, v) => { a.tone({ type: 'square', f: 180, f2: 120, t: 0.16, g: 0.16 * v }); a.tone({ type: 'square', f: 140, f2: 100, t: 0.16, g: 0.1 * v, delay: 0.08 }); },
  deploy: (a, v) => { a.tone({ type: 'square', f: N(72), t: 0.06, g: 0.14 * v }); a.tone({ type: 'square', f: N(79), t: 0.08, g: 0.14 * v, delay: 0.05 }); a.noise({ t: 0.08, g: 0.08 * v, hp: 1500 }); },
  spawn: (a, v) => a.noise({ t: 0.06, g: 0.05 * v, hp: 800, lp: 3000 }),
  sword: (a, v) => { a.noise({ t: 0.07, g: 0.22 * v, hp: 2500, lp: 9000, lp2: 2000 }); a.tone({ type: 'square', f: 220, f2: 90, t: 0.06, g: 0.12 * v }); },
  hit: (a, v) => { a.noise({ t: 0.05, g: 0.16 * v, hp: 600, lp: 3000 }); a.tone({ type: 'triangle', f: 160, f2: 60, t: 0.08, g: 0.2 * v }); },
  arrow: (a, v) => a.noise({ t: 0.12, g: 0.1 * v, hp: 3000, lp: 9000, lp2: 3000 }),
  arrowHit: (a, v) => { a.tone({ type: 'square', f: 900, f2: 300, t: 0.04, g: 0.1 * v }); a.noise({ t: 0.03, g: 0.08 * v, hp: 2000 }); },
  fireball: (a, v) => { a.noise({ t: 0.3, g: 0.12 * v, hp: 300, lp: 800, lp2: 4000 }); a.tone({ type: 'sawtooth', f: 200, f2: 500, t: 0.25, g: 0.05 * v }); },
  explode: (a, v) => { a.noise({ t: 0.35, g: 0.35 * v, hp: 60, lp: 5000, lp2: 300 }); a.tone({ type: 'sine', f: 120, f2: 40, t: 0.3, g: 0.35 * v }); },
  slam: (a, v) => { a.tone({ type: 'sine', f: 90, f2: 30, t: 0.3, g: 0.45 * v }); a.noise({ t: 0.25, g: 0.25 * v, hp: 80, lp: 1500, lp2: 200 }); },
  death: (a, v) => { a.tone({ type: 'square', f: 500, f2: 150, t: 0.14, g: 0.1 * v }); a.noise({ t: 0.08, g: 0.05 * v, hp: 1000 }); },
  bigDeath: (a, v) => { a.tone({ type: 'sawtooth', f: 200, f2: 40, t: 0.5, g: 0.25 * v }); a.noise({ t: 0.4, g: 0.25 * v, hp: 60, lp: 3000, lp2: 200 }); },
  counter: (a, v) => { a.tone({ type: 'square', f: N(84), t: 0.06, g: 0.08 * v }); a.tone({ type: 'square', f: N(91), t: 0.1, g: 0.08 * v, delay: 0.04 }); },
  charge: (a, v) => { a.tone({ type: 'sawtooth', f: 150, f2: 450, t: 0.18, g: 0.12 * v }); a.noise({ t: 0.15, g: 0.12 * v, hp: 400, lp: 2500 }); },
  baseHit: (a, v) => { a.tone({ type: 'sine', f: 70, f2: 35, t: 0.35, g: 0.5 * v }); a.noise({ t: 0.3, g: 0.3 * v, hp: 100, lp: 2500, lp2: 200 }); a.tone({ type: 'square', f: 300, f2: 120, t: 0.1, g: 0.08 * v }); },
  baseDestroyed: (a, v) => { for (let i = 0; i < 6; i++) { a.noise({ t: 0.5, g: 0.35 * v, hp: 50, lp: 4000, lp2: 150, delay: i * 0.22 }); a.tone({ type: 'sine', f: 90, f2: 25, t: 0.5, g: 0.45 * v, delay: i * 0.22 }); } },
  coin: (a, v) => { a.tone({ type: 'square', f: N(88), t: 0.05, g: 0.08 * v }); a.tone({ type: 'square', f: N(95), t: 0.12, g: 0.08 * v, delay: 0.05 }); },
  unlock: (a, v) => [72, 76, 79, 84].forEach((n, i) => a.tone({ type: 'square', f: N(n), t: 0.16, g: 0.12 * v, delay: i * 0.09 })),
  victory: (a, v) => { [67, 72, 76, 79, 84, 79, 84, 91].forEach((n, i) => a.tone({ type: 'square', f: N(n), t: i === 7 ? 0.7 : 0.16, g: 0.16 * v, delay: i * 0.12 })); [43, 43, 48, 48, 43, 43, 48, 48].forEach((n, i) => a.tone({ type: 'triangle', f: N(n), t: 0.14, g: 0.2 * v, delay: i * 0.12 })); },
  defeat: (a, v) => { [64, 63, 62, 59, 55].forEach((n, i) => a.tone({ type: 'square', f: N(n), t: i === 4 ? 0.9 : 0.25, g: 0.14 * v, delay: i * 0.22 })); a.tone({ type: 'triangle', f: N(40), t: 1.4, g: 0.2 * v, delay: 0.88 }); },
  warn: (a, v) => { a.tone({ type: 'square', f: 660, t: 0.08, g: 0.1 * v }); a.tone({ type: 'square', f: 660, t: 0.08, g: 0.1 * v, delay: 0.14 }); },
  countdown: (a, v) => a.tone({ type: 'square', f: N(76), t: 0.12, g: 0.12 * v }),
  laser: (a, v) => { a.tone({ type: 'sawtooth', f: 1200, f2: 300, t: 0.18, g: 0.12 * v }); a.noise({ t: 0.12, g: 0.06 * v, hp: 3000 }); },
  zap: (a, v) => { a.tone({ type: 'square', f: 2000, f2: 400, t: 0.08, g: 0.1 * v }); a.noise({ t: 0.06, g: 0.08 * v, hp: 4000 }); },
  revive: (a, v) => [64, 68, 71, 76].forEach((n, i) => a.tone({ type: 'triangle', f: N(n), t: 0.14, g: 0.12 * v, delay: i * 0.06 })),
  go: (a, v) => a.tone({ type: 'square', f: N(88), t: 0.4, g: 0.14 * v }),
};

const SONGS = {
  battle: {
    bpm: 132, length: 64,
    bass: [N(40), 0, N(40), N(40), 0, N(40), N(47), 0, N(40), 0, N(40), N(40), 0, N(43), N(45), N(47),
           N(38), 0, N(38), N(38), 0, N(38), N(45), 0, N(38), 0, N(38), N(38), 0, N(41), N(43), N(45),
           N(36), 0, N(36), N(36), 0, N(36), N(43), 0, N(36), 0, N(36), N(36), 0, N(39), N(41), N(43),
           N(43), 0, N(43), N(43), 0, N(43), N(50), 0, N(43), 0, N(43), N(43), 0, N(46), N(48), N(50)],
    lead: [N(64), 0, N(67), 0, N(71), 0, N(67), 0, N(64), 0, N(67), 0, N(72), 0, N(71), 0,
           N(62), 0, N(65), 0, N(69), 0, N(65), 0, N(62), 0, N(65), 0, N(70), 0, N(69), 0,
           N(60), 0, N(64), 0, N(67), 0, N(64), 0, N(60), 0, N(64), 0, N(69), 0, N(67), 0,
           N(67), 0, N(71), 0, N(74), 0, N(71), 0, N(67), N(69), N(71), N(72), N(74), 0, N(79), 0],
    perc: [2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 2, 1, 0],
  },
  menu: {
    bpm: 96, length: 32, leadType: 'triangle',
    bass: [N(45), 0, 0, 0, N(45), 0, 0, 0, N(41), 0, 0, 0, N(41), 0, 0, 0, N(43), 0, 0, 0, N(43), 0, 0, 0, N(40), 0, 0, 0, N(43), 0, 0, 0],
    lead: [N(69), 0, N(72), 0, N(76), 0, N(72), 0, N(69), 0, N(72), 0, N(77), 0, N(76), 0, N(67), 0, N(71), 0, N(74), 0, N(71), 0, N(67), 0, N(71), 0, N(76), 0, N(74), 0],
    perc: [0, 0, 1, 0],
  },
};
