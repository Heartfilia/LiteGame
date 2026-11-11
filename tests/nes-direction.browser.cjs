const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
const game=require('../games/nes/catalog.json').games.find(g=>g.title==='魂斗罗'&&g.status==='boot');
async function keys(page){return page.evaluate(()=>Object.keys(jsnes.Controller).filter(k=>k.startsWith('BUTTON_')&&nesTest.controllers[1].state[jsnes.Controller[k]]===0x41).map(k=>k.slice(7)).sort());}
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
   await context.addInitScript(()=>{Element.prototype.requestFullscreen=undefined;Element.prototype.webkitRequestFullscreen=undefined;});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/nes/nes.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync('games/nes/nes.js','utf8').replace('nes = candidate; rom = bytes;','nes = candidate; window.nesTest = nes; rom = bytes;')}));
   await page.goto(base+'/games/nes/?game='+game.id);await page.locator('#play').click();await page.locator('#landscape').click();
   for(const viewport of [{width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(100);
    const r=await page.locator('#direction-disc').boundingBox(),rotated=viewport.height>viewport.width;
    const point=(x,y)=>({x:r.x+r.width/2+(rotated?-y:x)*r.width/2,y:r.y+r.height/2+(rotated?x:y)*r.height/2});
    let p=point(0,-.7);await page.mouse.move(p.x,p.y);await page.mouse.down();assert.deepEqual(await keys(page),['UP']);
    for(const [x,y,expected] of [[.6,-.6,['RIGHT','UP']],[.7,0,['RIGHT']],[.6,.6,['DOWN','RIGHT']],[0,.7,['DOWN']],[-.6,.6,['DOWN','LEFT']],[-.7,0,['LEFT']],[-.6,-.6,['LEFT','UP']],[0,0,[]]]){
     p=point(x,y);await page.mouse.move(p.x,p.y);assert.deepEqual(await keys(page),expected);
    }
    p=point(.6,.6);await page.mouse.move(p.x,p.y);await page.mouse.up();assert.deepEqual(await keys(page),[]);
    if(name==='chromium'){
     const cdp=await context.newCDPSession(page),a=await page.locator('[data-key=A]').boundingBox();p=point(.6,-.6);
     const action={x:a.x+a.width/2,y:a.y+a.height/2,id:2};
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1},action]});
     assert.deepEqual(await keys(page),['A','RIGHT','UP']);
     p=point(-.6,.6);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1},action]});assert.deepEqual(await keys(page),['A','DOWN','LEFT']);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual(await keys(page),[]);
     // A second finger on the disc cannot add a third or opposite direction.
     p=point(.6,-.6);const q=point(-.6,.6);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1},{...q,id:3}]});assert.deepEqual(await keys(page),['RIGHT','UP']);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();
    }
    p=point(.6,-.6);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.evaluate(()=>document.getElementById('console-menu').click());await page.mouse.up();assert.deepEqual(await keys(page),[]);
    await page.locator('#menu-resume').click();
   }
   assert.deepEqual(errors,[]);console.log(name+': emulator states verify eight sectors, sliding, centre dead zone, rotation, release/menu and multitouch cancellation');
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
