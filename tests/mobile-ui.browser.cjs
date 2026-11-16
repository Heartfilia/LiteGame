const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8766';
(async () => {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      for (const entry of ['', 'games/nes/', 'games/snake/', 'games/bounce-back/', 'games/fogtown/', 'games/crisp/antlion/frame.html']) {
        await page.goto(base + '/' + entry); await page.waitForFunction(() => !!window.LiteMobileUI);
        const result = await page.evaluate(() => {
          // Nested dynamic controls and ordinary HUD text reproduce the previous coverage gaps.
          const control = document.createElement('div'); control.innerHTML = '<span>◀ 持续移动</span>'; document.body.append(control);
          const target = control.firstChild;
          const input = document.createElement('input'); input.value = 'https://save.example.com'; document.body.append(input);
          const copy = document.createElement('p'); copy.setAttribute('data-allow-select', ''); copy.textContent = 'copyable server'; document.body.append(copy);
          const cancel = (node, type) => !node.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
          const result = { selected: getComputedStyle(target).userSelect, blocked: ['selectstart','contextmenu','dragstart'].every(type => cancel(target,type)), editable: getComputedStyle(input).userSelect, font: getComputedStyle(input).fontSize, inputAllowed: !cancel(input,'contextmenu'), copyAllowed: !cancel(copy,'selectstart'), pointerAllowed: !cancel(target,'pointerdown') };
          control.remove(); input.remove(); copy.remove(); return result;
        });
        assert.deepEqual(result, { selected: 'none', blocked: true, editable: 'text', font: '16px', inputAllowed: true, copyAllowed: true, pointerAllowed: true }, entry);
      }
      await page.goto(base);
      for (const size of [{width:390,height:844},{width:320,height:568},{width:568,height:320}]) {
        await page.setViewportSize(size);
        await page.locator('#dataBtn').click();
        if (await page.locator('#serverSettings').isHidden()) await page.locator('#serverBtn').click();
        await page.locator('#serverUrl').fill('https://save.example.com');
        await page.locator('#serverUsername').fill('mobile-user');
        await page.locator('.server-project a').scrollIntoViewIfNeeded();
        const before = await page.evaluate(() => ({ y: window.scrollY, top: document.body.style.top }));
        const panel = await page.locator('.data-panel').boundingBox();
        const close = await page.locator('.data-close').boundingBox();
        assert.ok(close.width >= 44 && close.height >= 44 && close.y >= panel.y && close.y + close.height <= panel.y + panel.height, 'sticky close reachable');
        assert.equal(await page.locator('.data-close').evaluate(n => { const r = n.getBoundingClientRect(); return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }), true);
        await page.locator('.server-project a').focus(); await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.classList.contains('data-close')), true);
        await page.locator('.data-close').click();
        await page.waitForFunction(() => document.body.style.position !== 'fixed');
        assert.equal(await page.locator('#dataModal').isHidden(), true);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
        assert.equal(before.y, 0); // Fixed body keeps the background immobile while modal scrolls.
      }
      assert.deepEqual(errors, []);
      await context.close();
      const desktop = await browser.newPage(); await desktop.goto(base);
      assert.equal(await desktop.locator('.data-desc').evaluate(n => getComputedStyle(n).userSelect === 'none'), false, 'desktop prose remains selectable');
      console.log(name + ': nested/dynamic/iframe selection guard, editable exceptions, native pointer events, three-size modal reachability, focus and scroll passed');
    } finally { await browser.close(); }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
