const test=require('node:test'),assert=require('node:assert/strict');
const data=require('../games/lib/collection-data.js'),factory=require('../games/lib/collection-engines.js');
const get=m=>factory(data.find(g=>g.mode===m));
test('original catalog: distinct modes, serializable active progress, invalid save rejection',()=>{
 assert.equal(data.length,53);assert.equal(new Set(data.map(g=>g.id)).size,53);
 for(const cfg of data){const E=factory(cfg),s=E.newGame(()=>.25);E.step(s,.04,{});assert.deepEqual(E.restore(JSON.parse(JSON.stringify(s))),s,cfg.id);assert.equal(E.restore({...s,elapsed:NaN}),null);assert.equal(E.restore({...s,id:'other'}),null);assert.equal(E.restore({}),null);}
});
test('card variants conserve a complete deck through actions and undo',()=>{
 for(const cfg of data.filter(g=>g.category==='cards')){const E=factory(cfg),s=E.newGame(()=>.42);let seed=12;
  for(let n=0;n<300;n++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const a=['deal','waste','undo','foundation'+seed%4,'pile'+seed%s.piles.length][seed%5];E.action(s,a);const all=[...s.deck,...s.waste,...s.removed,...s.piles.flat()];assert.equal(all.length,52,cfg.id);assert.equal(new Set(all).size,52,cfg.id);}
 }
});
test('pyramid supports either selection order, kings, covering, and undo',()=>{
 const E=get('pyramid'),s=E.newGame(()=>.2);const cards=[...s.deck,...s.waste,...s.piles.flat()];
 s.piles=Array.from({length:28},()=>[]);s.piles[21]=[4];s.waste=[7];s.removed=cards.filter(c=>![4,7].includes(c));s.deck=[];
 E.action(s,'pile21');assert.ok(E.action(s,'waste'));assert.equal(s.removed.length,52);assert.ok(s.won);assert.ok(E.action(s,'undo'));assert.deepEqual(s.piles[21],[4]);assert.deepEqual(s.waste,[7]);
});
test('all untimed music exercises accept correct answers and finish eight rounds',()=>{
 for(const cfg of data.filter(g=>g.category==='music')){const E=factory(cfg);if(E.timed)continue;const s=E.newGame(()=>.2);
  for(let r=0;r<8;r++){if(cfg.mode==='duration'){for(let j=0;j<s.target;j++)E.action(s,'choice0');}else if(Array.isArray(s.answer)){for(const i of s.answer)E.action(s,'choice'+i);}else E.action(s,'choice'+s.answer);assert.ok(s.answered,cfg.id);E.action(s,'next');}
  assert.ok(s.over&&s.won,cfg.id);assert.equal(s.correct,8);assert.equal(s.score,800);
 }
});
test('timed music honors rests, lanes, holds, and full-run scoring',()=>{
 for(const cfg of data.filter(g=>g.category==='music')){const E=factory(cfg);if(!E.timed)continue;const s=E.newGame(()=>.2);E.action(s,'listen');
  for(const event of s.events){while(s.clock<event.at-1e-7)E.step(s,Math.min(.01,event.at-s.clock));if(!event.rest){E.action(s,'choice'+event.lane);if(event.hold){while(s.clock<event.at+event.hold-1e-7)E.step(s,Math.min(.01,event.at+event.hold-s.clock));E.release(s);}}}
  while(!s.answered)E.step(s,.05);assert.equal(s.hits,12,cfg.id);assert.equal(s.misses,0,cfg.id);assert.equal(s.correct,1,cfg.id);
 }
});
test('racing: automatic steering finishes ordinary courses and stopping fails deadline',()=>{
 for(const m of ['night','ice','fuel','pursuit','jump','checkpoints','cones','pit']){const E=get(m),s=E.newGame(()=>.2);
  while(!s.over){let target=E.road(s.distance+15);if(['checkpoints','cones'].includes(m)&&s.next-s.distance<100)target=E.road(s.next)+(s.progress%2?45:-45);if(m==='fuel'&&s.next-s.distance<90)target+=45;E.step(s,.01,{left:s.x>target+2,right:s.x<target-2,gas:true});}
  assert.ok(s.won,m+': '+s.message);
 }
 const E=get('reverse'),s=E.newGame(()=>.2);while(!s.over)E.step(s,.05,{});assert.equal(s.won,false);
});
test('RPG basic route can visit objectives, heal, battle and leave',()=>{
 const E=get('frost'),s=E.newGame(()=>.2);
 function walk(x,y){let guard=0;while((s.x!==x||s.y!==y)&&!s.over){if(guard++>300)throw Error('route');const dirs=[['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]],q=[[s.x,s.y,[]]],seen=new Set([s.x+','+s.y]);let route;
  while(q.length){const [px,py,r]=q.shift();if(px===x&&py===y){route=r;break;}for(const[d,dx,dy]of dirs){const nx=px+dx,ny=py+dy,k=nx+','+ny;if(nx<1||nx>9||ny<1||ny>7||seen.has(k)||['wall','rock'].includes(s.map[ny*11+nx]))continue;seen.add(k);q.push([nx,ny,r.concat(d)]);}}
  assert.ok(route);if(s.hp<20&&s.inventory)E.action(s,'heal');E.action(s,route[0]);}
 }
 walk(3,1);E.action(s,'interact');walk(7,1);E.action(s,'interact');walk(1,4);E.action(s,'interact');walk(9,5);E.action(s,'interact');walk(9,7);E.action(s,'interact');assert.ok(s.won,s.message);
});
test('sports projectile targets are reachable with legal angle and power choices',()=>{
 for(const m of ['basket','archery','curling','penalty']){const E=get(m);let found=false;
  for(let angle=-2.3;angle<-.29&&!found;angle+=.08)for(let power=25;power<=120&&!found;power+=5){const s=E.newGame(()=>.3);s.angle=angle;s.power=power;E.action(s,'shoot');for(let t=0;t<2000&&s.round===0;t++)E.step(s,.01,{});found=s.hits>0;}
  assert.ok(found,m+' has no reachable target');
 }
});
