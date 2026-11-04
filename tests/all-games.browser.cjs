// All catalog entries: load, interact, resize, reload, and exercise help dialogs.
// Requires Playwright and a running static server; see tests/README.md.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..'), window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/games.js'), 'utf8'), { window });
const games = window.GAME_DATA.games.filter(g => !process.env.GAME_IDS || process.env.GAME_IDS.split(',').includes(g.id));
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8765';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const results = [];
  try {
    // Separate contexts avoid cross-game saves/settings and touch emulation leaks.
    for (const game of games) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
      await context.addInitScript(id => {
        localStorage.setItem('chogan.' + id + '.tutSeen', 'true');
        window.__auditErrors = [];
        window.addEventListener('error', e => window.__auditErrors.push(e.message));
        window.addEventListener('unhandledrejection', e => window.__auditErrors.push(String(e.reason)));
        window.__resizeCalls = 0;
        const RO = window.ResizeObserver;
        if (RO) window.ResizeObserver = class extends RO {
          constructor(fn) { super((entries, observer) => { window.__resizeCalls++; fn(entries, observer); }); }
        };
      }, game.id);
      const page = await context.newPage();
      const row = { id: game.id, errors: [], failedResources: [], layouts: [], actions: [] };
      page.on('pageerror', e => row.errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) row.failedResources.push(`${r.status()} ${r.url()}`); });
      try {
        await page.goto(base + '/' + game.url, { waitUntil: 'load', timeout: 20000 });
        if (game.id === 'fogtown') {
          const welcome = page.getByRole('button', { name: '踏入小镇', exact: true });
          if (await welcome.count()) await welcome.click();
        }
        await page.waitForTimeout(400);
        for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
          await page.setViewportSize(size);
          await page.waitForTimeout(200);
          const layout = await page.evaluate(() => {
            const main = document.querySelector('.ch-gamemain') || document.body;
            const clipped = [...main.querySelectorAll('canvas, button, select, [role="grid"], .ch-fit')].filter(n => {
              const r = n.getBoundingClientRect(), css = getComputedStyle(n);
              if (!r.width || !r.height || css.visibility === 'hidden' || css.display === 'none') return false;
              // Hand trays intentionally scroll; don't call those clipping defects.
              for (let p = n.parentElement; p && p !== main; p = p.parentElement) {
                if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return false;
              }
              return r.left < -2 || r.right > innerWidth + 2;
            }).map(n => ({ tag: n.tagName, cls: n.className.baseVal || n.className, label: n.getAttribute('aria-label') || n.textContent.slice(0, 30) })).slice(0, 8);
            const emptyCanvases = [...main.querySelectorAll('canvas')].filter(n => { const r = n.getBoundingClientRect(); return !r.width || !r.height; }).map(n => n.className);
            return { width: innerWidth, height: innerHeight, clipped, emptyCanvases };
          });
          row.layouts.push(layout);
        }
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(150);
        // Try user-facing primary actions, cards, and board pointer input.
        for (let step = 0; step < 8; step++) {
          if (await page.locator('.cp-sheet:not([hidden])').count()) await page.keyboard.press('Escape');
          if (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');
          if (game.id === 'fogtown' && await page.locator('.ft-sheet:not([hidden])').count()) {
            await page.locator('.ft-dialog-head button').click();
          }
          const modal = page.locator('.ch-scrim');
          if (await modal.count()) {
            const action = modal.last().locator('.ch-modal__actions button').last();
            if (await action.count()) { await action.click({ timeout: 1000 }); await page.waitForTimeout(130); }
            else break;
          }
          const action = await page.evaluate(step => {
            const main = document.querySelector('.ch-gamemain') || document.body;
            const buttons = [...main.querySelectorAll('button')].filter(n => !n.disabled && n.getBoundingClientRect().width && !/返回|重[新开]|设置|帮助|说明|换牌背|下一局|再来|放弃/.test(n.textContent + n.getAttribute('aria-label')));
            const primary = buttons.find(n => /^(开始|发牌|要牌|停牌|掷骰|掷骰子|开球|发球|下一步|出牌|摸牌|确定|继续游戏|开始 \/ 继续)$/.test(n.textContent.trim()));
            const card = main.querySelector('.sp-card:not(.sp-card--down):not([style*="visibility: hidden"]), .kl-card:not(.kl-card--down):not([style*="visibility: hidden"])');
            const target = primary || (step < 3 && card) || buttons[(step * 7) % Math.max(1, buttons.length)] || main.querySelector('canvas, [role="grid"], svg');
            if (!target) return null;
            const b = target.getBoundingClientRect();
            return { x: b.x + b.width / 2, y: b.y + b.height / 2, label: target.getAttribute('aria-label') || target.textContent.slice(0, 30) || target.tagName };
          }, step);
          if (action && action.x > 0 && action.x < 1280 && action.y > 60 && action.y < 800) {
            await page.mouse.click(action.x, action.y); row.actions.push(action.label);
          }
          await page.waitForTimeout(100);
        }
        for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '1', '2']) await page.keyboard.press(key);
        await page.waitForTimeout(200);
        const help = page.locator('.ch-gamebar button[aria-label]').filter({ has: page.locator('svg') });
        const helpIndex = await help.evaluateAll(nodes => nodes.findIndex(n => /帮助|玩法|说明/.test(n.getAttribute('aria-label'))));
        if (await page.locator('.cp-sheet:not([hidden])').count()) await page.keyboard.press('Escape');
        if (game.id === 'fogtown' && await page.locator('.ft-sheet:not([hidden])').count()) await page.locator('.ft-dialog-head button').click();
        if (helpIndex >= 0 && !await page.locator('.ch-scrim').count()) {
          await help.nth(helpIndex).click(); await page.waitForTimeout(100);
          await page.keyboard.press('Escape'); await page.waitForTimeout(150);
        }
        await page.reload(); await page.waitForTimeout(300);
        const start = await page.evaluate(() => window.__resizeCalls);
        await page.waitForTimeout(300);
        row.idleResizeCalls = await page.evaluate(n => window.__resizeCalls - n, start);
        row.errors.push(...await page.evaluate(() => window.__auditErrors));
        row.loaded = await page.locator('canvas, .ch-gamemain, #gameCanvas, .casual-board button').count() > 0;
      } catch (e) { row.errors.push(e.message); }
      row.errors = [...new Set(row.errors)];
      results.push(row);
      console.log(JSON.stringify(row));
      await context.close();
      await sleep(10);
    }
  } finally { await browser.close(); }
  if (process.env.AUDIT_REPORT) fs.writeFileSync(process.env.AUDIT_REPORT, JSON.stringify(results, null, 2));
  const failures = results.filter(r => r.errors.length || r.failedResources.length || !r.loaded || r.idleResizeCalls > 10);
  console.log(`Audited ${results.length} games; ${failures.length} runtime/resource/resize failures. Layout observations require review.`);
  if (failures.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
