// Shared journal UI; each original game supplies a validated snapshot adapter.
window.PortShell=function(config){
  'use strict';
  Object.assign(config,window.LitePortState||{});
  if(!config.isPlaying){let playing=false;const pause=config.pause,resume=config.resume;config.pause=(...args)=>{playing=false;return pause(...args);};config.resume=(...args)=>{const result=resume(...args);playing=true;return result;};config.isPlaying=()=>playing;}
  document.body.classList.add('port-game-'+config.id);
  const home=document.querySelector('header a[href*="index.html"]');
  if(home){const target=window.LiteNavigation?.destination();home.className='port-home';home.href=target?.href||'../../index.html';home.textContent='← '+(target?.label||'游戏厅首页');}
 if(['bounce-back','entombed'].includes(config.id)){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('../lib/port-mobile.css',location.href).href;document.head.append(style);}
 const status=document.getElementById('port-status'),journal=CampaignSave(config.id,{restore:config.validate}, {getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)});
 const loaded=journal.load();let locked=['corrupt','version','unavailable'].includes(loaded.status),ready=false;
 const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','存档管理');document.body.append(dialog);
 const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;document.body.append(file);
 function note(t){status.textContent=t;}
  function button(t,fn){const b=document.createElement('button');b.textContent=t;b.onclick=fn;dialog.append(b);return b;}
 function show(t){config.pause(true);dialog.replaceChildren();const p=document.createElement('p');p.textContent=t;dialog.append(p);if(!dialog.open)dialog.showModal();}
 function close(){dialog.close();}
 function save(){if(!ready||locked)return;const s=config.snapshot();if(!s)return;const result=journal.save(s);if(!result.ok){if(result.reason==='conflict'){locked=true;config.pause(true);}note(result.reason==='conflict'?'另一标签页已更新进度，请重新载入。':'保存失败，请导出备份。');}else note(config.saveLabel||'已自动保存');}
 function exportFile(){try{const s=config.snapshot()||loaded.state;if(!s)throw Error('请先开始游戏。');const url=URL.createObjectURL(new Blob([journal.encode(s)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=config.id+'-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}catch(e){note(e.message);}}
 function replace(s){const r=journal.replace(s);if(!r.ok){note('替换失败，请重新载入后再试。');return;}locked=false;config.restore(s);close();note('已载入进度，点击开始 / 继续');}
 function confirm(t,fn){show(t);button('确认',fn);button('取消',close);}
  document.getElementById('port-save').textContent='存档管理';
  document.getElementById('port-save').onclick=()=>{save();show('进度自动保存在当前浏览器。\n'+config.saveLabel);button('导出存档',exportFile).disabled=!config.snapshot()&&!loaded.state;button('导入存档',()=>{file.value='';file.click();});const backup=journal.backup();button(backup?'恢复上一份备份':'暂无可恢复备份',()=>confirm('恢复上一份有效备份？',()=>replace(backup))).disabled=!backup;if(locked)button('重新载入',()=>location.reload());button('返回游戏',close);};
 document.getElementById('port-reset').onclick=()=>{if(!ready)return;confirm('重新开始？建议先导出已有进度。',()=>{if(locked){note('请先处理存档冲突或损坏。');return;}config.newGame();close();save();});};
 document.getElementById('port-start').onclick=()=>{if(ready&&!locked)config.resume();};
 document.getElementById('port-pause').onclick=()=>{config.pause(true);save();};
 file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>900000)throw Error('存档过大');const s=journal.decode(await f.text());confirm('存档校验通过，替换当前进度？',()=>replace(s));}catch(e){note('导入失败：'+e.message);}};
 function release(){config.release();}
 window.addEventListener('blur',()=>{release();config.pause(true);save();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){release();config.pause(true);save();}});
 window.addEventListener('pagehide',save);
 window.addEventListener('storage',e=>{if((e.key===journal.key||e.key===null)&&journal.changed()){locked=true;release();config.pause(true);note('另一标签页更新了存档，此页已停止覆盖。请重新载入。');}});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'){config.pause(true);save();}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)&&!dialog.open)e.preventDefault();});
 document.querySelectorAll('[data-hold]').forEach(b=>{const key=b.dataset.hold;let pointer=null;b.onpointerdown=e=>{if(locked||dialog.open)return;e.preventDefault();pointer=e.pointerId;b.setPointerCapture(pointer);config.input(key,true);};const up=()=>{if(pointer!==null){pointer=null;config.input(key,false);}};b.onpointerup=up;b.onpointercancel=up;b.onlostpointercapture=up;});
  setInterval(save,5000);
  function updateControls(){
    const playing=ready&&!locked&&!dialog.open&&(config.isPlaying?config.isPlaying():true);
    if(config.isPlaying){document.getElementById('port-start').hidden=playing;document.getElementById('port-pause').hidden=!playing;}
    document.getElementById('port-start').disabled=!ready||locked;
    document.getElementById('port-reset').disabled=!ready||locked;
    document.querySelectorAll('[data-hold]').forEach(b=>b.disabled=!playing);
    const retry=document.getElementById('port-retry');if(retry&&config.canRetry)retry.hidden=!config.canRetry();
  }
  updateControls();setInterval(updateControls,100);
 return {journal,save,ready(){ready=true;if(loaded.state){config.restore(loaded.state);note(loaded.status==='recovered'?'主存档损坏，已恢复有效备份。':'已恢复进度，点击开始 / 继续');}else if(locked){config.pause(true);show('本地存档无法读取（'+loaded.status+'）。可导入备份或重新载入。');button('导入备份',()=>file.click());button('重新载入',()=>location.reload());if(loaded.status==='corrupt')button('放弃损坏存档',()=>{locked=false;config.newGame();const s=config.snapshot();if(s&&journal.replace(s).ok){close();note('已新建进度');}else locked=true;});}else note('点击开始 / 继续。');},blocked:()=>locked||dialog.open};
};
