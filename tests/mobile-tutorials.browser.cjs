// Fresh visits must keep tutorial artwork and touch navigation reachable.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/games.js'), 'utf8'), { window });
const games = window.GAME_DATA.games.filter(g => {
  const html = fs.readFileSync(path.join(__dirname, '..', g.url.split('?')[0]), 'utf8');
  return /ctx\.tutorialIfNew\(/.test(html) && (!process.env.GAME_IDS || process.env.GAME_IDS.split(',').includes(g.id));
});
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8765';
(async () => {
  assert.ok(games.length, 'No tutorial games selected');
  const engine = process.env.BROWSER_ENGINE === 'webkit' ? webkit : chromium;
  const browser = await engine.launch(engine === webkit ? {} : { executablePath: process.env.CHROME_PATH });
  try {
    for (const game of games) {
      const context = await browser.newContext({ viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true });
      try {
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(base + '/' + game.url);
        const modal = page.locator('.ch-modal--tutorial');
        await modal.waitFor();
        await page.waitForTimeout(400);
        const pages = await modal.locator('.ch-tut__dot').count();
        for (const size of [{ width: 568, height: 320 }, { width: 320, height: 568 }]) {
          await page.setViewportSize(size);
          await page.waitForTimeout(200);
          assert.ok(await modal.evaluate(n => {
            const r = n.getBoundingClientRect(), art = n.querySelector('.ch-tut__art').getBoundingClientRect();
            return r.top >= 0 && r.bottom <= innerHeight && art.top >= r.top &&
              n.querySelector('.ch-tut').scrollTop === 0 &&
              [...n.querySelectorAll('.ch-modal__actions button')].every(b => {
                const box = b.getBoundingClientRect();
                return box.top >= r.top && box.bottom <= r.bottom && b.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
              });
          }), game.id + ': artwork starts at top and navigation is visible ' + JSON.stringify(size));
        }
        await page.setViewportSize({ width: 568, height: 320 });
        const next = modal.locator('.ch-modal__actions button').last();
        for (let i = 0; i < pages; i++) { await next.tap(); await page.waitForTimeout(150); }
        await modal.waitFor({ state: 'detached' });
        await page.reload(); await page.waitForTimeout(400);
        assert.equal(await modal.count(), 0, game.id + ': completion is remembered');
        assert.deepEqual(errors, []);
        console.log(game.id + ': fresh tutorial, rotation, touch pages and remembered completion passed');
      } finally { await context.close(); }
    }
    console.log(engine.name() + ': ' + games.length + ' mobile tutorials passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
