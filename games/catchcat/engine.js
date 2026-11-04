// MIT. Port of Ganlv's nearestSolver.ts: edge-seeded BFS, then prefer the
// shortest exit direction with the greatest number of shortest routes.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.CasualEngine=factory;})(typeof window==='object'?window:this,function(){
 'use strict';
 const clone=s=>JSON.parse(JSON.stringify(s));
 function rand(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
 function edge(i){return i%11===0||i%11===10||i<11||i>=110;}
 function position(i){const y=i/11|0;return {x:28+(i%11)*40+(y%2)*20,y:40+y*39};}
 function neighbors(i){const x=i%11,y=i/11|0,shift=y%2;return [[-1,0],[shift-1,-1],[shift,-1],[1,0],[shift,1],[shift-1,1]].map(([a,b])=>[x+a,y+b]).filter(([a,b])=>a>=0&&a<11&&b>=0&&b<11).map(([a,b])=>b*11+a);}
 function distances(walls){const blocked=new Set(walls),d=Array(121).fill(Infinity),q=[];for(let i=0;i<121;i++)if(edge(i)&&!blocked.has(i)){d[i]=0;q.push(i);}for(let k=0;k<q.length;k++)for(const j of neighbors(q[k]))if(!blocked.has(j)&&d[j]>d[q[k]]+1){d[j]=d[q[k]]+1;q.push(j);}return d;}
 function escape(walls,cat){const d=distances(walls),memo=new Map();function routes(i){if(!Number.isFinite(d[i]))return 0;if(d[i]===0)return 1;if(memo.has(i))return memo.get(i);const n=neighbors(i).filter(j=>d[j]<d[i]).reduce((n,j)=>n+routes(j),0);memo.set(i,n);return n;}const options=neighbors(cat).filter(i=>d[i]<d[cat]);options.sort((a,b)=>routes(b)-routes(a));return options.length?options[0]:-1;}
 function setup(s){s.cat=60;s.walls=[];s.turns=0;s.phase='play';s.history=[];s.message='点击圆点设置障碍，小猫会寻找最短逃生路线。';const count=Math.max(12,30-s.level);for(let tries=0;tries<100;tries++){s.walls=[];while(s.walls.length<count){const i=Math.floor(rand(s)*121);if(i!==60&&!s.walls.includes(i))s.walls.push(i);}if(Number.isFinite(distances(s.walls)[60]))break;}}
 function newGame(seed){const s={version:1,seed:(seed===undefined?Date.now():seed)>>>0,level:1,unlocked:1,wins:0};setup(s);return s;}
 function act(s,a,n){if(a==='undo'&&s.history.length){const old=s.history.pop();s.cat=old.cat;s.walls.pop();s.turns--;if(s.phase==='won')s.wins--;s.phase='play';s.message='已撤销上一步。';return true;}if(s.phase!=='play')return false;if(a==='reroll'){setup(s);return true;}if(a!=='block'||!Number.isInteger(n)||n<0||n>=121||s.walls.includes(n)||s.cat===n)return false;s.history.push({cat:s.cat});s.walls.push(n);s.turns++;const next=escape(s.walls,s.cat);if(next<0){s.phase='won';s.wins++;s.unlocked=Math.max(s.unlocked,Math.min(20,s.level+1));}else{s.cat=next;if(edge(next))s.phase='lost';}return true;}
 function next(s){if(s.phase!=='won'||s.level===20)return false;s.level++;setup(s);return true;}
 function restore(s){try{const n=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;if(!s||s.version!==1||!n(s.seed,0,4294967295)||!n(s.level,1,20)||!n(s.unlocked,s.level,20)||!n(s.wins,0,100000)||!n(s.cat,0,120)||!n(s.turns,0,120)||!['play','won','lost'].includes(s.phase)||!Array.isArray(s.walls)||s.walls.length>120||new Set(s.walls).size!==s.walls.length||s.walls.includes(s.cat)||!s.walls.every(i=>n(i,0,120))||!Array.isArray(s.history)||s.history.length!==s.turns||!s.history.every(h=>h&&n(h.cat,0,120))||s.walls.length<s.turns||typeof s.message!=='string'||s.message.length>300)return null;if(s.phase==='won'&&escape(s.walls,s.cat)>=0||s.phase==='lost'&&!edge(s.cat)||s.phase==='play'&&edge(s.cat))return null;return clone(s);}catch(e){return null;}}
 return {LEVELS:20,newGame,act,next,retry:setup,restore,neighbors,position,distances,escape,edge};
});
