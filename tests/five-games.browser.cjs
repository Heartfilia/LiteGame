const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const factory=require('../games/lib/five-engines.js');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch();
 try {
  for(const id of ['ridge-rally','neon-traffic','beat-echo','chord-lab']){
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/games/'+id+'/');
   const play=page.locator('.arc-tools .ch-btn--primary');await play.tap();
   if(id==='ridge-rally'){await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');}
   if(id==='neon-traffic')await page.locator('[data-action=right]').tap();
   if(id==='beat-echo'){await page.locator('[data-action=listen]').tap();await page.waitForFunction(()=>!document.querySelector('[data-action=tap]').disabled);await page.locator('[data-action=tap]').tap();}
   if(id==='chord-lab'){await page.locator('[data-action=listen]').tap();await page.locator('[data-action=note0]').tap();}
   await play.tap();
   const saved=await page.evaluate(id=>Chogan.storage(id).get('session'),id);
   if(id==='ridge-rally')assert.ok(saved.x>300);
   if(id==='neon-traffic')assert.equal(saved.lane,2);
   if(id==='beat-echo')assert.equal(saved.taps.length,1);
   if(id==='chord-lab')assert.deepEqual(saved.selected,[0]);
   await page.reload();assert.ok(await page.locator('.arc-overlay').isVisible());
   const restored=await page.evaluate(id=>Chogan.storage(id).get('session'),id);delete restored.at;delete saved.at;
   assert.deepEqual(restored,saved);
   // Exercise real settlement from near-ending states without a long gameplay recording.
   let fixture=factory(id).newGame(()=>.2);
   if(id==='ridge-rally'){fixture.distance=3599;fixture.x=factory(id).center(3599);fixture.speed=100;}
   if(id==='neon-traffic'){fixture.elapsed=59.99;fixture.spawn=1;}
   if(id==='beat-echo'){fixture.round=7;fixture.phase='result';fixture.correct=7;}
   if(id==='chord-lab'){fixture.round=9;fixture.answered=true;fixture.correct=9;fixture.selected=fixture.rounds[9];}
   await page.addInitScript(({id,fixture})=>localStorage.setItem('chogan.'+id+'.session',JSON.stringify(fixture)),{id,fixture});await page.reload();await page.locator('.arc-tools .ch-btn--primary').tap();
   if(['beat-echo','chord-lab'].includes(id))await page.locator('[data-action=next]').tap();
   await page.locator('.ch-seeboard').waitFor();
   assert.equal(await page.evaluate(id=>Chogan.stats.game(id).plays,id),1);
   assert.deepEqual(errors,[]);await context.close();console.log(id+': input, saved state reload, ending and one-time settlement passed');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
