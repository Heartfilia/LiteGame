const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8765';
const copy=s=>JSON.parse(JSON.stringify(s));
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});try{
 for(const id of ['bubble-shooter','match3','catchcat','packabunchas']){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const key=`litegame.${id}.campaign`;await page.goto(`${base}/games/${id}/`);await page.waitForFunction(()=>!document.getElementById('casual-loading'));await page.locator('#port-start').tap();
  const initial=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key);
  if(id==='bubble-shooter'){await page.locator('#fire').tap();const s=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key);assert.equal(s.shots,initial.shots-1);}
  if(id==='match3'){const E=require('../games/match3/engine.js')();const move=E.moves(initial.board)[0];for(const i of move)await page.locator(`[data-cell="${i}"]`).tap();assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data.moves,key),27);}
  if(id==='catchcat'){const E=require('../games/catchcat/engine.js')(),cell=Array.from({length:121},(_,i)=>i).find(i=>i!==60&&!initial.walls.includes(i)),p=E.position(cell);const box=await page.locator('#casual-board').boundingBox();await page.touchscreen.tap(box.x+p.x*box.width/480,box.y+p.y*box.height/490);assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data.turns,key),1);await page.locator('#undo').tap();assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data.turns,key),0);}
  if(id==='packabunchas'){
   await page.locator('#packing-select').tap();await page.locator('#packing-rotate').tap();let saved=await page.evaluate(()=>PackingPort.snapshot());assert.notEqual(saved.pieces[0].angle,initial.pieces[0].angle);assert.ok(await page.evaluate(()=>PackingPort.validate(PackingPort.snapshot())));
   // Actual pointer drag on the original canvas, release commits to the journal.
   const pos=await page.evaluate(()=>{const p=pieces[0],b=p.blocks[0];return {x:p.originalPosition.x+b[0]*blockSize,y:p.originalPosition.y+b[1]*blockSize};});await page.locator('#v').scrollIntoViewIfNeeded();const rect=await page.locator('#v').boundingBox();const x=rect.x+pos.x*rect.width/1080,y=rect.y+pos.y*rect.height/1560;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+rect.height*83/1560,{steps:4});await page.mouse.up();assert.notDeepEqual((await page.evaluate(()=>PackingPort.snapshot())).pieces[0].position,saved.pieces[0].position);
  }
  await page.locator('#port-pause').click();const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key);await page.reload();await page.waitForFunction(()=>!document.getElementById('casual-loading'));assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key),saved);
  if(id==='packabunchas')assert.deepEqual(await page.evaluate(()=>PackingPort.snapshot()),saved);
  // Export and import through visible save UI.
  await page.locator('#port-save').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出存档',exact:true}).click();const d=await download;assert.ok(d.suggestedFilename().includes(id));const portable=fs.readFileSync(await d.path());await page.locator('input[type=file]').setInputFiles({name:'save.json',mimeType:'application/json',buffer:portable});await page.getByRole('button',{name:'确认',exact:true}).click();assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key),saved);
  await page.locator('#port-save').click();await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForFunction(()=>document.getElementById('port-status').textContent.includes('导入失败'));assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key),saved);await page.keyboard.press('Escape');
  if(id==='packabunchas'){
   // Every mode produces solvable non-overlapping shapes; use saved solutions
   // to drive the original rotate/containment/completion functions.
   await page.locator('#port-start').click();
   for(let mode=0;mode<5;mode++){
    await page.locator('#packing-mode').selectOption(String(mode));await page.locator('#packing-shuffle').click();
    // Seeded generation stress: validate solutions with the original collision code.
    const stress=await page.evaluate(()=>{const original=Math.random;let seed=713;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);try{for(let i=0;i<100;i++){document.getElementById('packing-shuffle').click();const s=PackingPort.snapshot();if(!PackingPort.validate(s))throw Error('Invalid generated snapshot');if(s.mode===1&&s.pieces.some(p=>p.blocks.length!==5))throw Error('Five-block mode lost a block');if(PackingPort.validate({...s,completed:true,rescued:100}))throw Error('False completed state accepted');for(const p of pieces){const goal=s.solutions.find(t=>t.id===p.portId);p.rotateTo(goal.angle);p.originalPosition={x:bag.originalPosition.x+goal.x*blockSize,y:bag.originalPosition.y+goal.y*blockSize};}if(!checkCompleted())throw Error('Generated solution does not fit');}document.getElementById('packing-shuffle').click();return true;}finally{Math.random=original;}});assert.ok(stress);
    for(let iteration=0;iteration<8;iteration++){
     const result=await page.evaluate(()=>{const s=PackingPort.snapshot();for(const p of pieces){const goal=s.solutions.find(t=>t.id===p.portId);p.rotateTo(goal.angle);p.originalPosition={x:bag.originalPosition.x+goal.x*blockSize,y:bag.originalPosition.y+goal.y*blockSize};}const solved=checkCompleted();PackingPort.settle();return {solved,valid:!!PackingPort.validate(PackingPort.snapshot()),s:PackingPort.snapshot()};});assert.ok(result.solved&&result.valid);assert.ok(result.s.completed);await page.locator('#packing-next').click();
    }
   }
   assert.ok((await page.evaluate(()=>PackingPort.snapshot())).rescued>=100);
  }else{
   // End-state fixtures verify visible next/retry/undo and permanent journals.
   const E=require(`../games/${id}/engine.js`)(),s=E.newGame(78);
   if(id==='bubble-shooter'){s.board=Array(130).fill(-1);s.phase='won';s.wins=1;s.unlocked=2;}
   if(id==='match3'){s.score=s.target;s.collected=s.goal;s.phase='won';s.wins=1;s.unlocked=2;}
   if(id==='catchcat'){s.walls=E.neighbors(60).slice(1);E.act(s,'block',E.neighbors(60)[0]);}
   const encoded=require('../games/lib/campaign-save.js')(id,E,{getItem(){return null;},setItem(){}}).encode(s);
   await page.locator('#port-save').click();await page.locator('input[type=file]').setInputFiles({name:'ending.json',mimeType:'application/json',buffer:Buffer.from(encoded)});await page.getByRole('button',{name:'确认',exact:true}).click();await page.reload();await page.waitForFunction(()=>!document.getElementById('casual-loading'));assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data.phase,key),'won');await page.locator('#casual-next').click();assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data.level,key),2);
  }
  // A second tab must block stale writes, preserving the first tab's changes.
  const second=await context.newPage();await second.goto(`${base}/games/${id}/`);await second.waitForFunction(()=>!document.getElementById('casual-loading'));await second.locator('#port-start').click();
  if(id==='packabunchas'){await second.locator('#packing-select').click();await second.locator('#packing-rotate').click();}else if(id==='bubble-shooter')await second.locator('#fire').click();else if(id==='match3'){const s=await second.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key),E=require('../games/match3/engine.js')();for(const i of E.moves(s.board)[0])await second.locator(`[data-cell="${i}"]`).click();}else await second.locator('#new-round').click();
  await page.waitForFunction(()=>document.getElementById('port-status').textContent.includes('另一标签页'));await second.close();
  const backup=await page.evaluate(k=>JSON.parse(localStorage.getItem(k+'.backup')).data,key);await page.evaluate(k=>localStorage.setItem(k,'broken'),key);await page.reload();await page.waitForFunction(()=>!document.getElementById('casual-loading'));assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key),backup);
  assert.deepEqual(errors,[],id);console.log(id+': input, pause, refresh, import/export, ending, corruption and concurrent tabs passed');await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
