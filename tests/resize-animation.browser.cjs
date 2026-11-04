const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    for (const [id, prefix] of [['spider', 'sp'], ['klondike', 'kl'], ['sliding', 'sp']]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(id => localStorage.setItem('chogan.' + id + '.tutSeen', 'true'), id);
      await page.goto(`${base}/games/${id}/index.html`);
      if (id !== 'sliding') {
        // Exercise a long in-flight card at rotation, not just the settled table.
        await page.evaluate(prefix => {
          const node = [...document.querySelectorAll(`.${prefix}-card`)].find(n => getComputedStyle(n).visibility !== 'hidden');
          const rect = node.getBoundingClientRect();
          Chogan.ui.fly(node, { left: rect.left + 300, top: rect.top, width: rect.width, height: rect.height }, { ms: 3000 });
        }, prefix);
      }
      for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
        await page.setViewportSize(size);
        await page.waitForTimeout(100);
        const report = await page.evaluate(({ id, prefix }) => {
          const selector = id === 'sliding' ? '.sp-tile' : `.${prefix}-card`;
          const cards = [...document.querySelectorAll(selector)].filter(n => getComputedStyle(n).visibility !== 'hidden');
          return {
            outside: cards.filter(n => { const r = n.getBoundingClientRect(); return r.left < -2 || r.right > innerWidth + 2; }).length,
            staleFlights: cards.filter(n => n._chFlight && n._chFlight.playState === 'running').length
          };
        }, { id, prefix });
        assert.equal(report.outside, 0, `${id} cards outside ${size.width}px viewport`);
        assert.equal(report.staleFlights, 0, `${id} still flies toward pre-rotation coordinates`);
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${id}: resize during animation stays inside the viewport`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
