const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { load, rng } = require('./engine-loader.cjs');
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    async function savedPage(id, save) {
      const page = await browser.newPage();
      await page.goto(base + '/index.html');
      await page.evaluate(({ id, save }) => {
        localStorage.setItem('chogan.' + id + '.tutSeen', 'true');
        localStorage.setItem('chogan.' + id + '.session', JSON.stringify(save));
      }, { id, save });
      await page.goto(`${base}/games/${id}/index.html?from=cards`);
      return page;
    }
    const E = load('ginrummy');
    const h = E.newHand(rng(7), 1);
    h.phase = 'over'; h.result = { draw: true, points: 0, winner: -1 };
    const m = { H: h, scores: [0, 0], hand: 1, daily: null, level: 'easy', order: h.hands[0], gins: 0, undercuts: 0, elapsed: 100 };
    const gin = await savedPage('ginrummy', { m });
    await gin.locator('.ch-modal__actions .ch-btn--primary').click();
    await gin.waitForTimeout(150);
    assert.equal(await gin.evaluate(() => Chogan.storage('ginrummy').get('session').m.hand), 2, 'Next hand must advance once');
    await gin.close();
    h.scored = true; m.scores = [100, 0];
    const ended = await savedPage('ginrummy', { m });
    await ended.locator('.ch-scrim').waitFor();
    assert.equal(await ended.evaluate(() => Chogan.stats.game('ginrummy').plays), 1, 'Won saved match must settle, not redeal');
    assert.equal(await ended.evaluate(() => Chogan.storage('ginrummy').get('session')), null);
    await ended.close();
    console.log('Gin Rummy: one hand per click; restored completed match settles correctly');

    const CE = load('crazyeights');
    const r = CE.newRound(rng(11), 2, 0, 'classic');
    // Put a single ordinary matching card in the human hand, conserving all 52 cards.
    const card = r.hands[0].find(c => CE.canPlay(r, c) && !CE.isWild(r, c));
    assert.notEqual(card, undefined);
    r.stock.push(...r.hands[0].filter(c => c !== card)); r.hands[0] = [card];
    const ce = await savedPage('crazyeights', { m: { R: r, n: 2, rules: 'classic', scores: [0, 0], round: 1, daily: null, level: 'easy', roundsWon: 0, elapsed: 100 } });
    await ce.locator('.ce-hand .ch-pcard').click();
    await ce.locator('.ch-modal__actions .ch-btn--primary').waitFor();
    await ce.locator('.ch-modal__actions .ch-btn--primary').click();
    await ce.waitForTimeout(150);
    assert.equal(await ce.evaluate(() => Chogan.storage('crazyeights').get('session').m.round), 2, 'Next round must advance once');
    await ce.close();
    console.log('Crazy Eights: one round per click');

    const BJ = load('blackjack'), hand = BJ.deal(rng(9));
    if (!hand.done) BJ.stand(hand);
    const bj = await savedPage('blackjack', { s: { H: hand, n: 10, wins: 6, losses: 4, pushes: 0, bjs: 0, elapsed: 1000 } });
    await bj.locator('.bj-actions .ch-btn--primary').click();
    assert.equal(await bj.evaluate(() => Chogan.stats.game('blackjack').plays), 1);
    await bj.locator('.ch-seeboard').click(); await bj.waitForTimeout(150);
    await bj.locator('.bj-actions .ch-btn--primary').click();
    assert.equal(await bj.evaluate(() => Chogan.stats.game('blackjack').plays), 1, 'Reopening finished board must not award twice');
    await bj.close();
    console.log('Blackjack: finished match awards exactly once');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
