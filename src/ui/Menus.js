// UIManager screens: title, race selection, army roster, campaign, skirmish,
// how-to-play, settings, pause, stage intro and results.
// Every screen is a `shell`: an ornate gold frame with a starry title plate,
// a scrolling body and an optional footer band (see css/style.css).
import { UNITS, RACE_UNITS, RACES, RACE_ORDER, TAGS, TEAM } from '../data/units.js';
import { STAGES, CHAPTERS } from '../data/stages.js';
import { DIFFICULTIES, PERSONALITIES } from '../sim/EnemyAI.js';
import { THEMES } from '../render/Ground.js';
import { unitIconFit, animatedUnit, frameIcon } from './icons.js';

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function btn(label, cls, onClick) { const b = el('button', 'btn ' + (cls || ''), label); b.onclick = (e) => { e.stopPropagation(); onClick && onClick(); }; return b; }
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${s.toString().padStart(2, '0')}`; }
const pips = (n, max = 3) => '<span class="pips">' + '&#9679;'.repeat(n) + '<i>' + '&#9679;'.repeat(max - n) + '</i></span>';
const stars = (n, max = 3, cls = '') => Array.from({ length: max }, (_, i) => `<span class="ico star ${i < n ? 'on' : 'off'} ${cls}"></span>`).join('');
// the champion drawn in each army's portrait window and as a footer mascot
const HERO = { human: 'h_king', demon: 'd_behemoth', robot: 'r_omega', mummy: 'm_pharaoh' };
const RACE_FLAVOUR = {
  human: 'Loyal, disciplined and unbreakable. A kingdom of steel that answers every threat in kind.',
  demon: 'Born from fire and chaos. Ruthless, brutal and relentless — they burn brightest when they bleed.',
  robot: 'Cold precision from the iron foundries. Armour, artillery and inevitability.',
  mummy: 'An ancient dynasty risen from the sands. Timeless, tireless, and never truly dead.',
};

export class Menus {
  constructor(root, atlas, progression, cb) {
    this.root = root; this.atlas = atlas; this.prog = progression; this.cb = cb;
    this.current = null;
    this.stopAnims = [];
    this.selectedStage = 0;
    this.skirmish = { difficulty: 'normal', theme: 'meadow', enemyRace: 'demon' };
    this.root.addEventListener('click', (e) => { if (e.target.closest('.btn, .close-x, .stage-node, .diff-card, .theme-chip, .toggle, .seg button, .race-card, .race-tab, .race-chip, .roster-card')) this.cb.click(); });
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

  // ---------- kit helpers ----------
  emblem(race, size = '') { return el('span', `ico em ${race} ${size}`); }

  // Animated champion on a transparent canvas (used in portraits and the footer band).
  hero(rid, w = 120, h = 110, flip = false) {
    const id = HERO[rid], def = UNITS[id];
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    this.stopAnims.push(animatedUnit(this.atlas, cv, id, TEAM.PLAYER, def.look.body === 'giant' ? 2 : 3, flip));
    return cv;
  }

  // Ornate screen shell. opts: { race, sub, onClose, closeLabel, size: 'narrow'|'medium'|'', dim, id }
  shell(title, opts = {}) {
    const s = this.open(opts.dim === false ? 'clear' : 'dim');
    if (opts.id) s.id = opts.id;
    const f = el('div', 'frame shell ' + (opts.size || ''));
    const head = el('div', 'shell-head');
    const plate = el('div', 'plate');
    plate.appendChild(el('span', 'ico sword'));
    const name = el('div', 'plate-box name');
    name.appendChild(el('span', 'ico crown crown'));
    if (opts.race) name.appendChild(this.emblem(opts.race, 'm'));
    name.appendChild(el('span', null, title));
    plate.appendChild(name);
    plate.appendChild(el('span', 'ico sword r'));
    head.appendChild(plate);
    if (opts.sub) head.appendChild(el('div', 'sub', opts.sub));
    f.appendChild(head);
    if (opts.onClose) {
      const x = el('button', 'close-x'); x.setAttribute('aria-label', opts.closeLabel || 'BACK'); x.title = opts.closeLabel || 'Back';
      x.onclick = (e) => { e.stopPropagation(); opts.onClose(); };
      f.appendChild(x);
    }
    const body = el('div', 'shell-body');
    f.appendChild(body);
    s.appendChild(f);
    return { s, frame: f, head, body, foot: () => { const ft = el('div', 'shell-foot'); f.appendChild(ft); return ft; } };
  }

  // ---------- title ----------
  title() {
    const s = this.open('clear'); s.id = 'title';
    const inner = el('div', 'title-inner');
    const logo = el('div', 'logo');
    const row = el('div', 'plate-row');
    row.appendChild(el('span', 'ico sword'));
    const box = el('div', 'plate-box');
    box.appendChild(el('span', 'ico crown crown'));
    box.appendChild(el('span', 'l1', 'BANNERFALL'));
    box.appendChild(el('span', 'l2', 'FOUR REALMS'));
    row.appendChild(box);
    row.appendChild(el('span', 'ico sword r'));
    logo.appendChild(row);
    logo.appendChild(el('span', 'sub', 'ONE LANE &middot; COUNTLESS TACTICS'));
    inner.appendChild(logo);
    const col = el('div', 'menu-col frame');
    const cleared = this.prog.data.stagesCleared;
    col.appendChild(btn(cleared > 0 ? `CAMPAIGN <span class="key">${cleared}/${STAGES.length}</span>` : 'CAMPAIGN', 'primary orn', () => this.campaign()));
    col.appendChild(btn('SKIRMISH', 'human orn', () => this.skirmishMenu()));
    col.appendChild(btn('ARMIES', '', () => this.raceSelect({ mode: 'browse' })));
    col.appendChild(btn('HOW TO PLAY', '', () => this.howto()));
    col.appendChild(btn('SETTINGS', 'ghost', () => this.settings()));
    inner.appendChild(col);
    s.appendChild(inner);
    const st = this.prog.data.stats;
    s.appendChild(el('div', 'title-foot', `<div class="records chip"><b>RECORDS</b><span><span class="ico sword" style="width:34px;height:9px;background-size:34px 9px"></span>${st.played} battles</span><span><span class="ico trophy"></span>${st.wins} wins</span><span><span class="ico star"></span>${this.prog.totalStars()} stars</span><span><span class="ico skull"></span>${st.kills} kills</span></div><span class="ver muted">v2.0 &middot; THREEJS</span>`));
  }

  // ---------- race selection: THE FOUR ARMIES ----------
  // opts: { mode: 'browse' | 'pick', title, onPick(race), onBack, enemyRace }
  raceSelect(opts) {
    const pick = opts.mode === 'pick';
    const { body, foot } = this.shell(opts.title || (pick ? 'CHOOSE YOUR ARMY' : 'THE FOUR ARMIES'), { onClose: () => opts.onBack ? opts.onBack() : this.title(), id: 'armies' });
    if (opts.enemyRace) body.appendChild(el('div', 'muted vs-line', `You will face the <b class="red">${RACES[opts.enemyRace].name}</b> &mdash; ${RACES[opts.enemyRace].identity}`));
    const grid = el('div', 'race-grid');
    for (const rid of RACE_ORDER) {
      const r = RACES[rid];
      const card = el('article', 'race-card ' + rid + (pick ? ' pickable' : ''));
      const top = el('div', 'rc-head');
      top.appendChild(this.emblem(rid));
      top.appendChild(el('div', 'rc-title', `<b>${r.name.toUpperCase()}</b><span>${r.title}</span>`));
      card.appendChild(top);
      const port = el('div', 'rc-portrait ' + rid);
      port.appendChild(el('div', 'scene'));
      port.appendChild(el('div', 'flag l')); port.appendChild(el('div', 'flag r'));
      port.appendChild(this.hero(rid, 150, 100));
      port.appendChild(el('div', 'ground'));
      card.appendChild(port);
      card.appendChild(el('p', 'rc-desc', RACE_FLAVOUR[rid]));
      card.appendChild(el('div', 'rc-line passive', `<small>PASSIVE &middot; ${r.passive.name}</small>${r.passive.desc}`));
      card.appendChild(el('div', 'rc-line strength', `<small>STRENGTH</small>${r.strengths.join(', ')}.`));
      card.appendChild(el('div', 'rc-line', `<small>WEAKNESS</small>${r.weaknesses.join(', ')}.`));
      card.appendChild(el('div', 'rc-line', `<small class="split"><span>UNITS PREVIEW</span><span title="Complexity: ${['', 'easy to learn', 'some tricks', 'advanced'][r.difficulty]}">${['', 'EASY', 'TRICKY', 'ADVANCED'][r.difficulty]} ${pips(r.difficulty)}</span></small>`));
      const lineup = el('div', 'rc-preview');
      for (const id of RACE_UNITS[rid]) { const c = unitIconFit(this.atlas, id, TEAM.PLAYER, 36); c.title = UNITS[id].name; lineup.appendChild(c); }
      card.appendChild(lineup);
      const ft = el('div', 'rc-foot');
      if (pick) {
        ft.classList.add('row');
        ft.appendChild(btn('CHOOSE', rid + ' orn', () => this.raceReveal(rid, opts)));
        ft.appendChild(btn('VIEW UNITS', 'small', () => this.roster(rid, () => this.raceSelect(opts))));
      } else ft.appendChild(btn('VIEW UNITS', rid + ' orn', () => this.roster(rid, () => this.raceSelect(opts))));
      card.appendChild(ft);
      if (pick) card.onclick = (e) => { if (!e.target.closest('.btn')) this.raceReveal(rid, opts); };
      grid.appendChild(card);
    }
    body.appendChild(grid);
    const f = foot();
    const ml = el('div', 'mascot'); ml.appendChild(this.hero('human', 96, 76)); f.appendChild(ml);
    f.appendChild(el('div', 'foot-text', `<div class="orn-title">${pick ? 'PICK YOUR BANNER' : 'CHOOSE YOUR ARMY'}</div><p>Each army has unique units, a passive and its own way to win.<br>${pick ? 'Choose one and <b>lead it to the enemy gate</b>.' : 'Lead them to victory and conquer the battlefield!'}</p>`));
    const mr = el('div', 'mascot r'); mr.appendChild(this.hero('mummy', 96, 76)); f.appendChild(mr);
  }

  // Short transition: show the army, passive and base before the fight.
  raceReveal(rid, opts) {
    const r = RACES[rid];
    const { body } = this.shell(r.name.toUpperCase(), { race: rid, sub: `${r.title.toUpperCase()} &middot; ${r.tagline.toUpperCase()}`, onClose: () => this.raceSelect(opts) });
    body.classList.add(rid);
    const army = el('div', 'reveal-army box');
    RACE_UNITS[rid].forEach((id, i) => {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; cv.style.animationDelay = (i * 0.06) + 's';
      army.appendChild(cv);
      this.stopAnims.push(animatedUnit(this.atlas, cv, id, TEAM.PLAYER, UNITS[id].look.body === 'giant' || UNITS[id].look.body === 'mount' ? 1 : 2));
    });
    body.appendChild(army);
    const row = el('div', 'reveal-row'); row.style.marginTop = '12px';
    row.appendChild(el('div', 'reveal-box box', `<small>PASSIVE &middot; ${r.passive.name}</small>${r.passive.desc}<br><br><small>IDENTITY</small>${r.identity}`));
    const baseBox = el('div', 'reveal-box base box'); baseBox.appendChild(el('small', null, 'YOUR BASE')); baseBox.appendChild(frameIcon(this.atlas, `base_${r.base}_0`, 1)); row.appendChild(baseBox);
    body.appendChild(row);
    const ft = el('div', 'menu-foot center');
    ft.appendChild(btn('BACK', 'ghost small', () => this.raceSelect(opts)));
    ft.appendChild(btn('TO BATTLE', 'primary orn', () => opts.onPick(rid)));
    body.appendChild(ft);
    this.cb.reveal && this.cb.reveal(rid);
  }

  // ---------- army roster (12-unit grid with details) ----------
  roster(rid, onBack, selected = null) {
    const r = RACES[rid];
    const { body } = this.shell(`${r.name.toUpperCase()} ARMY`, { race: rid, sub: r.title.toUpperCase(), onClose: () => onBack ? onBack() : this.title() });
    const tabs = el('div', 'race-tabs');
    for (const other of RACE_ORDER) { const t = el('button', 'race-tab ' + other + (other === rid ? ' on' : '')); t.appendChild(this.emblem(other, 's')); t.appendChild(el('span', null, RACES[other].name.toUpperCase())); t.onclick = () => this.roster(other, onBack); tabs.appendChild(t); }
    body.appendChild(tabs);
    const grid = el('div', 'roster-grid');
    for (const id of RACE_UNITS[rid]) {
      const d = UNITS[id];
      const c = el('button', 'roster-card tier' + d.tier + (selected === id ? ' selected' : ''));
      c.appendChild(el('div', 'rk', `${d.tier}<span>${d.hotkey}</span>`));
      c.appendChild(unitIconFit(this.atlas, id, TEAM.PLAYER, 52));
      c.appendChild(el('div', 'rn', d.name));
      c.appendChild(el('div', 'rr', d.role));
      c.appendChild(el('div', 'rc', `<span class="ico coin" style="width:12px;height:12px;background-size:12px 12px"></span>${d.cost} <span>x${d.squad}</span>`));
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
    body.appendChild(grid);
    if (selected) { const d = this.unitDetail(selected); body.appendChild(d); requestAnimationFrame(() => d.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); }
    else body.appendChild(el('div', 'muted hint-line', 'Tap a unit to see stats, abilities and counters. Bars: HP / damage per second / speed.'));
  }

  unitDetail(id) {
    const def = UNITS[id];
    const d = el('div', 'unit-detail box gold');
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
    const { body } = this.shell('CAMPAIGN', { sub: `${this.prog.totalStars()} / ${STAGES.length * 3} STARS COLLECTED`, onClose: () => this.title() });
    const cleared = this.prog.data.stagesCleared;
    if (this.selectedStage > cleared) this.selectedStage = cleared;
    if (this.selectedStage >= STAGES.length) this.selectedStage = STAGES.length - 1;
    const grid = el('div', 'menu-grid');
    const list = el('div', 'chapter-list');
    for (const ch of CHAPTERS) {
      const box = el('div', 'chapter box ' + ch.enemyRace);
      const h = el('div', 'ch-head'); h.appendChild(this.emblem(ch.enemyRace, 'm')); h.appendChild(el('div', null, `<b>CHAPTER ${ch.id} &middot; ${ch.name.toUpperCase()}</b><span>${ch.blurb}</span>`)); box.appendChild(h);
      const row = el('div', 'stage-row');
      STAGES.filter((st) => st.chapter === ch.id).forEach((st) => {
        const i = STAGES.indexOf(st);
        const locked = i > cleared;
        const n = el('button', 'stage-node' + (locked ? ' locked' : '') + (i === this.selectedStage ? ' selected' : ''));
        const got = this.prog.data.stars[st.id] || 0;
        n.appendChild(el('div', 'num', `<span>STAGE ${st.id}${locked ? '<span class="lock"><span class="ico lock"></span></span>' : ''}</span><span class="tag ${st.difficulty}">${st.difficulty}</span>`));
        n.appendChild(el('div', 'name', st.name));
        n.appendChild(el('div', 'stars', stars(got)));
        n.onclick = () => { if (locked) return; this.selectedStage = i; this.campaign(); };
        row.appendChild(n);
      });
      box.appendChild(row);
      list.appendChild(box);
    }
    grid.appendChild(list);
    grid.appendChild(this.stageDetail(STAGES[this.selectedStage]));
    body.appendChild(grid);
  }

  stageDetail(st) {
    const d = el('div', 'stage-detail box gold');
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
    foot.appendChild(btn('CHOOSE RACE & FIGHT', 'primary orn', () => this.cb.startCampaign(st)));
    d.appendChild(foot);
    return d;
  }

  // ---------- skirmish ----------
  skirmishMenu() {
    const { body } = this.shell('SKIRMISH', { sub: 'ONE BATTLE, YOUR RULES', size: 'medium', onClose: () => this.title() });
    body.appendChild(el('div', 'sec-label', 'ENEMY RACE'));
    const races = el('div', 'race-row');
    for (const rid of [...RACE_ORDER, 'random']) {
      const c = el('button', 'race-chip ' + rid + (this.skirmish.enemyRace === rid ? ' selected' : ''));
      if (rid !== 'random') c.appendChild(this.emblem(rid, 's')); else c.appendChild(el('span', 'q', '?'));
      c.appendChild(el('span', null, rid === 'random' ? 'RANDOM' : RACES[rid].name.toUpperCase()));
      c.onclick = () => { this.skirmish.enemyRace = rid; this.skirmishMenu(); };
      races.appendChild(c);
    }
    body.appendChild(races);
    body.appendChild(el('div', 'sec-label', 'DIFFICULTY'));
    const grid = el('div', 'diff-grid');
    for (const key in DIFFICULTIES) {
      const d = DIFFICULTIES[key];
      const c = el('button', 'diff-card' + (this.skirmish.difficulty === key ? ' selected' : ''));
      c.innerHTML = `<div class="t"><span class="tag ${key}">${d.name}</span></div><p>${d.desc}</p>`;
      c.onclick = () => { this.skirmish.difficulty = key; this.skirmishMenu(); };
      grid.appendChild(c);
    }
    body.appendChild(grid);
    body.appendChild(el('div', 'sec-label', 'BATTLEFIELD'));
    const row = el('div', 'theme-row');
    for (const key in THEMES) {
      const t = THEMES[key];
      const c = el('button', 'theme-chip' + (this.skirmish.theme === key ? ' selected' : ''));
      c.innerHTML = `<span class="sw" style="background:${t.grass[0]}"></span>${t.name}`;
      c.onclick = () => { this.skirmish.theme = key; this.skirmishMenu(); };
      row.appendChild(c);
    }
    body.appendChild(row);
    const foot = el('div', 'menu-foot center');
    foot.appendChild(btn('CHOOSE RACE & FIGHT', 'primary orn', () => this.cb.startSkirmish({ ...this.skirmish })));
    body.appendChild(foot);
  }

  // ---------- how to play ----------
  howto(onDone) {
    const { body } = this.shell('HOW TO PLAY', { sub: 'FOUR STEPS TO THE ENEMY GATE', size: 'medium', onClose: () => onDone ? onDone() : this.title(), closeLabel: onDone ? 'SKIP' : 'BACK' });
    body.appendChild(el('p', 'howto-intro', 'Units you buy muster at your gate and march together every 10 seconds - so does the enemy. Siege damage rises at 6:00 and both gates crumble from 12:00, so matches end around 10-15 minutes; at 20:00 the healthier base wins.'));
    const steps = el('div', 'howto-steps');
    const step = (n, title, text, art) => {
      const d = el('div', 'howto-step');
      d.appendChild(el('div', 'num', n));
      const a = el('div', 'art'); a.appendChild(art); d.appendChild(a);
      d.appendChild(el('div', 't', `<b>${title}</b><span>${text}</span>`));
      steps.appendChild(d);
    };
    const coin = el('div', 'howto-coin'); coin.appendChild(el('span', 'ico coin', '')).style.cssText = 'width:54px;height:54px;background-size:54px 54px'; coin.appendChild(el('span', 'pixel-text gold', '+7/s'));
    step('1', 'EARN GOLD', 'Gold trickles in every second and faster when you are losing ground. Save it or spend it fast.', coin);
    const card = el('div', 'howto-card');
    card.appendChild(unitIconFit(this.atlas, 'h_swordsman', TEAM.PLAYER, 48));
    card.appendChild(el('span', 'pixel-text', 'Swordsman <span class="gold">&#9679;60</span>'));
    step('2', 'DEPLOY SQUADS', 'Click a card (or press its key) to send a whole squad. Units march and fight on their own.', card);
    const wheel = el('div', 'howto-wheel');
    for (const [a, b2, why] of [['h_spearman', 'd_doombringer', 'spears beat cavalry'], ['h_knight', 'm_bonearcher', 'cavalry beats ranged'], ['h_crossbow', 'r_tank', 'piercing beats armour'], ['h_firemage', 'm_scarab', 'fire beats swarms'], ['d_hound', 'h_priest', 'hunters beat backlines'], ['h_paladin', 'm_mummy', 'holy beats undead']]) {
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
    body.appendChild(steps);
    const foot = el('div', 'menu-foot center');
    foot.appendChild(btn(onDone ? 'GOT IT — FIGHT!' : 'GOT IT', 'primary orn', () => onDone ? onDone() : this.title()));
    body.appendChild(foot);
  }

  // ---------- settings ----------
  settings(fromPause = false) {
    const { body } = this.shell('SETTINGS', { size: 'narrow', onClose: () => fromPause ? this.pause() : this.title() });
    const st = this.prog.settings;
    const slider = (label, desc, key) => {
      const r = el('div', 'setting-row');
      r.appendChild(el('div', null, `<div class="lbl">${label}</div><div class="desc">${desc}</div>`));
      const wrap = el('div', 'slider-wrap');
      const i = document.createElement('input'); i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05; i.value = st[key];
      const val = el('span', 'slider-val', Math.round(st[key] * 100) + '%');
      i.oninput = () => { st[key] = parseFloat(i.value); val.textContent = Math.round(st[key] * 100) + '%'; this.prog.save(); this.cb.settingsChanged(); };
      i.onchange = () => this.cb.click();
      wrap.append(i, val); r.appendChild(wrap); body.appendChild(r);
    };
    const toggle = (label, desc, key) => {
      const r = el('div', 'setting-row');
      r.appendChild(el('div', null, `<div class="lbl">${label}</div><div class="desc">${desc}</div>`));
      const t = el('div', 'toggle' + (st[key] ? ' on' : '')); t.appendChild(el('i'));
      t.onclick = () => { st[key] = !st[key]; t.classList.toggle('on', st[key]); this.prog.save(); this.cb.settingsChanged(); this.cb.click(); };
      r.appendChild(t); body.appendChild(r);
    };
    slider('SOUND EFFECTS', 'Swords, arrows, explosions.', 'sfx');
    slider('MUSIC', 'Chiptune battle themes.', 'music');
    toggle('SCREEN SHAKE', 'Camera kick on heavy hits.', 'shake');
    toggle('DAMAGE NUMBERS', 'Show counter and big-hit numbers.', 'numbers');
    const r = el('div', 'setting-row');
    r.appendChild(el('div', null, '<div class="lbl">PROGRESS</div><div class="desc">Wipe campaign stars and records.</div>'));
    r.appendChild(btn('RESET', 'small red', () => { if (this.confirmReset) { this.prog.reset(); this.cb.settingsChanged(); this.settings(fromPause); } else { this.confirmReset = true; r.lastChild.textContent = 'SURE?'; } }));
    this.confirmReset = false;
    body.appendChild(r);
  }

  // ---------- pause ----------
  pause() {
    const { body, frame } = this.shell('PAUSED', { size: 'narrow', sub: 'THE BATTLE WAITS' });
    frame.classList.add('pause-panel');
    const col = el('div', 'menu-col');
    col.appendChild(btn('RESUME', 'primary orn', () => this.cb.resume()));
    col.appendChild(btn('MY ARMY', '', () => this.roster(this.cb.currentRace(), () => this.pause())));
    col.appendChild(btn('RESTART', '', () => this.cb.restart()));
    col.appendChild(btn('SETTINGS', '', () => this.settings(true)));
    col.appendChild(btn('QUIT TO MENU', 'red', () => this.cb.quit()));
    body.appendChild(col);
  }

  // ---------- stage intro / countdown ----------
  intro(name, tip, sub, races) {
    const s = this.open('clear');
    const box = el('div', 'stage-intro');
    if (sub) box.appendChild(el('div', 'sub chip gold', sub));
    box.appendChild(el('h1', 'pixel-text', name));
    if (races) {
      const vs = el('div', 'intro-vs chip');
      vs.appendChild(this.emblem(races[0])); vs.appendChild(el('span', 'blue', RACES[races[0]].name.toUpperCase())); vs.appendChild(el('b', null, 'VS')); vs.appendChild(el('span', 'red', RACES[races[1]].name.toUpperCase())); vs.appendChild(this.emblem(races[1]));
      box.appendChild(vs);
    }
    if (tip) box.appendChild(el('div', 'tip box', tip));
    this.count = el('div', 'countdown', '3');
    box.appendChild(this.count);
    s.appendChild(box);
    return s;
  }
  setCount(text) { if (this.count) { this.count.textContent = text; this.count.style.animation = 'none'; void this.count.offsetWidth; this.count.style.animation = ''; } }

  // ---------- results ----------
  results(r) {
    const { body } = this.shell('BATTLE REPORT', { size: 'medium', dim: !r.won, sub: r.won ? 'THE ENEMY GATE HAS FALLEN' : r.draw ? 'BOTH GATES STILL STAND' : 'YOUR GATE HAS FALLEN' });
    const box = el('div', 'results');
    box.appendChild(el('div', 'title ' + (r.won ? 'win' : 'lose'), r.draw ? 'DRAW' : r.won ? 'VICTORY' : 'DEFEAT'));
    const vs = el('div', 'intro-vs small chip'); vs.appendChild(this.emblem(r.race, 's')); vs.appendChild(el('span', 'blue', RACES[r.race].name.toUpperCase())); vs.appendChild(el('b', null, 'VS')); vs.appendChild(el('span', 'red', RACES[r.enemyRace].name.toUpperCase())); vs.appendChild(this.emblem(r.enemyRace, 's')); box.appendChild(vs);
    if (r.won) {
      const st = el('div', 'stars');
      for (let i = 0; i < 3; i++) { const sp = el('span', 'ico star ' + (i < r.stars ? 'on' : 'off')); sp.style.animationDelay = (0.3 + i * 0.25) + 's'; st.appendChild(sp); }
      box.appendChild(st);
      box.appendChild(el('div', 'verdict', r.stars === 3 ? 'Flawless command!' : r.stars === 2 ? 'Solid victory. Keep your base healthier for 3 stars.' : 'Close one. Counter faster next time.'));
    } else box.appendChild(el('div', 'verdict', r.hintText || 'The enemy broke through. Read their army and answer with counters.'));
    const grid = el('div', 'stat-grid');
    const stats = [['TIME', fmtTime(r.time)], ['KILLS', r.kills], ['LOST', r.lost], ['GOLD SPENT', r.spent], ['DEPLOYED', r.deployed], ['MVP', r.favourite || '-']];
    stats.forEach(([k, v], i) => { const b = el('div', 'stat-box box', `<small>${k}</small><b>${v}</b>`); b.style.animationDelay = (0.1 * i) + 's'; grid.appendChild(b); });
    box.appendChild(grid);
    if (r.mvpId) { const m = el('div', 'mvp-box box gold'); m.appendChild(unitIconFit(this.atlas, r.mvpId, TEAM.PLAYER, 48)); m.appendChild(el('div', 't', `<b>MOST DEPLOYED</b>${UNITS[r.mvpId].name} &middot; ${r.mvpN} squads`)); box.appendChild(m); }
    const foot = el('div', 'menu-foot center');
    if (r.won && r.next) foot.appendChild(btn('NEXT STAGE', 'primary orn', () => this.cb.nextStage()));
    foot.appendChild(btn(r.won ? 'PLAY AGAIN' : 'RETRY', r.won && r.next ? 'human' : 'primary orn', () => this.cb.restart()));
    foot.appendChild(btn('CHANGE RACE', 'ghost', () => this.cb.changeRace()));
    foot.appendChild(btn('MENU', 'ghost', () => this.cb.quit()));
    box.appendChild(foot);
    body.appendChild(box);
  }
}
