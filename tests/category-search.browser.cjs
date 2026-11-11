const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/');const categories=await page.evaluate(()=>GAME_DATA.categories.map(c=>c.id));
   for(const cat of categories){
    await page.goto(base+'/index.html#/category/'+cat);
    const field=page.locator('#category-search');await field.waitFor();
    const title=await page.evaluate(id=>GAME_DATA.games.find(g=>g.category===id).title,cat);
    await field.fill(title);
    const expected=await page.evaluate(({cat,title})=>GAME_DATA.games.filter(g=>g.category===cat&&[g.title,g.subtitle,g.description,(g.tags||[]).join(' ')].join(' ').toLowerCase().includes(title.toLowerCase())).map(g=>g.url),{cat,title});
    const urls=await page.locator('#app .game-card').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
    assert.deepEqual(urls,expected.slice(0,cat==='retro'?36:expected.length));
    await field.fill('<不存在的游戏XYZ>');assert.equal(await page.locator('#app .game-card').count(),0);
    assert.ok((await page.locator('#category-search-status').textContent()).includes('没有匹配'));
    await page.locator('#category-search-clear').click();assert.equal(await field.inputValue(),'');
   }
   await page.goto(base+'/index.html#/category/retro');await page.locator('#retro-pages-top button').last().click();
   await page.locator('#category-search').fill('魂斗罗');assert.ok((await page.locator('#retro-pages-top span').textContent()).startsWith('1 /'));
   const first=await page.locator('#retro-cards a').first().getAttribute('href');await page.locator('#retro-cards a').first().click();await page.goBack();
   assert.equal(await page.locator('#category-search').inputValue(),'魂斗罗');assert.equal(await page.locator('#retro-cards a').first().getAttribute('href'),first);
   assert.deepEqual(errors,[]);console.log(name+': all category searches scoped, empty/clear, retro page reset and back restoration passed');
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
