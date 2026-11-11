const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const manifest=require('../games/jigsaw/images/manifest.json');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:1000,height:900},hasTouch:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/games/jigsaw/');await page.evaluate(()=>Chogan.storage('jigsaw').set('tutSeen',true));await page.reload();
   for(const photo of manifest){
    await page.route('**/games/jigsaw/',async route=>{
     const response=await route.fetch(),html=await response.text();
     const setup=`var fixture=E.deal(100,123,C.rng(123),'lake');fixture.pic=${JSON.stringify(photo.id)};fixture.free=F.create(10);ctx.store.set('session',{s:fixture,daily:null,elapsed:0});`;
     await route.fulfill({response,body:html.replace('var saved = ctx.loadSave();',setup+'var saved = ctx.loadSave();')});
    },{times:1});
    await page.reload();await page.locator('.jg-slot').first().waitFor({state:'visible'});
    assert.equal(await page.locator('.jg-slot').count(),100);
    assert.ok((await page.locator('.jg-top').textContent()).includes(photo.title));
    assert.deepEqual(await page.evaluate(async id=>{const i=await JigsawPhotos.load(id);return [i.naturalWidth,i.naturalHeight];},photo.id),[photo.width,photo.height]);
    await page.getByRole('button',{name:'查看完整参考图',exact:true}).tap();await page.getByRole('button',{name:'返回拼图',exact:true}).tap();await page.locator('.jg-preview').waitFor({state:'detached'});
    await page.locator('.jg-slot').first().tap();await page.locator('.jg-free-canvas').tap({position:{x:120,y:120}});
    const before=await page.evaluate(()=>Chogan.storage('jigsaw').get('session').s);
    assert.equal(before.pic,photo.id);assert.equal(before.placed.length,1);
    await page.reload();await page.locator('.jg-slot').first().waitFor({state:'visible'});
    assert.deepEqual(await page.evaluate(()=>Chogan.storage('jigsaw').get('session').s),before);
   }
   // Retry the same saved puzzle after a failed image request.
   await page.route('**/images/*.webp',route=>route.abort());await page.reload();
   await page.getByRole('button',{name:'重试加载图片',exact:true}).waitFor({state:'visible'});
   assert.equal(await page.locator('.jg-free-canvas').isVisible(),false);
   await page.unroute('**/images/*.webp');await page.getByRole('button',{name:'重试加载图片',exact:true}).click();
   await page.locator('.jg-slot').first().waitFor({state:'visible'});assert.equal(await page.locator('.jg-slot').count(),99);
   // Switch mode while a previous photo is still loading: late completion cannot overwrite it.
   let release;const gate=new Promise(resolve=>{release=resolve;});
   await page.route('**/images/*.webp',async route=>{await gate;await route.continue();});
   await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('tab',{name:'12',exact:true}).click();
   await page.locator('.ch-scrim button.ch-btn--primary').last().click();
   release();await page.locator('.jg-grid').waitFor({state:'visible'});
   assert.equal(await page.locator('.jg-free-canvas').isVisible(),false);
   assert.equal(await page.locator('.jg-slot').count(),12);
   assert.deepEqual(errors,[]);console.log(name+': all six photos load/render/save, retry and late-load mode switch passed');
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
