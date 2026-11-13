const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const catalog = require('../games/nes/catalog.json');
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, acceptDownloads:true });
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/#/category/retro');
    assert.equal(await page.locator('#retro-cards .game-card').count(), Math.min(36, catalog.games.length));
    if (catalog.games.length > 36) {
      const first = await page.locator('#retro-cards .game-card').first().getAttribute('href');
      await page.locator('#retro-pages-top').getByRole('button',{name:'下一页',exact:true}).click();
      assert.notEqual(await page.locator('#retro-cards .game-card').first().getAttribute('href'), first);
    }
    for (const name of ['魂斗罗', '马戏团', '冒险岛']) {
      const game = catalog.games.find(g => g.title === name && g.status === 'boot') || catalog.games.find(g => g.title.includes(name) && g.status === 'boot');
      await page.goto(base + '/games/nes/index.html?game=' + game.id);
      await page.waitForFunction(() => !document.getElementById('play').disabled);
      await page.locator('#play').tap();
      await page.locator('[data-key=START]').tap();
      await page.waitForTimeout(500);
      assert.equal(await page.locator('#play').textContent(), '运行中');
      await page.waitForFunction(() => {
        const c = document.getElementById('screen'), data = c.getContext('2d').getImageData(0,0,256,240).data;
        return data.some((n,i) => i % 4 !== 3 && n !== data[i % 4]);
      }, null, {timeout:15000});
      const cdp = await context.newCDPSession(page);
      await page.locator('#direction-disc').scrollIntoViewIfNeeded();
      const left = await page.locator('#direction-disc').boundingBox(), a = await page.locator('[data-key=A]').boundingBox();
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:left.x+left.width*.2,y:left.y+left.height/2,id:1},{x:a.x+a.width/2,y:a.y+a.height/2,id:2}]});
      assert.equal(await page.locator('[data-held]').count(), 1);
      assert.equal(await page.locator('#direction-disc').getAttribute('data-directions'),'LEFT');
      await cdp.send('Input.dispatchTouchEvent', {type:'touchCancel', touchPoints:[]});
      assert.equal(await page.locator('[data-held]').count(), 0);
      await cdp.detach();
      await page.locator('#save').click();
      await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('已保存'));
      const download = page.waitForEvent('download'); await page.locator('#export').click();
      const file = await download, data = fs.readFileSync(await file.path());
      await page.reload(); await page.waitForFunction(() => !document.getElementById('play').disabled);
      await page.locator('#restore').click();
      await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('已读档'));
      await page.locator('#state-file').setInputFiles({name:'save.json',mimeType:'application/json',buffer:data});
      await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('导入'));
      assert.match(await page.locator('#status').textContent(), /^导入成功/);
      const bad = JSON.parse(data); bad.sha256 = 'wrong';
      await page.locator('#state-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
      await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('导入失败'));
      const broken = JSON.parse(data); broken.state.cpu.mem = [];
      await page.locator('#state-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(broken))});
      await page.waitForFunction(() => document.getElementById('status').textContent.includes('存档数组损坏'));
      await page.locator('#play').click(); await page.waitForTimeout(100);
      assert.equal(await page.locator('#play').textContent(), '运行中');
      await page.locator('#mute').click();
      assert.equal(await page.locator('#mute').getAttribute('aria-pressed'), 'true');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      assert.equal(await page.locator('#play').textContent(), '开始 / 继续');
      for (const size of [{width:844,height:390},{width:568,height:320},{width:320,height:568}]) {
        await page.setViewportSize(size);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'viewport overflow');
        for (const key of ['A','B','START']) {
          const box = await page.locator('[data-key='+key+']').boundingBox();
          assert.ok(box.width >= 40 && box.height >= 40 && box.x >= 0 && box.x + box.width <= size.width, key+' unreachable');
        }
      }
      await page.setViewportSize({width:390,height:844});
      console.log(name + ': boot, simultaneous touch/cancel, save/reload, export/import, invalid import, landscape passed');
    }
    await page.goto(base + '/games/nes/');
    const local = catalog.games.find(g => g.title === '魂斗罗');
    assert.equal(await page.locator('#rom-file,input[accept=".nes"]').count(), 0);
    assert.equal(await page.locator('.nes-arrow').count(), 8);
    assert.equal(await page.locator('.nes-arrow').first().textContent(), '');
    assert.equal(await page.locator('[data-key=A]').evaluate(n => getComputedStyle(n).userSelect), 'none');
    await page.route('**/roms/*.nes', route => route.abort());
    await page.goto(base + '/games/nes/index.html?game=' + local.id);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('无法加载'));
    assert.ok(await page.locator('#play').isDisabled());
    await page.unroute('**/roms/*.nes');
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('play').disabled);
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
