const {test}=require('node:test'),assert=require('node:assert/strict');
const copy=s=>JSON.parse(JSON.stringify(s));
const bubble=require('../games/bubble-shooter/engine.js')(),match=require('../games/match3/engine.js')(),cat=require('../games/catchcat/engine.js')();
test('bubble: staggered adjacency, hanging clusters and swept wall-reflection trace',()=>{
 for(let i=0;i<130;i++)for(const j of bubble.neighbors(i))assert.ok(bubble.neighbors(j).includes(i));
 const b=Array(130).fill(-1);b[0]=b[10]=b[20]=0;b[65]=2;assert.deepEqual(bubble.floating(b),[65]);assert.equal(bubble.cluster(b,0,0).length,3);
 const s=bubble.newGame(7);assert.ok(bubble.trace(s,-72).path.length>2);const t=bubble.trace(s,0);assert.ok(t.cell>=0);assert.equal(s.board[t.cell],-1);
});
function bubbleBest(s){let best=null;for(const swap of [false,true])for(let a=-72;a<=72;a+=2){const t=copy(s);if(swap)bubble.act(t,'swap');if(!bubble.act(t,'shoot',a))continue;const score=(t.phase==='won'?1e5:0)+(t.score-s.score)*10-t.board.reduce((n,c,i)=>n+(c>=0?(i/10|0)*.1:0),0);if(!best||score>best.score)best={swap,a,score,t};}return best;}
test('bubble: all twenty levels cleared using legal shots and color swaps',()=>{
 let s=bubble.newGame(42);for(let level=1;level<=20;level++){let attempts=0;while(s.phase!=='won'&&attempts++<8){if(s.phase==='lost')bubble.retry(s);let steps=0;while(s.phase==='play'&&steps++<50){const b=bubbleBest(s);assert.ok(b);if(b.swap)bubble.act(s,'swap');assert.ok(bubble.act(s,'shoot',b.a));assert.ok(bubble.restore(s));}}assert.equal(s.phase,'won','level '+level);if(level<20)assert.ok(bubble.next(s));}assert.equal(s.wins,20);
});
test('match3: stable playable generation, invalid swaps preserve moves, crossing clusters count once',()=>{
 for(let seed=0;seed<30;seed++){const s=match.newGame(seed);assert.equal(match.clusters(s.board).length,0);assert.ok(match.moves(s.board).length);assert.ok(match.restore(s));}
 const s=match.newGame(42),original=copy(s);assert.equal(match.act(s,'swap',[0,63]),false);assert.deepEqual(s,original);
 const b=Array.from({length:64},(_,i)=>(i+(i/8|0))%5);for(const i of [25,26,27,18,34])b[i]=5;assert.equal(match.clusters(b).filter(i=>[25,26,27,18,34].includes(i)).length,5);
});
test('match3: all twenty goals achievable through legal swaps; save/reload stays deterministic',()=>{
 const s=match.newGame(281);let retries=0;for(let level=1;level<=20;level++){while(s.phase!=='won'){if(s.phase==='lost'){assert.ok(retries++<80,'too many retries at '+level);match.retry(s);}const possible=match.moves(s.board).map(move=>{const t=copy(s);match.act(t,'swap',move);return {move,t,score:(t.phase==='won'?1e6:0)+(t.score-s.score)+(Math.min(t.collected,s.goal)-Math.min(s.collected,s.goal))*30};}).sort((a,b)=>b.score-a.score);assert.ok(possible.length);const restored=match.restore(s);assert.ok(restored);match.act(s,'swap',possible[0].move);match.act(restored,'swap',possible[0].move);assert.deepEqual(s,restored);assert.ok(match.restore(s));}if(level<20)match.next(s);}assert.equal(s.wins,20);
});
test('cat: BFS symmetry and route preference, trapped win, edge loss and exact undo',()=>{
 for(let i=0;i<121;i++)for(const j of cat.neighbors(i))assert.ok(cat.neighbors(j).includes(i));
 const s=cat.newGame(3);s.walls=cat.neighbors(60).slice(1);const first=cat.neighbors(60)[0];assert.ok(cat.act(s,'block',first));assert.equal(s.phase,'won');assert.equal(s.wins,1);assert.ok(cat.restore(s));assert.ok(cat.act(s,'undo'));assert.equal(s.wins,0);assert.equal(s.phase,'play');
 const t=cat.newGame(4);t.cat=12;t.walls=[];const before=copy(t);cat.act(t,'block',80);assert.equal(t.phase,'lost');cat.act(t,'undo');assert.deepEqual(t.walls,before.walls);assert.equal(t.cat,before.cat);
});
test('all ports reject corrupt/version-mismatched saves and preserve completed state',()=>{
 for(const E of [bubble,match,cat]){const s=E.newGame(5);assert.ok(E.restore(s));assert.equal(E.restore({...s,version:2}),null);assert.equal(E.restore({...s,seed:NaN}),null);assert.equal(E.restore({...s,level:21}),null);assert.equal(E.restore({...s,board:[],walls:[999]}),null);}
});
