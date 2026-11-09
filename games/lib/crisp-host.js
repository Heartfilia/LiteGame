// Imported games keep their own isolated globals; the hall owns navigation and scores.
(function(){
  'use strict';
  const id=document.body.dataset.game, frame=document.querySelector('iframe'), cover=document.querySelector('.crisp-cover');
  const start=document.getElementById('crisp-start'), pause=document.getElementById('crisp-pause'), sound=document.getElementById('crisp-sound');
  const status=document.getElementById('crisp-status'), key='litegame.crisp.'+id;
  const category=new URLSearchParams(location.search).get('from')||document.querySelector('.hall-link').hash.slice(1);
  if(/^[a-z]+$/.test(category))document.querySelector('.hall-link').href='../../../index.html#/category/'+category;
  let ready=false,paused=true,muted=false,best=0;
  try{const saved=JSON.parse(localStorage.getItem(key)||'{}');best=Number.isFinite(saved.best)?saved.best:0;muted=!!saved.muted;}catch(e){}
  function save(){try{localStorage.setItem(key,JSON.stringify({best,muted}));}catch(e){}}
  function send(type){frame.contentWindow.postMessage({liteCrisp:true,type,muted},location.origin);}
  function render(){cover.hidden=!paused;pause.textContent=paused?'继续':'暂停';sound.textContent=muted?'声音：关':'声音：开';sound.setAttribute('aria-pressed',String(!muted));}
  function resume(){if(!ready)return;paused=false;send('resume');render();frame.focus();}
  function stop(){paused=true;send('pause');render();}
  window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||!e.data.liteCrisp)return;
    if(e.data.type==='ready'){ready=true;start.disabled=false;start.textContent='开始 / 继续';send('pause');send('sound');status.textContent='最佳 '+best+' · 点击画面开始一局';}
    if(e.data.type==='score'&&Number.isFinite(e.data.score)){best=Math.max(best,Math.floor(e.data.score));save();status.textContent='本局 '+Math.floor(e.data.score)+' · 最佳 '+best;}
    if(e.data.type==='error'){stop();start.disabled=true;status.textContent='加载失败，请重新载入。';}
  });
  start.addEventListener('click',resume);pause.addEventListener('click',()=>paused?resume():stop());
  sound.addEventListener('click',()=>{muted=!muted;send('sound');save();render();});
  document.getElementById('crisp-restart').addEventListener('click',()=>{ready=false;stop();start.disabled=true;start.textContent='正在加载…';frame.src=frame.getAttribute('src');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  document.getElementById('crisp-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.crisp-stage').requestFullscreen();}catch(e){status.textContent='此浏览器暂不支持全屏，可横屏游玩。';}});
  render();
})();
