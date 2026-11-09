// Adapter for crisp-game-lib 1.1.1. The vendor loop checks liteCrispPaused.
(function(){
  'use strict';
  window.liteCrispPaused=true;
  function report(type,extra){parent.postMessage(Object.assign({liteCrisp:true,type},extra),location.origin);}
  function release(){const target=document.querySelector('canvas')||document.body;target.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',keyCode:32,bubbles:true}));target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));target.dispatchEvent(new Event('touchcancel',{bubbles:true}));}
  window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||!e.data.liteCrisp)return;
    if(e.data.type==='pause'){release();window.liteCrispPaused=true;sss.stopBgm();}
    if(e.data.type==='resume'){window.liteCrispPaused=false;sss.startAudio();}
    if(e.data.type==='sound'||e.data.type==='resume')sss.setVolume(e.data.muted?0:0.3);
  });
  window.addEventListener('blur',release);
  window.addEventListener('error',()=>report('error'));
  options=Object.assign({},options,{theme:options.theme==='dark'?'dark':'simple',isReplayEnabled:false,isCapturing:false,isPlayingBgm:false});
  const originalEnd=window.end;window.end=function(){report('score',{score:window.score});return originalEnd.apply(this,arguments);};
  window.addEventListener('load',()=>{onLoad();report('ready');});
})();
