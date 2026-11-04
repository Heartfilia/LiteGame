// MIT. Rule adaptation of Rembound.com Match-3 Game HTML5 (2015).
// LiteGame: deterministic refill, finite-move goals, journals and level progression.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.CasualEngine=factory;})(typeof window==='object'?window:this,function(){
 'use strict';
 const N=8,LEVELS=20;const clone=s=>JSON.parse(JSON.stringify(s));
 function rand(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
 function adjacent(a,b){return Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a<64&&b<64&&Math.abs(a%8-b%8)+Math.abs((a/8|0)-(b/8|0))===1;}
 // Scan horizontal and vertical runs; intersecting runs are removed only once.
 function clusters(board){const found=new Set();for(let y=0;y<N;y++)for(let x=0;x<N;){const i=y*N+x,c=board[i];let end=x+1;while(end<N&&board[y*N+end]===c)end++;if(c>=0&&end-x>=3)for(let k=x;k<end;k++)found.add(y*N+k);x=end;}for(let x=0;x<N;x++)for(let y=0;y<N;){const c=board[y*N+x];let end=y+1;while(end<N&&board[end*N+x]===c)end++;if(c>=0&&end-y>=3)for(let k=y;k<end;k++)found.add(k*N+x);y=end;}return [...found];}
 function moves(board){const out=[];for(let i=0;i<64;i++)for(const j of [i+1,i+8]){if(!adjacent(i,j)||board[i]===board[j])continue;const b=board.slice();[b[i],b[j]]=[b[j],b[i]];if(clusters(b).length)out.push([i,j]);}return out;}
 function generate(s){for(let tries=0;tries<100;tries++){const b=[];for(let i=0;i<64;i++){const pool=[];for(let c=0;c<s.colors;c++){if(i%8>=2&&b[i-1]===c&&b[i-2]===c||i>=16&&b[i-8]===c&&b[i-16]===c)continue;pool.push(c);}b.push(pool[Math.floor(rand(s)*pool.length)]);}if(moves(b).length)return b;}throw Error('Cannot generate board');}
 function setup(s){s.colors=s.level<7?5:6;s.moves=28;s.target=550+s.level*45;s.goal=7+Math.floor(s.level/3);s.goalColor=(s.level-1)%s.colors;s.score=0;s.collected=0;s.phase='play';s.board=generate(s);s.message='不限时间，在步数内达成两个目标。';}
 function newGame(seed){const s={version:1,seed:(seed===undefined?Date.now():seed)>>>0,level:1,unlocked:1,wins:0,board:[]};setup(s);return s;}
 function resolve(s){let combo=0,removed=0;for(;combo<100;combo++){const cells=clusters(s.board);if(!cells.length)break;removed+=cells.length;for(const i of cells){if(s.board[i]===s.goalColor)s.collected++;s.board[i]=-1;}s.score+=cells.length*10*(combo+1);for(let x=0;x<8;x++){const col=[];for(let y=7;y>=0;y--)if(s.board[y*8+x]>=0)col.push(s.board[y*8+x]);while(col.length<8)col.push(Math.floor(rand(s)*s.colors));for(let y=7;y>=0;y--)s.board[y*8+x]=col[7-y];}}
 if(combo===100||!moves(s.board).length){s.board=generate(s);s.message='棋盘已自动重排，不消耗额外步数。';}else s.message='消除 '+removed+' 颗宝石'+(combo>1?'，连续 '+combo+' 次！':'。');
 if(s.score>=s.target&&s.collected>=s.goal){s.phase='won';s.wins++;s.unlocked=Math.max(s.unlocked,Math.min(20,s.level+1));}else if(!s.moves)s.phase='lost';return {removed,combo};}
 function act(s,a,n){if(s.phase!=='play')return false;if(a==='swap'&&Array.isArray(n)&&n.length===2&&adjacent(n[0],n[1])){const [i,j]=n;[s.board[i],s.board[j]]=[s.board[j],s.board[i]];if(!clusters(s.board).length){[s.board[i],s.board[j]]=[s.board[j],s.board[i]];s.message='这次交换不能消除，没有扣步数。';return false;}s.moves--;resolve(s);return true;}return false;}
 function next(s){if(s.phase!=='won'||s.level===20)return false;s.level++;setup(s);return true;}
 function retry(s){setup(s);return true;}
 function restore(s){try{const n=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;if(!s||s.version!==1||!n(s.seed,0,4294967295)||!n(s.level,1,20)||!n(s.unlocked,s.level,20)||!n(s.wins,0,100000)||![5,6].includes(s.colors)||s.colors!==(s.level<7?5:6)||!n(s.moves,0,28)||!n(s.score,0,10000000)||!n(s.collected,0,100000)||s.target!==550+s.level*45||s.goal!==7+Math.floor(s.level/3)||s.goalColor!==(s.level-1)%s.colors||!['play','won','lost'].includes(s.phase)||!Array.isArray(s.board)||s.board.length!==64||!s.board.every(c=>n(c,0,s.colors-1))||clusters(s.board).length||!moves(s.board).length||typeof s.message!=='string'||s.message.length>300)return null;if(s.phase==='won'&&(s.score<s.target||s.collected<s.goal)||s.phase==='play'&&!s.moves||s.phase==='lost'&&s.moves!==0)return null;return clone(s);}catch(e){return null;}}
 return {LEVELS,newGame,act,next,retry,restore,adjacent,clusters,moves};
});
