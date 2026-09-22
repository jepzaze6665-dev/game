// Real browser smoke/interaction checks. Start tools/serve.mjs first.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const url = process.env.GAME_URL || 'http://127.0.0.1:8766';
await mkdir('progress/screenshots', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.GAME?.menus);
  await page.screenshot({ path: 'progress/screenshots/title.png' });
  await page.getByRole('button', { name: 'SKIRMISH', exact: true }).click();
  await page.getByRole('button', { name: 'CHOOSE RACE & FIGHT' }).click();
  assert.equal(await page.locator('.race-card').count(), 4);
  await page.screenshot({ path: 'progress/screenshots/races.png' });
  for (const race of ['human', 'demon', 'robot', 'mummy']) {
    if (race !== 'human') {
      await page.getByRole('button', { name: 'SKIRMISH', exact: true }).click();
      await page.getByRole('button', { name: 'CHOOSE RACE & FIGHT' }).click();
    }
    await page.locator('.race-card.' + race).getByRole('button', { name: 'VIEW UNITS' }).click();
    assert.equal(await page.locator('.roster-card').count(), 12);
    await page.locator('.roster-card').last().click();
    await page.screenshot({ path: `progress/screenshots/${race}-roster.png` });
    await page.getByRole('button', { name: 'BACK', exact: true }).click();
    await page.locator('.race-card.' + race).getByRole('button', { name: 'CHOOSE', exact: true }).click();
    await page.getByRole('button', { name: 'TO BATTLE' }).click();
    if (await page.getByRole('button', { name: 'SKIP', exact: true }).count()) await page.getByRole('button', { name: 'SKIP', exact: true }).click();
    await page.waitForFunction(() => GAME.phase === 'fight');
    assert.equal(await page.locator('.ucard').count(), 12);
    // Stage resources only; every deployment below uses actual card input.
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => { GAME.battle.gold[0] = 999; });
      await page.locator('.ucard').nth(i).click();
    }
    assert.equal(await page.evaluate(() => Object.keys(GAME.battle.stats[0].squads).length), 12);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `progress/screenshots/${race}-battle.png` });
    await page.locator('button[title="Pause (Esc)"]').click();
    assert.equal(await page.evaluate(() => GAME.paused), true);
    await page.getByRole('button', { name: 'RESUME', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'RESTART', exact: true }).click();
    await page.waitForFunction(() => GAME.phase === 'fight');
    assert.equal(await page.evaluate(() => GAME.battle.races[0]), race);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'QUIT TO MENU', exact: true }).click();
    console.log(race + ': roster, all 12 deployments, pause, resume, restart passed');
  }
  const mobile = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto(url);
  await mobile.waitForFunction(() => window.GAME?.menus);
  await mobile.getByRole('button', { name: 'SKIRMISH', exact: true }).tap();
  await mobile.getByRole('button', { name: 'CHOOSE RACE & FIGHT' }).tap();
  await mobile.locator('.race-card.robot').getByRole('button', { name: 'CHOOSE', exact: true }).tap();
  await mobile.getByRole('button', { name: 'TO BATTLE' }).tap();
  await mobile.getByRole('button', { name: 'SKIP', exact: true }).tap();
  await mobile.waitForFunction(() => GAME.phase === 'fight');
  const bounds = await mobile.locator('.ucard, .base-bar, .hud-btns, .gold').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { cls: e.className, x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
  console.log('mobile bounds', JSON.stringify(bounds));
  for (const b of bounds) assert.ok(b.x >= 0 && b.y >= 0 && b.right <= 844.5 && b.bottom <= 390.5, 'mobile overflow ' + JSON.stringify(b));
  await mobile.locator('.ucard').first().tap();
  assert.equal(await mobile.evaluate(() => Object.keys(GAME.battle.stats[0].squads).length), 1);
  await mobile.screenshot({ path: 'progress/screenshots/mobile.png' });
  // Hold is inspection only, including the click generated on release.
  const card = mobile.locator('.ucard').nth(1);
  const box = await card.boundingBox();
  const before = await mobile.evaluate(() => GAME.battle.stats[0].spent);
  await mobile.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await mobile.mouse.down(); await mobile.waitForTimeout(600); await mobile.mouse.up();
  assert.equal(await mobile.evaluate(() => GAME.battle.stats[0].spent), before);
  assert.ok(await mobile.locator('#tooltip.show').count());
  // Stage the boundary; the normal frame loop must render the draw results.
  await mobile.evaluate(() => { GAME.battle.units = []; GAME.battle.projectiles = []; GAME.battle.spawnQueue = []; GAME.battle.bases.forEach(b => b.hp = 100); GAME.battle.time = (GAME.battle.timeLimit || 1200) - 0.01; });
  await mobile.getByText('DRAW', { exact: true }).waitFor({ timeout: 15000 });
  await mobile.screenshot({ path: 'progress/screenshots/draw.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: browser interactions, mobile tap, no runtime errors');
} finally { await browser.close(); }
