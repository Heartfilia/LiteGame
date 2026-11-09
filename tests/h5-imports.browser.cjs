const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8765';
(async()=>{
 const browser=await (process.env.BROWSER_ENGINE==='webkit'?webkit:chromium).launch();
 const failures=[];
 try{
  for(const item of JSON.parse(fs.readFileSync('deploy/h5-selection.json','utf8'))){
   const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))external.push(r.url());});
   try{
    await page.goto(base+'/games/crisp/'+item[0]+'/');await page.locator('#crisp-start').click({timeout:10000});
    const frame=page.frames()[1];const canvas=frame.locator('canvas');await canvas.tap({timeout:3000});
    const box=await canvas.boundingBox();
    for(let i=0;i<6;i++){await page.waitForTimeout(130);await canvas.tap({position:{x:box.width*(.2+i*.1),y:box.height*(.3+i*.05)},timeout:3000});}
    await page.locator('#crisp-pause').click();await page.waitForTimeout(100);const tick=await frame.evaluate(()=>ticks);await page.waitForTimeout(150);assert.equal(await frame.evaluate(()=>ticks),tick);
    for(const [width,height] of [[320,568],[844,390],[568,320]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log(item[0]+': input, pause, local assets, four layouts OK');
   }catch(e){failures.push({id:item[0],error:e.message,errors});}finally{await page.close();}
  }
 }finally{await browser.close();}
 console.log(JSON.stringify(failures,null,2));assert.equal(failures.length,0);
})().catch(e=>{console.error(e);process.exitCode=1;});
