// Browser regression for cards jumping to the origin during invalid-move feedback.
// Start a static server, then run with Playwright available on NODE_PATH:
// GAME_BASE_URL=http://127.0.0.1:8765 CHROME_PATH=/path/to/chrome node tests/card-feedback.browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    for (const fallback of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(({ fallback }) => {
        for (const id of ['spider', 'klondike']) localStorage.setItem('chogan.' + id + '.tutSeen', 'true');
        if (fallback) {
          const supports = CSS.supports.bind(CSS);
          CSS.supports = (...args) => args[0] === 'translate' ? false : supports(...args);
        }
      }, { fallback });
      for (const [id, prefix] of [['spider', 'sp'], ['klondike', 'kl']]) {
        await page.goto(`${base}/games/${id}/index.html?from=cards`);
        if (fallback) await page.addStyleTag({ content: '.ch-shake { animation-name: ch-shake !important; }' });
        await page.waitForTimeout(1700);
        const result = await page.evaluate(async prefix => {
          const cards = [...document.querySelectorAll(`.${prefix}-card:not(.${prefix}-card--down)`)];
          const node = cards.filter(n => getComputedStyle(n).visibility !== 'hidden').sort((a, b) => b.getBoundingClientRect().x - a.getBoundingClientRect().x)[0];
          const before = node.getBoundingClientRect(), transform = node.style.transform;
          Chogan.ui.shake(node);
          let maxX = 0, maxY = 0;
          const start = performance.now();
          while (performance.now() - start < 600) {
            await new Promise(requestAnimationFrame);
            const r = node.getBoundingClientRect();
            maxX = Math.max(maxX, Math.abs(r.x - before.x));
            maxY = Math.max(maxY, Math.abs(r.y - before.y));
          }
          const after = node.getBoundingClientRect();
          return { maxX, maxY, restored: Math.abs(after.x - before.x) < 0.1 && Math.abs(after.y - before.y) < 0.1, transformUnchanged: node.style.transform === transform, cleaned: !node.classList.contains('ch-shake') && !node.style.getPropertyValue('--ch-shake-base') };
        }, prefix);
        assert.ok(result.maxX <= 8, `${id}: card jumped ${result.maxX}px`);
        assert.ok(result.maxY < 1, `${id}: card jumped vertically ${result.maxY}px`);
        assert.ok(result.restored && result.transformUnchanged && result.cleaned);
        console.log(`${id}: shake stays within 8px and restores position (${fallback ? 'legacy fallback' : 'independent translate'})`);
      }
      const repeated = await page.evaluate(async () => {
        const node = document.querySelector('.kl-card');
        Chogan.ui.shake(node);
        await new Promise(r => setTimeout(r, 300));
        Chogan.ui.shake(node);
        await new Promise(r => setTimeout(r, 280));
        const active = node.classList.contains('ch-shake');
        await new Promise(r => setTimeout(r, 300));
        return { active, cleaned: !node.classList.contains('ch-shake') };
      });
      assert.ok(repeated.active && repeated.cleaned, 'Earlier timer must not cancel a repeated shake');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.evaluate(() => { const n = document.querySelector('.kl-card'); Chogan.ui.shake(n); return n.classList.contains('ch-shake'); }), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Repeated clicks and reduced-motion preference passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
