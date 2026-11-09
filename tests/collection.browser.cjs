const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
const data=require('../games/lib/collection-data.js'),factory=require('../games/lib/collection-engines.js');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:8766';
(async()=>{const browser=await(process.env.BROWSER_ENGINE==='webkit'?webkit:chromium).launch();
 try{for(const cfg of data){const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/games/'+cfg.id+'/');await page.locator('.arc-tools .ch-btn--primary').tap();
  const selector=cfg.category==='rpg'?'right':cfg.category==='racing'?'gas':cfg.category==='music'?'listen':cfg.category==='sports'?'shoot':null;
  if(selector){const b=page.locator('[data-action='+selector+']');if(cfg.category==='racing'||cfg.mode==='curling'){const box=await b.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(150);await page.mouse.up();}else await b.tap();}
  if(cfg.category==='cards')await page.getByRole('group',{name:'大按钮选牌区'}).locator('button').first().tap();
  await page.locator('.arc-tools .ch-btn--primary').tap();
  let saved=await page.evaluate(id=>Chogan.storage(id).get('session'),cfg.id);assert.ok(factory(cfg).restore(saved),cfg.id+' save');
  await page.reload();let restored=await page.evaluate(id=>Chogan.storage(id).get('session'),cfg.id);delete saved.at;delete restored.at;assert.deepEqual(restored,saved,cfg.id+' resume');
  for(const size of [{width:320,height:568},{width:844,height:390},{width:568,height:320}]){await page.setViewportSize(size);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),cfg.id+' overflow');}
  assert.deepEqual(errors,[],cfg.id);await context.close();console.log(cfg.id+': real input, valid save, exact reload, layouts OK');
 }
 // Near-completion fixtures verify the actual shared result path once per family.
 for(const mode of ['frost','ring','interval','pyramid','volley']){const cfg=data.find(g=>g.mode===mode),E=factory(cfg),s=E.newGame(()=>.2),context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  if(mode==='frost'){s.x=9;s.y=7;s.goal=3;}
  if(mode==='ring'){s.ringAngle=6*Math.PI-Math.PI/2-.001;s.speed=100;}
  if(mode==='interval'){s.round=7;s.answered=true;s.correct=7;}
  if(mode==='pyramid'){s.piles=Array.from({length:28},()=>[]);s.piles[21]=[12];s.deck=[];s.waste=[];s.removed=Array.from({length:52},(_,i)=>i).filter(i=>i!==12);}
  if(mode==='volley'){s.hits=9;s.ball={x:300,y:399,vx:0,vy:160};}
  await context.addInitScript(({id,s})=>localStorage.setItem('chogan.'+id+'.session',JSON.stringify(s)),{id:cfg.id,s});const page=await context.newPage();await page.goto(base+'/games/'+cfg.id+'/');await page.locator('.arc-tools .ch-btn--primary').tap();
  if(mode==='frost')await page.locator('[data-action=interact]').tap();if(mode==='interval')await page.locator('[data-action=next]').tap();if(mode==='pyramid')await page.getByRole('group',{name:'大按钮选牌区'}).getByRole('button',{name:'22列 K♣',exact:true}).tap();
  await page.locator('.ch-seeboard').waitFor();assert.equal(await page.evaluate(id=>Chogan.stats.game(id).plays,cfg.id),1);await context.close();console.log(mode+': one-time settlement OK');
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
