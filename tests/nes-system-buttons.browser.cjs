const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const catalog=require('../games/nes/catalog.json');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
const game=catalog.games.find(g=>g.title==='魂斗罗'&&g.status==='boot');
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/nes/nes.js',route=>route.fulfill({contentType:'text/javascript',body:'window.inputEvents=[];\n'+fs.readFileSync('games/nes/nes.js','utf8').replace('nes.frame();',"nes.frame(); window.inputEvents.push(['frame']);").replace('nes.buttonDown(player, button);',"nes.buttonDown(player, button); window.inputEvents.push(['buttonDown',player,button]);").replace('nes.buttonUp(value.player, value.button);',"{ nes.buttonUp(value.player, value.button); window.inputEvents.push(['buttonUp',value.player,value.button]); }")}));
   await page.goto(base+'/games/nes/');assert.ok(await page.locator('#console-pause').isDisabled());assert.ok(await page.locator('[data-key=START]').isDisabled());
   for(const launcher of ['#console-pause','[data-key=START]','[data-key=SELECT]']){
    await page.goto(base+'/games/nes/?game='+game.id);await page.waitForFunction(()=>!document.getElementById('console-pause').disabled);
    await page.locator(launcher).tap();await page.waitForFunction(()=>inputEvents.filter(e=>e[0]==='frame').length>=4);
    assert.equal(await page.locator('#console-pause').textContent(),'暂停');assert.equal(await page.locator('#play').textContent(),'运行中');
    assert.equal(await page.evaluate(()=>inputEvents.filter(e=>e[0]==='buttonDown').length),0,'wake does not send an accidental cartridge pause');
    for(const key of ['SELECT','START']){
     await page.evaluate(()=>{inputEvents=[];});await page.locator('[data-key='+key+']').tap();
     await page.waitForFunction(key=>inputEvents.some(e=>e[0]==='buttonUp'&&e[2]===jsnes.Controller['BUTTON_'+key]),key);
     const frames=await page.evaluate(key=>{const code=jsnes.Controller['BUTTON_'+key],down=inputEvents.findIndex(e=>e[0]==='buttonDown'&&e[2]===code),up=inputEvents.findIndex(e=>e[0]==='buttonUp'&&e[2]===code);return down>=0?inputEvents.slice(down+1,up).filter(e=>e[0]==='frame').length:-1;},key);
     assert.equal(frames,2,'short tap reaches two emulated frames');
    }
    await page.locator('#console-pause').tap();assert.equal(await page.locator('#console-pause').textContent(),'继续');
    const frames=await page.evaluate(()=>inputEvents.filter(e=>e[0]==='frame').length);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>inputEvents.filter(e=>e[0]==='frame').length),frames);
    await page.locator('#console-pause').tap();assert.equal(await page.locator('#console-pause').textContent(),'暂停');
    await page.locator('#pause').click();assert.equal(await page.locator('#console-pause').textContent(),'继续');
    await page.locator('[data-key=START]').tap();assert.equal(await page.locator('#play').textContent(),'运行中');
    await page.locator('#pause').click();await page.locator('#screen').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#play').textContent(),'运行中');
    console.log(name+' '+launcher+': starts without top play, frame-safe START/SELECT, pause/resume and keyboard wake passed');
   }
   // The same bottom toggle remains sufficient in the immersive landscape layout.
   await page.locator('#pause').click();await page.locator('#landscape').click();await page.locator('#console-pause').tap();assert.equal(await page.locator('#play').textContent(),'运行中');
   await page.locator('#console-menu').tap();await page.locator('#exit-display').tap();assert.equal(await page.locator('#console-pause').textContent(),'继续');
   assert.deepEqual(errors,[]);
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
