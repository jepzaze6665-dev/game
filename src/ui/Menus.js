// UIManager screens: title, race selection, army roster, campaign, skirmish,
// codex, how-to-play, settings, pause, stage intro and results.
import { UNITS, RACE_UNITS, RACES, RACE_ORDER, TAGS, TEAM } from '../data/units.js';
import { STAGES, CHAPTERS } from '../data/stages.js';
import { DIFFICULTIES, PERSONALITIES } from '../sim/EnemyAI.js';
import { THEMES } from '../render/Ground.js';
import { unitIconFit, animatedUnit, frameIcon } from './icons.js';

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function btn(label, cls, onClick) { const b = el('button', 'btn ' + (cls || ''), label); b.onclick = (e) => { e.stopPropagation(); onClick && onClick(); }; return b; }
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${s.toString().padStart(2, '0')}`; }
const pips = (n, max = 3) => '<span class="pips">' + '&#9679;'.repeat(n) + '<i>' + '&#9679;'.repeat(max - n) + '</i></span>';

export class Menus {
  constructor(root, atlas, progression, cb) {
    this.root = root; this.atlas = atlas; this.prog = progression; this.cb = cb;
    this.current = null;
    this.stopAnims = [];
    this.selectedStage = 0;
    this.skirmish = { difficulty: 'normal', theme: 'meadow', enemyRace: 'demon' };
    this.root.addEventListener('click', (e) => { if (e.target.closest('.btn, .stage-node, .diff-card, .codex-item, .theme-chip, .toggle, .seg button, .race-card, .race-tab, .chip')) this.cb.click(); });
  }

  close() {
    if (this.current) { this.current.remove(); this.current = null; }
    for (const s of this.stopAnims) s();
    this.stopAnims = [];
  }

  open(cls) {
    this.close();
    const s = el('div', 'screen ' + (cls || ''));
    this.root.appendChild(s);
    this.current = s;
    return s;
  }

  emblem(race, scale = 2) { return frameIcon(this.atlas, 'emblem_' + RACES[race].emblem, scale); }

  // ---------- title ----------
  title() {
    const s = this.open('clear'); s.id = 'title';
    const inner = el('div', 'screen-inner');
    inner.appendChild(el('div', 'logo', '<span class="l1">BANNERFALL</span><span class="l2">FOUR REALMS</span><span class="sub">ONE LANE &middot; COUNTLESS TACTICS</span>'));
    const col = el('div', 'menu-col panel');
    const cleared = this.prog.data.stagesCleared;
    col.appendChild(btn(cleared > 0 ? `CAMPAIGN <span class="key">${cleared}/${STAGES.length}</span>` : 'CAMPAIGN', 'primary', () => this.campaign()));
    col.appendChild(btn('SKIRMISH', 'blue', () => this.skirmishMenu()));
    col.appendChild(btn('ARMIES', '', () => this.raceSelect({ mode: 'browse' })));
    col.appendChild(btn('HOW TO PLAY', '', () => this.howto()));
    col.appendChild(btn('SETTINGS', 'ghost', () => this.settings()));
    inner.appendChild(col);
    s.appendChild(inner);
    const st = this.prog.data.stats;
    s.appendChild(el('div', 'title-foot', `<span class="records"><b>RECORDS</b> <i>&#9876;</i> ${st.played} battles <i>&#127942;</i> ${st.wins} wins <i>&#9733;</i> ${this.prog.totalStars()} stars <i>&#128128;</i> ${st.kills} kills</span><span class="muted">v2.0 &middot; ThreeJS</span>`));
  }

  // ---------- race selection ----------
  // opts: { mode: 'browse' | 'pick', title, onPick(race), onBack, enemyRace }
  raceSelect(opts) {
    const s = this.open('dim');
    const p = el('div', 'panel screen-inner wide');
    const head = el('div', 'menu-head');
    head.appendChild(el('h2', null, opts.title || (opts.mode === 'pick' ? 'CHOOSE YOUR RACE' : 'THE FOUR ARMIES')));
    head.appendChild(btn('BACK', 'small ghost', () => opts.onBack ? opts.onBack() : this.title()));
    p.appendChild(head);
    if (opts.enemyRace) p.appendChild(el('div', 'muted vs-line', `Enemy: <b class="red">${RACES[opts.enemyRace].name}</b> &mdash; ${RACES[opts.enemyRace].identity}`));
    const grid = el('div', 'race-grid');
    for (const rid of RACE_ORDER) {
      const r = RACES[rid];
      const card = el('article', 'race-card ' + rid);
      const top = el('div', 'rc-top');
      top.appendChild(this.emblem(rid, 3));
      top.appendChild(el('div', 'rc-title', `<b>${r.name.toUpperCase()}</b><span>${r.title}</span>`));
      card.appendChild(top);
      card.appendChild(el('p', 'rc-desc', r.description));
      card.appendChild(el('div', 'rc-line', `<small>IDENTITY</small>${r.identity}`));
      card.appendChild(el('div', 'rc-line passive', `<small>PASSIVE &middot; ${r.passive.name}</small>${r.passive.desc}`));
      card.appendChild(el('div', 'rc-line', `<small>STRENGTHS</small>${r.strengths.join(' / ')}`));
      card.appendChild(el('div', 'rc-line', `<small>TRADEOFFS</small>${r.weaknesses.join(' / ')}`));
      const lineup = el('div', 'rc-lineup');
      for (const id of RACE_UNITS[rid]) lineup.appendChild(unitIconFit(this.atlas, id, TEAM.PLAYER, 44));
      card.appendChild(lineup);
      card.appendChild(el('div', 'rc-line', `<small>COMPLEXITY</small>${pips(r.difficulty)} <span class="muted">${['', 'Easy to learn', 'Some tricks', 'Advanced'][r.difficulty]}</span>`));
      const foot = el('div', 'rc-foot');
      foot.appendChild(btn('VIEW UNITS', 'small', () => this.roster(rid, () => this.raceSelect(opts))));
      if (opts.mode === 'pick') foot.appendChild(btn('CHOOSE', 'small primary', () => this.raceReveal(rid, opts)));
      card.appendChild(foot);
      grid.appendChild(card);
    }
    p.appendChild(grid);
    s.appendChild(p);
  }

  // Short transition: show the army, passive and base before the fight.
  raceReveal(rid, opts) {
    const r = RACES[rid];
    const s = this.open('dim reveal');
    const p = el('div', 'panel reveal-panel ' + rid);
    const head = el('div', 'reveal-head');
    head.appendChild(this.emblem(rid, 4));
    head.appendChild(el('div', null, `<h1 class="pixel-text">${r.name.toUpperCase()}</h1><div class="muted">${r.title} &mdash; ${r.tagline}</div>`));
    p.appendChild(head);
    const army = el('div', 'reveal-army');
    RACE_UNITS[rid].forEach((id, i) => {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; cv.style.animationDelay = (i * 0.06) + 's';
      army.appendChild(cv);
      this.stopAnims.push(animatedUnit(this.atlas, cv, id, TEAM.PLAYER, UNITS[id].look.body === 'giant' || UNITS[id].look.body === 'mount' ? 1 : 2));
    });
    p.appendChild(army);
    const row = el('div', 'reveal-row');
    row.appendChild(el('div', 'reveal-box', `<small>PASSIVE &middot; ${r.passive.name}</small>${r.passive.desc}`));
    const baseBox = el('div', 'reveal-box base'); baseBox.appendChild(el('small', null, 'YOUR BASE')); baseBox.appendChild(frameIcon(this.atlas, `base_${r.base}_0`, 1)); row.appendChild(baseBox);
    p.appendChild(row);
    const foot = el('div', 'menu-foot'); foot.style.justifyContent = 'center';
    foot.appendChild(btn('BACK', 'ghost small', () => this.raceSelect(opts)));
    foot.appendChild(btn('TO BATTLE', 'primary', () => opts.onPick(rid)));
    p.appendChild(foot);
    s.appendChild(p);
    this.cb.reveal && this.cb.reveal(rid);
  }

  // ---------- army roster (12-unit grid with details) ----------
  roster(rid, onBack, selected = null) {
    const r = RACES[rid];
    const s = this.open('dim');
    const p = el('div', 'panel screen-inner wide');
    const head = el('div', 'menu-head');
    const h = el('div', 'race-title'); h.appendChild(this.emblem(rid, 2)); h.appendChild(el('h2', null, `${r.name.toUpperCase()} ARMY`)); head.appendChild(h);
    const tabs = el('div', 'race-tabs');
    for (const other of RACE_ORDER) { const t = el('button', 'race-tab ' + other + (other === rid ? ' on' : '')); t.appendChild(this.emblem(other, 1)); t.appendChild(el('span', null, RACES[other].name)); t.onclick = () => this.roster(other, onBack); tabs.appendChild(t); }
    head.appendChild(tabs);
    head.appendChild(btn('BACK', 'small ghost', () => onBack ? onBack() : this.title()));
    p.appendChild(head);
    const grid = el('div', 'roster-grid');
    for (const id of RACE_UNITS[rid]) {
      const d = UNITS[id];
      const c = el('button', 'roster-card tier' + d.tier + (selected === id ? ' selected' : ''));
      c.appendChild(el('div', 'rk', `${d.tier}<span>${d.hotkey}</span>`));
      c.appendChild(unitIconFit(this.atlas, id, TEAM.PLAYER, 52));
      c.appendChild(el('div', 'rn', d.name));
      c.appendChild(el('div', 'rr', d.role));
      c.appendChild(el('div', 'rc', `&#9679; ${d.cost} <span>x${d.squad}</span>`));
      const bars = el('div', 'rbars');
      const bar = (v, max, cls) => { const b = el('div', 'rbar ' + cls); b.appendChild(el('i')).style.width = Math.min(100, v / max * 100) + '%'; bars.appendChild(b); };
      bar(d.hp, 1300, 'hp'); bar(d.damage * d.attackSpeed, 60, 'dmg'); bar(d.movementSpeed, 5, 'spd');
      c.appendChild(bars);
      c.appendChild(el('div', 'roster-stats', `<span title="Health per unit">HP ${d.hp}</span><span title="Damage per attack">DMG ${d.damage}</span><span title="Attacks per second">ATK ${d.attackSpeed}/s</span><span title="Attack range">RNG ${d.attackRange}</span>`));
      c.appendChild(el('div', 'roster-ability', d.ability ? d.ability.name : (d.passive ? RACES[rid].passive.name : 'Basic attack')));
      c.appendChild(el('div', 'roster-counters', `<span class="good" title="Strong against">+ ${d.strongAgainst.join(' / ') || 'Balanced'}</span><span class="bad" title="Weak against">− ${d.weakAgainst.join(' / ')}</span>`));
      c.onclick = () => this.roster(rid, onBack, id);
      grid.appendChild(c);
    }
    p.appendChild(grid);
    if (selected) p.appendChild(this.unitDetail(selected));
    else p.appendChild(el('div', 'muted hint-line', 'Tap a unit to see stats, abilities and counters. Bars: HP / damage per second / speed.'));
    s.appendChild(p);
  }

  unitDetail(id) {
    const def = UNITS[id];
    const d = el('div', 'unit-detail');
    const hero = el('div', 'codex-hero');
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 120;
    hero.appendChild(cv);
    this.stopAnims.push(animatedUnit(this.atlas, cv, id, TEAM.PLAYER, def.look.body === 'giant' ? 2 : def.look.body === 'mount' || def.look.body === 'vehicle' ? 2 : 3));
    const t = el('div', 't');
    t.appendChild(el('h2', null, `${def.name} <span class="muted small">#${def.tier} ${def.role}</span>`));
    t.appendChild(el('p', null, def.description));
    const tags = el('div', 'tagrow'); for (const tg of def.counterTags) { const sp = el('span', 'tag mini', tg); sp.title = TAGS[tg] || tg; tags.appendChild(sp); } t.appendChild(tags);
    hero.appendChild(t);
    d.appendChild(hero);
    const sb = el('div', 'statbars');
    const rows = [['HP', def.hp, 1300], ['DAMAGE', def.damage, 90], ['ARMOR', def.armor || 0, 16], ['ATK SPEED', def.attackSpeed, 1.6], ['SPEED', def.movementSpeed, 5], ['RANGE', def.attackRange, 9]];
    for (const [k, v, max] of rows) {
      sb.appendChild(el('div', 'lbl', k));
      const bar = el('div', 'bar'); bar.appendChild(el('i')).style.width = Math.min(100, v / max * 100) + '%'; sb.appendChild(bar);
      sb.appendChild(el('div', 'v', Number.isInteger(v) ? v : v.toFixed(1)));
    }
    d.appendChild(sb);
    const meta = el('div', 'kv');
    meta.innerHTML = `<div class="k">DAMAGE</div><div>${def.damageType}${def.armorPiercing ? ' &middot; armour-piercing' : ''}${def.splash ? ' &middot; splash ' + def.splash : ''}</div>
      <div class="k">SQUAD</div><div>${def.squad} unit${def.squad > 1 ? 's' : ''} for ${def.cost} gold &middot; cooldown ${def.cooldown.toFixed(1)}s</div>
      ${def.ability ? `<div class="k">ABILITY</div><div><b class="gold">${def.ability.name}</b> &mdash; ${def.ability.desc}</div>` : ''}
      ${def.passive ? `<div class="k">PASSIVE</div><div>${RACES[def.race].passive.name} &mdash; ${RACES[def.race].passive.desc}</div>` : ''}`;
    d.appendChild(meta);
    const good = el('div', 'counter-row good'); good.appendChild(el('span', 'lbl', 'STRONG VS'));
    for (const s of def.strongAgainst) good.appendChild(el('span', 'tag mini good', s)); if (!def.strongAgainst.length) good.appendChild(el('span', 'muted', 'nothing in particular'));
    d.appendChild(good);
    const bad = el('div', 'counter-row bad'); bad.appendChild(el('span', 'lbl', 'WEAK VS'));
    for (const s of def.weakAgainst) bad.appendChild(el('span', 'tag mini bad', s));
    d.appendChild(bad);
    return d;
  }

  // ---------- campaign ----------
  campaign() {
    const s = this.open('dim');
    const p = el('div', 'panel screen-inner wide');
    const head = el('div', 'menu-head');
    head.appendChild(el('h2', null, 'CAMPAIGN'));
    head.appendChild(el('div', 'muted', `${this.prog.totalStars()} / ${STAGES.length * 3} stars`));
    head.appendChild(btn('BACK', 'small ghost', () => this.title()));
    p.appendChild(head);
    const cleared = this.prog.data.stagesCleared;
    if (this.selectedStage > cleared) this.selectedStage = cleared;
    if (this.selectedStage >= STAGES.length) this.selectedStage = STAGES.length - 1;
    const grid = el('div', 'menu-grid');
    const list = el('div', 'chapter-list');
    for (const ch of CHAPTERS) {
      const box = el('div', 'chapter ' + ch.enemyRace);
      const h = el('div', 'ch-head'); h.appendChild(this.emblem(ch.enemyRace, 2)); h.appendChild(el('div', null, `<b>CHAPTER ${ch.id} &middot; ${ch.name.toUpperCase()}</b><span>${ch.blurb}</span>`)); box.appendChild(h);
      const row = el('div', 'stage-row');
      STAGES.filter((st) => st.chapter === ch.id).forEach((st) => {
        const i = STAGES.indexOf(st);
        const locked = i > cleared;
        const n = el('button', 'stage-node' + (locked ? ' locked' : '') + (i === this.selectedStage ? ' selected' : ''));
        const stars = this.prog.data.stars[st.id] || 0;
        n.appendChild(el('div', 'num', `<span>STAGE ${st.id}</span><span class="tag ${st.difficulty}">${st.difficulty}</span>`));
        n.appendChild(el('div', 'name', st.name));
        n.appendChild(el('div', 'stars', '&#9733;'.repeat(stars) + '<span style="opacity:.25">' + '&#9733;'.repeat(3 - stars) + '</span>'));
        if (locked) n.appendChild(el('div', 'lock', '&#128274;'));
        n.onclick = () => { if (locked) return; this.selectedStage = i; this.campaign(); };
        row.appendChild(n);
      });
      box.appendChild(row);
      list.appendChild(box);
    }
    grid.appendChild(list);
    grid.appendChild(this.stageDetail(STAGES[this.selectedStage]));
    p.appendChild(grid);
    s.appendChild(p);
  }

  stageDetail(st) {
    const d = el('div', 'stage-detail panel');
    d.style.padding = '12px';
    d.appendChild(el('h2', null, `${st.id}. ${st.name}`));
    const prev = el('div', 'preview'); prev.appendChild(this.cb.themePreview(st.theme)); d.appendChild(prev);
    const r = RACES[st.enemyRace];
    const kv = el('div', 'kv');
    kv.innerHTML = `<div class="k">FIELD</div><div>${THEMES[st.theme].name}</div>
      <div class="k">ENEMY</div><div><b class="red">${r.name}</b> &middot; ${PERSONALITIES[r.ai].name} commander &middot; <span class="tag ${st.difficulty}">${st.difficulty}</span></div>
      <div class="k">ROSTER</div><div>${st.enemyTiers >= 12 ? 'Full army' : 'Units 1–' + st.enemyTiers}</div>
      <div class="k">TIP</div><div class="muted">${st.tip}</div>`;
    d.appendChild(kv);
    const lineup = el('div', 'roster-row');
    for (const id of RACE_UNITS[st.enemyRace].slice(0, st.enemyTiers)) { const m = el('div', 'mini-unit'); m.appendChild(unitIconFit(this.atlas, id, TEAM.ENEMY, 40, 'idle', true)); m.title = UNITS[id].name; lineup.appendChild(m); }
    d.appendChild(lineup);
    const foot = el('div', 'menu-foot');
    foot.appendChild(btn('CHOOSE RACE & FIGHT', 'primary', () => this.cb.startCampaign(st)));
    d.appendChild(foot);
    return d;
  }

  // ---------- skirmish ----------
  skirmishMenu() {
    const s = this.open('dim');
    const p = el('div', 'panel screen-inner wide');
    const head = el('div', 'menu-head');
    head.appendChild(el('h2', null, 'SKIRMISH'));
    head.appendChild(btn('BACK', 'small ghost', () => this.title()));
    p.appendChild(head);
    p.appendChild(el('h3', null, 'ENEMY RACE'));
    const races = el('div', 'race-row');
    for (const rid of [...RACE_ORDER, 'random']) {
      const c = el('button', 'chip race-chip ' + rid + (this.skirmish.enemyRace === rid ? ' selected' : ''));
      if (rid !== 'random') c.appendChild(this.emblem(rid, 2)); else c.appendChild(el('span', 'q', '?'));
      c.appendChild(el('span', null, rid === 'random' ? 'Random' : RACES[rid].name));
      c.onclick = () => { this.skirmish.enemyRace = rid; this.skirmishMenu(); };
      races.appendChild(c);
    }
    p.appendChild(races);
    p.appendChild(el('h3', null, 'DIFFICULTY')).style.marginTop = '12px';
    const grid = el('div', 'diff-grid');
    for (const key in DIFFICULTIES) {
      const d = DIFFICULTIES[key];
      const c = el('button', 'diff-card' + (this.skirmish.difficulty === key ? ' selected' : ''));
      c.innerHTML = `<div class="t"><span class="tag ${key}">${d.name}</span></div><p>${d.desc}</p>`;
      c.onclick = () => { this.skirmish.difficulty = key; this.skirmishMenu(); };
      grid.appendChild(c);
    }
    p.appendChild(grid);
    p.appendChild(el('h3', null, 'BATTLEFIELD')).style.marginTop = '12px';
    const row = el('div', 'theme-row');
    for (const key in THEMES) {
      const t = THEMES[key];
      const c = el('button', 'theme-chip' + (this.skirmish.theme === key ? ' selected' : ''));
      c.innerHTML = `<span class="sw" style="background:${t.grass[0]}"></span>${t.name}`;
      c.onclick = () => { this.skirmish.theme = key; this.skirmishMenu(); };
      row.appendChild(c);
    }
    p.appendChild(row);
    const foot = el('div', 'menu-foot');
    foot.appendChild(btn('CHOOSE RACE & FIGHT', 'primary', () => this.cb.startSkirmish({ ...this.skirmish })));
    p.appendChild(foot);
    s.appendChild(p);
  }

  // ---------- how to play ----------
  howto(onDone) {
    const s = this.open('dim');
    const p = el('div', 'panel screen-inner'); p.style.maxWidth = '860px';
    const head = el('div', 'menu-head');
    head.appendChild(el('h2', null, 'HOW TO PLAY'));
    head.appendChild(btn(onDone ? 'SKIP' : 'BACK', 'small ghost', () => onDone ? onDone() : this.title()));
    p.appendChild(head);
    p.appendChild(el('p', 'muted', 'Siege damage rises at 5:00. Both gates crumble at 7:00. At 8:00 the healthier base wins; with equal health the stronger surviving army wins.'));
    const steps = el('div', 'howto-steps');
    const step = (n, title, text, art) => {
      const d = el('div', 'howto-step');
      d.appendChild(el('div', 'num', n));
      const a = el('div', 'art'); a.appendChild(art); d.appendChild(a);
      d.appendChild(el('div', 't', `<b>${title}</b><span>${text}</span>`));
      steps.appendChild(d);
    };
    const coin = el('div', 'howto-coin'); coin.appendChild(frameIcon(this.atlas, 'coin', 6)); coin.appendChild(el('span', 'pixel-text gold', '+7/s'));
    step('1', 'EARN GOLD', 'Gold trickles in every second and faster when you are losing ground. Save it or spend it fast.', coin);
    const card = el('div', 'howto-card');
    card.appendChild(unitIconFit(this.atlas, 'h_swordsman', TEAM.PLAYER, 48));
    card.appendChild(el('span', 'pixel-text', 'Swordsman <span class="gold">&#9679;60</span>'));
    step('2', 'DEPLOY SQUADS', 'Click a card (or press its key) to send a whole squad. Units march and fight on their own.', card);
    const wheel = el('div', 'howto-wheel');
    for (const [a, b2, why] of [['h_spearman', 'd_hellknight', 'spears beat cavalry'], ['h_knight', 'm_bonearcher', 'cavalry beats ranged'], ['h_crossbow', 'r_tank', 'piercing beats armour'], ['h_firemage', 'm_scarab', 'fire beats swarms'], ['d_hound', 'h_priest', 'hunters beat backlines'], ['h_paladin', 'm_mummy', 'holy beats undead']]) {
      const r = el('div', 'pair');
      const icons = el('div', 'icons');
      icons.appendChild(unitIconFit(this.atlas, a, TEAM.PLAYER, 40));
      icons.appendChild(el('span', 'arrow', '&#10148;'));
      icons.appendChild(unitIconFit(this.atlas, b2, TEAM.ENEMY, 40, 'idle', true));
      r.appendChild(icons);
      r.appendChild(el('span', 'why', why));
      wheel.appendChild(r);
    }
    step('3', 'COUNTER THEM', 'Every unit has tags (LIGHT, HEAVY, ARMORED, CAVALRY, RANGED, SWARM, MAGIC…). Hit a tag a unit is strong against for +50% damage. Cards marked COUNTER! are your best answer right now.', wheel);
    const base = el('div', 'howto-base'); base.appendChild(frameIcon(this.atlas, 'base_fortress_1', 1)); base.appendChild(el('span', 'pixel-text red', 'DESTROY IT'));
    step('4', 'BREAK THE GATE', 'Push the front line across the field and smash their base before they smash yours. Elite and Legendary units (★) turn a war.', base);
    p.appendChild(steps);
    const foot = el('div', 'menu-foot'); foot.style.justifyContent = 'center';
    foot.appendChild(btn(onDone ? 'GOT IT — FIGHT!' : 'GOT IT', 'primary', () => onDone ? onDone() : this.title()));
    p.appendChild(foot);
    s.appendChild(p);
  }

  // ---------- settings ----------
  settings(fromPause = false) {
    const s = this.open('dim');
    const p = el('div', 'panel screen-inner'); p.style.maxWidth = '560px';
    const head = el('div', 'menu-head');
    head.appendChild(el('h2', null, 'SETTINGS'));
    head.appendChild(btn('BACK', 'small ghost', () => fromPause ? this.pause() : this.title()));
    p.appendChild(head);
    const st = this.prog.settings;
    const slider = (label, desc, key) => {
      const r = el('div', 'setting-row');
      r.appendChild(el('div', null, `<div class="lbl">${label}</div><div class="desc">${desc}</div>`));
      const wrap = el('div', 'slider-wrap');
      const i = document.createElement('input'); i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05; i.value = st[key];
      const val = el('span', 'slider-val', Math.round(st[key] * 100) + '%');
      i.oninput = () => { st[key] = parseFloat(i.value); val.textContent = Math.round(st[key] * 100) + '%'; this.prog.save(); this.cb.settingsChanged(); };
      i.onchange = () => this.cb.click();
      wrap.append(i, val); r.appendChild(wrap); p.appendChild(r);
    };
    const toggle = (label, desc, key) => {
      const r = el('div', 'setting-row');
      r.appendChild(el('div', null, `<div class="lbl">${label}</div><div class="desc">${desc}</div>`));
      const t = el('div', 'toggle' + (st[key] ? ' on' : '')); t.appendChild(el('i'));
      t.onclick = () => { st[key] = !st[key]; t.classList.toggle('on', st[key]); this.prog.save(); this.cb.settingsChanged(); this.cb.click(); };
      r.appendChild(t); p.appendChild(r);
    };
    slider('SOUND EFFECTS', 'Swords, arrows, explosions.', 'sfx');
    slider('MUSIC', 'Chiptune battle themes.', 'music');
    toggle('SCREEN SHAKE', 'Camera kick on heavy hits.', 'shake');
    toggle('DAMAGE NUMBERS', 'Show counter and big-hit numbers.', 'numbers');
    const r = el('div', 'setting-row');
    r.appendChild(el('div', null, '<div class="lbl">PROGRESS</div><div class="desc">Wipe campaign stars and records.</div>'));
    r.appendChild(btn('RESET', 'small red', () => { if (this.confirmReset) { this.prog.reset(); this.cb.settingsChanged(); this.settings(fromPause); } else { this.confirmReset = true; r.lastChild.textContent = 'SURE?'; } }));
    this.confirmReset = false;
    p.appendChild(r);
    s.appendChild(p);
  }

  // ---------- pause ----------
  pause() {
    const s = this.open('dim');
    const p = el('div', 'panel'); p.style.width = 'min(360px, 100%)';
    p.appendChild(el('h2', null, 'PAUSED')).style.textAlign = 'center';
    const col = el('div', 'menu-col'); col.style.marginTop = '14px'; col.style.width = '100%';
    col.appendChild(btn('RESUME', 'primary', () => this.cb.resume()));
    col.appendChild(btn('MY ARMY', '', () => this.roster(this.cb.currentRace(), () => this.pause())));
    col.appendChild(btn('RESTART', '', () => this.cb.restart()));
    col.appendChild(btn('SETTINGS', '', () => this.settings(true)));
    col.appendChild(btn('QUIT TO MENU', 'red', () => this.cb.quit()));
    p.appendChild(col);
    s.appendChild(p);
  }

  // ---------- stage intro / countdown ----------
  intro(name, tip, sub, races) {
    const s = this.open('clear');
    const box = el('div', 'stage-intro');
    box.appendChild(el('h3', null, sub || ''));
    box.appendChild(el('h1', 'pixel-text', name));
    if (races) {
      const vs = el('div', 'intro-vs');
      vs.appendChild(this.emblem(races[0], 3)); vs.appendChild(el('span', 'blue', RACES[races[0]].name)); vs.appendChild(el('b', null, 'VS')); vs.appendChild(el('span', 'red', RACES[races[1]].name)); vs.appendChild(this.emblem(races[1], 3));
      box.appendChild(vs);
    }
    if (tip) box.appendChild(el('div', 'tip', tip));
    this.count = el('div', 'countdown', '3');
    box.appendChild(this.count);
    s.appendChild(box);
    return s;
  }
  setCount(text) { if (this.count) { this.count.textContent = text; this.count.style.animation = 'none'; void this.count.offsetWidth; this.count.style.animation = ''; } }

  // ---------- results ----------
  results(r) {
    const s = this.open(r.won ? '' : 'dim');
    const p = el('div', 'panel screen-inner'); p.style.maxWidth = '680px';
    const box = el('div', 'results');
    box.appendChild(el('div', 'title ' + (r.won ? 'win' : 'lose'), r.draw ? 'DRAW' : r.won ? 'VICTORY' : 'DEFEAT'));
    const vs = el('div', 'intro-vs small'); vs.appendChild(this.emblem(r.race, 2)); vs.appendChild(el('span', 'blue', RACES[r.race].name)); vs.appendChild(el('b', null, 'VS')); vs.appendChild(el('span', 'red', RACES[r.enemyRace].name)); vs.appendChild(this.emblem(r.enemyRace, 2)); box.appendChild(vs);
    if (r.won) {
      const stars = el('div', 'stars');
      for (let i = 0; i < 3; i++) { const sp = el('span', i < r.stars ? 'on' : '', '&#9733;'); sp.style.animationDelay = (0.3 + i * 0.25) + 's'; stars.appendChild(sp); }
      box.appendChild(stars);
      box.appendChild(el('div', 'muted', r.stars === 3 ? 'Flawless command!' : r.stars === 2 ? 'Solid victory. Keep your base healthier for 3 stars.' : 'Close one. Counter faster next time.'));
    } else box.appendChild(el('div', 'muted', r.hintText || 'The enemy broke through. Read their army and answer with counters.'));
    const grid = el('div', 'stat-grid');
    const stats = [['TIME', fmtTime(r.time)], ['KILLS', r.kills], ['LOST', r.lost], ['GOLD SPENT', r.spent], ['DEPLOYED', r.deployed], ['MVP', r.favourite || '-']];
    stats.forEach(([k, v], i) => { const b = el('div', 'stat-box', `<small>${k}</small><b>${v}</b>`); b.style.animationDelay = (0.1 * i) + 's'; grid.appendChild(b); });
    box.appendChild(grid);
    if (r.mvpId) { const m = el('div', 'mvp-box'); m.appendChild(unitIconFit(this.atlas, r.mvpId, TEAM.PLAYER, 48)); m.appendChild(el('div', 't', `<b>MOST DEPLOYED</b>${UNITS[r.mvpId].name} &middot; ${r.mvpN} squads`)); box.appendChild(m); }
    const foot = el('div', 'menu-foot'); foot.style.justifyContent = 'center';
    if (r.won && r.next) foot.appendChild(btn('NEXT STAGE', 'primary', () => this.cb.nextStage()));
    foot.appendChild(btn(r.won ? 'PLAY AGAIN' : 'RETRY', r.won && r.next ? 'blue' : 'primary', () => this.cb.restart()));
    foot.appendChild(btn('CHANGE RACE', 'ghost', () => this.cb.changeRace()));
    foot.appendChild(btn('MENU', 'ghost', () => this.cb.quit()));
    box.appendChild(foot);
    p.appendChild(box);
    s.appendChild(p);
  }
}
