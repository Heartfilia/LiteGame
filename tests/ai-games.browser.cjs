const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
async function open(page,id){
 await page.goto(base+'/games/'+id+'/');
 await page.waitForFunction(()=>document.body.dataset.ready==='true'&&document.querySelector('#loading').classList.contains('hidden'),null,{timeout:90000});
}
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   for(const mobile of [false,true]){
    const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:800},hasTouch:mobile,isMobile:mobile});
    const page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base+'/'))external.push(r.url());});
    await page.addInitScript(()=>{
     localStorage.setItem('litegame.ai-speed.settings',JSON.stringify({quality:'low',laps:1}));
     localStorage.setItem('litegame.ai-cf.settings',JSON.stringify({quality:'low',size:4}));
    });
    await open(page,'ai-speed');
    assert.equal(await page.title(),'Ai飞车 · LiteGame');
    await page.locator('#lite-favorite').click();assert.equal(await page.locator('#lite-favorite').getAttribute('aria-pressed'),'true');
    await page.locator('#start').click();await page.waitForFunction(()=>game.state==='race',null,{timeout:60000});
    if(!mobile){await page.keyboard.down('ArrowUp');await page.waitForTimeout(1200);await page.keyboard.up('ArrowUp');}
    else {
     // Real pointer input is exercised below for the CF joystick; check touch buttons using mouse capture too.
     const r=await page.locator('#t-drift').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
     assert.equal(await page.evaluate(()=>game.input.touch.shift),true);await page.mouse.up();
     assert.equal(await page.evaluate(()=>game.input.touch.shift),false);
    }
    assert.ok(await page.evaluate(()=>game.player.speed>0||Math.hypot(game.player.vx||0,game.player.vz||0)>0||Number(document.getElementById('spd').textContent)>0),'race accelerates');
    await page.locator('#lite-pause').click();assert.equal(await page.evaluate(()=>game.state),'paused');
    const raceTime=await page.evaluate(()=>game.raceTime);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>game.raceTime),raceTime);
    assert.ok(await page.evaluate(()=>[...game.input.down].length===0&&!game.input.touch.shift));
    await page.locator('#resume').click();assert.equal(await page.evaluate(()=>game.state),'race');
    if(mobile){
     for(const size of [{width:844,height:390},{width:568,height:320}]){
      await page.setViewportSize(size);await checkControls(page,'#touch .tb');
     }
     await page.screenshot({path:'/private/var/folders/hb/xgj26dls1c91mc9fp63lfkm40000gn/T/opencode/ai-speed-mobile-play.png'});
    }
    await page.locator('#lite-toolbar a').first().click();await page.waitForURL('**/index.html#/category/racing');
    await page.locator('[data-favorite="ai-speed"]').waitFor();assert.equal(await page.locator('[data-favorite="ai-speed"]').getAttribute('aria-pressed'),'true');
    await page.setViewportSize(mobile?{width:844,height:390}:{width:1280,height:800});
    await open(page,'ai-cf');assert.equal(await page.title(),'AiCF·运输船 · LiteGame');
    await page.locator('#lite-favorite').click();
    await page.locator('#btnStart').click();await page.waitForFunction(()=>__game.playing&&!__game.paused);
    if(!mobile){
     await page.waitForFunction(()=>!!document.pointerLockElement||__game.dragLook,null,{timeout:10000});
     const before=await page.evaluate(()=>__game.player.pos.toArray());
     await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW');
     assert.notDeepEqual(await page.evaluate(()=>__game.player.pos.toArray()),before);
     await page.mouse.down();await page.waitForTimeout(900);await page.mouse.up();
     assert.ok(await page.evaluate(()=>__game.player.weapon.mag<__game.player.weapon.def.mag),'actual shooting consumes ammunition');
     await page.keyboard.press('Escape');await page.waitForFunction(()=>__game.paused);
    }else{
     await checkControls(page,'#touch .btn,#cf-move');
     const r=await page.locator('#cf-move').boundingBox();await page.mouse.move(r.x+r.width*.8,r.y+r.height*.2);await page.mouse.down();
     assert.ok(await page.evaluate(()=>__game.player.touch.mx>0&&__game.player.touch.mz>0));await page.mouse.up();
     assert.equal(await page.evaluate(()=>__game.player.touch.mx),0);
     const fire=await page.locator('#cf-fire').boundingBox();await page.mouse.move(fire.x+fire.width/2,fire.y+fire.height/2);await page.mouse.down();await page.waitForTimeout(800);
     assert.ok(await page.evaluate(()=>__game.player.weapon.mag<__game.player.weapon.def.mag));await page.mouse.up();
     assert.equal(await page.evaluate(()=>__game.player.touch.fire),false);
     if(name==='chromium'){
      const cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width*.8,y:r.y+r.height*.2,id:1},{x:fire.x+fire.width/2,y:fire.y+fire.height/2,id:2}]});
      assert.ok(await page.evaluate(()=>__game.player.touch.mx>0&&__game.player.touch.fire));
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.ok(await page.evaluate(()=>!__game.player.touch.mx&&!__game.player.touch.fire));await cdp.detach();
     }
     await page.setViewportSize({width:568,height:320});await checkControls(page,'#touch .btn,#cf-move');
     await page.screenshot({path:'/private/var/folders/hb/xgj26dls1c91mc9fp63lfkm40000gn/T/opencode/ai-cf-mobile-play.png'});
     await page.locator('#lite-pause').click();
    }
    assert.equal(await page.evaluate(()=>__game.paused),true);
    const remaining=await page.evaluate(()=>__game.timeLeft);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__game.timeLeft),remaining);
    assert.ok(await page.evaluate(()=>!__game.player.touch.fire&&__game.player.keys.size===0));
    await page.locator('#btnResume').click();await page.waitForFunction(()=>!__game.paused);
    if(!mobile){await page.keyboard.press('Escape');await page.waitForFunction(()=>__game.paused);}
    await page.locator('#lite-toolbar a').first().click();await page.waitForURL('**/index.html#/category/shooting');
    assert.equal(await page.locator('.game-card h3').first().textContent(),'AiCF·运输船');
    assert.equal(await page.locator('[data-favorite="ai-cf"]').getAttribute('aria-pressed'),'true');
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    console.log(name+' '+(mobile?'mobile':'desktop')+': local 3D boot, acceleration, firing, pause, navigation, favorites and touch passed');
    await context.close();
   }
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
async function checkControls(page,selector){
 const boxes=await page.locator(selector).evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width).map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,hit:n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),id:n.id};}));
 const size=page.viewportSize();for(const r of boxes){assert.ok(r.w>=44&&r.h>=44,r.id+' touch size');assert.ok(r.x>=0&&r.y>=48&&r.right<=size.width&&r.bottom<=size.height,r.id+' on screen');assert.ok(r.hit,r.id+' not blocked');}
}
