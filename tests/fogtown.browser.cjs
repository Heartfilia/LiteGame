const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./engine-loader.cjs');
const createSaves = require('../games/fogtown/save.js');
const E = load('fogtown');
const codec = createSaves(E, { getItem:()=>null, setItem:()=>{} });
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8765';
const key = codec.KEY;
const decode = text => codec.decode(text);
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  const errors=[];
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,acceptDownloads:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    const url=base+'/games/fogtown/index.html?from=rpg';
    const state=async()=>decode(await page.evaluate(k=>localStorage.getItem(k),key));
    const close=()=>page.locator('.ft-dialog-head button').click();
    const importState=async(s)=>{
      if(await page.locator('.ft-sheet:not([hidden])').count())await close();
      await page.getByRole('button',{name:'存档',exact:true}).click();
      await page.locator('input[type=file]').setInputFiles({name:'save.json',mimeType:'application/json',buffer:Buffer.from(codec.encode(s))});
      await page.getByRole('button',{name:'确认导入',exact:true}).click();
    };
    await page.goto(url);await page.getByRole('button',{name:'踏入小镇'}).click();
    await page.getByRole('button',{name:'向上移动',exact:true}).tap();
    assert.equal((await state()).y,8);
    const down=page.getByRole('button',{name:'向下移动',exact:true}),b=await down.boundingBox();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(480);await page.mouse.up();
    const moved=await state();assert.ok(moved.y>=10,'held direction repeats');
    await page.waitForTimeout(300);assert.equal((await state()).y,moved.y,'released direction stops');
    await page.reload();assert.equal((await state()).y,moved.y);assert.equal(await page.locator('.ft-sheet:not([hidden])').count(),0);

    // Mobile safe hit targets and no horizontal overflow at each supported size.
    for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1280,height:800}]){
      await page.setViewportSize(size);await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      assert.ok(await page.locator('.ft-dpad button').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect();return r.width>=42&&r.height>=42;})));
    }
    await page.setViewportSize({width:390,height:844});
    if(process.env.RPG_SHOTS)await page.screenshot({path:process.env.RPG_SHOTS+'/fogtown-mobile.png',fullPage:true});
    // Import a real battle checkpoint and take a turn; restore exactly on reload.
    const fight=E.newGame(123);fight.flags.intro=true;fight.map='forest';fight.visited.push('forest');fight.x=4;fight.y=9;E.interact(fight,E.ALL['f-slime']);
    await importState(fight);assert.equal(await page.locator('.ft-battle').isVisible(),true);
    await page.locator('[data-action=attack]').tap();const fought=await state();assert.ok(fought.battle.hp<24);assert.ok(fought.hp<72);
    await page.reload();const resumed=await state();assert.deepEqual(resumed.battle,fought.battle);assert.equal(resumed.hp,fought.hp);
    await page.getByRole('button',{name:'背包',exact:true}).click();assert.equal(await page.locator('.ft-dialog-body').getByRole('button',{name:'使用',exact:true}).first().isDisabled(),true);await close();
    if(process.env.RPG_SHOTS)await page.screenshot({path:process.env.RPG_SHOTS+'/fogtown-battle.png',fullPage:true});
    await page.locator('[data-action=spark]').tap();assert.equal((await state()).battle,null);assert.ok((await state()).defeated.includes('f-slime'));
    // Export produces a validated portable save; import restores its inventory.
    await page.getByRole('button',{name:'存档',exact:true}).click();
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出当前进度 .json',exact:true}).click();
    const download=await downloadPromise,exported=decode(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.kills,1);
    await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
    await page.getByText(/导入失败/).waitFor();assert.equal((await state()).kills,1);
    await close();await importState(exported);assert.equal((await state()).gold,exported.gold);

    // Completion remains a normal permanent save, with no replayed reward on reload.
    const done=E.newGame(999);done.flags.intro=true;done.keys=['forest','mine','ruins'];done.defeated=['f-root','m-golem','r-keeper'];done.x=11;done.y=3;done.dir='up';
    await importState(done);await page.locator('.ft-interact').tap();await page.getByRole('heading',{name:'终章 · 雾散时分'}).waitFor();
    assert.ok((await state()).flags.completed);const gold=(await state()).gold;
    await page.reload();assert.ok((await state()).flags.completed);assert.equal((await state()).gold,gold);
    // Broken primary falls back to previous good journal entry.
    await page.evaluate(({key,text})=>{localStorage.setItem(key+'.backup',text);localStorage.setItem(key,'broken');},{key,text:codec.encode(exported)});
    await page.reload();assert.equal((await state()).kills,1);assert.ok(!(await state()).flags.completed);
    // Another tab updates the save: this page must lock rather than overwrite.
    const other=await context.newPage();await other.goto(url);
    await other.getByRole('button',{name:'向下移动',exact:true}).click();
    await page.getByText('另一标签页修改了存档。当前页面已停止操作，避免把新进度覆盖。',{exact:true}).waitFor();
    const current=await other.evaluate(k=>localStorage.getItem(k),key);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await other.evaluate(k=>localStorage.getItem(k),key),current);
    await other.close();await page.close();await context.close();
    assert.deepEqual(errors,[]);
    console.log('Fogtown browser: touch/hold/release, four layouts, battle reload, export/import, corrupt recovery, ending persistence and cross-tab conflict passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
