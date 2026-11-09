const test = require('node:test');
const assert = require('node:assert/strict');
const factory = require('../games/lib/five-engines.js');
test('ridge rally: steering driver finishes, offroad fails, terminal state is stable',()=>{
  const E=factory('ridge-rally'),s=E.newGame();
  while(!s.over){const target=E.center(s.distance+12);E.step(s,1/120,{left:s.x>target+1,right:s.x<target-1,gas:true});}
  assert.ok(s.won);assert.equal(s.distance,3600);assert.ok(s.health>0);
  const done=JSON.stringify(s);E.step(s,.05,{gas:true});assert.equal(JSON.stringify(s),done);
  const bad=E.newGame();while(!bad.over)E.step(bad,.05,{left:true,gas:true});assert.equal(bad.won,false);
});
test('traffic: legal lane changes avoid complete waves and careless driving loses',()=>{
  const E=factory('neon-traffic'),s=E.newGame(()=>.123);
  while(!s.over){const nearest=s.traffic.filter(c=>c.y<430&&c.y>30).sort((a,b)=>b.y-a.y)[0];if(nearest){const wave=s.traffic.filter(c=>Math.abs(c.y-nearest.y)<1);const lane=[0,1,2].find(l=>!wave.some(c=>c.lane===l));if(lane!==undefined&&lane!==s.lane)E.action(s,Math.sign(lane-s.lane));}E.step(s,1/120);}
  assert.ok(s.won);assert.ok(s.passed>0);assert.ok(s.lives>0);
  const bad=E.newGame(()=>.123);while(!bad.over)E.step(bad,.05);assert.equal(bad.won,false);
  const fresh=E.newGame(()=>.2);assert.ok(E.action(fresh,1));assert.equal(E.action(fresh,-1),false);
});
test('beat echo: exact rhythms win eight rounds; premature taps, duplicates and timeout handled',()=>{
  const E=factory('beat-echo'),s=E.newGame();assert.equal(E.tap(s),false);
  for(let r=0;r<8;r++){
    assert.ok(E.listen(s));while(s.phase==='listen')E.step(s,.01);
    const origin=s.elapsed;
    for(const beat of E.patterns[r]){while(s.elapsed<origin+beat*.5-1e-8)E.step(s,.01);assert.ok(E.tap(s));assert.equal(E.tap(s),false);}
    assert.equal(s.phase,'result');E.next(s);
  }
  assert.ok(s.won);assert.equal(s.correct,8);assert.equal(s.score,960);
  const bad=E.newGame();E.listen(bad);while(bad.phase==='listen')E.step(bad,.05);E.tap(bad);for(let i=0;i<90;i++)E.step(bad,.05);assert.equal(bad.phase,'result');assert.equal(bad.correct,0);
});
test('chord lab: selection limit, exact sets, assistance scoring and ten-round ending',()=>{
  const E=factory('chord-lab'),s=E.newGame(()=>.5);
  assert.equal(E.submit(s),false);
  for(let r=0;r<10;r++){if(r===0)s.assisted=true;for(const n of s.rounds[r])assert.ok(E.select(s,n));const other=[0,1,2,3,4].find(n=>!s.selected.includes(n));assert.equal(E.select(s,other),false);assert.ok(E.submit(s));assert.equal(E.submit(s),false);E.next(s);}
  assert.ok(s.won);assert.equal(s.correct,10);assert.equal(s.score,1400);
});
test('four games preserve active progress and reject corrupted save values',()=>{
  for(const id of ['ridge-rally','neon-traffic','beat-echo','chord-lab']){
    const E=factory(id),s=E.newGame(()=>.2);for(let i=0;i<5;i++)E.step(s,.05,{});
    assert.deepEqual(E.restore(JSON.parse(JSON.stringify(s))),s);
    assert.equal(E.restore({...s,elapsed:NaN}),null);assert.equal(E.restore({...s,over:true}),null);assert.equal(E.restore({}),null);
  }
  const T=factory('neon-traffic'),s=T.newGame(()=>.3);s.traffic.push({lane:4,y:0,color:0,hit:false});assert.equal(T.restore(s),null);
  const C=factory('chord-lab'),c=C.newGame(()=>.3);c.selected=[0,0];assert.equal(C.restore(c),null);
});
