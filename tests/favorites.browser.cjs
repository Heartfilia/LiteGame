const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
const upload=data=>({name:'favorites.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   const context=await browser.newContext({viewport:{width:1280,height:900}});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/');
   assert.equal(await page.locator('#home-play').textContent(),'立即开玩');
   assert.equal(await page.locator('.category-card[href="#/category/favorites"] .category-count').textContent(),'0 款游戏');
   const original=await page.locator('.showcase-card').getAttribute('href');
   await page.goto(base+'/#/category/favorites');
   assert.ok(await page.locator('#favorites-export').isDisabled());
   assert.ok((await page.locator('#favorites-empty').textContent()).includes('还没有收藏'));
   const selected=[];
   for(const category of ['racing','puzzle','retro']){
    await page.goto(base+'/#/category/'+category);
    const button=page.locator('.game-card-shell [data-favorite]').first();
    selected.push(await button.getAttribute('data-favorite'));
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'),'true');
    assert.ok(page.url().endsWith('/category/'+category),'favorite does not launch game');
   }
   await page.reload();assert.equal(await page.locator('.game-card-shell [data-favorite]').first().getAttribute('aria-pressed'),'true');
   await page.goto(base+'/#/category/favorites');
   assert.equal(await page.locator('#favorites-cards .game-card').count(),3);
   const title=await page.locator('#favorites-cards h3').first().textContent();
   await page.locator('#favorites-search').fill(title);assert.equal(await page.locator('#favorites-cards .game-card').count(),1);
   await page.locator('#favorites-search').fill('not-a-game-xyz');assert.equal(await page.locator('#favorites-cards .game-card').count(),0);
   await page.locator('#favorites-clear').click();
   const downloadPromise=page.waitForEvent('download');await page.locator('#favorites-export').click();
   const download=await downloadPromise,backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));
   assert.deepEqual(new Set(backup.ids),new Set(selected));
   // Import into an independent browser storage, then merge without losing its own favorite.
   const otherContext=await browser.newContext(),other=await otherContext.newPage();
   await other.goto(base+'/#/category/action');await other.locator('[data-favorite]').first().click();
   await other.goto(base+'/#/category/favorites');
   await other.locator('#favorites-file').setInputFiles(upload(backup));
   await other.waitForFunction(()=>document.querySelector('#favorites-message').textContent.includes('新增 3'));
   assert.equal(await other.locator('#favorites-cards .game-card').count(),4);
   await other.locator('#favorites-file').setInputFiles(upload(backup));
   await other.waitForFunction(()=>document.querySelector('#favorites-message').textContent.includes('新增 0'));
   await other.locator('#favorites-file').setInputFiles(upload({...backup,ids:[42]}));
   await other.waitForFunction(()=>document.querySelector('#favorites-message').textContent.includes('导入失败'));
   assert.equal(await other.locator('#favorites-cards .game-card').count(),4);
   await other.reload();assert.equal(await other.locator('#favorites-cards .game-card').count(),4);
   // Existing full progress backups must also contain the favorite record.
   await page.locator('#dataBtn').click();
   const fullDownload=page.waitForEvent('download');await page.locator('#exportBtn').click();
   const fullBackup=JSON.parse(await fs.readFile(await (await fullDownload).path(),'utf8'));
   assert.deepEqual(new Set(JSON.parse(fullBackup.data['litegame.favorites']).ids),new Set(selected));
   await page.locator('.data-close').click();
   await other.evaluate(()=>localStorage.clear());await other.reload();await other.locator('#dataBtn').click();
   await other.locator('#importFile').setInputFiles(upload(fullBackup));await other.locator('#importConfirmBtn').click();
   await other.waitForFunction(()=>document.querySelector('#dataModal').hidden&&document.querySelectorAll('#favorites-cards .game-card').length===3);
   // Unknown identifiers are skipped, duplicate identifiers collapse, malformed input is atomic.
   await other.locator('#favorites-file').setInputFiles(upload({...backup,ids:[selected[0],selected[0],'removed-game']}));
   await other.waitForFunction(()=>document.querySelector('#favorites-message').textContent.includes('跳过 1'));
   assert.equal(await other.locator('#favorites-cards .game-card').count(),3);
   const many=await other.evaluate(()=>GAME_DATA.games.slice(0,40).map(g=>g.id));
   await other.locator('#favorites-file').setInputFiles(upload({...backup,ids:many}));
   await other.waitForFunction(()=>document.querySelector('#favorites-pages-top span').textContent==='1 / 2');
   await other.locator('#favorites-pages-top button').last().click();
   assert.equal(await other.locator('#favorites-pages span').textContent(),'2 / 2');
   await other.locator('#favorites-pages button').first().click();
   assert.equal(await other.locator('#favorites-pages-top span').textContent(),'1 / 2');
   // Shared storage event updates another tab immediately.
   const tab=await context.newPage();await tab.goto(base+'/');
   await page.locator('#favorites-cards [data-favorite]').first().click();
   await tab.waitForFunction(()=>document.querySelector('[data-favorite-count]').textContent==='2');
   await tab.close();
   await page.locator('#favorites-file').setInputFiles(upload(backup));
   await page.waitForFunction(()=>document.querySelector('#favorites-message').textContent.includes('新增 1'));
   // Virtual clock verifies the exact interval, every item in a cycle, pause and teardown.
   await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto(base+'/');await page.mouse.move(0,0);
   assert.equal(await page.locator('#home-play').textContent(),'我的收藏');
   const first=await page.locator('.showcase-slide').getAttribute('data-game-id');
   await page.clock.runFor(9999);assert.equal(await page.locator('.showcase-slide').getAttribute('data-game-id'),first);
   await page.clock.runFor(1);assert.equal(await page.locator('.slide-enter').count(),1);assert.equal(await page.locator('.slide-leave').count(),1);
   await page.clock.runFor(600);
   const second=await page.locator('.showcase-slide').getAttribute('data-game-id');assert.notEqual(first,second);
   await page.clock.runFor(10000);
   const third=await page.locator('.showcase-slide').getAttribute('data-game-id');assert.deepEqual(new Set([first,second,third]),new Set(selected));
   const shown=await page.evaluate(()=>{const slide=document.querySelector('.showcase-slide'),g=GAME_DATA.games.find(g=>g.id===slide.dataset.gameId);return {url:slide.querySelector('a').getAttribute('href'),expected:g.url,title:slide.querySelector('h2').textContent,expectedTitle:g.title};});
   assert.equal(shown.url,shown.expected);assert.equal(shown.title,shown.expectedTitle);
   await page.locator('#showcase-pause').click();await page.mouse.move(0,0);await page.clock.runFor(20000);
   assert.equal(await page.locator('.showcase-slide').getAttribute('data-game-id'),third);
   await page.locator('#showcase-pause').click();await page.mouse.move(0,0);await page.clock.runFor(10000);
   assert.notEqual(await page.locator('.showcase-slide').getAttribute('data-game-id'),third);
   await page.goto(base+'/#/category/favorites');await page.clock.runFor(20000);assert.equal(await page.locator('.showcase-slide').count(),0);
   while(await page.locator('#favorites-cards [data-favorite]').count())await page.locator('#favorites-cards [data-favorite]').first().click();
   await page.goto(base+'/');assert.equal(await page.locator('#home-play').textContent(),'立即开玩');assert.equal(await page.locator('.showcase-card').getAttribute('href'),original);
   await page.locator('.feature-game-shell [data-favorite]').click();await page.mouse.move(0,0);
   const only=await page.locator('.showcase-slide').getAttribute('data-game-id');
   await page.clock.runFor(30000);assert.equal(await page.locator('.showcase-slide').getAttribute('data-game-id'),only);
   assert.ok(await page.locator('#showcase-pause').isHidden());
   // A failed storage write must not claim that the favorite was saved.
   const denied=await browser.newPage();await denied.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('unavailable');};});
   await denied.goto(base+'/#/category/racing');await denied.locator('[data-favorite]').first().click();
   assert.equal(await denied.locator('[data-favorite]').first().getAttribute('aria-pressed'),'false');
   assert.ok((await denied.locator('#favorite-notice').textContent()).includes('未保存'));await denied.close();
   // Search dropdown and touchscreen targets, including a narrow phone.
   const mobile=await browser.newPage({viewport:{width:320,height:700},hasTouch:true,isMobile:true});
   await mobile.goto(base+'/');await mobile.locator('#searchInput').fill('数独');
   await mobile.locator('#searchDropdown [data-favorite]').first().tap();
   assert.equal(await mobile.locator('#home-play').textContent(),'我的收藏');
   await mobile.goto(base+'/#/category/favorites');
   const target=await mobile.locator('#favorites-cards [data-favorite]').first().boundingBox();assert.ok(target.width>=44&&target.height>=44);
   assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const href=await mobile.locator('#favorites-cards a').first().getAttribute('href');await mobile.locator('#favorites-cards a').first().tap();await mobile.waitForURL(new URL(href,base+'/').href);
   // NES internal catalog shares favorites with the hall.
   await mobile.goto(base+'/games/nes/');const nesButton=mobile.locator('#library [data-favorite]').first();const nesID=await nesButton.getAttribute('data-favorite');await nesButton.tap();
   await mobile.goto(base+'/#/category/favorites');assert.equal(await mobile.locator('[data-favorite="'+nesID+'"]').count(),1);
   assert.deepEqual(errors,[]);
   console.log(name+': favorites, persistence, cross-context merge/backup, cross-tab sync, exact 10s animated rotation, pause, empty fallback, mobile and NES passed');
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
