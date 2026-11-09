// Mobile-specific audit: real touch events, fresh mobile context, short landscape,
// clipped controls (including ancestor overflow), rotation and refresh.
const { chromium, webkit } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const window = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/games.js'), 'utf8'), { window });
const games = window.GAME_DATA.games.filter(g => !process.env.GAME_IDS || process.env.GAME_IDS.split(',').includes(g.id));
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8765';
const engine = process.env.BROWSER_ENGINE || 'chromium';
async function ready(page) {
  await page.waitForFunction(() => !document.querySelector('#casual-loading, #campaign-loading'));
  await page.waitForTimeout(180);
}
async function closeOverlay(page) {
  const toast = page.locator('.ch-toast:not(.ch-toast--out)').first();
  if(await toast.count()){await toast.tap();await page.waitForTimeout(300);}
  const modal = page.locator('.ch-scrim').last();
  if (await modal.count()) {
    const close = modal.locator('.ch-modal__head button').first(), action = modal.locator('.ch-modal__actions button').last();
    if (await close.count()) await close.tap(); else if (await action.count()) await action.tap();
    await page.waitForTimeout(220);return;
  }
  for (const sel of ['.ch-modal__actions button:last-child', '.ft-dialog-head button', '.cp-sheet:not([hidden]) button', 'dialog[open] button']) {
    const nodes = page.locator(sel);
    for (let i = 0; i < await nodes.count(); i++) {
      const b = nodes.nth(i); if (!await b.isVisible()) continue;
      const text = await b.textContent();
      if (/取消|返回|关闭|继续|开始|踏入|知道|好的|×/.test(text) || sel.startsWith('.ch-modal')) { await b.tap({ timeout: 2000 });await page.waitForTimeout(220); return; }
    }
  }
}
async function layout(page) {
  return page.evaluate(() => {
    const visible = n => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); return r.width && r.height && s.visibility !== 'hidden' && s.display !== 'none'; };
    const describe = n => ({ tag: n.tagName, cls: typeof n.className === 'string' ? n.className : n.className.baseVal, label: (n.getAttribute('aria-label') || n.textContent || '').trim().slice(0, 45) });
    const clipped = [], small = [], blocked = [];
    for (const n of document.querySelectorAll('button, select, input, canvas, [role="grid"], .lg-pad')) {
      if (!visible(n) || n.closest('[hidden]') || n.matches('canvas.ch-fx')) continue;
      const r = n.getBoundingClientRect(); let rect = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, scrollX = false, scrollY = false;
      for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) {
        const css = getComputedStyle(p), b = p.getBoundingClientRect();
        scrollX ||= /auto|scroll/.test(css.overflowX); scrollY ||= /auto|scroll/.test(css.overflowY);
        if (/hidden|clip/.test(css.overflowX)) { rect.left = Math.max(rect.left, b.left); rect.right = Math.min(rect.right, b.right); }
        if (/hidden|clip/.test(css.overflowY)) { rect.top = Math.max(rect.top, b.top); rect.bottom = Math.min(rect.bottom, b.bottom); }
      }
      if ((!scrollX && (r.left < -2 || r.right > innerWidth + 2 || rect.right - rect.left < r.width - 3)) || (!scrollY && rect.bottom - rect.top < r.height - 3)) clipped.push({ ...describe(n), w: Math.round(r.width), h: Math.round(r.height) });
      if (n.tagName === 'BUTTON' && !n.disabled && (r.width < 32 || r.height < 32)) small.push({ ...describe(n), w: Math.round(r.width), h: Math.round(r.height) });
      if (n.tagName === 'BUTTON' && !n.disabled && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && !document.querySelector('.ch-scrim, dialog[open], .cp-sheet:not([hidden]), .ft-sheet:not([hidden])')) {
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (hit && !n.contains(hit)) blocked.push({ ...describe(n), by: describe(hit) });
      }
    }
    return { width: innerWidth, height: innerHeight, viewport: document.querySelector('meta[name=viewport]')?.content, clipped, small, blocked, pad: !!document.querySelector('.lg-pad') };
  });
}
(async () => {
  const browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'webkit' ? {} : { executablePath: process.env.CHROME_PATH || undefined });
  const results = [];
  try {
    for (const game of games) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await context.addInitScript(id => {
        localStorage.setItem('chogan.' + id + '.tutSeen', 'true');
        window.__touches = 0; document.addEventListener('touchstart', () => window.__touches++, { passive: true });
      }, game.id);
      const page = await context.newPage(), row = { id: game.id, engine, errors: [], resources: [], actions: [], layouts: [] };
      page.on('pageerror', e => row.errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) row.resources.push(`${r.status()} ${r.url()}`); });
      page.on('requestfailed', r => { if (r.failure()?.errorText !== 'net::ERR_ABORTED') row.resources.push(`${r.failure()?.errorText} ${r.url()}`); });
      try {
        await page.goto(base + '/' + game.url); await ready(page); await closeOverlay(page);
        const used = new Set();
        for (let step = 0; step < 6; step++) {
          await closeOverlay(page);
          const buttons = page.locator('button'); let target = null;
          for (let i = 0; i < await buttons.count(); i++) {
            const b = buttons.nth(i); if (!await b.isVisible() || !await b.isEnabled()) continue;
            const label = ((await b.getAttribute('aria-label')) || await b.textContent()).trim();
            if (!label || used.has(label) || /主页|游戏厅|返回|重[新开玩]|设置|帮助|玩法|说明|存档|导入|导出|放弃|换牌背|全屏|认输|和棋|新[一牌棋对比]|取消|确定/.test(label)) continue;
            const accessible=await b.evaluate(n=>{const r=n.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)return true;const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit&&n.contains(hit);});if(!accessible)continue;
            target = { b, label }; if (/开始|发牌|继续|掷骰|开球|发球/.test(label)) break;
          }
          if (!target) break;
          used.add(target.label); await target.b.tap({ timeout: 2500 }); row.actions.push(target.label); await page.waitForTimeout(150);
        }
        // Tap the game surface itself, with touch rather than synthetic mouse input.
        await closeOverlay(page);
        const surface = page.locator('canvas, [role="grid"], .ch-fit > svg, .m-board, .wo-board, .gl-board, .pg-board').first();
        if (await surface.isVisible()) { await surface.scrollIntoViewIfNeeded();const r=await surface.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2); row.actions.push('surface touch'); }
        row.touchEvents = await page.evaluate(() => window.__touches);
        for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 568, height: 320 }]) {
          await page.setViewportSize(size); await page.evaluate(()=>{window.scrollTo(0,0);document.querySelectorAll('.ch-gamemain,.ch-side').forEach(n=>n.scrollTop=0);});await page.waitForTimeout(220); row.layouts.push(await layout(page));
        }
        if (process.env.MOBILE_SHOTS) { await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(process.env.MOBILE_SHOTS, game.id + '-' + engine + '.png'), fullPage: true }); }
        await page.reload(); await ready(page); row.reloaded = true;
      } catch (e) { row.errors.push(e.message); }
      row.errors = [...new Set(row.errors)]; results.push(row); console.log(JSON.stringify(row)); await context.close();
    }
  } finally { await browser.close(); }
  if (process.env.AUDIT_REPORT) fs.writeFileSync(process.env.AUDIT_REPORT, JSON.stringify(results, null, 2));
  const failures = results.filter(r => r.errors.length || r.resources.length || !r.reloaded || !r.touchEvents);
  console.log(`${engine}: ${results.length} mobile games, ${failures.length} execution failures; inspect layout observations separately.`);
  if (failures.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
