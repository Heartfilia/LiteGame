// Small turn-based ports use the same versioned journal as the campaign games.
window.CasualShell=function(config){
 'use strict';
 const E=config.engine;let state=E.newGame(),paused=true,selected=-1;
 const status=document.getElementById('casual-message'),stats=document.getElementById('casual-stats'),board=document.getElementById('casual-board');
 const api={get state(){return state;},get selected(){return selected;},get unlocked(){return !paused&&!port.blocked();},get active(){return api.unlocked&&state.phase==='play';},select(i){selected=i;render();},act(action,value){if(!api.active&&!(action==='undo'&&api.unlocked))return false;const result=E.act(state,action,value);if(result){selected=-1;port.save();}render();return result;},render,board};
 function render(){config.render(api,stats,status);document.getElementById('casual-next').hidden=state.phase!=='won';document.getElementById('casual-next').textContent=state.level===E.LEVELS?'已完成全部关卡':'下一关';document.getElementById('casual-next').disabled=state.level===E.LEVELS;document.getElementById('casual-retry').hidden=state.phase!=='lost';document.getElementById('casual-pause').textContent=paused?'已暂停 · 点击开始 / 继续':'进行中 · 每步自动保存';}
 const port=PortShell({id:config.id,validate:E.restore,saveLabel:'每步自动保存 · 通关记录保留 · 支持导入导出',snapshot:()=>state,restore(s){state=s;selected=-1;paused=true;render();},newGame(){state=E.newGame();selected=-1;paused=true;render();},pause(){paused=true;selected=-1;render();},release(){},resume(){paused=false;render();},input(){}});
 document.getElementById('casual-next').onclick=()=>{if(port.blocked())return;if(E.next(state)){paused=false;selected=-1;port.save();render();}};
 document.getElementById('casual-retry').onclick=()=>{if(port.blocked())return;E.retry(state);paused=false;selected=-1;port.save();render();};
 config.mount(api);render();port.ready();port.save();document.getElementById('casual-loading').remove();return api;
};
