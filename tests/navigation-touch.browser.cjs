const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(`${base}/#/`);
    await page.waitForSelector('.category-card');
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, Math.min(480, document.body.scrollHeight - innerHeight));
    });
    await page.waitForTimeout(120);
    const before = await page.evaluate(() => scrollY);
    await page.locator('.category-card[href="#/category/retro"]').evaluate(node => node.click());
    await page.waitForSelector('.game-card');
    await page.waitForTimeout(40);
    assert.equal(await page.evaluate(() => scrollY), 0);
    await page.goBack();
    await page.waitForSelector('.category-card');
    await page.waitForTimeout(80);
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - before) <= 4, 'SPA route restores scroll position');

    await page.goto(`${base}/games/2048/`);
    await page.locator('.ch-homebtn').click();
    await page.waitForLoadState('domcontentloaded');
    assert.match(page.url(), /\/index\.html(?:#|$)/, 'Chogan home button returns to the game hall');

    await page.goto(`${base}/games/bounce-back/`);
    const portHome = page.getByRole('link', { name: '返回游戏厅主页' });
    await portHome.waitFor();
    assert.equal(await portHome.getAttribute('href'), '../../index.html');
    await portHome.click();
    await page.waitForLoadState('domcontentloaded');
    assert.match(page.url(), /\/index\.html(?:#|$)/, 'port shell home link returns to the game hall');

    await page.goto(`${base}/games/2048/`);
    const touch = await page.locator('.m-board').evaluate(node => {
      const style = getComputedStyle(node);
      return { action: style.touchAction, overscroll: style.overscrollBehavior };
    });
    assert.equal(touch.action, 'none');
    assert.match(touch.overscroll, /contain/);
    assert.deepEqual(errors, []);
    console.log('navigation and touch isolation passed');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
