const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
const session=page=>page.evaluate(()=>Chogan.storage('jigsaw').get('session'));
async function loadFixture(page,save,prefs){
 await page.route('**/games/jigsaw/',async route=>{
  const response=await route.fetch(),html=await response.text();
  const setup=`ctx.store.${save?'set(\'session\', '+JSON.stringify(save)+')':"remove('session')"};`+(prefs?`prefs=${JSON.stringify(prefs)};`:'');
  await route.fulfill({response,body:html.replace('var saved = ctx.loadSave();',setup+'var saved = ctx.loadSave();')});
 },{times:1});
 await page.reload();
}
async function canvasPoint(page,x,y){
 await page.locator('.jg-free-canvas').scrollIntoViewIfNeeded();
 const r=await page.locator('.jg-free-canvas').boundingBox();
 return {x:r.x+x,y:r.y+y};
}
async function drag(page,from,to){
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();
}
async function drop(page,id,x,y){
 await page.locator(`[data-piece="${id}"]`).tap();
 await page.locator('.jg-free-canvas').tap({position:{x,y}});
}
async function worldPoint(page,id){
 const s=(await session(page)).s, g=s.free.groups.find(g=>g.pieces.includes(id));
 const r=await page.locator('.jg-free-canvas').boundingBox(),v=s.free.view;
 return canvasPoint(page,r.width/2+((g.x+id%20+.5)*48-v.x)*v.zoom,r.height/2+((g.y+Math.floor(id/20)+.5)*64-v.y)*v.zoom);
}
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:1000,height:900},hasTouch:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/games/jigsaw/');
   await page.evaluate(()=>Chogan.storage('jigsaw').set('tutSeen',true));await page.reload();
   await page.getByRole('tab',{name:'自由 · 20×20',exact:true}).tap();
   await page.waitForFunction(()=>Chogan.storage('jigsaw').get('session')?.s.count===400);
   assert.equal(await page.locator('.jg-slot').count(),400);
   assert.equal(await page.locator('.jg-grid').isVisible(),false);
   assert.ok(await page.locator('.jg-free-canvas').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.every(v=>v===0)),'empty workspace has no guide lines or picture');
   // Arrange only the tray order for deterministic selection; all assembly actions use UI input.
   const ordered=await session(page);ordered.s.tray=[0,1,20,21,...ordered.s.tray.filter(i=>![0,1,20,21].includes(i))];await loadFixture(page,ordered);
   await page.locator('[data-piece="0"]').waitFor({state:'visible'});
   const slot=await page.locator('[data-piece="0"]').boundingBox(),target=await canvasPoint(page,180,160);
   await drag(page,{x:slot.x+slot.width/2,y:slot.y+slot.height/2},target);
   let s=(await session(page)).s;assert.equal(s.free.groups.length,1);assert.equal(s.placed.length,1);
   const origin={...s.free.groups[0]};
   await drop(page,1,180+48+5,160+4);
   s=(await session(page)).s;assert.equal(s.free.groups.length,1);assert.equal(s.free.groups[0].pieces.length,2);assert.equal(s.free.groups[0].x,origin.x);
   // Correct shapes but far from their neighbour stay independent and can form a second group.
   await drop(page,20,380,320);await drop(page,21,428,320);
   s=(await session(page)).s;assert.equal(s.free.groups.length,2);assert.ok(s.free.groups.every(g=>g.pieces.length===2));
   let p=await worldPoint(page,0);await drag(page,p,{x:p.x+70,y:p.y+30});
   s=(await session(page)).s;const moved=s.free.groups.find(g=>g.pieces.includes(0));
   assert.ok(Math.abs(moved.x-origin.x-70/48)<.001);assert.equal(moved.pieces.length,2);
   // Grab a piece in the second group and join both assemblies at once.
   const first=await worldPoint(page,0),second=await worldPoint(page,20);
   await drag(page,second,{x:first.x+3,y:first.y+64+3});
   s=(await session(page)).s;assert.equal(s.free.groups.length,1);assert.equal(s.free.groups[0].pieces.length,4);
   const beforeCancel=JSON.stringify(s.free.groups);
   p=await worldPoint(page,0);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+70,p.y+10);await page.keyboard.press('Escape');await page.mouse.up();
   assert.equal(JSON.stringify((await session(page)).s.free.groups),beforeCancel,'cancel restores assembly position');
   const beforePan=(await session(page)).s.free.view;
   p=await canvasPoint(page,40,40);await drag(page,p,{x:p.x+35,y:p.y+25});
   assert.notDeepEqual((await session(page)).s.free.view,beforePan);
   await page.getByRole('button',{name:'＋ 放大',exact:true}).tap();
   assert.equal((await session(page)).s.free.view.zoom,1.25);
   p=await worldPoint(page,0);const beforeScaled=(await session(page)).s.free.groups[0].x;
   await drag(page,p,{x:p.x+30,y:p.y+15});
   assert.ok(Math.abs((await session(page)).s.free.groups[0].x-beforeScaled-30/1.25/48)<.001,'drag uses zoomed world coordinates');
   const beforeReload=(await session(page)).s;await page.reload();
   assert.deepEqual((await session(page)).s,beforeReload,'positions, groups, view and tray survive refresh');
   await page.getByRole('button',{name:'查看全部',exact:true}).tap();
   if(name==='chromium'){
    const cdp=await page.context().newCDPSession(page);
    p=await worldPoint(page,0);const old=(await session(page)).s.free.groups[0].x;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+36,y:p.y+24,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(Math.abs((await session(page)).s.free.groups[0].x-old-.75)<.001,'real touch moves entire assembly');
    p=await worldPoint(page,0);const stable=(await session(page)).s.free.groups;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+40,y:p.y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.deepEqual((await session(page)).s.free.groups,stable);
    await cdp.detach();
   }
   // Mobile viewports: actual touch placement and no horizontal overflow after rotation.
   for(const size of [{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:568,height:320}]){
    await page.setViewportSize(size);await page.waitForTimeout(250);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow '+JSON.stringify(size));
    await page.getByRole('tab',{name:'自由 · 20×20',exact:true}).scrollIntoViewIfNeeded();
    assert.ok(await page.getByRole('tab',{name:'自由 · 20×20',exact:true}).evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'difficulty selector remains reachable');
    const id=(await session(page)).s.tray[0];await drop(page,id,90,90);
    assert.ok((await session(page)).s.placed.includes(id));
   }
   // A valid near-complete save exercises completion, including persistence and final-group movement.
   await page.setViewportSize({width:1000,height:900});
   const nearComplete=await session(page);
   nearComplete.s.placed=Array.from({length:399},(_,i)=>i);nearComplete.s.tray=[399];
   nearComplete.s.free={version:1,groups:[{pieces:nearComplete.s.placed.slice(),x:0,y:0}],view:{x:19*48,y:19*64,zoom:1}};
   await loadFixture(page,nearComplete);
   const r=await page.locator('.jg-free-canvas').boundingBox();await drop(page,399,r.width/2+24,r.height/2+32);
   s=(await session(page)).s;assert.equal(s.free.groups[0].pieces.length,400);assert.equal(s.tray.length,0);
   assert.ok((await page.locator('.jg-status').textContent()).includes('拼图完成'));
   p=await worldPoint(page,399);await drag(page,p,{x:p.x+20,y:p.y+15});
   assert.ok((await session(page)).s.free.groups[0].x>0,'completed puzzle remains movable');
   await page.reload();assert.equal(await page.locator('.jg-slot').count(),0);assert.ok((await page.locator('.jg-status').textContent()).includes('拼图完成'));
   assert.deepEqual(errors,[]);console.log(name+': 400 pieces, blank workspace, touch placement, group joins/drag/cancel, pan/zoom, refresh, four sizes and completion passed');
   // Classic mode still draws guides and places a piece by its keyboard cell.
   await loadFixture(page,null,{count:12,done:{}});
   assert.equal(await page.locator('.jg-grid').isVisible(),true);assert.equal(await page.locator('.jg-free-canvas').isVisible(),false);
   await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
   const id=await page.locator('.jg-slot--sel').evaluate(n=>n._piece);
   for(let i=0;i<id%3;i++)await page.keyboard.press('ArrowRight');
   for(let i=0;i<Math.floor(id/3);i++)await page.keyboard.press('ArrowDown');
   await page.keyboard.press('Enter');assert.equal(await page.locator('.jg-piece').count(),1);
   console.log(name+': classic guided placement regression passed');
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
