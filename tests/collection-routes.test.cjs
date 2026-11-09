const test=require('node:test'),assert=require('node:assert/strict');
const data=require('../games/lib/collection-data.js'),factory=require('../games/lib/collection-engines.js');
for(const cfg of data.filter(c=>c.category==='rpg'))test(cfg.id+': complete its own objective through legal actions',()=>{
 const E=factory(cfg),s=E.newGame(()=>.4),m=cfg.mode;
 if(m==='mirror')E.action(s,'skill');
 function walk(tx,ty){let limit=0;
  while(s.x!==tx||s.y!==ty){assert.ok(!s.over,cfg.id+' '+s.message);assert.ok(limit++<300,'route exceeded');
   const q=[[s.x,s.y,[]]],seen=new Set([s.x+','+s.y]);let route;
   while(q.length){const [x,y,r]=q.shift();if(x===tx&&y===ty){route=r;break;}for(const [a,dx,dy] of [['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny,t=s.map[ny*11+nx];if(nx<1||nx>9||ny<1||ny>7||seen.has(k)||['wall','rock'].includes(t))continue;seen.add(k);q.push([nx,ny,r.concat(a)]);}}
   assert.ok(route,'no route');const a=route[0],d={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]}[a],e=E.enemyAt(s,s.x+d[0],s.y+d[1]);
   if(s.hp<25&&s.inventory>(m==='garden'?1:0)&&!(m==='herb'&&s.items<3))E.action(s,'heal');
   if(e&&m==='tamer'&&e.hp<=e.maxHp*.6&&s.mp>=2){E.action(s,'skill');continue;}
   if(e&&m==='echo'&&e.windup){E.action(s,'guard');if(s.mp>=2)E.action(s,'skill');continue;}
   if(e&&!['tamer','echo','herb','garden','forge','mirror'].includes(m)&&s.mp>=2){E.action(s,'skill');continue;}
   if(s.map[(s.y+d[1])*11+s.x+d[0]]==='water'&&Math.floor(s.turn/3)%2===1){E.action(s,'wait');continue;}
   E.action(s,a);
  }
 }
 // Collect supplies without a battle, then prepare profession-specific tools.
 walk(2,3);walk(3,6);walk(1,4);E.action(s,'interact');
 if(m==='forge')E.action(s,'skill');
 if(m==='herb'){E.action(s,'skill');E.action(s,'skill');walk(5,1);E.action(s,'skill');}
 if(m==='tamer'){
  walk(4,1);walk(1,4);E.action(s,'interact');walk(6,3);walk(1,4);E.action(s,'interact');
 }
 for(const [x,y] of [[3,1],[7,1],[9,5]]){walk(x,y);assert.ok(E.action(s,'interact'));
  if(m==='garden'){const enemy=s.enemies.find(e=>e.hp>0&&Math.abs(e.x-s.x)+Math.abs(e.y-s.y)===1);if(enemy){walk(enemy.x,enemy.y);walk(x,y);}E.action(s,'skill');E.action(s,'wait');E.action(s,'wait');E.action(s,'wait');assert.ok(E.action(s,'interact'));}
  if(x!==9){walk(1,4);E.action(s,'interact');}
 }
 if(m==='echo')for(const e of s.enemies.slice(0,3)){if(e.hp>0){walk(e.x,e.y);walk(1,4);E.action(s,'interact');}}
 walk(1,4);E.action(s,'interact');walk(9,7);E.action(s,'interact');assert.ok(s.won,s.message);assert.equal(s.goal,3);
});
