const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load, root } = require('./engine-loader.cjs');
const makeSaves = require('../games/fogtown/save.js');
const E = load('fogtown'), clone = s => JSON.parse(JSON.stringify(s));
function memory() { const data = new Map(); return { getItem:k=>data.has(k)?data.get(k):null, setItem:(k,v)=>data.set(k,v) }; }
function navigate(s, id) {
  const goal = E.ALL[id], map = E.MAPS[s.map];
  const q = [[s.x,s.y,[]]], seen = new Set();
  while(q.length) {
    const [x,y,moves] = q.shift(), key = x+','+y;
    if(seen.has(key))continue;seen.add(key);
    if(Math.abs(x-goal.x)+Math.abs(y-goal.y)===1) { for(const d of moves) { E.move(s,d); assert.equal(s.battle,null,'unexpected battle on path'); } return E.interact(s,goal); }
    for(const [dir,[dx,dy]] of Object.entries(E.DIR)) {
      const nx=x+dx,ny=y+dy;
      if(E.walkable(s.map,nx,ny)&&!E.at(s,nx,ny))q.push([nx,ny,[...moves,dir]]);
    }
  }
  assert.fail('No accessible path to '+id+' on '+map.name);
}
function fight(s) {
  let turns=0;
  while(s.battle&&turns++<100) {
    const intent=E.intent(s),v=E.stats(s);
    let a='attack';
    if(s.hp<v.maxHp*0.4&&s.bag.potion)a='potion';
    else if((intent==='charge'||intent==='heavy')&&s.mp>=E.cost(s,'power'))a='power';
    else if(intent==='heavy')a='defend';
    else if(s.mp>=E.cost(s,'spark'))a='spark';
    else if(s.hp<v.maxHp*0.6&&s.bag.ether)a='ether';
    E.battle(s,a);assert.ok(E.restore(clone(s)),'each battle turn must be restorable');
  }
  assert.ok(turns<100);
}

test('Fogtown complete campaign is reachable and winnable, including both quests and three chests',()=>{
  const s=E.newGame(123);navigate(s,'elder');E.choose(s,'spark');
  navigate(s,'healer');navigate(s,'to-forest');
  for(const id of ['f-slime','f-moth','f-wolf','f-wolf2','f-moth2']){navigate(s,id);fight(s);assert.equal(s.map,'forest');navigate(s,'f-camp');}
  for(const id of ['f-herb1','f-herb2','f-herb3','f-chest'])navigate(s,id);
  E.equip(s,'thorn');navigate(s,'f-root');fight(s);assert.ok(s.keys.includes('forest'));
  E.recall(s);navigate(s,'healer');assert.ok(s.flags.herbDone);const gold=s.gold;navigate(s,'healer');assert.equal(s.gold,gold);
  E.buy(s,'staff');E.equip(s,'staff');E.buy(s,'robe');E.equip(s,'robe');E.rest(s,false);
  navigate(s,'to-mine');navigate(s,'miner');E.equip(s,'focus');navigate(s,'m-chest');
  for(const id of ['m-bat','m-crab','m-wisp','m-crab2','m-bat2']){navigate(s,id);fight(s);assert.equal(s.map,'mine');navigate(s,'m-camp');}
  navigate(s,'m-golem');fight(s);assert.ok(s.keys.includes('mine'));
  E.recall(s);E.buy(s,'mail');E.equip(s,'mail');E.rest(s,false);navigate(s,'to-ruins');navigate(s,'r-chest');
  for(const id of ['r-shade','r-knight','r-mirror','r-shade2','r-knight2']){navigate(s,id);fight(s);assert.equal(s.map,'ruins');navigate(s,'r-camp');}
  navigate(s,'r-keeper');fight(s);assert.ok(s.keys.includes('ruins'));E.recall(s);
  assert.equal(navigate(s,'lighthouse').type,'ending');assert.ok(s.flags.completed);assert.equal(s.opened.length,3);assert.ok(s.flags.minerDone);
  assert.ok(E.restore(clone(s)));const end=clone(s);assert.equal(navigate(s,'lighthouse').type,'dialog');assert.equal(s.gold,end.gold);
});
test('Fogtown combat turn persists, heavy attack interrupts, guard mitigates, and death preserves progress',()=>{
  const s=E.newGame(1);navigate(s,'elder');navigate(s,'to-forest');navigate(s,'f-wolf');
  assert.equal(E.intent(s),'charge');E.battle(s,'power');assert.equal(s.battle.turn,2);
  assert.deepEqual(clone(E.restore(s)),clone(s));
  s.battle.turn=2;const hp=s.hp;E.battle(s,'defend');assert.ok(s.hp<hp);assert.ok(s.hp>=hp-3);
  const turn=s.battle.turn;s.bag.potion=0;E.battle(s,'potion');assert.equal(s.battle.turn,turn);
  s.hp=1;s.battle.turn=2;E.battle(s,'defend');assert.equal(s.battle,null);assert.equal(s.map,'town');assert.equal(s.deaths,1);assert.equal(s.level,1);assert.ok(s.flags.intro);
});
test('Fogtown gates, duplicate loot, equipment, and expedition refresh preserve one-time rewards',()=>{
  const s=E.newGame(2);navigate(s,'elder');navigate(s,'to-mine');assert.equal(s.map,'town');navigate(s,'to-forest');navigate(s,'f-chest');
  const gold=s.gold;assert.equal(E.interact(s,E.ALL['f-chest']),null);assert.equal(s.gold,gold);
  E.equip(s,'thorn');assert.equal(E.stats(s).reflect,5);assert.equal(E.equip(s,'fang'),false);
  navigate(s,'f-slime');fight(s);assert.ok(s.defeated.includes('f-slime'));E.recall(s);E.rest(s,true);assert.ok(!s.defeated.includes('f-slime'));assert.ok(s.opened.includes('f-chest'));
});
test('Fogtown save journal recovers interrupted/corrupt primary and detects competing tabs',()=>{
  const store=memory(),a=makeSaves(E,store),s=E.newGame(10);assert.equal(a.load().status,'new');assert.ok(a.save(s).ok);
  s.x=10;assert.ok(a.save(s).ok);store.setItem(a.KEY,'broken');
  const b=makeSaves(E,store),recovered=b.load();assert.equal(recovered.status,'recovered');assert.equal(recovered.state.x,11);assert.ok(b.save(recovered.state).ok);
  const tab=makeSaves(E,store);tab.load();recovered.state.x=9;assert.ok(b.save(recovered.state).ok);
  assert.equal(tab.save(s).reason,'conflict');assert.equal(makeSaves(E,store).load().state.x,9);
});
test('Fogtown save import validates versions/checksum/schema; storage failures preserve old primary',()=>{
  const store=memory(),a=makeSaves(E,store),s=E.newGame(42);a.load();a.save(s);const old=store.getItem(a.KEY);
  const text=a.encode(s);assert.deepEqual(clone(a.decode(text)),clone(s));
  const corrupt=JSON.parse(text);corrupt.data.gold++;assert.throws(()=>a.decode(JSON.stringify(corrupt)),/校验/);
  const newer=JSON.parse(text);newer.data.version=99;store.setItem(a.KEY,JSON.stringify(newer));assert.equal(makeSaves(E,store).load().status,'version');
  assert.equal(E.restore({...clone(s),map:'__proto__'}),null);assert.equal(E.restore({...clone(s),hp:999}),null);assert.equal(E.restore({...clone(s),battle:{id:'f-slime',hp:20,turn:0}}),null);
  store.setItem(a.KEY,old);const fail=makeSaves(E,{getItem:store.getItem,setItem:()=>{throw new Error('quota');}});fail.load();s.x=10;assert.equal(fail.save(s).ok,false);assert.equal(store.getItem(a.KEY),old);
});
test('Fogtown complete incremental game source and cover remain under one megabyte',()=>{
  const dir=path.join(root,'games/fogtown');const bytes=fs.readdirSync(dir).reduce((n,f)=>n+fs.statSync(path.join(dir,f)).size,0)+fs.statSync(path.join(root,'assets/images/covers/fogtown.svg')).size;
  assert.ok(bytes<1000000,bytes+' bytes');
});
