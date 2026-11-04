// MIT. Based on Rembound.com Bubble Shooter HTML5 (2015): staggered neighbors,
// connected color clusters and ceiling-connected/floating clusters.
// LiteGame adds a pure rule API, swept aim trace, finite-shot levels and saves.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.CasualEngine=factory;})(typeof window==='object'?window:this,function(){
 'use strict';
 const COLS=10,ROWS=13,R=21,ORIGIN={x:240,y:540},STEP=Math.sqrt(3)*R;
 const clone=s=>JSON.parse(JSON.stringify(s));
 function rand(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
 function position(i){const row=i/COLS|0;return {x:30+(i%COLS)*42+(row%2)*21,y:30+row*STEP};}
 function neighbors(i){const x=i%COLS,y=i/COLS|0,offsets=y%2?[[1,0],[1,1],[0,1],[-1,0],[0,-1],[1,-1]]:[[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]];return offsets.map(([dx,dy])=>[x+dx,y+dy]).filter(([a,b])=>a>=0&&a<COLS&&b>=0&&b<ROWS).map(([a,b])=>b*COLS+a);}
 function cluster(board,start,color){const seen=new Set(),q=[start];while(q.length){const i=q.pop();if(seen.has(i)||board[i]<0||color!==undefined&&board[i]!==color)continue;seen.add(i);q.push(...neighbors(i));}return [...seen];}
 function floating(board){const connected=new Set();for(let i=0;i<COLS;i++)if(board[i]>=0&&!connected.has(i))for(const j of cluster(board,i))connected.add(j);return board.flatMap((c,i)=>c>=0&&!connected.has(i)?[i]:[]);}
 function color(s){const options=[...new Set(s.board.filter(c=>c>=0))];return options.length?options[Math.floor(rand(s)*options.length)]:0;}
 function setup(s){s.phase='play';s.score=0;s.shots=24+Math.floor(s.level/2);s.board=Array(130).fill(-1);const rows=3+Math.floor((s.level-1)/4),colors=Math.min(5,3+Math.floor(s.level/8));for(let y=0;y<rows;y++)for(let x=0;x<COLS;x++)s.board[y*COLS+x]=(Math.floor(x/2)+Math.floor(y/2)+s.level)%colors;s.current=color(s);s.next=color(s);s.message='清空所有泡泡即可过关。';}
 function newGame(seed){const s={version:1,seed:(seed===undefined?Date.now():seed)>>>0,level:1,unlocked:1,wins:0};setup(s);return s;}
 function trace(s,angle){const rad=angle*Math.PI/180;let x=ORIGIN.x,y=ORIGIN.y,dx=Math.sin(rad)*3,dy=-Math.cos(rad)*3;const path=[{x,y}];let hit=-1,ceiling=false;
 for(let step=0;step<650;step++){x+=dx;y+=dy;if(x<R){x=R+(R-x);dx=-dx;path.push({x,y});}if(x>480-R){x=480-R-(x-(480-R));dx=-dx;path.push({x,y});}if(y<=30){ceiling=true;break;}for(let i=0;i<s.board.length;i++)if(s.board[i]>=0){const p=position(i);if(Math.hypot(x-p.x,y-p.y)<=R*2-1){hit=i;break;}}if(hit>=0)break;}
 path.push({x,y});let candidates=ceiling?Array.from({length:COLS},(_,i)=>i):hit>=0?neighbors(hit):[];candidates=candidates.filter(i=>s.board[i]<0).sort((a,b)=>{const p=position(a),q=position(b);return Math.hypot(p.x-x,p.y-y)-Math.hypot(q.x-x,q.y-y);});return {path,cell:candidates.length?candidates[0]:-1,hit};}
 function act(s,a,n){if(s.phase!=='play')return false;if(a==='swap'){[s.current,s.next]=[s.next,s.current];return true;}if(a!=='shoot'||!Number.isFinite(n)||n< -72||n>72)return false;const target=trace(s,n).cell;if(target<0){s.message='这条路线没有可落点，换个角度试试。';return false;}s.shots--;s.board[target]=s.current;const group=cluster(s.board,target,s.current);let removed=0;if(group.length>=3){for(const i of group)s.board[i]=-1;const drop=floating(s.board);for(const i of drop)s.board[i]=-1;removed=group.length+drop.length;s.score+=removed*10;s.message='消除 '+group.length+' 个'+(drop.length?'，额外掉落 '+drop.length+' 个！':'。');}else s.message='再接上同色泡泡，三个即可消除。';if(s.board.every(c=>c<0)){s.phase='won';s.wins++;s.unlocked=Math.max(s.unlocked,Math.min(20,s.level+1));}else if(!s.shots||s.board.some((c,i)=>c>=0&&position(i).y+R>=480))s.phase='lost';s.current=s.next;if(!s.board.includes(s.current))s.current=color(s);s.next=color(s);return true;}
 function next(s){if(s.phase!=='won'||s.level===20)return false;s.level++;setup(s);return true;}
 function restore(s){try{const n=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;if(!s||s.version!==1||!n(s.seed,0,4294967295)||!n(s.level,1,20)||!n(s.unlocked,s.level,20)||!n(s.wins,0,100000)||!n(s.shots,0,34)||!n(s.score,0,1000000)||!n(s.current,0,4)||!n(s.next,0,4)||!['play','won','lost'].includes(s.phase)||!Array.isArray(s.board)||s.board.length!==130||!s.board.every(c=>n(c,-1,4))||typeof s.message!=='string'||s.message.length>300)return null;if(s.phase==='won'&&s.board.some(c=>c>=0)||s.phase==='play'&&(!s.shots||s.board.every(c=>c<0)))return null;return clone(s);}catch(e){return null;}}
 return {LEVELS:20,R,ORIGIN,position,neighbors,cluster,floating,trace,newGame,act,next,retry:setup,restore};
});
