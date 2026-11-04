(function(){
 'use strict';
 const script=document.currentScript,id=script.dataset.port,base=new URL('.',script.src),status=document.getElementById('casual-loading');
 const files=['campaign-save.js','port-shell.js'].concat(id==='packabunchas'?['../packabunchas/game.js','../packabunchas/adapter.js']:['casual-shell.js','../'+id+'/engine.js','casual-ports.js']);
 function load(name,n){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=new URL(name,base).href+(n?'?retry='+n:'');s.onload=ok;s.onerror=()=>{s.remove();if(n<2)load(name,n+1).then(ok,no);else no(Error(name));};document.body.appendChild(s);});}
 document.body.dataset.game=id;
 (async()=>{try{for(const f of files)await load(f,0);}catch(e){status.textContent='加载失败：'+e.message+'。请重新载入页面。';const a=document.createElement('a');a.href='';a.textContent='重新载入';status.append(' ',a);}})();
})();
