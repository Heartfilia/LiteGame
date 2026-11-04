(function(){
  'use strict';
  var C=window.Chogan,el=C.el,E=FogtownEngineFactory();C.boot({});
  var ctx=C.game({id:'fogtown',name:{zh:'雾灯镇：遗迹之钥',en:'Fogtown'},accent:'#c6a56c',scroll:true});
  // Use explicit storage errors; the arcade storage adapter intentionally hides them.
  var storage={getItem:function(k){return localStorage.getItem(k);},setItem:function(k,v){localStorage.setItem(k,v);}};
  var saves=FogtownSaves(E,storage),loaded=saves.load(),S=loaded.state||E.newGame(Date.now()),locked=['corrupt','version','unavailable'].includes(loaded.status);
  var sheetKind='',sheetReturn=null,lastResult=null,saveText='',saveError=false,held=null,repeatAt=0,lastFrame=0,lastAutosave=0,anim=0,overview=false,camera={x:0,y:0,zoom:1};
  var wrap=el('div',{class:'ft-wrap'}),world=el('section',{class:'ft-world'}),side=el('aside',{class:'ft-side'});
  var place=el('h1',{class:'ft-place'}),locationInfo=el('span',{class:'ft-location'}),level=el('strong');
  function meter(cls){var fill=el('i'),text=el('span'),node=el('div',{class:'ft-meter '+cls},[fill,text]);return {node:node,fill:fill,text:text};}
  var hp=meter(''),mp=meter('ft-meter--mp'),gold=el('span');
  var canvas=el('canvas',{class:'ft-canvas',width:'368',height:'304',role:'img','aria-label':'雾灯镇地图，使用方向键移动；靠近人物后点击交互'}),g=canvas.getContext('2d');
  g.imageSmoothingEnabled=false;
  var mapLabel=el('div',{class:'ft-map-label',text:'人物 · 宝箱 · 花草：靠近后交互'}),objective=el('p',{class:'ft-objective'});
  var dpad=el('div',{class:'ft-dpad',role:'group','aria-label':'移动方向'}),interactBtn=button('交互 · A',function(){interact();},'ft-btn--gold ft-interact');
  var controls=el('div',{class:'ft-controls'},[dpad,interactBtn]);
  var battleBox=el('section',{class:'ft-battle',hidden:''}),battleTitle=el('h2'),intentText=el('p',{class:'ft-intent'}),enemyFill=el('i'),battleActions=el('div',{class:'ft-battle-actions'}),battleLog=el('p',{class:'ft-battle-log','aria-live':'polite'}),battleButtons={};
  battleBox.append(battleTitle,el('div',{class:'ft-enemy-hp'},[enemyFill]),intentText,battleActions,battleLog);
  var shortcuts=el('div',{class:'ft-shortcuts'},[button('背包',inventory),button('任务',quests),button('存档',saveMenu),button('回镇',function(){if(!S.battle)confirm('摇响归乡铃？','回到雾灯镇，保留当前地图的探索进度。',function(){E.recall(S);changed();});})]);
  var saveStatus=el('div',{class:'ft-save',role:'status','aria-live':'polite'}),journal=el('ul',{class:'ft-journal'});
  world.append(el('div',{class:'ft-heading'},[place,locationInfo,level]),el('div',{class:'ft-hud'},[hp.node,mp.node,gold]),el('div',{class:'ft-stage'},[canvas,mapLabel]),objective,battleBox,controls,shortcuts,saveStatus);
  side.append(el('section',{class:'ft-card ft-lore'},[el('h2',{text:'雾灯镇 · 遗迹之钥'}),el('p',{text:'雾漫过山谷，灯塔沉默了许多年。\n而你，带着一柄旧剑和一封迟到的信，来到这座小镇。'}),el('p',{text:'三枚钥印，三段被遗忘的往事。\n把灯点亮，让迷途的人回家。'})]),el('section',{class:'ft-card'},[el('h2',{text:'冒险手记'}),journal]),el('p',{class:'ft-hint',text:'方向键 / WASD 移动 · E / 空格交互 · B 背包 · J 任务 · Esc 返回地图。手机可长按方向键，或轻点相邻格移动。'}));
  wrap.append(world,side);ctx.main.appendChild(wrap);
  var sheet=el('div',{class:'ft-sheet',hidden:''}),dialog=el('section',{class:'ft-dialog',role:'dialog','aria-modal':'true','aria-labelledby':'ft-dialog-title'}),dialogTitle=el('h2',{id:'ft-dialog-title'}),closeBtn=button('关闭',closeSheet),dialogBody=el('div',{class:'ft-dialog-body'});
  dialog.append(el('header',{class:'ft-dialog-head'},[dialogTitle,closeBtn]),dialogBody);sheet.appendChild(dialog);document.body.appendChild(sheet);
  var file=el('input',{class:'ft-file',type:'file',accept:'.json,application/json','aria-label':'选择雾灯镇存档文件'});document.body.appendChild(file);
  ctx.button({icon:'help',label:'玩法与操作',onClick:help});
  var mapBtn=ctx.button({icon:'grid',label:'切换全图与跟随视角',onClick:function(){overview=!overview;mapBtn.setAttribute('aria-pressed',String(overview));draw();}});
  ctx.mount();
  function button(text,fn,cls){var b=el('button',{class:'ft-btn'+(cls?' '+cls:''),type:'button',text:text});b.addEventListener('click',fn);return b;}
  function p(text){return el('p',{text:text});}
  function release(){held=null;Object.keys(dirButtons).forEach(function(k){dirButtons[k].removeAttribute('data-held');});}
  function openSheet(title,kind){release();sheetReturn=sheet.hidden?document.activeElement:sheetReturn;sheetKind=kind||'dialog';dialogTitle.textContent=title;dialogBody.replaceChildren();sheet.hidden=false;closeBtn.disabled=locked;wrap.inert=true;ctx.bar.inert=true;closeBtn.focus();}
  function closeSheet(){if(locked)return;sheet.hidden=true;sheetKind='';wrap.inert=false;ctx.bar.inert=false;if(sheetReturn&&sheetReturn.isConnected)sheetReturn.focus();sheetReturn=null;}
  function confirm(title,text,fn){openSheet(title,'confirm');dialogBody.append(p(text),button('确认',function(){closeSheet();fn();},'ft-btn--gold'),button('取消',closeSheet));}
  function persist(){
    if(locked)return false;
    var out=saves.save(S);saveError=!out.ok;
    if(out.ok)saveText='已自动保存 · '+new Date().toLocaleTimeString('zh-CN',{hour12:false});
    else {
      saveText=out.reason==='conflict'?'另一标签页更新了进度，请重新载入。':'保存失败：请先导出存档文件。';
      if(out.reason==='conflict'){locked=true;openRecovery('conflict');}
    }
    renderSave();return out.ok;
  }
  function renderSave(){saveStatus.textContent=saveText;saveStatus.toggleAttribute('data-error',saveError);}
  function changed(result){lastResult=result||null;persist();render();if(result&&['dialog','shop','inn','ending'].includes(result.type))showResult(result);if(result&&result.type==='loot')C.audio.sfx('coin');if(result&&result.type==='victory')C.audio.sfx('win');}
  function blocked(){return locked||!sheet.hidden||document.hidden||!!document.querySelector('.ch-scrim');}
  function move(dir){if(blocked()||S.battle)return;var result=E.move(S,dir);if(result&&result.type!=='move')release();changed(result);}
  function interact(){if(blocked()||S.battle)return;changed(E.interact(S,E.nearby(S)));}
  var dirButtons={};
  ['up','left','down','right'].forEach(function(dir){
    var b=button({up:'▲',left:'◀',down:'▼',right:'▶'}[dir],function(e){if(e.detail===0)move(dir);});b.dataset.dir=dir;b.setAttribute('aria-label',{up:'向上移动',left:'向左移动',down:'向下移动',right:'向右移动'}[dir]);
    b.addEventListener('pointerdown',function(e){if(e.button!==0||blocked()||S.battle)return;e.preventDefault();release();b.setPointerCapture(e.pointerId);move(dir);if(!blocked()&&!S.battle){held={dir:dir,id:e.pointerId};repeatAt=performance.now()+280;b.setAttribute('data-held','');}});
    function end(e){if(held&&held.id===e.pointerId)release();}
    b.addEventListener('pointerup',end);b.addEventListener('pointercancel',end);b.addEventListener('lostpointercapture',end);dpad.appendChild(b);dirButtons[dir]=b;
  });
  var actionNames={attack:'挥剑',power:'破势重击',spark:'星火术',defend:'防御',potion:'疗伤药',ether:'萤光露',flee:'撤退回镇'};
  Object.keys(actionNames).forEach(function(id,i){var b=button('',function(){if(blocked()||!S.battle)return;changed(E.battle(S,id));});b.dataset.action=id;battleButtons[id]=b;battleActions.appendChild(b);});
  function render(){
    var v=E.stats(S);place.textContent=E.MAPS[S.map].name;locationInfo.textContent='钥印 '+S.keys.length+' / 3';level.textContent='Lv.'+S.level;
    hp.text.textContent='生命 '+S.hp+'/'+v.maxHp;mp.text.textContent='魔力 '+S.mp+'/'+v.maxMp;hp.fill.style.transform='scaleX('+(S.hp/v.maxHp)+')';mp.fill.style.transform='scaleX('+(S.mp/v.maxMp)+')';gold.textContent=S.gold+' G';
    objective.textContent=E.objective(S);var n=E.nearby(S);interactBtn.textContent=n?(n.type==='enemy'?'迎战':n.type==='portal'?'前往':n.type==='chest'?'打开':n.type==='herb'?'采集':'交互')+' · E':'交互 · E';interactBtn.disabled=locked||!!S.battle||!n;
    journal.replaceChildren();S.log.slice().reverse().slice(0,5).forEach(function(t){journal.appendChild(el('li',{text:t}));});
    battleBox.hidden=!S.battle;wrap.toggleAttribute('data-battle',!!S.battle);
    Object.keys(dirButtons).forEach(function(k){dirButtons[k].disabled=locked||!!S.battle;});
    if(S.battle){
      var e=E.ENEMIES[E.ALL[S.battle.id].kind];battleTitle.textContent=e.name+(e.boss?' · 首领':'')+'  '+S.battle.hp+'/'+e.hp;
      enemyFill.style.width=(S.battle.hp/e.hp*100)+'%';intentText.textContent='敌方意图：'+({attack:'普通攻击',charge:'蓄力 · 可重击打断',heavy:'重击将至 · 防御或打断',guard:'护甲防御 · 用星火穿透',drain:'吸取魔力'}[E.intent(S)]);
      Object.keys(battleButtons).forEach(function(id,i){var b=battleButtons[id],detail=id==='power'||id==='spark'?E.cost(S,id)+' 魔力':id==='defend'?'减伤 / +3 魔力':id==='potion'||id==='ether'?'剩余 '+S.bag[id]:id==='flee'?(e.boss?'首领不可撤退':'保留成长与物品'):'无消耗';b.replaceChildren(document.createTextNode((i+1)+'. '+actionNames[id]),el('small',{text:detail}));b.disabled=locked||(id==='power'||id==='spark')&&S.mp<E.cost(S,id)||id==='potion'&&(S.bag.potion===0||S.hp===v.maxHp)||id==='ether'&&(S.bag.ether===0||S.mp===v.maxMp)||id==='flee'&&e.boss;});
      battleLog.textContent=S.log.slice(-2).join(' ');
    }
    renderSave();draw();
  }
  function showResult(r){
    if(r.type==='shop'){shop();return;}if(r.type==='inn'){inn();return;}
    if(r.type==='ending'){ending();return;}
    openSheet(r.title);dialogBody.append(p(r.text),button('继续冒险',closeSheet,'ft-btn--gold'));
  }
  function inventory(){
    if(locked)return;openSheet('行囊与成长','inventory');var v=E.stats(S);
    dialogBody.append(p('等级 '+S.level+' · 经验 '+S.xp+'/'+E.threshold(S)+'\n攻击 '+v.atk+' · 防御 '+v.def+' · 星火加成 '+v.magic+'\n成长路线：'+({wanderer:'尚未选择',blade:'剑卫',spark:'星火'}[S.path])));
    if(S.path==='wanderer'){dialogBody.append(p('选择一次成长方向；所有技能仍可使用。'),button('剑卫 · 攻击 +3 / 生命 +12',function(){if(E.choose(S,'blade')){changed();inventory();}}),button('星火 · 法术 +5 / 魔力 +6',function(){if(E.choose(S,'spark')){changed();inventory();}}));}
    ['potion','ether'].forEach(function(id){var b=button('使用',function(){if(S.battle)return;if(E.use(S,id)){changed();inventory();}});b.disabled=!!S.battle||S.bag[id]===0;dialogBody.append(item(E.ITEMS[id].name+' × '+S.bag[id],E.ITEMS[id].desc,b));});
    S.owned.forEach(function(id){var it=E.ITEMS[id],on=S.equip[it.slot]===id,b=button(on?'已装备':'装备',function(){if(E.equip(S,id)){changed();inventory();}});b.disabled=on||!!S.battle;dialogBody.append(item(it.name,it.desc,b));});
    if(S.battle)dialogBody.append(p('战斗中不能换装；请在战斗按钮中使用药品。'));
  }
  function item(name,desc,b){return el('div',{class:'ft-item'},[el('div',{},[el('strong',{text:name}),el('small',{text:desc})]),b]);}
  function quests(){
    if(locked)return;openSheet('任务与地区','quests');dialogBody.append(p('【主线 · 归来的灯火】\n'+E.objective(S)),p('林之印 '+(S.keys.includes('forest')?'✓':'○')+'　岩之印 '+(S.keys.includes('mine')?'✓':'○')+'　星之印 '+(S.keys.includes('ruins')?'✓':'○')),
      p('【支线 · 月露药香】\n'+(S.flags.herbDone?'已完成，药师的谢礼已领取。':'采集森林三株月露草，然后回镇找药师芽芽。进度 '+S.herbs.length+'/3。')),
      p('【支线 · 回响之人】\n'+(S.flags.minerDone?'已救出矿工，获得回响吊坠。':'在矿洞东南角寻找被困矿工。')),
      p('【遗物收集】\n宝箱 '+S.opened.length+'/3 · 击败敌人 '+S.kills+' · 败退 '+S.deaths+' 次\n已到访：'+S.visited.map(function(k){return E.MAPS[k].name;}).join('、')),
      p('地图标记：金色箱子＝宝箱，白花＝月露草，蓝泉/火盆＝免费恢复，紫色高大身影＝首领，金色菱形＝区域出口。'));
  }
  function shop(){
    openSheet('老锤的装备与补给','shop');dialogBody.append(p('金币 '+S.gold+' G · 购买装备后，去背包穿戴。'));
    ['potion','ether','steel','staff','robe','mail','fang'].forEach(function(id){var it=E.ITEMS[id],owned=it.slot&&S.owned.includes(id),b=button(owned?'已拥有':it.price+' G',function(){if(E.buy(S,id)){changed();shop();}});b.disabled=!!owned||S.gold<it.price||!!S.battle;dialogBody.append(item(it.name,it.desc,b));});
  }
  function inn(){openSheet('眠风屋 · 旅店','inn');dialogBody.append(p('镇民为守灯人准备了热汤。休息免费，也不会改变探索进度。'),button('休息 · 完全恢复',function(){E.rest(S,false);closeSheet();changed();},'ft-btn--gold'),p('需要经验或金币？重新远征会刷新普通怪物，首领、宝箱、任务保持不变。'),button('休息并重新远征',function(){confirm('重新远征？','普通怪物会再次出现，可继续积累经验和金币。已完成的任务和首领不重置。',function(){E.rest(S,true);changed();});}));}
  function ending(){openSheet('终章 · 雾散时分','ending');dialogBody.append(p('林之印化作灯芯，岩之印托起灯座，星之印点燃长夜。\n\n光沿着山脊穿过森林和矿洞，照进遗迹最深处。阿禾站在塔下，终于收起了那封没有寄出的信。\n\n“谢谢你。现在，他们都能找到回家的路了。”'),p('主线已完成，永久进度已保留。你可以继续寻找遗漏的宝箱与支线。\n等级 '+S.level+' · 击败 '+S.kills+' 个敌人 · 宝箱 '+S.opened.length+'/3'),button('继续留在雾灯镇',closeSheet,'ft-btn--gold'),button('导出通关存档',exportSave));}
  function help(){openSheet('守灯人的旅行指南','help');dialogBody.append(p('移动：方向键 / WASD，手机长按方向按钮。也可点击相邻格移动。\n交互：靠近人物、箱子、草药或出口，按 E / 空格或交互按钮。向目标移动也会自动交互。'),p('战斗是回合制，不操作就不会受伤。先看敌方意图：重击打断蓄力，防御减伤并回魔，星火无视护甲。药品占一个回合，背包换装只能在战斗外进行。'),p('泉眼与旅店免费恢复，回镇按钮可随时在战斗外使用。败退只损失少量金币，不丢等级与装备。'),p('每次移动、交互、战斗回合都会自动保存。存档管理可导出文件、导入、恢复上一份备份。清除浏览器网站数据会删除本地存档，请定期导出。游戏更新保留同源同路径下的存档键。'),p('游戏地图、角色和音效均在本地运行；无需账号。手机切换应用会保存并释放长按输入。'));
  }
  function exportSave(){
    try{var text=saves.encode(S),blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='雾灯镇-Lv'+S.level+'-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},5000);}catch(e){saveText=e.message;saveError=true;renderSave();}
  }
  function install(s){var out=saves.replace(s);if(!out.ok){saveText=out.reason==='conflict'?'另一页面改变了存档，请先重新载入。':'写入失败，原存档仍保留。请检查浏览器存储权限。';saveError=true;renderSave();dialogBody.append(p(saveText));return;}S=s;locked=false;closeBtn.disabled=false;closeSheet();saveText='存档已载入并保存';saveError=false;render();}
  function saveMenu(){
    openSheet('存档管理','save');dialogBody.append(p('当前：Lv.'+S.level+' · '+E.MAPS[S.map].name+' · 钥印 '+S.keys.length+'/3\n'+(S.flags.completed?'主线已通关':'冒险进行中')+' · '+Math.floor(S.elapsed/60)+' 分钟'),p(saveError?saveText:'每次关键操作自动保存，另保留上一份有效备份。'),button('导出当前进度 .json',exportSave,'ft-btn--gold'),button('导入存档文件',function(){file.value='';file.click();}),button('恢复上一份备份',function(){var b=saves.backup();if(!b){dialogBody.append(p('没有可用的备份。'));return;}confirm('恢复备份？','将恢复至 Lv.'+b.level+' · '+E.MAPS[b.map].name+'。当前有效存档会先保留为备份。',function(){install(b);});}),button('重新载入本地存档',function(){location.reload();}),button('开始全新冒险',function(){confirm('开始全新冒险？','建议先导出当前进度。确认后将替换当前冒险；上一份有效进度会作为备份保留。',function(){install(E.newGame(Date.now()));});},'ft-btn--danger'),p('同一浏览器同一站点保存。换设备请导出再导入；无账号云同步。'));
  }
  function openRecovery(status){
    openSheet('存档需要处理','recovery');var text={corrupt:'主存档与备份都未通过校验，已暂停自动覆盖。可以导入你的备份文件。',version:'检测到更高版本的存档。请使用更新版本的游戏，原存档不会被覆盖。',unavailable:'浏览器存储不可用。请允许此站点使用本地存储，然后重新载入。',conflict:'另一标签页修改了存档。当前页面已停止操作，避免把新进度覆盖。'}[status];
    dialogBody.append(p(text),button('重新载入',function(){location.reload();},'ft-btn--gold'),button('导入备份文件',function(){file.value='';file.click();}));
    if(status==='conflict')dialogBody.append(button('导出此页面的进度',exportSave));
    if(status==='corrupt')dialogBody.append(button('确认放弃损坏存档，重新冒险',function(){var s=E.newGame(Date.now());install(s);},'ft-btn--danger'));
  }
  file.addEventListener('change',async function(){var f=file.files[0];if(!f)return;if(f.size>250000){dialogBody.append(p('文件超过 250KB，不是有效的雾灯镇存档。'));return;}
    try{var incoming=saves.decode(await f.text());openSheet('确认导入存档','import');dialogBody.append(p('Lv.'+incoming.level+' · '+E.MAPS[incoming.map].name+' · 钥印 '+incoming.keys.length+'/3\n导入会替换当前进度，当前有效存档先作为备份保留。'),button('确认导入',function(){install(incoming);},'ft-btn--gold'),button('取消',function(){if(locked)openRecovery(loaded.status);else closeSheet();}));}catch(e){dialogBody.append(p('导入失败：'+e.message+' 原存档未改动。'));}
  });
  window.addEventListener('storage',function(e){if((e.key===saves.KEY||e.key===null)&&saves.hasExternalChange()){release();locked=true;saveError=true;saveText='存档在其他标签页发生变化。';renderSave();openRecovery('conflict');}});
  window.addEventListener('keydown',function(e){
    if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    if(!sheet.hidden){
      if(e.key==='Escape'){e.preventDefault();closeSheet();}
      if(e.key==='Tab'){var nodes=Array.from(dialog.querySelectorAll('button:not(:disabled),input:not(:disabled)')).filter(function(n){return n.getClientRects().length;});if(!nodes.length)return;var first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(blocked())return;var key=e.key.toLowerCase(),dir={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'}[key];
    if(dir){e.preventDefault();if(!e.repeat){move(dir);if(!blocked()&&!S.battle){held={dir:dir,key:e.code};repeatAt=performance.now()+230;}}return;}
    if(key==='escape'||key==='backspace'){e.preventDefault();saveMenu();return;}
    if(e.repeat)return;
    if(key==='b'){e.preventDefault();inventory();}else if(key==='j'){e.preventDefault();quests();}
    else if(S.battle&&/^[1-7]$/.test(key)){e.preventDefault();var id=Object.keys(actionNames)[Number(key)-1];if(!battleButtons[id].disabled)changed(E.battle(S,id));}
    else if(key==='e'||key===' '&&e.target.tagName!=='BUTTON'){e.preventDefault();interact();}
  });
  window.addEventListener('keyup',function(e){if(held&&held.key===e.code)release();});
  canvas.addEventListener('click',function(e){if(blocked()||S.battle)return;var r=canvas.getBoundingClientRect(),scale=Math.min(r.width/368,r.height/304),left=r.x+(r.width-368*scale)/2,top=r.y+(r.height-304*scale)/2,x=Math.floor(((e.clientX-left)/scale/camera.zoom+camera.x)/16),y=Math.floor(((e.clientY-top)/scale/camera.zoom+camera.y)/16);var dx=x-S.x,dy=y-S.y;if(Math.abs(dx)+Math.abs(dy)===1)move(dx?dx>0?'right':'left':dy>0?'down':'up');else if(!dx&&!dy)interact();});
  function suspend(){release();persist();}
  C.onPause(suspend);window.addEventListener('blur',suspend);window.addEventListener('pagehide',suspend);
  // Keep portal history/back behavior, but never use ctx.finish or clearSave for this RPG.
  ctx.save=persist;
  function rect(x,y,w,h,color){g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),w,h);}
  function person(x,y,color,hero){
    rect(x+3,y+13,11,2,'#0c151b66');rect(x+5,y+3,7,7,'#d7b184');rect(x+4,y+2,9,4,hero?'#493f3a':'#696663');
    rect(x+4,y+9,9,5,color);rect(x+4,y+13,3,3,'#303b41');rect(x+10,y+13,3,3,'#303b41');rect(x+7,y+6,1,1,'#27242a');rect(x+11,y+6,1,1,'#27242a');
    if(hero){rect(x+3,y+8,3,6,'#d9bd78');rect(x+13,y+9,1,6,'#d1d8d0');}
  }
  function monster(e,x,y,large){
    var n=E.ENEMIES[e.kind],c=n.color;g.save();g.translate(x,y);if(large)g.scale(3,3);
    rect(2,13,13,2,'#0b111a66');
    if(e.kind==='slime'){rect(3,7,11,7,c);rect(5,5,7,2,c);}
    else if(e.kind==='moth'||e.kind==='bat'){rect(0,4,6,7,c);rect(11,4,5,7,c);rect(6,6,5,8,'#71677e');}
    else if(e.kind==='wolf'){rect(2,5,12,8,c);rect(2,2,3,4,c);rect(11,2,3,4,c);rect(4,12,2,3,c);rect(11,12,2,3,c);}
    else if(n.boss){rect(3,1,11,13,c);rect(0,6,3,7,c);rect(14,6,2,7,c);rect(5,0,2,3,'#eed78f');rect(11,0,2,3,'#eed78f');}
    else {rect(4,3,9,10,c);rect(2,7,13,6,c);rect(5,1,7,3,c);}
    rect(5,7,2,2,'#17212a');rect(10,7,2,2,'#17212a');if(n.boss)rect(6,11,5,1,'#f7deb0');g.restore();
  }
  function draw(){
    var m=E.MAPS[S.map],town=S.map==='town',forest=S.map==='forest',mine=S.map==='mine';
    var floor=town||forest?'#314b3d':mine?'#303943':'#3b394b',path=town?'#796e51':forest?'#5f6345':mine?'#51555c':'#646071';
    rect(0,0,368,304,floor);
    var z=overview||S.battle?1:1.75;
    camera={zoom:z,x:Math.round(Math.max(0,Math.min(368-368/z,S.x*16+8-184/z))),y:Math.round(Math.max(0,Math.min(304-304/z,S.y*16+8-152/z)))};
    g.save();g.scale(z,z);g.translate(-camera.x,-camera.y);
    for(var y=0;y<E.H;y++)for(var x=0;x<E.W;x++){
      var t=m.tiles[y][x],px=x*16,py=y*16,n=(x*17+y*31)%11;
      if(t==='#'){
        if(town&&x>0&&y>0&&x<22&&y<18){rect(px,py,16,16,'#655a4a');rect(px+1,py+1,14,5,'#9b6752');rect(px,py+7,16,2,'#473e37');rect(px+3,py+10,4,4,'#c4ab75');}
        else if(town||forest){rect(px+7,py+9,3,7,'#514c35');rect(px+2,py+3,13,10,'#213d32');rect(px+4,py,9,9,'#3c6246');rect(px+6,py+1,4,2,'#54784f');}
        else {rect(px,py,16,16,mine?'#1e2933':'#262638');rect(px+1,py+1,14,10,mine?'#48515c':'#504c61');rect(px+3,py+2,8,2,mine?'#66717a':'#6c657f');if(mine&&n===0){rect(px+7,py+6,3,7,'#7bbfc6');rect(px+8,py+6,1,4,'#d6f3e4');}}
      }else if(t==='.'){rect(px,py,16,16,path);if(n<5)rect(px+3,py+11,4,1,'#ffffff12');if(n>6)rect(px+11,py+3,2,2,'#141f2522');}
      else if(forest||town){rect(px+(n%9)+2,py+7,1,3,'#658059');if(n===1){rect(px+8,py+3,2,2,'#d9bc78');}}
      else {if(n<4)rect(px+3,py+8,5,1,'#8d899122');}
    }
    // Town signboards and the lighthouse terrace are drawn in the same tiny palette.
    if(town){rect(160,17,48,45,'#596967');rect(174,10,20,44,'#a5a696');rect(177,13,14,27,'#c3c0a4');rect(172,7,24,7,'#6f786c');rect(178,22,12,10,S.flags.completed?'#ffe7a1':'#586b72');}
    m.entities.forEach(function(e){
      var px=e.x*16,py=e.y*16;
      if(!E.active(S,e)){if(e.type==='chest'){rect(px+3,py+7,11,7,'#534938');rect(px+3,py+4,11,2,'#a6844a');}return;}
      if(e.type==='npc'){person(px,py,({elder:'#b4a078',inn:'#bb8c79',shop:'#8ba1ab',healer:'#95b885',miner:'#bc995f'}[e.role]),false);if(e.role==='elder'&&!S.flags.intro){rect(px+7,py-5,2,3,'#ffe6a2');rect(px+7,py-1,2,1,'#ffe6a2');}}
      else if(e.type==='enemy')monster(e,px,py,false);
      else if(e.type==='chest'){rect(px+2,py+5,12,9,'#bd9149');rect(px+2,py+8,12,2,'#553d2d');rect(px+7,py+8,2,4,'#ead196');}
      else if(e.type==='herb'){rect(px+7,py+8,2,7,'#7cb579');rect(px+4,py+10,4,2,'#a8c997');rect(px+5,py+4,6,5,'#dce8ca');rect(px+7,py+5,2,3,'#f4d78c');}
      else if(e.type==='portal'){g.fillStyle=e.require&&!S.keys.includes(e.require)?'#8c8580':'#e2c483';g.beginPath();g.moveTo(px+8,py+2);g.lineTo(px+14,py+8);g.lineTo(px+8,py+14);g.lineTo(px+2,py+8);g.fill();rect(px+7,py+5,2,6,'#454b44');}
      else if(e.type==='camp'){rect(px+1,py+5,14,9,'#6e8580');rect(px+3,py+6,10,6,'#83c6c4');rect(px+5,py+7,5,1,'#c2ede0');}
      else if(e.type==='sign'){rect(px+7,py+8,2,7,'#6e573e');rect(px+2,py+2,12,8,'#ad9671');rect(px+4,py+4,8,1,'#655844');}
    });
    person(S.x*16,S.y*16,'#7ba5a1',true);var d=E.DIR[S.dir];rect(S.x*16+7+d[0]*7,S.y*16+7+d[1]*7,2,2,'#ffdda2');
    if(!town){for(var i=0;i<7;i++){var fx=(i*59+Math.floor(anim*2))%368,fy=(i*43+17)%304;rect(fx,fy,2,1,'#d4e6c522');}}
    var near=E.nearby(S);if(near&&!S.battle){g.strokeStyle='#f2d59d';g.lineWidth=1;g.strokeRect(near.x*16+.5,near.y*16+.5,15,15);}
    g.restore();
    mapLabel.textContent=near?(near.name||E.ENEMIES[near.kind].name)+' · 点击交互':overview?'全区域地图 · 顶部网格按钮切回跟随':'跟随视角 · 顶部网格按钮查看全图';
    if(S.battle){
      rect(0,0,368,304,'#111a25cc');rect(37,67,294,171,'#263940');rect(40,70,288,165,'#20313b');
      rect(40,193,288,42,'#3d4d43');g.save();g.translate(92,148);g.scale(3,3);person(0,0,'#7ba5a1',true);g.restore();monster(E.ALL[S.battle.id],229,135,true);
      g.fillStyle='#ead7ad';g.textAlign='center';g.font='12px sans-serif';g.fillText('守灯人   VS   '+E.ENEMIES[E.ALL[S.battle.id].kind].name,184,105);
      g.font='9px sans-serif';g.fillStyle='#b7c6be';g.fillText('回合 '+(S.battle.turn+1)+' · 等待你的指令',184,222);
    }
  }
  function frame(t){
    var dt=lastFrame?Math.min((t-lastFrame)/1000,0.1):0;lastFrame=t;
    if(!blocked()&&document.hasFocus()){S.elapsed+=dt;anim+=dt;if(held&&t>=repeatAt){var dir=held.dir;repeatAt=t+155;move(dir);}if(t-lastAutosave>15000){persist();lastAutosave=t;}}
    if(t%200<25)draw();requestAnimationFrame(frame);
  }
  if(loaded.status==='recovered'){saveText='主存档损坏，已恢复上一份有效备份。';persist();}
  else if(loaded.status==='loaded')saveText='已载入本地冒险 · 可直接继续';
  else if(!locked)persist();
  render();if(locked)openRecovery(loaded.status);
  else if(loaded.status==='new'){openSheet('雾灯镇：遗迹之钥','welcome');dialogBody.append(p('你带着一封旧信来到雾灯镇。灯塔熄灭，归乡的船只已多年未见。\n\n北边的守灯人阿禾正在等你。'),p('手机：长按方向按钮移动，靠近目标点击交互。\n战斗：轮到你行动才会推进，可随时离开。\n每次操作自动保存，也可导出进度文件。'),button('踏入小镇',closeSheet,'ft-btn--gold'));}
  requestAnimationFrame(frame);
})();
