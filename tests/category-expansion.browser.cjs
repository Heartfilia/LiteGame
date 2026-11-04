const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { load, rng } = require('./engine-loader.cjs');
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    async function pageFor(id, save) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
      page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
      await page.addInitScript(({ id, save }) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem('chogan.' + id + '.session', JSON.stringify(save));
          sessionStorage.setItem('seeded', '1');
        }
      }, { id, save });
      await page.goto(`${base}/games/${id}/index.html?from=${['pitch', 'melody'].includes(id) ? 'music' : id === 'stack' ? 'casual' : 'racing'}`);
      await page.locator('.arc-canvas').waitFor();
      return page;
    }
    const start = page => page.locator('.arc-tools .ch-btn--primary').click();
    const action = (page, text) => page.locator('.arc-controls button').getByText(text, { exact: true }).click();
    const saveOf = (page, id) => page.evaluate(id => Chogan.storage(id).get('session'), id);
    async function settled(page, id) {
      await page.locator('.ch-seeboard').waitFor();
      assert.equal(await page.evaluate(id => Chogan.stats.game(id).plays, id), 1);
      await page.locator('.ch-seeboard').click(); await page.waitForTimeout(200);
      assert.equal(await page.evaluate(id => Chogan.stats.game(id).plays, id), 1);
      assert.deepEqual(page.errors, []); await page.close();
    }

    const circuit = await pageFor('circuit', load('circuit').newGame());
    await start(circuit);
    await circuit.keyboard.down('ArrowRight'); await circuit.waitForTimeout(450); await circuit.keyboard.up('ArrowRight');
    await circuit.locator('.arc-tools .ch-btn--primary').click();
    const driven = await saveOf(circuit, 'circuit'); assert.ok(driven.angle > 0); assert.ok(driven.elapsed > 0);
    await circuit.reload(); assert.equal(await circuit.locator('.arc-overlay').isVisible(), true);
    assert.equal((await saveOf(circuit, 'circuit')).elapsed, driven.elapsed);
    await start(circuit);
    const turn = circuit.locator('.arc-controls button').filter({ hasText: '左转' });
    const box = await turn.boundingBox(); await circuit.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await circuit.mouse.down();
    await circuit.waitForTimeout(150); await circuit.mouse.up();
    await circuit.locator('.arc-tools .ch-btn--primary').click();
    if (process.env.EXPANSION_SHOTS) await circuit.screenshot({ path: process.env.EXPANSION_SHOTS + '/circuit.png', fullPage: true });
    assert.deepEqual(circuit.errors, []); await circuit.close();

    const D = load('drag-race'), d = D.newGame(); d.countdown = 0; d.gear = 5; d.shifts = 4; d.perfect = 4; d.speed = 70; d.distance = 399; d.time = 10;
    const drag = await pageFor('drag-race', d); await start(drag); await settled(drag, 'drag-race');

    const T = load('stack'), t = T.newGame();
    for (let i = 0; i < 29; i++) { t.x = t.layers.at(-1).x; t.cooldown = 0; T.drop(t); }
    t.x = t.layers.at(-1).x; t.cooldown = 0;
    const stack = await pageFor('stack', t); await start(stack);
    await action(stack, '放下方块'); await settled(stack, 'stack');

    const p = load('pitch').newGame(rng(23)), pitch = await pageFor('pitch', p); await start(pitch);
    await action(pitch, '▶ 听一遍 R'); await pitch.waitForTimeout(150);
    await action(pitch, '显示音高（减半分）');
    for (let i = 0; i < 12; i++) {
      const r = p.rounds[i]; await action(pitch, ['↓ 更低', '＝ 相同', '↑ 更高'][Math.sign(r.second - r.first) + 1]);
      await action(pitch, i === 11 ? '查看成绩' : '下一题');
    }
    await settled(pitch, 'pitch');

    const m = load('melody').newGame(rng(61)), melody = await pageFor('melody', m); await start(melody);
    await action(melody, '▶ 目标旋律 R');
    for (let i = 0; i < 5; i++) {
      const r = m.rounds[i];
      for (const n of r.target) await melody.locator('.arc-controls button').nth(r.tiles.indexOf(n)).click();
      await action(melody, '▷ 我的旋律 P'); await action(melody, '提交旋律');
      await action(melody, i === 4 ? '完成合辑' : '下一曲');
    }
    await settled(melody, 'melody');
    console.log('New games: steering, pause/reload, four result flows, audio controls and one-time settlement passed.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
