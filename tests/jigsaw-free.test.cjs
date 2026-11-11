const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../games/jigsaw/free.js');
const {load,rng}=require('./engine-loader.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));

test('Photo IDs restore only in free modes; classic and legacy pictures keep their original identity',()=>{
 const J=load('jigsaw'),photos=require('../games/jigsaw/images/manifest.json'),ids=photos.map(p=>p.id);
 for(const n of [100,400]){
  const s=J.deal(n,42,rng(42),'lake');s.pic=ids[0];
  assert.equal(J.restore(s,ids).pic,ids[0]);assert.equal(J.restore({...s,pic:'missing-photo'},ids),null);
 }
 const classic=J.deal(12,42,rng(42),'lake');assert.equal(J.restore(classic,ids).pic,'lake');
 assert.equal(J.restore({...classic,pic:ids[0]},ids),null);
 assert.equal(J.restore(J.deal(400,42,rng(42),'lake'),ids).pic,'lake');
});

test('Free jigsaw permits arbitrary placement, rejects false neighbours and merges whole assemblies',()=>{
 const s=F.create(),a=F.add(s,0,2.37,-4.81),b=F.add(s,1,8,9);
 assert.equal(F.join(s,b),0);assert.equal(b.x,7);assert.equal(b.y,9);
 F.move(b,a.x+.12,a.y-.1);assert.equal(F.join(s,b),1);assert.equal(s.groups.length,1);
 assert.deepEqual(b.pieces,[1,0]);assert.equal(b.x,2.37);
 F.move(b,13.4,17.8);assert.equal(F.groupOf(s,0),F.groupOf(s,1));
 const c=F.add(s,20,-5,-5),d=F.add(s,21,-4,-5);assert.equal(F.join(s,d),1);
 F.move(d,b.x-.1,b.y+.1);assert.equal(F.join(s,d),1);assert.equal(d.pieces.length,4);
 assert.equal(F.join(s,d),0);assert.equal(F.add(s,0,1,1),null);
 const wrong=F.add(s,50,d.x+10,d.y+2);assert.equal(F.join(s,wrong),0,'non-neighbour at identical image origin does not join');
 const wrap=F.create(),edge=F.add(wrap,19,19,0),next=F.add(wrap,20,0,1);
 assert.equal(edge.x,next.x);assert.equal(F.join(wrap,next),0,'row wrapping is not adjacency');
});

test('Free jigsaw completes only when all 400 pieces form one connected movable assembly',()=>{
 const J=load('jigsaw'),deal=J.deal(400,42,rng(42),'lake'),s=F.create();
 assert.equal(deal.cols,20);assert.equal(deal.rows,20);assert.equal(deal.tray.length,400);
 for(let i=0;i<400;i++){
  const g=F.add(s,i,i%20+3.14,Math.floor(i/20)-7.2);
  F.join(s,g);assert.equal(F.complete(s),i===399);
 }
 assert.equal(s.groups.length,1);F.move(s.groups[0],-17,26);
 assert.equal(F.groupOf(s,399).x,-17);
 const placed=Array.from({length:400},(_,i)=>i);
 assert.deepEqual(F.restore(copy(s),placed),s);
 const scattered=F.create();placed.forEach(i=>F.add(scattered,i,i*3,0));
 assert.equal(F.complete(scattered),false,'empty tray alone is not completion');
});

test('Free jigsaw saves preserve positions/view and reject corrupted or disconnected groups',()=>{
 const s=F.create();F.add(s,3,4.25,-2);F.add(s,9,-1,4);s.view={x:123,y:-456,zoom:.8};
 assert.deepEqual(F.restore(copy(s),[3,9]),s);
 const duplicate=copy(s);duplicate.groups[1].pieces=[3];assert.equal(F.restore(duplicate,[3,9]),null);
 const disconnected=copy(s);disconnected.groups=[{x:0,y:0,pieces:[3,9]}];assert.equal(F.restore(disconnected,[3,9]),null);
 const nan=copy(s);nan.groups[0].x=Infinity;assert.equal(F.restore(nan,[3,9]),null);
 const zoom=copy(s);zoom.view.zoom=0;assert.equal(F.restore(zoom,[3,9]),null);
 assert.equal(F.restore(s,[3]),null);assert.equal(F.restore({...s,version:2},[3,9]),null);
 assert.equal(F.move(s.groups[0],NaN,0),false);
});

test('10x10 uses its own neighbours, piece limits and completion; legacy 20x20 saves remain compatible',()=>{
 const J=load('jigsaw'),deal=J.deal(100,42,rng(42),'lake'),s=F.create(10);
 assert.equal(deal.cols,10);assert.equal(deal.rows,10);assert.equal(deal.tray.length,100);
 assert.equal(F.add(s,100,0,0),null);
 assert.equal(F.adjacent(9,10,10),false);assert.equal(F.adjacent(0,10,10),true);
 const a=F.add(s,0,4,5),b=F.add(s,10,4,6);assert.equal(F.join(s,b),1);
 assert.equal(F.groupOf(s,0),b);assert.equal(a.x,b.x);
 for(let i=0;i<100;i++)if(i!==0&&i!==10){const g=F.add(s,i,4+i%10,5+Math.floor(i/10));F.join(s,g);}
 assert.ok(F.complete(s));assert.equal(s.groups[0].pieces.length,100);
 const placed=Array.from({length:100},(_,i)=>i);
 assert.deepEqual(F.restore(copy(s),placed,10),s);
 assert.equal(F.restore(copy(s),placed,20),null);
 const legacy=F.create();F.add(legacy,20,2,3);delete legacy.cols;
 const restored=F.restore(legacy,[20],20);assert.equal(restored.cols,20);assert.deepEqual(restored.groups,legacy.groups);
 assert.equal(F.restore(legacy,[20],10),null);
});
