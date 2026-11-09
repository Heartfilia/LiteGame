const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8765';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});try{
 for(const id of ['snake','bounce-back','entombed','2048']){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/games/${id}/`);await page.waitForTimeout(250);
  const cdp=await context.newCDPSession(page);
  async function hold(selector,ms){const node=page.locator(selector);await node.scrollIntoViewIfNeeded();const r=await node.boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await page.waitForTimeout(ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  if(id==='snake'){
   for(const size of [{width:390,height:844},{width:320,height:568},{width:568,height:320},{width:844,height:390}]){await page.setViewportSize(size);await page.waitForTimeout(150);const fits=await page.evaluate(()=>{const r=document.querySelector('.sn-canvas').getBoundingClientRect();return r.width>=140&&r.top>=0&&r.bottom<=innerHeight&&[...document.querySelectorAll('.lg-pad button')].every(n=>{const b=n.getBoundingClientRect();return b.right<=r.left||b.left>=r.right||b.bottom<=r.top||b.top>=r.bottom;});});assert.ok(fits,'snake board fits and avoids pad '+JSON.stringify(size));}
   await page.getByRole('button',{name:'继续游戏',exact:true}).tap();await hold('.lg-pad__btn--up',40);await page.waitForTimeout(250);await page.getByRole('button',{name:'暂停',exact:true}).tap();assert.equal(await page.evaluate(()=>Chogan.storage('snake').get('session').dir),'up');
  }else if(id==='2048'){
   const before=await page.evaluate(()=>Chogan.storage('2048').get('session').moves);const r=await page.locator('.m-board').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width*.8,y:r.y+r.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+r.width*.2,y:r.y+r.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await page.evaluate(()=>Chogan.storage('2048').get('session').moves))>before);
  }else{
   await page.waitForFunction(()=>document.getElementById('port-status').textContent.length>0);await page.locator('#port-start').tap();await page.waitForTimeout(500);
   if(id==='entombed'){const before=await page.evaluate(()=>({...player.direction}));await hold('[data-hold=turnRight]',400);assert.notDeepEqual(await page.evaluate(()=>({...player.direction})),before);assert.equal(await page.evaluate(()=>!!downKeys.turnRight),false);}
   else{await page.waitForTimeout(1300);const before=await page.evaluate(()=>({x:player.pos.x,y:player.pos.y}));await hold('[data-hold="68"]',350);assert.notDeepEqual(await page.evaluate(()=>({x:player.pos.x,y:player.pos.y})),before);}
   await page.locator('#port-pause').tap();await page.setViewportSize({width:568,height:320});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.port-stage,.port-controls button')].every(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})),id+' landscape controls visible');
  }
  assert.deepEqual(errors,[]);console.log(id+': touch input and mobile layout passed');await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
