const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const catalog=require('../games/nes/catalog.json');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
const game=catalog.games.find(g=>g.title==='魂斗罗'&&g.status==='boot');
async function geometry(page){
 const boxes=await page.evaluate(()=>{
  const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  return {w:innerWidth,h:innerHeight,rotated:document.getElementById('console').classList.contains('is-rotated'),screen:rect(document.getElementById('screen')),pad:rect(document.querySelector('.pad')),actions:rect(document.querySelector('.actions')),buttons:[...document.querySelectorAll('#console-menu,[data-key],#console-pause')].map(n=>({id:n.id||n.dataset.key,...rect(n)}))};
 });
 for(const b of boxes.buttons){assert.ok(b.width>=40&&b.height>=40,b.id+' target size');assert.ok(b.x>=-1&&b.y>=-1&&b.right<=boxes.w+1&&b.bottom<=boxes.h+1,b.id+' within viewport '+JSON.stringify(b));}
 const {screen:s,pad:p,actions:a}=boxes;
 assert.ok(s.x>=0&&s.y>=0&&s.right<=boxes.w&&s.bottom<=boxes.h,'screen in viewport');
 if(boxes.rotated){assert.ok(p.bottom<=s.y+1&&s.bottom<=a.y+1,'rotated left/screen/right');assert.ok(Math.abs(s.height/s.width-256/240)<.01,'rotated aspect');}
 else{assert.ok(p.right<=s.x+1&&s.right<=a.x+1,'left/screen/right');assert.ok(Math.abs(s.width/s.height-256/240)<.01,'aspect');}
}
(async()=>{
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   for(const mode of ['unsupported','denied','supported']){
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await context.addInitScript(mode=>{
     window.displayCalls=[];
     if(mode==='unsupported'){Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:undefined});Object.defineProperty(Element.prototype,'webkitRequestFullscreen',{configurable:true,value:undefined});return;}
     let current=null;
     Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>current});
     Element.prototype.requestFullscreen=async function(){displayCalls.push('fullscreen');if(mode==='denied')throw Error('Denied');current=this;document.dispatchEvent(new Event('fullscreenchange'));};
     document.exitFullscreen=async()=>{displayCalls.push('exit');current=null;document.dispatchEvent(new Event('fullscreenchange'));};
     Object.defineProperty(screen,'orientation',{configurable:true,value:{lock:async direction=>{displayCalls.push('lock:'+direction);},unlock:()=>displayCalls.push('unlock')}});
    },mode);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/games/nes/?game='+game.id);await page.waitForFunction(()=>!document.getElementById('play').disabled);await page.locator('#play').tap();
    await page.locator('#landscape').scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);await page.locator('#landscape').tap();
    await page.waitForFunction(()=>document.getElementById('console').classList.contains('is-rotated'));await geometry(page);
    if(mode==='supported')assert.deepEqual((await page.evaluate(()=>displayCalls)).slice(0,2),['fullscreen','lock:landscape']);
    // Pointer capture still works after the whole layout has been rotated.
    const b=await page.locator('[data-key=A]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();assert.equal(await page.locator('[data-held]').count(),1);await page.mouse.up();
    if(name==='chromium'){
     const cdp=await context.newCDPSession(page),left=await page.locator('[data-key=LEFT]').boundingBox();
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1},{x:left.x+left.width/2,y:left.y+left.height/2,id:2}]});
     assert.equal(await page.locator('[data-held]').count(),2);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await page.locator('[data-held]').count(),0);await cdp.detach();
    }
    await page.locator('#console-menu').tap();assert.equal(await page.locator('[data-held]').count(),0);assert.equal(await page.locator('#play').textContent(),'开始 / 继续');
    await page.locator('#menu-save').tap();await page.waitForFunction(()=>document.getElementById('menu-status').textContent.startsWith('已保存'));
    await page.locator('#menu-restore').tap();await page.waitForFunction(()=>document.getElementById('menu-status').textContent.startsWith('已读档'));
    await page.locator('#menu-resume').tap();assert.equal(await page.locator('#play').textContent(),'运行中');
    for(const size of [{width:844,height:390},{width:568,height:320},{width:320,height:568}]){await page.setViewportSize(size);await page.waitForTimeout(60);await geometry(page);}
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(60);await page.locator('#console-menu').tap();await page.locator('#exit-display').tap();
    assert.equal(await page.locator('.immersive').count(),0);assert.equal(await page.locator('#landscape').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#play').textContent(),'开始 / 继续');
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scroll)<2,'scroll restored');
    if(mode==='supported'){
     await page.locator('#landscape').tap();await page.evaluate(()=>document.exitFullscreen());assert.equal(await page.locator('.immersive').count(),0,'browser exit restores layout');
    }
    assert.deepEqual(errors,[]);await context.close();console.log(name+' '+mode+': rotation, side controls, menu, saves, exit and scroll passed');
   }
   if(name==='chromium'){
    const page=await browser.newPage({viewport:{width:844,height:390}});await page.goto(base+'/games/nes/');await page.locator('#landscape').click();await page.waitForFunction(()=>document.fullscreenElement?.id==='console');await geometry(page);await page.locator('#console-menu').click();await page.locator('#exit-display').click();await page.waitForFunction(()=>!document.fullscreenElement);await page.close();console.log('chromium native fullscreen entry/exit passed');
   }
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
