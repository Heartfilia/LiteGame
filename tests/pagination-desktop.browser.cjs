const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const catalog=require('../games/nes/catalog.json');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
async function pagination(page,top,bottom,items){
 const first=await page.locator(items).first().getAttribute('href');
 assert.ok(await page.locator(top+' button').first().isDisabled());
 await page.locator(top+' button').last().click();
 assert.notEqual(await page.locator(items).first().getAttribute('href'),first);
 assert.equal(await page.locator(top+' span').textContent(),await page.locator(bottom+' span').textContent());
 assert.ok((await page.locator(top+' span').textContent()).startsWith('2 /'));
 await page.locator(bottom+' button').first().click();
 assert.equal(await page.locator(items).first().getAttribute('href'),first);
 assert.ok(await page.locator(top+' button').first().isDisabled());
 assert.ok(await page.locator(bottom+' button').first().isDisabled());
 await page.waitForFunction(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;},top);
}
async function desktopGeometry(page){
 const g=await page.evaluate(()=>{
  const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
   return {screen:rect('#screen'),cabinet:rect('.screen'),controls:rect('.console-controls'),pad:rect('.pad'),actions:rect('.actions'),system:rect('.system'),hint:rect('.keyboard-reference'),host:rect('#console'),w:innerWidth,h:innerHeight,full:document.querySelector('#console').classList.contains('immersive'),buttons:[...document.querySelectorAll('.console-controls button')].map(n=>n.getBoundingClientRect().toJSON())};
 });
 assert.ok(Math.abs(g.screen.width/g.screen.height-256/240)<.01,'correct NES aspect ratio');
 for(const k of ['pad','actions','system','hint'])assert.ok(g[k].top>=g.screen.bottom,k+' below picture');
 assert.ok(g.screen.left>=g.host.left&&g.screen.right<=g.host.right,'picture inside container');
 assert.ok(Math.abs((g.screen.left+g.screen.right)/2-(g.host.left+g.host.right)/2)<2,'picture centred');
  assert.ok(g.controls.top>=g.cabinet.bottom+15,'control section separated from TV cabinet');
  for(let i=0;i<g.buttons.length;i++){
   const a=g.buttons[i];assert.ok(a.width>=40&&a.height>=40,'usable button size');
   assert.ok(a.left>=g.controls.left&&a.right<=g.controls.right&&a.bottom<=g.controls.bottom,'button within bottom panel');
   for(const b of g.buttons.slice(i+1))assert.ok(a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1,'buttons do not overlap');
  }
  if(g.full){assert.ok(g.screen.top>=0,'fullscreen image starts below menu');assert.ok(g.controls.bottom<=g.host.top+await page.locator('#console').evaluate(n=>n.scrollHeight)+1,'fullscreen controls reachable by scroll');}
}
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/index.html#/category/retro');
   await pagination(page,'#retro-pages-top','#retro-pages','#retro-cards a.game-card');
   const game=catalog.games.find(g=>g.title==='魂斗罗'&&g.status==='boot');
   await page.goto(base+'/games/nes/?game='+game.id);await page.waitForFunction(()=>!document.getElementById('play').disabled);
   await pagination(page,'#pages-top','#pages','#library a');
   await page.locator('#search').fill('没有这张卡带XYZ');
   for(const id of ['pages-top','pages']){assert.equal(await page.locator('#'+id+' span').textContent(),'1 / 1');assert.ok(await page.locator('#'+id+' button').first().isDisabled());assert.ok(await page.locator('#'+id+' button').last().isDisabled());}
   await page.locator('#search').fill('');
    for(const size of [{width:1280,height:800},{width:1920,height:1080},{width:1024,height:600},{width:880,height:700},{width:768,height:900},{width:640,height:600},{width:480,height:700},{width:1024,height:400}]){
    await page.setViewportSize(size);await desktopGeometry(page);
   }
   await page.setViewportSize({width:1280,height:800});
   await page.locator('#screen').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#play').textContent(),'运行中');
    for(const id of ['fullscreen','landscape']){
    await page.locator('#'+id).click();await page.waitForTimeout(150);await desktopGeometry(page);
    await page.locator('#console-menu').click();await page.locator('#exit-display').click();
    }
    await page.setViewportSize({width:640,height:800});
    await page.locator('#landscape').click();await page.waitForTimeout(150);await desktopGeometry(page);
    assert.equal(await page.locator('.is-rotated').count(),0,'narrow desktop does not rotate like a phone');
    await page.locator('#console-menu').click();await page.locator('#exit-display').click();
   assert.deepEqual(errors,[]);
   const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
   await mobile.goto(base+'/index.html#/category/retro');await pagination(mobile,'#retro-pages-top','#retro-pages','#retro-cards a.game-card');
   await mobile.goto(base+'/games/nes/');await pagination(mobile,'#pages-top','#pages','#library a');
   assert.ok(await mobile.locator('.keyboard-reference').isHidden());
   console.log(name+': synchronized top/bottom pagination, empty search, desktop screen/controls, keyboard wake, fullscreen and mobile pagination passed');
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
