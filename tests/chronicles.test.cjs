const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../games/lib/chronicles-engines.js');
const saves = require('../games/lib/campaign-save.js');
function game(id) { const E=engine(id),s=E.newGame();return {E,s,act(a,n){const ok=E.act(s,a,n);assert.ok(E.restore(s),id+' invalid after '+a);return ok;}}; }
test('island: bootstrap tools, all regions and rescue through legal actions',()=>{
 const {E,s,act}=game('island');
 function energy(n){if(s.energy<n)act('rest');}
 function gather(zone,n){energy(1);if(s.zone!==zone)assert.ok(act('travel',zone));for(let i=0;i<n;i++){energy(2);assert.ok(act('gather'));}}
 gather(0,6);assert.ok(act('craft','axe'));assert.ok(act('craft','pick'));
 gather(1,10);gather(2,15);gather(3,6);
 for(let zone=0;zone<4;zone++){energy(4);act('travel',zone);assert.ok(act('search'));}
 for(const k of Object.keys(E.recipes))if(!s.made.includes(k))assert.ok(act('craft',k),k);
 assert.ok(act('rescue'));assert.ok(s.won);
});
test('farm: renewable seeds, eight orders and all facilities',()=>{
 const {E,s,act}=game('starfarm');
 function harvest(k){act('crop',k);act('plot',0);for(let d=0;d<E.crops[k].days;d++){act('tool','water');act('plot',0);act('sleep');}act('tool','harvest');assert.ok(act('plot',0));}
 for(let i=0;i<20;i++){harvest('turnip');act('sell','turnip');}
 for(const b of ['well','kitchen','pond'])assert.ok(act('build',b));
 for(let i=0;i<8;i++){const o=E.order(s);while(s.stock[o.item]<o.n){if(o.item==='fish'){if(s.energy<3)act('sleep');act('fish');}else if(o.item==='bread'){harvest('wheat');harvest('wheat');act('cook');}else harvest(o.item);}assert.ok(act('order'));}
 assert.ok(s.won);
});
test('caravan: contracts, upgrades and event recovery',()=>{
 const {E,s,act}=game('caravan');
 function travel(n){if(s.city!==n)act('travel',n);if(s.event)act('event',s.event==='bandits'?'pay':'leave');}
 for(let i=0;i<6;i++){const c=E.contract(s);travel(c.item);while(s.gold<400)act('work');for(let j=0;j<c.n;j++)assert.ok(act('buy',c.item));travel(c.city);assert.ok(act('contract'));}
 while(s.gold<240)act('work');act('cart');act('cart');assert.ok(s.won);
});
test('rune traveler: nine battles, deck conservation and ending',()=>{
 const {E,s,act}=game('runetraveler');let turns=0;
 while(!s.won&&turns++<500){
  if(s.dead)throw Error('strategy died at '+s.stage);
  if(s.phase==='route'){if(s.gold>=40)act('relic');if(s.gold>=20&&s.hp<45)act('heal');act('route','rest');}
  if(s.phase==='reward'){act('reward',s.rewards.includes('drain')?'drain':s.rewards.includes('bash')?'bash':'skip');continue;}
  if(s.phase==='battle'){for(let i=0;i<15&&s.phase==='battle';i++){const ranked=s.hand.map((k,i)=>({k,i,c:E.cards[k]})).filter(x=>x.c.cost<=s.energy).sort((a,b)=>((b.c.damage||0)+(b.c.poison||0)*2+(b.c.heal||0)+(b.c.draw||0)*8)-((a.c.damage||0)+(a.c.poison||0)*2+(a.c.heal||0)+(a.c.draw||0)*8));if(!ranked.length)break;act('play',ranked[0].i);}if(s.phase==='battle')act('end');}
 }assert.ok(s.won);
});
test('tower: all 100 floors reachable and beatable; loot never respawns',()=>{
 const {E,s,act}=game('magictower');
 function walk(target){let q=[[s.pos,[]]],seen=new Set([s.pos]),route;
  while(q.length){const [p,path]=q.shift();if(p===target){route=path;break;}for(const [d,delta] of Object.entries({up:-9,down:9,left:-1,right:1})){const n=p+delta;if(n<0||n>80||Math.abs(n%9-p%9)+Math.abs((n/9|0)-(p/9|0))!==1||seen.has(n))continue;const t=E.current(s,n);if(t==='#'||n!==target&&['up','down','enemy','boss'].includes(t))continue;seen.add(n);q.push([n,path.concat(d)]);}}
  assert.ok(route,'no route floor '+s.floor+' to '+target);for(const d of route)assert.ok(act('move',d),s.message);
 }
 for(let f=1;f<=100;f++){for(const p of [22,24,42,58,12,40,67])walk(p);const atk=s.atk;walk(42);assert.equal(s.atk,atk);if(f%5===0){walk(12);while(s.gold>=20)act('buy','def');}walk(70);}
 assert.ok(s.won);assert.equal(s.maxFloor,100);
});
test('farm final facility completes already fulfilled orders; tower prevents lethal fights and boss bypass',()=>{
 const farm=game('starfarm');farm.s.orders=8;farm.s.gold=50;farm.s.buildings.kitchen=farm.s.buildings.pond=true;assert.ok(farm.act('build','well'));assert.ok(farm.s.won);
 const {E,s,act}=game('magictower');s.pos=39;s.hp=1;assert.equal(act('move','right'),false);assert.equal(s.pos,39);assert.equal(s.hp,1);s.floor=s.maxFloor=10;s.pos=69;assert.equal(act('move','right'),false);assert.equal(s.floor,10);assert.ok(E.restore(s));
});
test('new campaign files and either open-source port each fit the 1MB budget',()=>{
 const fs=require('node:fs'),path=require('node:path');const root=path.join(__dirname,'..');
 function size(p){return fs.statSync(p).isDirectory()?fs.readdirSync(p).reduce((n,f)=>n+size(path.join(p,f)),0):fs.statSync(p).size;}
 const originals=['starfarm','runetraveler','caravan','wardens','island','magictower'];const common=['chronicles-engines.js','chronicles.js','campaign-save.js','campaign.css','campaign-loader.js'];
 const bytes=common.reduce((n,f)=>n+size(path.join(root,'games/lib',f)),0)+originals.reduce((n,id)=>n+size(path.join(root,'games',id))+size(path.join(root,'assets/images/covers',id+'.svg')),0);assert.ok(bytes<1000000,bytes);
 for(const id of ['bounce-back','entombed']){const total=size(path.join(root,'games',id))+['port-shell.js','port.css','campaign-save.js'].reduce((n,f)=>n+size(path.join(root,'games/lib',f)),0)+size(path.join(root,'assets/images/covers',id+'.svg'));assert.ok(total<1000000,id+': '+total);}
});
test('wardens: six missions with legal movement, combat and training',()=>{
 const {E,s,act}=game('wardens');let rounds=0;
 while(!s.won&&rounds++<150){
  assert.notEqual(s.phase,'defeat');if(s.phase==='camp'){act('upgrade');act('next');}
  for(let i=0;i<3&&s.phase==='battle';i++){
   if(!s.units[i].hp)continue;act('select',i);const u=s.units[i];
   for(let a=0;a<2&&s.phase==='battle';a++){
    const range=[1,4,2][i],enemies=s.enemies.filter(e=>e.hp).sort((a,b)=>a.hp-b.hp),target=enemies.find(e=>E.distance(u.pos,e.pos)<=range&&E.sight(s,u.pos,e.pos));
    if(target){act('cell',target.pos);continue;}
    if(i===2){const hurt=s.units.findIndex(v=>v.hp&&v.max-v.hp>=10&&E.distance(u.pos,v.pos)<=3);if(hurt>=0&&act('heal',hurt))continue;}
    const nearest=enemies.sort((a,b)=>E.path(s,u.pos,a.pos).length-E.path(s,u.pos,b.pos).length)[0];if(nearest){const route=E.path(s,u.pos,nearest.pos);if(route.length>1)act('cell',route[Math.min(2,route.length-2)]);}
   }
  }if(s.phase==='battle')act('end');
 }assert.ok(s.won);
});
test('campaign journals recover corruption, reject tampering and stop concurrent overwrite',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},E=engine('island'),A=saves('island',E,storage);A.load();const s=E.newGame();assert.ok(A.save(s).ok);E.act(s,'gather');assert.ok(A.save(s).ok);
 const B=saves('island',E,storage);B.load();E.act(s,'rest');A.save(s);assert.equal(B.save(s).reason,'conflict');
 data.set(A.key,'broken');const C=saves('island',E,storage);assert.equal(C.load().status,'recovered');assert.ok(C.save(s).ok);
 const corrupt=JSON.parse(C.encode(s));corrupt.data.wood++;assert.throws(()=>C.decode(JSON.stringify(corrupt)));assert.throws(()=>saves('caravan',engine('caravan'),storage).decode(C.encode(s)));
});
