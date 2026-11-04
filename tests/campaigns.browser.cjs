const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8765';
async function hold(page,selector,ms){const b=await page.locator(selector).boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(ms);await page.mouse.up();}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});try{
 {const context=await browser.newContext(),page=await context.newPage();let attempts=0;await page.route('**/chronicles.js*',route=>++attempts===1?route.abort('connectionreset'):route.continue());await page.goto(`${base}/games/starfarm/`);await page.waitForSelector('.cp-wrap');assert.equal(attempts,2);assert.equal(await page.locator('#campaign-loading').count(),0);await context.close();console.log('campaign loader: interrupted script retries successfully');}
 {const context=await browser.newContext(),page=await context.newPage();await page.route('**/chronicles.js*',route=>route.abort('connectionreset'));await page.goto(`${base}/games/starfarm/`);await page.waitForFunction(()=>document.getElementById('campaign-loading').textContent.includes('加载失败'));assert.equal(await page.getByRole('link',{name:'重新载入'}).count(),1);await context.close();console.log('campaign loader: persistent failure has visible recovery');}
 for(const [id,a,n] of [['starfarm','sleep'],['runetraveler','route','rest'],['caravan','work'],['wardens','end'],['island','gather'],['magictower','move','right']]){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure().errorText));
  await page.goto(`${base}/games/${id}/index.html`);await page.waitForSelector('.cp-wrap');assert.deepEqual(errors,[],id+' startup errors');const key=`litegame.${id}.campaign`;
  const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key);
  await page.locator(`[data-action="${a}"]${n?`[data-value="${n}"]`:''}`).first().tap();
  const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key);assert.notDeepEqual(after,before);
  await page.reload();await page.waitForSelector('.cp-wrap');assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key),after);
  const portable=await page.evaluate(k=>localStorage.getItem(k),key);
  await page.getByRole('button',{name:'存档',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出存档 .json',exact:true}).click();assert.ok((await download).suggestedFilename().startsWith(id));
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'存档',exact:true}).click();await page.locator('input[type="file"]').setInputFiles({name:'save.json',mimeType:'application/json',buffer:Buffer.from(portable)});await page.getByRole('button',{name:'确认',exact:true}).click();assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key),after);
  await page.getByRole('button',{name:'存档',exact:true}).click();await page.locator('input[type="file"]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"bad":true}')});await page.waitForFunction(()=>document.querySelector('.cp-dialog').textContent.includes('导入失败'));assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key),after);await page.keyboard.press('Escape');
  const second=await context.newPage();await second.goto(`${base}/games/${id}/index.html`);
  if(id==='runetraveler')await second.locator('[data-action="end"]').click();else await second.locator(`[data-action="${a}"]${n?`[data-value="${n}"]`:''}`).first().click();
  await page.waitForFunction(()=>document.querySelector('.cp-dialog').textContent.includes('另一标签页'));
  assert.deepEqual(errors,[]);console.log(id+': touch action, refresh, download, concurrent-tab lock passed');await context.close();
 }
 for(const id of ['bounce-back','entombed']){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/games/${id}/index.html`);await page.waitForFunction(()=>document.getElementById('port-status').textContent.length>0);await page.locator('#port-start').click();await page.waitForTimeout(1700);
  if(id==='bounce-back'){
   const start=await page.evaluate(()=>({x:player.pos.x,y:player.pos.y}));await hold(page,'[data-hold="68"]',350);assert.notDeepEqual(await page.evaluate(()=>({x:player.pos.x,y:player.pos.y})),start);
   await hold(page,'[data-hold="throw"]',80);
   // Exercise actual level transition/checkpoint hook, rather than editing the journal.
   await page.evaluate(()=>{nextLevel=2;NextLevel();});await page.locator('#port-pause').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('litegame.bounce-back.campaign')).data.floor),2);
   await page.reload();await page.waitForFunction(()=>typeof levelNumber!=='undefined'&&levelNumber===2);assert.ok(await page.evaluate(()=>window.portPaused));
   await page.evaluate(()=>{bounceMeta.won=1;winTimer.Set();bouncePort.save();});await page.reload();await page.waitForFunction(()=>typeof winTimer!=='undefined'&&winTimer.IsSet());
  }else{
   const before=await page.evaluate(()=>({...player.direction}));await hold(page,'[data-hold="turnRight"]',200);assert.notDeepEqual(await page.evaluate(()=>({...player.direction})),before);
   await page.locator('#port-pause').click();const saved=await page.evaluate(()=>portSnapshot());assert.ok(await page.evaluate(()=>entombedValidate(portSnapshot())));await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state===STATE_PAUSE);assert.deepEqual(await page.evaluate(()=>({x:player.x,y:player.y,health:player.health,mana:player.mana})),{x:saved.player.x,y:saved.player.y,health:saved.player.health,mana:saved.player.mana});
   // Regression fixtures: original reset, ghost/key/locked-door/ladder completion.
   const result=await page.evaluate(()=>{player.hasKey=true;stats.shotsFired=42;achievements.pacifist=false;start();setState(STATE_PLAY);const reset=!player.hasKey&&stats.shotsFired===0&&achievements.pacifist;const ghost=map.entities.find(e=>e instanceof Ghost);ghost.damage(120,player);const key=map.entities.find(e=>e instanceof Key);key.collect();const door=flat(map.data).find(t=>t&&t.locked);open_door(door);setState(STATE_PAUSE);const offset=door.offset;return {reset,key:player.hasKey,offset};});assert.ok(result.reset&&result.key);
   await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>flat(map.data).find(t=>t&&t.locked).offset),result.offset);
   await page.evaluate(()=>{setState(STATE_PLAY);TweenManager.update(3);map.entities.find(e=>e instanceof Ladder).onInteract();entombedPort.save();});assert.equal(await page.evaluate(()=>state),4);await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state===STATE_WIN);
  }
  await page.locator('#port-save').click();const dl=page.waitForEvent('download');await page.getByRole('button',{name:'导出存档',exact:true}).click();assert.ok((await dl).suggestedFilename().includes(id));await page.keyboard.press('Escape');
  const key=`litegame.${id}.campaign`,portable=await page.evaluate(k=>localStorage.getItem(k),key);await page.locator('#port-save').click();await page.locator('input[type="file"]').setInputFiles({name:'save.json',mimeType:'application/json',buffer:Buffer.from(portable)});await page.getByRole('button',{name:'确认',exact:true}).click();
  await page.evaluate(k=>localStorage.setItem(k,'broken'),key);await page.reload();await page.waitForFunction(()=>document.getElementById('port-status').textContent.includes('有效备份'));
  assert.deepEqual(errors,[]);console.log(id+': touch controls, checkpoint/snapshot restore, ending fixture, export passed');await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
