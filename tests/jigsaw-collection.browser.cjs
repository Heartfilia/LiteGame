const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const manifest=require('../games/jigsaw/images/manifest.json');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
const ids=manifest.map(p=>p.id);
const value=(page,key)=>page.evaluate(key=>Chogan.storage('jigsaw').get(key),key);

async function setPrefs(page,prefs,save=null){
 await page.route('**/games/jigsaw/',async route=>{
  const response=await route.fetch(),html=await response.text();
  const setup=`prefs=${JSON.stringify(prefs)};ctx.store.set('tutSeen',true);ctx.store.set('prefs',prefs);`+(save?`ctx.store.set('session',${JSON.stringify(save)});`:"ctx.store.remove('session');")+'var saved = ctx.loadSave();';
  await route.fulfill({response,body:html.replace('var saved = ctx.loadSave();',setup)});
 },{times:1});
 await page.reload();
}
async function openCollection(page){
 await page.locator('[data-action="collection"]').click();
 await page.locator('.jg-collection-modal').waitFor({state:'visible'});
}

(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:1000,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/games/jigsaw/');await page.evaluate(()=>Chogan.storage('jigsaw').set('tutSeen',true));

  // A completed save from the old format is collected once and replaced by an unfinished game.
  const completed=await page.evaluate(id=>{
   const s=JigsawEngine.deal(100,123,Chogan.rng(123),'lake');s.pic=id;
   s.placed=Array.from({length:100},(_,i)=>i);s.tray=[];
   s.free={version:1,cols:10,groups:[{pieces:s.placed.slice(),x:0,y:0}],view:{x:432,y:576,zoom:1}};
   return {s,daily:null,elapsed:0};
  },ids[0]);
  await setPrefs(page,{count:100,lastPhoto:ids[0],donePhotos:[],done:{}},completed);
  await page.locator('.jg-slot').first().waitFor({state:'visible'});
  let prefs=await value(page,'prefs');
  assert.deepEqual(prefs.donePhotos,[ids[0]]);
  assert.notEqual((await value(page,'session')).s.pic,ids[0]);
  assert.equal((await value(page,'session')).s.tray.length,100);

  // An exhausted free library shows a useful waiting state instead of silently cycling.
  await setPrefs(page,{count:100,donePhotos:ids,done:{}});
  await page.locator('.jg-empty').waitFor({state:'visible'});
  assert.match(await page.locator('.jg-empty').textContent(),/等待后续新增更多图片/);
  assert.equal(await page.locator('.jg-free-canvas').isVisible(),false);
  assert.equal(await value(page,'session'),null);
  await openCollection(page);
  assert.equal(await page.locator('[data-collection-mode="free"]').count(),ids.length);
  assert.equal(await page.locator('[data-collection-mode="free"].jg-collection__item--done').count(),ids.length);
  await page.locator(`[data-collection-mode="free"][data-collection-id="${ids[0]}"]`).click();
  await page.locator('.jg-slot').first().waitFor({state:'visible'});
  assert.equal((await value(page,'session')).s.pic,ids[0],'collection allows an explicit replay');
  await page.locator('[data-action="new"]').click();
  await page.locator('.jg-empty').waitFor({state:'visible'});

  // Classic records stay separate per count and have the same exhausted state.
  const classicDone=await page.evaluate(()=>JigsawEngine.picsFor(24));
  await setPrefs(page,{count:24,donePhotos:ids,done:{24:classicDone}});
  await page.locator('.jg-empty').waitFor({state:'visible'});
  await openCollection(page);
  assert.equal(await page.locator('[data-collection-mode="classic"]').count(),classicDone.length);
  assert.equal(await page.locator('[data-collection-mode="classic"].jg-collection__item--done').count(),classicDone.length);
  await page.locator('.ch-modal__actions button').click();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await page.locator('.jg-empty').isVisible());

  // A real classic completion is recorded at its own piece count.
  await page.setViewportSize({width:1000,height:900});
  await setPrefs(page,{count:12,donePhotos:ids,done:{}});
  await page.locator('.jg-slot').first().waitFor({state:'visible'});
  for(let i=0;i<12;i++){
   const slot=await page.locator('.jg-slot').first().boundingBox(),frame=await page.locator('.jg-frame').boundingBox();
   const id=Number(await page.locator('.jg-slot').first().getAttribute('data-piece'));
   await page.mouse.move(slot.x+slot.width/2,slot.y+slot.height/2);await page.mouse.down();
   await page.mouse.move(frame.x+(id%3+.5)*frame.width/3,frame.y+(Math.floor(id/3)+.5)*frame.height/4,{steps:6});
   await page.mouse.up();
  }
  await page.waitForFunction(()=>Chogan.storage('jigsaw').get('prefs').done[12].length===1);
  await openCollection(page);
  assert.equal(await page.locator('[data-collection-mode="classic"].jg-collection__item--done').count(),1);
  await page.locator('.ch-modal__actions button').click();

  // Daily puzzles remain available even when every normal library is complete.
  await page.goto(base+'/games/jigsaw/?daily=2026-11-24');
  await page.locator('.jg-slot').first().waitFor({state:'visible'});
  assert.equal(await page.locator('.jg-slot').count(),24);
  assert.equal(await page.locator('.jg-grid').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('Chromium: completed-save migration, unfinished-first selection, real classic completion, free/classic exhaustion, collection replay, mobile empty state and daily puzzle passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
