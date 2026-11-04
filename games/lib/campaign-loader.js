// Ordered startup with bounded retries; a failed resource must not leave a blank page.
(function(){
 'use strict';
 const base=new URL('.',document.currentScript.src),status=document.getElementById('campaign-loading');
 const sources=['../version.js','chogan.js','litegame.js','chronicles-engines.js','campaign-save.js','chronicles.js'];
 function load(name,attempt){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(name,base).href+(attempt?'?retry='+attempt:'');script.onload=resolve;script.onerror=()=>{script.remove();if(attempt<2){status.firstChild.textContent='资源加载中断，正在重试… ';load(name,attempt+1).then(resolve,reject);}else reject(Error(name));};document.body.appendChild(script);});}
 (async()=>{try{for(const name of sources)await load(name,0);if(!document.querySelector('.cp-wrap'))throw Error('游戏初始化');status.remove();}catch(e){status.firstChild.textContent='加载失败：'+e.message+'。请检查连接后重载。 ';}})();
})();
