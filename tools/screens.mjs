// Capture every screen of the game for docs/screen-bible.html.
//   node tools/serve.mjs 8766      (in another terminal)
//   node tools/screens.mjs [outdir=docs/screens] [width=960]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const out = process.argv[2] || 'docs/screens';
const width = Number(process.argv[3] || 960);
const url = (process.env.GAME_URL || 'http://127.0.0.1:8766') + '/index.html?bg=1';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.GAME?.menus && GAME.renderer.atlas.art && GAME.renderer.atlas.art.ready);
await page.waitForTimeout(800);
const shot = async (name, fn, wait = 450) => {
  await fn(); await page.waitForTimeout(wait);
  const buf = await page.screenshot({ type: 'jpeg', quality: 82, scale: 'css' });
  // downscale in-page with a canvas so the docs stay light
  const small = await page.evaluate(async ([b64, w]) => {
    const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = Math.round(img.height * w / img.width);
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.84).split(',')[1];
  }, [buf.toString('base64'), width]);
  await (await import('node:fs/promises')).writeFile(`${out}/${name}.jpg`, Buffer.from(small, 'base64'));
  console.log('captured', name);
};
const m = (js) => () => page.evaluate(js);
await shot('01-title', m(() => GAME.menus.title()));
await shot('02-armies', m(() => GAME.menus.raceSelect({ mode: 'pick', enemyRace: 'demon', onPick: () => {}, onBack: () => {} })));
for (const [i, r] of ['human', 'demon', 'robot', 'mummy'].entries()) await shot(`0${3 + i}-roster-${r}`, m(`() => GAME.menus.roster('${r}')`));
await shot('07-unit-detail', async () => { await page.evaluate(() => GAME.menus.roster('human', null, 'h_king')); await page.waitForTimeout(600); await page.evaluate(() => document.querySelector('.unit-detail').scrollIntoView()); });
await shot('08-race-reveal', m(() => GAME.menus.raceReveal('robot', { onPick: () => {} })), 900);
await shot('09-campaign', m(() => GAME.menus.campaign()));
await shot('10-skirmish', m(() => GAME.menus.skirmishMenu()));
await shot('11-how-to-play', m(() => GAME.menus.howto()));
await shot('12-settings', m(() => GAME.menus.settings()));
await shot('13-results', m(() => GAME.menus.results({ won: true, stars: 3, time: 512, kills: 231, lost: 120, spent: 4210, deployed: 44, favourite: 'Royal Scout', mvpId: 'h_knight', mvpN: 9, next: true, race: 'human', enemyRace: 'demon' })), 1400);
// battle: intro, opening HUD, mid fight, tooltip, pause
await page.evaluate(() => { GAME.menus.close(); GAME.startBattle({ race: 'human', enemyRace: 'demon', difficulty: 'normal', theme: 'meadow' }); });
await page.waitForTimeout(400);
await shot('18-stage-intro', async () => {}, 0);
await page.waitForFunction(() => GAME.phase === 'fight', null, { timeout: 20000 });
await shot('15-hud-start', async () => {}, 300);
await page.evaluate(() => { GAME.battle.gold[0] = 999; GAME.speed = 1; });
for (let i = 0; i < 6; i++) await page.locator('.ucard').nth(i).click();
await page.evaluate(() => { GAME.battle.gold[0] = 600; });
await shot('16-hud-fight', async () => { await page.waitForTimeout(26000); }, 0);
await shot('17-card-tooltip', async () => { await page.locator('.ucard').nth(3).hover(); }, 400);
await shot('14-pause', async () => { await page.keyboard.press('Escape'); }, 400);
console.log(errors.length ? 'ERRORS ' + JSON.stringify(errors) : 'no runtime errors');
await browser.close();
