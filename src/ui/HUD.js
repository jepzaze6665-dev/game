// In-battle HUD: resources, army counts, base bars, centre numbers, unit bar.
import { UNITS, RACE_UNITS, RACES, TEAM, BASE_STATS, ECONOMY } from '../data/units.js';
import { counterMultiplier } from '../sim/Combat.js';
import { unitIconFit } from './icons.js';

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${s.toString().padStart(2, '0')}`; }

export class HUD {
  constructor(root, atlas, callbacks) {
    this.root = root; this.atlas = atlas; this.cb = callbacks;
    this.el = el('div', 'hidden'); this.el.id = 'hud';
    root.appendChild(this.el);
    this.cards = {};
    this.cache = {};
    this.compCache = { 0: {}, 1: {} };
    this.tooltipTimer = null;
    this.build();
  }

  build() {
    this.el.innerHTML = '';
    // vignette + flash
    this.vignette = el('div'); this.vignette.id = 'vignette'; this.el.appendChild(this.vignette);
    this.flash = el('div'); this.flash.id = 'flash'; this.el.appendChild(this.flash);
    // top bar
    const top = el('div'); top.id = 'hud-top';
    const left = el('div', 'hud-left');
    const row1 = el('div', 'hud-row');
    this.raceChip = el('div', 'hud-chip race');
    this.raceIcon = el('span', 'ico'); this.raceChip.appendChild(this.raceIcon);
    this.raceName = el('span', 'sub', 'HUMAN'); this.raceChip.appendChild(this.raceName);
    row1.appendChild(this.raceChip);
    this.goldChip = el('div', 'hud-chip gold');
    this.goldChip.appendChild(el('span', 'ico coin'));
    this.goldVal = el('span', 'val', '0'); this.goldChip.appendChild(this.goldVal);
    this.goldSub = el('span', 'sub', '+8/s'); this.goldChip.appendChild(this.goldSub);
    row1.appendChild(this.goldChip);
    this.armyP = el('div', 'hud-chip army-p');
    this.armyPVal = el('span', 'val', '0'); this.armyP.appendChild(this.armyPVal);
    this.armyP.appendChild(el('span', 'sub', 'ARMY'));
    row1.appendChild(this.armyP);
    left.appendChild(row1);
    this.compP = el('div', 'comp-row'); left.appendChild(this.compP);
    top.appendChild(left);

    const center = el('div', 'hud-center');
    const bars = el('div', 'base-bars');
    this.barP = this.makeBar('p', 'YOUR CASTLE'); bars.appendChild(this.barP.el);
    this.timer = el('div', 'timer'); this.timer.appendChild(el('span', 'ico clock')); this.timerTxt = el('span', null, '0:00'); this.timer.appendChild(this.timerTxt); bars.appendChild(this.timer);
    this.timer.title = 'Destroy the enemy base to win. Siege damage rises at 6:00, both gates crumble from 12:00, 20 minute cap.';
    this.barE = this.makeBar('e', 'ENEMY FORTRESS'); bars.appendChild(this.barE.el);
    center.appendChild(bars);
    const nums = el('div', 'center-nums');
    this.numP = el('div', 'n p', '0'); nums.appendChild(this.numP);
    const vs = el('div', 'vs'); vs.innerHTML = '<span>&#9876;</span><small>UNITS</small>'; nums.appendChild(vs);
    this.numE = el('div', 'n e', '0'); nums.appendChild(this.numE);
    center.appendChild(nums);
    this.push = el('div', 'push-meter'); this.push.innerHTML = '<div class="pl"></div><div class="en"></div><div class="mk"></div>';
    center.appendChild(this.push);
    // wave clock: everything bought now marches together when it hits zero
    this.waveRow = el('div', 'wave-row');
    this.waveLabel = el('div', 'wave-label', 'NEXT WAVE');
    this.waveBar = el('div', 'wave-bar'); this.waveBar.appendChild(el('i'));
    this.waveTime = el('div', 'wave-time', '10');
    this.waveQueueEl = el('div', 'wave-queue');
    this.waveRow.append(this.waveLabel, this.waveBar, this.waveTime, this.waveQueueEl);
    this.waveRow.title = 'Units you buy muster and march together when the wave clock hits zero (both sides).';
    center.appendChild(this.waveRow);
    // minimap: the whole lane; click to look, Space or the button to follow the fight again
    this.minimap = document.createElement('canvas'); this.minimap.className = 'minimap'; this.minimap.width = 320; this.minimap.height = 26;
    this.minimap.title = 'Battlefield overview. Click to look there; drag the battlefield or use A/D; Space follows the fight again.';
    this.minimap.addEventListener('pointerdown', (e) => { const r = this.minimap.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width; this.cb.lookAt((fx - 0.5) * (2 * BASE_STATS.x + 12)); });
    center.appendChild(this.minimap);
    this.killRow = el('div', 'kill-row'); this.killRow.innerHTML = '<span>KILLS <b class="kp">0</b></span><span>LOST <b class="lp">0</b></span>';
    center.appendChild(this.killRow);
    top.appendChild(center);

    const right = el('div', 'hud-right');
    const row2 = el('div', 'hud-row');
    this.btns = el('div', 'hud-btns');
    this.speedBtn = el('button', 'btn icon small', '1x'); this.speedBtn.title = 'Game speed';
    this.speedBtn.onclick = () => this.cb.toggleSpeed();
    this.soundBtn = el('button', 'btn icon small', '&#9835;'); this.soundBtn.title = 'Sound';
    this.soundBtn.onclick = () => this.cb.toggleSound();
    this.pauseBtn = el('button', 'btn icon small', '&#10074;&#10074;'); this.pauseBtn.title = 'Pause (Esc)';
    this.pauseBtn.onclick = () => this.cb.pause();
    this.btns.append(this.speedBtn, this.soundBtn, this.pauseBtn);
    this.armyE = el('div', 'hud-chip army-e');
    this.armyEVal = el('span', 'val', '0'); this.armyE.appendChild(this.armyEVal);
    this.armyE.appendChild(el('span', 'sub', 'ENEMY'));
    this.enemyRaceChip = el('div', 'hud-chip race enemy');
    this.enemyRaceName = el('span', 'sub', 'DEMON'); this.enemyRaceChip.appendChild(this.enemyRaceName);
    this.enemyRaceIcon = el('span', 'ico'); this.enemyRaceChip.appendChild(this.enemyRaceIcon);
    row2.append(this.enemyRaceChip, this.armyE, this.btns);
    right.appendChild(row2);
    this.compE = el('div', 'comp-row'); this.compE.style.justifyContent = 'flex-end'; right.appendChild(this.compE);
    top.appendChild(right);
    this.el.appendChild(top);

    // unit bar
    this.bar = el('div'); this.bar.id = 'unit-bar';
    this.el.appendChild(this.bar);
    // tooltip, toasts, banner
    this.tooltip = el('div'); this.tooltip.id = 'tooltip'; this.el.appendChild(this.tooltip);
    this.toasts = el('div'); this.toasts.id = 'toasts'; this.el.appendChild(this.toasts);
    this.banner = el('div'); this.banner.id = 'banner'; this.el.appendChild(this.banner);
    this.hint = null;
  }

  makeBar(cls, label) {
    const e = el('div', `base-bar ${cls}`);
    const ghost = el('div', 'ghost'), fill = el('div', 'fill'), txt = el('div', 'txt'), lbl = el('div', 'lbl', label);
    e.append(ghost, fill, txt, lbl);
    return { el: e, ghost, fill, txt, last: -1 };
  }

  // Build the 12 unit cards for this battle's roster and the race chips.
  setRoster(roster, race, enemyRace) {
    this.cancelLongPress(); this.hideTooltip(); this.cache = {};
    this.race = race; this.enemyRace = enemyRace; this.roster = roster;
    this.barP.el.querySelector('.lbl').textContent = 'YOUR ' + RACES[race].base.toUpperCase();
    this.barE.el.querySelector('.lbl').textContent = 'ENEMY ' + RACES[enemyRace].base.toUpperCase();
    this.raceChip.title = RACES[race].passive.name + ': ' + RACES[race].passive.desc;
    this.raceIcon.className = 'ico em ' + race; this.raceChip.className = 'hud-chip race ' + race;
    this.raceName.textContent = RACES[race].name.toUpperCase();
    this.enemyRaceIcon.className = 'ico em ' + enemyRace; this.enemyRaceChip.className = 'hud-chip race enemy ' + enemyRace;
    this.enemyRaceName.textContent = RACES[enemyRace].name.toUpperCase();
    this.compCache = { 0: {}, 1: {} }; this.compP.innerHTML = ''; this.compE.innerHTML = '';
    this.bar.innerHTML = '';
    this.cards = {};
    for (const id of RACE_UNITS[race]) {
      const def = UNITS[id];
      const inRoster = roster.includes(id);
      const c = el('button', 'ucard tier' + def.tier);
      c.dataset.id = id;
      c.appendChild(el('span', 'key', def.hotkey));
      c.appendChild(el('span', 'squad', 'x' + def.squad));
      const box = window.innerWidth < 900 ? 32 : 44;
      const icon = unitIconFit(this.atlas, id, TEAM.PLAYER, box); icon.className = 'icon'; c.appendChild(icon);
      c.appendChild(el('span', 'name', def.name));
      const cost = el('span', 'cost');
      cost.appendChild(el('span', 'ico coin'));
      cost.appendChild(el('span', null, String(def.cost)));
      c.appendChild(cost);
      c.appendChild(el('div', 'cd'));
      c.appendChild(el('div', 'cdt', ''));
      if (def.tier >= 11) c.appendChild(el('span', 'tierstar', '<span class="ico star"></span>'.repeat(def.tier === 12 ? 2 : 1)));
      if (!inRoster) { c.classList.add('locked'); c.appendChild(el('div', 'lockico', '<span class="ico lock"></span>')); }
      c.setAttribute('aria-label', `${def.name}, ${def.role}, ${def.cost} gold. Hold to inspect.`);
      let held = false;
      c.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        held = false; this.cancelLongPress();
        this.tooltipTimer = setTimeout(() => { held = true; this.showTooltip(id, c); }, 450);
      });
      c.addEventListener('pointerup', () => this.cancelLongPress());
      c.addEventListener('click', () => { if (!held && inRoster) this.cb.deploy(id); held = false; });
      c.addEventListener('pointerleave', () => { this.cancelLongPress(); this.hideTooltip(); });
      c.addEventListener('pointercancel', () => this.cancelLongPress());
      c.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) this.showTooltip(id, c); });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      this.bar.appendChild(c);
      this.cards[id] = { el: c, cd: c.querySelector('.cd'), cdt: c.querySelector('.cdt'), inRoster, state: '' };
    }
  }

  startLongPress(id, c) { this.cancelLongPress(); this.tooltipTimer = setTimeout(() => this.showTooltip(id, c), 450); }
  cancelLongPress() { if (this.tooltipTimer) { clearTimeout(this.tooltipTimer); this.tooltipTimer = null; } }

  showTooltip(id, card) {
    const def = UNITS[id];
    const t = this.tooltip;
    t.innerHTML = '';
    t.appendChild(el('h4', null, `${def.name} <span class="muted">x${def.squad}</span> <span class="muted small">${def.role}</span>`));
    t.appendChild(el('div', 'role', def.description));
    const st = el('div', 'statline');
    for (const [k, v] of [['HP', def.hp], ['DMG', def.damage], ['ARM', def.armor || 0], ['RNG', def.attackRange >= 3 ? def.attackRange.toFixed(0) : 'MELEE']]) st.appendChild(el('div', null, `<b>${v}</b><small>${k}</small>`));
    t.appendChild(st);
    if (def.ability) t.appendChild(el('div', 'abil', `<b>${def.ability.name}</b> ${def.ability.desc}`));
    const tags = el('div', 'tagrow'); for (const tg of def.counterTags) tags.appendChild(el('span', 'tag mini', tg)); t.appendChild(tags);
    const good = el('div', 'cr good'); good.appendChild(el('b', null, 'STRONG VS'));
    for (const s of def.strongAgainst) good.appendChild(el('span', 'tag mini good', s));
    if (!def.strongAgainst.length) good.appendChild(el('span', 'muted', '&mdash;'));
    t.appendChild(good);
    const bad = el('div', 'cr bad'); bad.appendChild(el('b', null, 'WEAK VS'));
    for (const s of def.weakAgainst) bad.appendChild(el('span', 'tag mini bad', s));
    t.appendChild(bad);
    t.classList.add('show');
    const r = card.getBoundingClientRect();
    const z = this.zoom || 1;
    const w = 270;
    const vw = window.innerWidth / z;
    // dock beside the card bar (left for the first half of the roster, right for the rest)
    const leftSide = (r.left / z + r.width / z / 2) < vw / 2;
    t.style.left = leftSide ? '10px' : 'auto';
    t.style.right = leftSide ? 'auto' : '10px';
    t.style.bottom = (window.innerHeight / z - r.bottom / z) + 'px';
    t.style.top = 'auto';
    t.style.width = w + 'px';
  }
  hideTooltip() { this.tooltip.classList.remove('show'); }

  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); this.hideTooltip(); }

  toast(text, kind = '') {
    const t = el('div', 'toast ' + kind, text);
    this.toasts.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 1300);
    setTimeout(() => t.remove(), 1700);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
  }

  showBanner(text, cls = '', sub = '', ms = 1600) {
    this.banner.innerHTML = '';
    const b = el('div', 'banner-text ' + cls, text);
    this.banner.appendChild(b);
    if (sub) this.banner.appendChild(el('span', 'banner-sub', sub));
    if (ms > 0) setTimeout(() => { if (this.banner.contains(b)) this.banner.innerHTML = ''; }, ms);
  }
  clearBanner() { this.banner.innerHTML = ''; }

  showHint(text) {
    this.hideHint();
    this.hint = el('div', 'tutorial-hint', `<div class="txt">${text}</div><div class="arrow">&#9660;</div>`);
    this.el.appendChild(this.hint);
  }
  hideHint() { if (this.hint) { this.hint.remove(); this.hint = null; } }

  deployFeedback(id, reason) {
    const card = this.cards[id];
    if (!card) return;
    card.el.classList.remove('deploy', 'deny');
    void card.el.offsetWidth;
    if (!reason) { card.el.classList.add('deploy'); this.goldChip.classList.remove('flash'); void this.goldChip.offsetWidth; this.goldChip.classList.add('flash'); return; }
    card.el.classList.add('deny');
    if (reason === 'gold') { this.goldChip.classList.remove('deny'); void this.goldChip.offsetWidth; this.goldChip.classList.add('deny'); this.toast('NOT ENOUGH GOLD', 'warn'); }
    else if (reason === 'full') this.toast('ARMY IS FULL', 'warn');
    else if (reason === 'locked') this.toast('UNIT LOCKED', 'warn');
  }

  baseHitFeedback(team) {
    const bar = team === TEAM.PLAYER ? this.barP : this.barE;
    bar.el.classList.remove('hit'); void bar.el.offsetWidth; bar.el.classList.add('hit');
  }

  setSpeed(s) { this.speedBtn.textContent = s + 'x'; this.speedBtn.classList.toggle('on', s > 1); }
  setSound(on) { this.soundBtn.innerHTML = on ? '&#9835;' : '&#9835;&#824;'; this.soundBtn.classList.toggle('on', !on); }

  drawMinimap(battle, dt) {
    this.mmT = (this.mmT || 0) + dt; if (this.mmT < 0.08) return; this.mmT = 0;
    const cv = this.minimap, ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    const span = 2 * BASE_STATS.x + 12, toX = (x) => (x / span + 0.5) * W;
    ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#4a3a24'; ctx.fillRect(toX(-BASE_STATS.x), 6, toX(BASE_STATS.x) - toX(-BASE_STATS.x), H - 12);
    ctx.fillStyle = '#3b82f6'; ctx.fillRect(toX(-BASE_STATS.x) - 4, 3, 5, H - 6);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(toX(BASE_STATS.x) - 1, 3, 5, H - 6);
    for (const u of battle.units) { if (u.state === 'dead') continue; ctx.fillStyle = u.team === TEAM.PLAYER ? '#93c5fd' : '#fca5a5'; ctx.fillRect(Math.round(toX(u.x)), Math.round(H / 2 + u.y * 1.6) - 1, 2, 2); }
    if (this.cam) { const { x, halfW } = this.cam(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(toX(x - halfW)) + 0.5, 1.5, Math.round(toX(x + halfW) - toX(x - halfW)), H - 3); }
  }

  update(battle, dt) {
    const c = this.cache;
    const gold = Math.floor(battle.gold[0]);
    if (c.gold !== gold) { c.gold = gold; this.goldVal.textContent = gold; }
    const regen = '+' + battle.regen[0].toFixed(0) + '/s';
    if (c.regen !== regen) { c.regen = regen; this.goldSub.textContent = regen; }
    const cp = battle.counts[0], ce = battle.counts[1];
    if (c.cp !== cp) { c.cp = cp; this.armyPVal.textContent = cp; this.numP.textContent = cp; this.pop(this.numP); }
    if (c.ce !== ce) { c.ce = ce; this.armyEVal.textContent = ce; this.numE.textContent = ce; this.pop(this.numE); }
    const t = fmtTime(battle.time);
    if (c.t !== t) { c.t = t; this.timerTxt.textContent = t; }
    this.updateBar(this.barP, battle.bases[0]);
    this.updateBar(this.barE, battle.bases[1]);
    // push meter: frontline from -base .. +base → 0..100%
    const pct = Math.max(0, Math.min(100, (battle.frontline + BASE_STATS.x) / (2 * BASE_STATS.x) * 100));
    const pr = Math.round(pct);
    if (c.push !== pr) { c.push = pr; this.push.children[0].style.width = pr + '%'; this.push.children[1].style.width = (100 - pr) + '%'; this.push.children[2].style.left = pr + '%'; }
    // wave clock + queued squads
    const wt = Math.ceil(battle.waveT);
    if (c.wt !== wt) { c.wt = wt; this.waveTime.textContent = wt; }
    this.waveBar.firstChild.style.width = Math.round(battle.waveT / ECONOMY.waveEvery * 100) + '%';
    const qkey = battle.waveQueue[0].join(',');
    if (c.qkey !== qkey) {
      c.qkey = qkey; this.waveQueueEl.innerHTML = '';
      const counts = {}; for (const id of battle.waveQueue[0]) counts[id] = (counts[id] || 0) + 1;
      for (const id in counts) { const chip = el('span', 'wave-chip'); chip.appendChild(unitIconFit(this.atlas, id, TEAM.PLAYER, 18)); chip.appendChild(el('b', null, 'x' + counts[id])); this.waveQueueEl.appendChild(chip); }
      this.waveRow.classList.toggle('empty', !battle.waveQueue[0].length);
    }
    this.drawMinimap(battle, dt);
    const kp = battle.stats[0].kills, lp = battle.stats[0].lost;
    if (c.kp !== kp) { c.kp = kp; this.killRow.querySelector('.kp').textContent = kp; }
    if (c.lp !== lp) { c.lp = lp; this.killRow.querySelector('.lp').textContent = lp; }
    // danger vignette when our castle is low
    const danger = battle.bases[0].hp / battle.bases[0].maxHp < 0.25 && battle.bases[0].hp > 0;
    if (c.danger !== danger) { c.danger = danger; this.vignette.classList.toggle('danger', danger); }
    // composition chips (throttled)
    c.compT = (c.compT || 0) + dt;
    if (c.compT > 0.25) { c.compT = 0; this.updateComp(battle); }
    // unit cards
    const recommended = this.recommendation(battle);
    for (const id in this.cards) {
      const card = this.cards[id];
      if (!card.inRoster) continue;
      const def = UNITS[id];
      const cd = battle.cooldownLeft(0, id);
      const full = battle.armyFull(0);
      let state = cd > 0 ? 'cooldown' : (gold >= def.cost && !full) ? 'affordable' : 'poor';
      if (card.state !== state) {
        card.state = state;
        card.el.classList.toggle('affordable', state === 'affordable');
        card.el.classList.toggle('poor', state === 'poor');
      }
      const pctCd = cd > 0 ? (cd / def.cooldown * 100) : 0;
      const pr2 = Math.round(pctCd);
      if (card.cdPct !== pr2) { card.cdPct = pr2; card.cd.style.height = pr2 + '%'; card.cdt.textContent = cd > 0.05 ? (Math.ceil(cd * 10) / 10).toFixed(1) + 's' : ''; }
      const rec = recommended === id && state !== 'cooldown';
      if (card.rec !== rec) { card.rec = rec; card.el.classList.toggle('recommended', rec); }
    }
  }

  pop(e) { e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); setTimeout(() => e.classList.remove('pop'), 120); }

  updateBar(bar, base) {
    const pct = Math.max(0, base.hp / base.maxHp * 100);
    const r = Math.round(pct * 10) / 10;
    if (bar.last === r) return;
    bar.last = r;
    bar.fill.style.width = r + '%';
    bar.ghost.style.width = r + '%';
    bar.txt.textContent = Math.max(0, Math.ceil(base.hp)) + ' / ' + base.maxHp;
    bar.el.classList.toggle('critical', pct < 25 && pct > 0);
  }

  updateComp(battle) {
    for (const team of [0, 1]) {
      const comp = battle.composition(team);
      const row = team === 0 ? this.compP : this.compE;
      const cache = this.compCache[team];
      const threat = team === 1 ? this.dominant(comp) : null;
      const raceIds = RACE_UNITS[team === 0 ? this.race : this.enemyRace] || [];
      for (const id of raceIds) {
        const n = comp[id] || 0;
        let chip = cache[id];
        if (n > 0 && !chip) {
          chip = el('div', 'comp-chip ' + (team === 0 ? 'p' : 'e'));
          chip.appendChild(unitIconFit(this.atlas, id, team, 20, 'idle', team === 1));
          chip.appendChild(el('span', null, '0'));
          chip.dataset.n = -1;
          row.appendChild(chip); cache[id] = chip;
        }
        if (chip) {
          if (n === 0) { chip.remove(); delete cache[id]; continue; }
          if (+chip.dataset.n !== n) { chip.dataset.n = n; chip.lastChild.textContent = n; }
          chip.classList.toggle('threat', threat === id);
        }
      }
    }
  }

  dominant(comp) {
    let total = 0, best = null, bestN = 0;
    for (const id in comp) { total += comp[id]; if (comp[id] > bestN) { bestN = comp[id]; best = id; } }
    if (total < 5 || bestN / total < 0.4) return null;
    return best;
  }

  // Suggest the roster unit that best counters the enemy's dominant type.
  recommendation(battle) {
    const comp = battle.composition(1);
    const dom = this.dominant(comp);
    if (!dom) return null;
    const victim = { type: UNITS[dom] };
    let best = null, bestB = 1.2;
    for (const id of battle.roster[0]) {
      const def = UNITS[id];
      let b = counterMultiplier(def, victim);
      if (UNITS[dom].armor >= 6 && (def.damageType === 'magic' || def.damageType === 'fire' || def.damageType === 'energy' || def.armorPiercing)) b += 0.3;
      if (b > bestB && def.cost <= 220) { bestB = b; best = id; }
    }
    return best;
  }
}
