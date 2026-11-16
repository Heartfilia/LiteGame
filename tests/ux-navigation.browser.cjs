const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
const catalog=require('../games/nes/catalog.json');
(async()=>{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/index.html#/category/favorites');
  assert.ok(await page.locator('#favorites-export').isHidden());assert.ok(await page.locator('#favorites-clear').isHidden());
  await page.evaluate(()=>GameFavorites.toggle('2048'));
  await page.locator('#favorites-search').fill('2048');
  await page.locator('#favorites-cards .game-card').click();
  await page.locator('.lg-return').waitFor();assert.equal(await page.locator('.lg-return').textContent(),'← 我的收藏');
  await page.reload();await page.locator('.lg-return').click();
  await page.waitForURL('**/index.html#/category/favorites');assert.equal(await page.locator('#favorites-search').inputValue(),'2048');
  assert.ok(await page.locator('#favorites-pages-top').isHidden());
  await page.goto(base+'/index.html#/search/2048');await page.locator('.game-card').first().click();
  assert.equal(await page.locator('.lg-return').textContent(),'← 搜索结果');await page.locator('.lg-return').click();await page.waitForURL('**/index.html#/search/2048');
  await page.locator('#settingsBtn').click();await page.locator('.data-close').click();
  // The explicit return link restores a long list's page, filter and scroll position.
  await page.goto(base+'/index.html#/category/retro');await page.locator('#retro-pages-top button').last().click();
  const card=page.locator('#retro-cards .game-card').nth(8);await card.scrollIntoViewIfNeeded();
  const scrollBefore=await page.evaluate(()=>scrollY);
  await card.click();await page.locator('.lg-return').click();await page.waitForURL('**/index.html#/category/retro');
  await page.waitForFunction(y=>Math.abs(scrollY-y)<4,scrollBefore);
  assert.ok((await page.locator('#retro-pages-top span').textContent()).startsWith('2 /'));
  await page.goto(base+'/games/bounce-back/?from=action');await page.waitForFunction(()=>!document.getElementById('port-start').disabled);
  assert.equal(await page.locator('.lg-return').textContent(),'← 动作分区');
  assert.ok(await page.locator('#port-retry').isHidden());assert.ok(await page.locator('#port-pause').isHidden());
  await page.locator('#port-start').click();await page.locator('#port-pause').waitFor();assert.ok(await page.locator('#port-start').isHidden());
  await page.locator('#port-pause').click();await page.locator('#port-start').waitFor();assert.ok(await page.locator('[data-hold="65"]').isDisabled());
  await page.locator('#port-save').click();assert.equal(await page.getByRole('button',{name:'重新载入',exact:true}).count(),0);
  await page.getByRole('button',{name:'返回游戏',exact:true}).click();
  await page.locator('.lg-return').click();await page.waitForURL('**/index.html#/category/action');
  await page.goto(base+'/games/nes/');assert.ok(await page.locator('#console').isHidden());
  assert.equal(await page.locator('#library a[aria-disabled=true]').count(),0);
  await page.locator('#show-other').check();assert.ok(await page.locator('#library a[aria-disabled=true]').count()>0);
  assert.ok(!(await page.locator('#library').textContent()).includes('Unsupported mapper'));
  await page.locator('#show-other').uncheck();await page.locator('#library a[href]').first().click();
  await page.waitForFunction(()=>!document.getElementById('play').disabled);
  await page.locator('#play').click();assert.ok(await page.locator('#play').isHidden());assert.ok(await page.locator('#pause').isVisible());
  await page.locator('#pause').click();assert.ok(await page.locator('#pause').isHidden());
  await page.locator('#landscape').click();await page.locator('#console-menu').click();await page.locator('#menu-back').click();await page.waitForURL('**/index.html#/category/retro');
  assert.equal(await page.locator('.game-card[aria-disabled=true]').count(),0);
  await page.locator('#category-search').fill('不存在xyz');assert.ok(await page.locator('#retro-pages-top').isHidden());
  await page.locator('#category-search-clear').click();assert.ok(await page.locator('#category-search-clear').isHidden());
  await page.goto(base+'/games/crisp/antlion/?from=action');await page.waitForFunction(()=>!document.getElementById('crisp-start').disabled);
  assert.ok(await page.locator('#crisp-pause').isHidden());await page.locator('#crisp-start').click();await page.locator('#crisp-pause').click();assert.ok(await page.locator('#crisp-pause').isHidden());
  for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);console.log(name+': source-aware return/reload, favorites/search restoration, state controls, save menu, NES picker/filter/immersive exit and compact UI passed');
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1});
