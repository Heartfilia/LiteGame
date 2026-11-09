// Original small-game rules. Plain serializable state; no DOM/audio dependencies.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.CollectionEngine=factory;})(typeof window==='object'?window:this,function(cfg){
 'use strict';
 const m=cfg.mode,category=cfg.category,clone=x=>JSON.parse(JSON.stringify(x)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const rand=s=>{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;};
 const int=(s,n)=>Math.floor(rand(s)*n),pick=(s,a)=>a[int(s,a.length)];
 const shuffle=(s,a)=>{for(let i=a.length-1;i>0;i--){const j=int(s,i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
 const base=r=>({version:1,id:cfg.id,seed:Math.floor((r||Math.random)()*4294967296)>>>0,elapsed:0,score:0,over:false,won:false,message:cfg.help});
 const finish=(s,won,message)=>{s.over=true;s.won=won;s.message=message;};
 let E;
 if(category==='rpg'){
  function newGame(r){const s=Object.assign(base(r),{x:1,y:1,hp:40,maxHp:40,mp:8,attack:5,level:1,xp:0,turn:0,resource:24,items:0,goal:0,realm:0,shield:0,companion:0,freeze:0,map:[],enemies:[],plants:[],inventory:0});
   const terrain=Array.from(m).reduce((n,c)=>n+c.charCodeAt(0),0);
   for(let y=0;y<9;y++)for(let x=0;x<11;x++){let t=x===0||y===0||x===10||y===8?'wall':'floor';if(x>2&&x<9&&y>1&&y<7&&(x*3+y+terrain)%7===0)t='rock';s.map.push(t);}
   [[3,1],[7,1],[9,5]].forEach(([x,y])=>s.map[y*11+x]='goal');[[1,4],[5,4],[9,7]].forEach(([x,y])=>s.map[y*11+x]='camp');
   [[2,3],[5,1],[8,3],[3,6],[7,7],[9,2]].forEach(([x,y])=>s.map[y*11+x]='supply');s.map[7*11+9]='exit';
   [[4,1],[6,3],[8,5],[5,7],[9,6]].forEach(([x,y],i)=>{s.map[y*11+x]='floor';s.enemies.push({x,y,hp:9+i*2,maxHp:9+i*2,attack:3+i%3,windup:false});});
   if(m==='mirror'){for(let y=1;y<8;y++)s.map[y*11+6]='mirror';s.map[3*11+6]='floor';s.map[3*11+7]='rock';}
   if(m==='tide')for(let x=2;x<9;x++)s.map[4*11+x]='water';
   if(m==='garden')s.resource=35;
   if(m==='courier'){s.deliveries=[[3,1],[7,1],[9,5]];s.message='先将第一封信送往左上信标，按顺序完成三次投递。';}
   if(m==='escort'){s.cart={x:1,y:1,hp:24};s.message='商队每两回合跟随一步，护送时注意近旁敌人。';}
   if(m==='lantern'){s.light=4;s.map[4*11+1]='camp';}
   return s;
  }
  function enemyAt(s,x,y){return s.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);}
  function tick(s){s.turn++;if(s.freeze>0)s.freeze--;else for(const e of s.enemies){if(e.hp<=0||Math.abs(e.x-s.x)+Math.abs(e.y-s.y)>1)continue;if(m==='echo'&&!e.windup){e.windup=true;s.message='敌人举起武器：下一回合攻击，适合防守。';continue;}const damage=Math.max(0,e.attack-s.shield);s.hp-=damage;e.windup=false;}
   if(m==='escort'&&s.turn%2===0){s.cart.x=s.x;s.cart.y=s.y;for(const e of s.enemies)if(e.hp>0&&Math.abs(e.x-s.cart.x)+Math.abs(e.y-s.cart.y)<=1)s.cart.hp-=2;if(s.cart.hp<=0)finish(s,false,'商队货车被击毁。');}
   s.shield=0;if(['frost','lantern','escort'].includes(m)){s.resource--;if(s.resource<=0)s.hp-=2;}
   for(const p of s.plants)if(!p.ripe&&s.turn-p.at>=3)p.ripe=true;
   if(s.hp<=0)finish(s,false,'生命耗尽，远征结束。');
  }
  function defeat(s,e){if(e.hp>0)return;s.score+=80;s.xp+=4;s.message='击败守卫，获得经验。';if(s.xp>=s.level*6){s.xp=0;s.level++;s.attack+=2;s.maxHp+=6;s.hp=Math.min(s.maxHp,s.hp+10);s.message='升级！攻击与生命上限提升。';}}
  function action(s,a){if(s.over)return false;
   const dirs={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
   if(dirs[a]){const [dx,dy]=dirs[a],x=s.x+dx,y=s.y+dy,t=s.map[y*11+x],e=enemyAt(s,x,y);
    if(t==='wall'||t==='rock'||(t==='mirror'&&s.realm===0)||(t==='water'&&Math.floor(s.turn/3)%2===1)){s.message='通路被阻挡。潮水每三回合涨落，可等待。';return false;}
    if(e){e.hp-=s.attack+s.companion*2;s.message='挥击守卫，造成 '+(s.attack+s.companion*2)+' 点伤害。';defeat(s,e);}else{s.x=x;s.y=y;s.message='探索中。';if(t==='supply'){s.inventory++;s.resource+=8;s.map[y*11+x]='floor';s.score+=20;s.message='获得补给与材料。';}}
   }else if(a==='guard'){s.shield=7;if(m==='echo')s.mp=Math.min(12,s.mp+2);s.message='防守：本回合减伤。';}
   else if(a==='skill'){
    if(m==='mirror'){s.realm=1-s.realm;s.message=s.realm?'镜界开启，可穿过镜墙。':'回到现实。';}
    else if(m==='clockwork'){if(s.mp<2)return false;s.mp-=2;s.freeze=4;s.message='机关停摆三个回合。';}
    else if(m==='garden'){if(s.inventory<1||s.plants.some(p=>p.x===s.x&&p.y===s.y))return false;s.inventory--;s.plants.push({x:s.x,y:s.y,at:s.turn,ripe:false});s.message='播种完成，三回合后可采收。';}
    else if(m==='herb'){if(s.inventory<1)return false;s.inventory--;s.items++;s.message='炼成一瓶解毒药。';}
    else if(m==='forge'){if(s.inventory<1)return false;s.inventory--;s.attack+=3;s.message='锻造完成，攻击 +3。';}
    else {const e=s.enemies.find(e=>e.hp>0&&Math.abs(e.x-s.x)+Math.abs(e.y-s.y)<=1);if(!e||s.mp<2)return false;s.mp-=2;
     if(m==='tamer'&&e.hp<=e.maxHp*.6){e.hp=0;s.companion++;s.message='契约成功，伙伴协助攻击。';defeat(s,e);}else{e.hp-=m==='echo'?14:10;defeat(s,e);s.message='技能命中目标。';}}
   }else if(a==='interact'){
    const i=s.y*11+s.x,t=s.map[i],plant=s.plants.find(p=>p.x===s.x&&p.y===s.y&&p.ripe);
    if(plant){s.goal++;s.score+=100;s.hp=Math.min(s.maxHp,s.hp+20);s.plants=s.plants.filter(p=>p!==plant);s.message='采收符文能量，恢复二十点生命。';}
    else if(t==='camp'){s.hp=s.maxHp;s.resource=Math.max(s.resource,24);s.mp=8;s.message='营地休整，补充生命与资源。';}
    else if(t==='goal'){
     if(m==='courier'&&(s.x!==s.deliveries[s.goal][0]||s.y!==s.deliveries[s.goal][1])){s.message='请按左上、右上、右下顺序送信。';return false;}
     if(m==='lantern'&&s.resource<6){s.message='点亮灯塔需要六份灯油，先寻找补给。';return false;}
     if(m==='forge'&&s.attack<8){s.message='需要先用矿石锻造一次武器。';return false;}
     if(m==='herb'&&s.items<1){s.message='需要先用草药制作解毒剂。';return false;}
     if(m==='garden'){s.inventory++;s.map[i]='floor';s.message='获得符文种子，请播种并等待成熟。';}
     else{if(m==='herb')s.items--;s.goal++;s.score+=120;s.map[i]='floor';s.resource+=m==='lantern'?-6:8;s.message='完成一项目标：'+s.goal+' / 3。';}
    }else if(t==='exit'){
     if(s.goal<3){s.message='还需完成三项目标，再到出口。';return false;}
     if(m==='tamer'&&s.companion<2){s.message='需要至少两只契约伙伴。';return false;}
     if(m==='echo'&&s.enemies.filter(e=>e.hp<=0).length<3){s.message='需要击败至少三名守卫。';return false;}
     finish(s,true,'任务完成，平安归来！');s.score+=s.hp*10;return true;
    }else{s.message='这里没有可交互的物品。';return false;}
   }else if(a==='heal'){if(s.inventory<1)return false;s.inventory--;s.hp=Math.min(s.maxHp,s.hp+16);s.message='使用补给恢复生命。';}
   else if(a!=='wait')return false;
   tick(s);return true;
  }
  E={newGame,action,step(s,dt){s.elapsed+=dt;},enemyAt};
 }
 if(category==='racing'){
  const road=(d)=>300+Math.sin(d/180)*100+Math.sin(d/74)*30;
  function newGame(r){return Object.assign(base(r),{x:300,y:370,angle:-Math.PI/2,speed:0,vx:0,distance:0,health:100,fuel:100,tires:100,boost:3,boostTime:0,progress:0,next:280,air:0,cooldown:0,penalty:0,lap:0,lastAngle:0,ringAngle:-Math.PI/2,ringRadius:140});}
  function action(s,a){if(s.over)return false;if(a==='special'){
   if(m==='pursuit'&&s.boost>0){s.boost--;s.boostTime=2;return true;}
   if(m==='pit'&&s.speed<35){s.tires=100;s.elapsed+=4;s.message='更换轮胎，耗时四秒。';return true;}
   if(m==='delivery'&&s.speed<30&&Math.abs(s.distance-s.next)<65){s.progress++;s.score+=200;s.next+=480;s.message='投递完成 '+s.progress+' / 5';return true;}
  }return false;}
  function step(s,dt,input){if(s.over)return;input=input||{};s.elapsed+=dt;s.cooldown=Math.max(0,s.cooldown-dt);s.boostTime=Math.max(0,s.boostTime-dt);const turn=(input.right?1:0)-(input.left?1:0);
   if(m==='reverse'){
    s.speed=clamp(s.speed+((input.gas?1:0)-(input.brake?1:0))*85*dt,-65,85);s.speed*=Math.pow(.5,dt);s.angle+=turn*s.speed*.015*dt;s.x+=Math.cos(s.angle)*s.speed*dt;s.y+=Math.sin(s.angle)*s.speed*dt;
    if(s.x<25||s.x>575||s.y<35||s.y>455||(s.y<170&&(s.x<240||s.x>360))){s.health-=20*dt;s.x=clamp(s.x,25,575);s.y=clamp(s.y,35,455);}
    if(s.x>255&&s.x<345&&s.y>65&&s.y<145&&Math.abs(Math.cos(s.angle))<.2&&Math.abs(s.speed)<8){finish(s,true,'成功摆正车身，泊车完成！');s.score=Math.max(0,1000-Math.floor(s.elapsed*5));}
   }else if(m==='ring'){
    s.speed=clamp(s.speed+(input.brake?-90:input.gas?45:5)*dt,0,145);s.ringRadius+=turn*75*dt;s.ringAngle+=s.speed/Math.max(90,s.ringRadius)*dt;s.x=300+Math.cos(s.ringAngle)*s.ringRadius;s.y=240+Math.sin(s.ringAngle)*s.ringRadius;
    if(s.ringRadius<105||s.ringRadius>175)s.health-=22*dt;s.ringRadius=clamp(s.ringRadius,90,190);s.lap=Math.floor((s.ringAngle+Math.PI/2)/(Math.PI*2));s.score=Math.floor((s.ringAngle+Math.PI/2)*100);if(s.lap>=3)finish(s,true,'三圈完成！');
   }else{
    const outside=Math.abs(s.x-road(s.distance))>75;let cap=outside?50:155;if(m==='pit')cap*=.45+.55*s.tires/100;if(s.boostTime>0)cap=220;
    s.speed=clamp(s.speed+(input.brake?-120:input.gas?55:10)*dt,0,cap);
    const target=turn*(80+s.speed*.65);s.vx=m==='ice'?s.vx+(target-s.vx)*dt*1.8:target;s.x=clamp(s.x+s.vx*dt,15,585);s.distance+=s.speed*dt;
    if(outside&&s.air<=0)s.health-=15*dt;s.air=Math.max(0,s.air-dt);
    if(m==='fuel'){s.fuel-=dt*(.25+s.speed*s.speed/10000);if(s.distance>=s.next){s.next+=650;if(Math.abs(s.x-road(s.distance)-45)<30){s.fuel=Math.min(100,s.fuel+28);s.message='补充燃油。';}}if(s.fuel<=0)finish(s,false,'燃油耗尽。');}
    if(m==='pit')s.tires=Math.max(0,s.tires-dt*1.4);
    if(m==='jump'&&s.distance>=s.next){s.next+=400;if(s.speed>95&&Math.abs(s.x-road(s.distance))<35){s.air=1.5;s.progress++;s.score+=100;}else{s.health-=25;s.message='速度或位置不足，未能飞越缺口。';}}
    if(['cones','checkpoints'].includes(m)&&s.distance>=s.next){const side=s.progress%2?1:-1,goal=road(s.distance)+side*45;s.next+=320;if(Math.abs(s.x-goal)>38){s.health-=18;s.penalty++;s.message='漏过路标，车况受损。';}else{s.score+=150;s.message='路标通过！';}s.progress++;}
    if(m==='pursuit'){if(s.distance<s.elapsed*62-180)finish(s,false,'追车赶上了你。');if(s.distance>=s.next){s.next+=390;const obstacle=road(s.distance)+(s.progress++%3-1)*48;if(Math.abs(s.x-obstacle)<30)s.health-=24;}}
    if(m==='delivery'&&s.distance>s.next+70&&s.progress<5){finish(s,false,'错过投递区。请提前减速并按投递。');}
    s.score=Math.max(s.score,Math.floor(s.distance/3));
    if(s.distance>=2800){if(m==='delivery'&&s.progress<5)finish(s,false,'包裹尚未送完。');else finish(s,true,'抵达终点！');}
   }
   if(s.health<=0||s.elapsed>=100)finish(s,false,s.health<=0?'车况耗尽。':'比赛超时。');
  }
  E={newGame,action,step,road};
 }
 if(category==='music'){
  const notes=['C','D','E','F','G','A','B'],pitches=[0,2,4,5,7,9,11];
  const timed=['tempo','rest','syncopation','duet','hold'].includes(m);
  function round(s){s.answered=false;s.selected=[];s.feedback='';s.phase='ready';s.clock=0;s.cursor=0;s.hits=0;s.misses=0;s.started=false;s.holdStart=null;
   const root=int(s,5),n=int(s,7);s.answer=0;s.choices=[];s.sequence=[];
   if(m==='interval'){s.answer=int(s,4);s.sequence=[root,root+[2,4,7,12][s.answer]];s.choices=['大二度','大三度','纯五度','八度'];}
   if(m==='scale'){s.answer=int(s,3);s.sequence=[[0,2,4,5,7,9,11,12],[0,2,3,5,7,8,10,12],[0,2,4,7,9,12]][s.answer].map(v=>v+root);s.choices=['大调','自然小调','五声音阶'];}
   if(m==='quality'){s.answer=int(s,3);s.sequence=[[root,root+[4,3,3][s.answer],root+[7,7,6][s.answer]]];s.choices=['大三和弦','小三和弦','减三和弦'];}
   if(m==='bass'){s.answer=n;s.sequence=[[pitches[n],pitches[n]+7,pitches[n]+12]];s.choices=notes;}
   if(m==='staff'){s.answer=n;s.sequence=[pitches[n]];s.choices=notes;}
   if(m==='contour'){s.answer=int(s,4);s.sequence=[[0,4,7],[7,4,0],[0,7,2],[7,0,5]][s.answer].map(v=>v+root);s.choices=['上行','下行','拱形','谷形'];}
   if(m==='odd'){s.answer=int(s,4);s.sequence=[root,root,root,root];s.sequence[s.answer]+=3;s.choices=['第一音','第二音','第三音','第四音'];}
   if(m==='duration'){s.target=pick(s,[3,4,5,6]);s.total=0;s.choices=['四分音符 1拍','二分音符 2拍','八分音符 ½拍'];s.sequence=Array(s.target).fill(0);}
   if(m==='order'){s.answer=shuffle(s,[0,1,2,3,4,5,6]).slice(0,3);s.sequence=s.answer.map(i=>pitches[i]);s.choices=notes;}
   if(m==='repair'){s.sequence=Array.from({length:4},()=>pick(s,pitches));s.missing=int(s,4);s.answer=pitches.indexOf(s.sequence[s.missing]);s.choices=notes;}
   if(timed){s.beat=[.6,.5,.4][s.round%3];s.events=Array.from({length:12},(_,i)=>({at:2+i*s.beat,lane:m==='duet'?i%2:0,rest:m==='rest'&&i%3===2,hold:m==='hold'&&i%3===1? s.beat*.65:0,done:false}));if(m==='syncopation')s.events.forEach((e,i)=>{if(i%3===1)e.at+=s.beat*.5;});s.sequence=Array(4).fill(0);s.choices=m==='duet'?['左鼓','右鼓']:['敲击'];}
  }
  function newGame(r){const s=Object.assign(base(r),{round:0,correct:0,assisted:false});round(s);return s;}
  function grade(s,ok){s.answered=true;s.correct+=ok?1:0;s.score+=ok?(s.assisted?50:100):0;s.feedback=ok?'正确！':'再听一遍，观察答案。';s.message=s.feedback;}
  function action(s,a){if(s.over)return false;
   if(a==='listen'){if(timed){if(s.answered)return false;if(s.phase==='playing'){s.score=s.roundStartScore;round(s);}s.roundStartScore=s.score;s.phase='playing';s.clock=0;return true;}return !s.answered;}
   if(a==='assist'){s.assisted=true;return true;}
   if(a==='next'&&s.answered){s.round++;if(s.round>=8)finish(s,s.correct>=5,'练习完成：'+s.correct+' / 8 轮达标');else{s.assisted=false;round(s);}return true;}
   if(!/^choice\d+$/.test(a)||s.answered)return false;const choice=Number(a.slice(6));if(choice>=s.choices.length)return false;
   if(timed){if(s.phase!=='playing')return false;const e=s.events.find(e=>!e.done&&Math.abs(e.at-s.clock)<.18&&e.lane===choice);if(!e){s.misses++;s.message='空拍';return false;}if(e.rest){e.done=true;s.misses++;s.message='这是休止符';return true;}if(e.hold){s.holdStart=s.clock;s.holding=s.events.indexOf(e);return true;}e.done=true;s.hits++;s.score+=10;s.message='命中';return true;}
   if(m==='duration'){s.total+=[1,2,.5][choice];s.selected.push(choice);if(s.total>=s.target)grade(s,s.total===s.target);return true;}
   if(m==='order'){s.selected.push(choice);if(s.selected.length===3)grade(s,s.selected.every((v,i)=>v===s.answer[i]));return true;}
   s.selected=[choice];grade(s,choice===s.answer);return true;
  }
  function release(s){if(s.holdStart==null||s.answered)return;const e=s.events[s.holding];e.done=true;if(Math.abs(s.clock-e.at-e.hold)<.18){s.hits++;s.score+=15;}else s.misses++;s.holdStart=null;}
  function step(s,dt){s.elapsed+=dt;if(!timed||s.phase!=='playing'||s.answered)return;s.clock+=dt;for(const [i,e] of s.events.entries())if(!e.done&&s.clock>e.at+e.hold+.2){e.done=true;if(m==='tempo'&&i<4)s.hits++;else if(!e.rest)s.misses++;else s.hits++;}if(s.clock>s.events[s.events.length-1].at+1){s.phase='result';grade(s,s.hits>=9&&s.misses<=3);}}
  E={newGame,action,step,release,timed,pitches};
 }
 if(category==='cards'){
  const rank=c=>c%13+1,suit=c=>Math.floor(c/13),red=c=>suit(c)%2===1;
  function newGame(r){const s=Object.assign(base(r),{deck:[],piles:[],waste:[],found:[0,0,0,0],removed:[],selected:null,moves:0,hist:[],active:12});s.deck=shuffle(s,Array.from({length:52},(_,i)=>i));
   const take=n=>s.deck.splice(0,n);
   if(m==='golf'){s.piles=Array.from({length:7},()=>take(5));s.waste=take(1);}
   if(m==='pyramid'){s.piles=take(28).map(c=>[c]);s.waste=take(1);}
   if(m==='monte'){s.piles=take(25).map(c=>[c]);}
   if(m==='accordion'){s.piles=take(52).map(c=>[c]);}
   if(m==='aces'){s.piles=Array.from({length:4},()=>take(1));}
   if(m==='calculation'){const initial=[0,1,2,3];s.deck=s.deck.filter(c=>!initial.includes(c));s.found=[1,2,3,4];s.removed=initial;s.piles=Array.from({length:4},()=>[]);s.waste=take(1);}
   if(m==='clock'){s.piles=Array.from({length:13},()=>take(4));s.revealed=Array(13).fill(0);}
   if(m==='yukon'){s.piles=Array.from({length:7},(_,i)=>take(i+1));for(let i=1;i<7;i++)s.piles[i].push(...take(4));s.down=[0,1,2,3,4,5,6];}
   return s;
  }
  const top=p=>p[p.length-1];
  function exposed(s,i){if(m!=='pyramid'||i>=21)return true;const row=Math.floor((Math.sqrt(8*i+1)-1)/2),col=i-row*(row+1)/2,j=(row+1)*(row+2)/2+col;return !s.piles[j].length&&!s.piles[j+1].length;}
  function checkpoint(s){const v=clone(s);delete v.hist;s.hist.push(v);if(s.hist.length>60)s.hist.shift();}
  function removed(s,c){s.removed.push(c);s.score+=10;}
  function settle(s){s.moves++;s.selected=null;
   let win=false;if(['golf','pyramid','monte'].includes(m))win=s.piles.every(p=>!p.length)&&(m!=='monte'||!s.deck.length);
   if(m==='accordion')win=s.piles.filter(p=>p.length).length===1;
   if(m==='aces')win=!s.deck.length&&s.piles.every(p=>p.length===1&&rank(p[0])===1);
   if(m==='calculation')win=s.removed.length===52;
   if(m==='yukon')win=s.found.reduce((a,b)=>a+b,0)===52;
   if(m==='clock')win=s.revealed.reduce((a,b)=>a+b,0)===52;
   if(win)finish(s,true,'牌局完成！');
  }
  function action(s,a){if(a==='undo'&&s.hist.length){const hist=s.hist,prev=hist.pop();Object.assign(s,prev,{hist});return true;}if(s.over)return false;
   if(a==='deal'){
    if(m==='monte'){checkpoint(s);s.piles=s.piles.filter(p=>p.length);while(s.piles.length<25&&s.deck.length)s.piles.push([s.deck.shift()]);while(s.piles.length<25)s.piles.push([]);settle(s);return true;}
    if(m==='clock')return action(s,'pile'+s.active);
    if(!s.deck.length)return false;
    if(['golf','pyramid','calculation','aces'].includes(m)){checkpoint(s);if(m==='aces')for(const p of s.piles)if(s.deck.length)p.push(s.deck.shift());else break;else s.waste.push(s.deck.shift());settle(s);return true;}return false;
   }
   if(a==='waste'){if(s.waste.length){if(m==='pyramid'&&rank(top(s.waste))===13){checkpoint(s);removed(s,s.waste.pop());settle(s);return true;}if(m==='pyramid'&&s.selected&&s.selected.zone==='pile'){const p=s.piles[s.selected.index];if(p.length&&rank(top(p))+rank(top(s.waste))===13){checkpoint(s);removed(s,p.pop());removed(s,s.waste.pop());settle(s);return true;}}s.selected={zone:'waste',index:0,card:top(s.waste)};}return true;}
   if(/^foundation\d$/.test(a)){const i=Number(a.slice(-1));if(!s.selected)return false;const p=s.selected.zone==='waste'?s.waste:s.piles[s.selected.index],c=top(p);
    if(c===undefined||m==='yukon'&&s.selected.at!==p.length-1)return false;
    const legal=m==='calculation'?rank(c)===(s.found[i]+i)%13+1:m==='yukon'&&suit(c)===i&&rank(c)===s.found[i]+1;
    if(!legal)return false;checkpoint(s);p.pop();if(m==='calculation'){s.found[i]=rank(c);removed(s,c);}else{s.found[i]++;removed(s,c);if(s.selected.zone==='pile')s.down[s.selected.index]=Math.min(s.down[s.selected.index],p.length-1);}settle(s);return true;
   }
   if(!/^pile\d+(?::\d+)?$/.test(a))return false;const parts=a.slice(4).split(':').map(Number),i=parts[0],p=s.piles[i];if(!p)return false;const c=top(p);
   if(m==='clock'){if(i!==s.active||s.revealed[i]>=4)return false;checkpoint(s);const card=p[s.revealed[i]++];s.active=rank(card)-1;s.score+=10;settle(s);if(!s.over&&s.revealed[s.active]>=4)finish(s,false,'四张 K 全部翻出，时钟停下。');return true;}
   if(m==='golf'){if(c===undefined||Math.abs(rank(c)-rank(top(s.waste)))!==1)return false;checkpoint(s);s.waste.push(p.pop());s.score+=10;settle(s);return true;}
   if(m==='aces'){
    if(!p.length&&s.selected&&s.piles[s.selected.index].length){checkpoint(s);p.push(s.piles[s.selected.index].pop());settle(s);return true;}
    if(c===undefined)return false;const value=rank(c)===1?14:rank(c);
    if(s.piles.some(q=>q.length&&suit(top(q))===suit(c)&&(rank(top(q))===1?14:rank(top(q)))>value)){checkpoint(s);removed(s,p.pop());settle(s);return true;}
    s.selected={zone:'pile',index:i,card:c};return true;
   }
   if(m==='pyramid'||m==='monte'){
    if(c===undefined||!exposed(s,i))return false;
    if(m==='pyramid'&&rank(c)===13){checkpoint(s);removed(s,p.pop());settle(s);return true;}
    if(s.selected){const prev=s.selected,other=prev.zone==='waste'?s.waste:s.piles[prev.index];
     const legal=prev.index!==i||prev.zone==='waste';const pair=m==='pyramid'?rank(c)+rank(top(other))===13:rank(c)===rank(top(other))&&Math.abs(i%5-prev.index%5)<=1&&Math.abs(Math.floor(i/5)-Math.floor(prev.index/5))<=1;
     if(legal&&pair){checkpoint(s);removed(s,p.pop());removed(s,other.pop());settle(s);return true;}
    }s.selected={zone:'pile',index:i,card:c};return true;
   }
   if(m==='accordion'){
    if(c===undefined)return false;if(s.selected){const j=s.selected.index,from=s.piles[j],active=s.piles.map((p,k)=>p.length?k:-1).filter(k=>k>=0),d=active.indexOf(j)-active.indexOf(i);
     if([1,3].includes(d)&&(rank(c)===rank(top(from))||suit(c)===suit(top(from)))){checkpoint(s);p.push(from.pop());s.score+=5;settle(s);return true;}}
    s.selected={zone:'pile',index:i,card:c};return true;
   }
   if(m==='calculation'){if(s.selected&&s.selected.zone==='waste'){checkpoint(s);p.push(s.waste.pop());settle(s);return true;}if(c!==undefined)s.selected={zone:'pile',index:i,card:c};return true;}
   if(m==='yukon'){
    if(s.selected&&s.selected.index!==i){const from=s.piles[s.selected.index],at=s.selected.at,moving=from[at];if((!p.length&&rank(moving)===13)||(p.length&&rank(c)===rank(moving)+1&&red(c)!==red(moving))){checkpoint(s);p.push(...from.splice(at));s.down[s.selected.index]=Math.max(0,Math.min(s.down[s.selected.index],from.length-1));s.score+=5;settle(s);return true;}}
    if(p.length){const at=parts[1]===undefined?p.length-1:parts[1];if(at<s.down[i]||at>=p.length)return false;s.selected={zone:'pile',index:i,at,card:p[at]};}return true;
   }return false;
  }
  E={newGame,action,step(s,dt){s.elapsed+=dt;},rank,suit,exposed};
 }
 if(category==='sports'){
  function newGame(r){return Object.assign(base(r),{round:0,attempts:10,hits:0,angle:-1,power:75,wind:(int({seed:123},9)-4)*3,ball:null,x:300,paddle:300,vx:0,vy:0,distance:0,speed:0,jump:0,jumpV:0,next:120,strokes:0,lastSide:'',flight:false,target:300,keeper:300,sweep:0});}
  function next(s){s.round++;s.ball=null;s.flight=false;s.distance=0;s.speed=0;s.jump=0;s.next=120;s.wind=pick(s,[-12,-6,0,6,12]);if(s.round>=s.attempts)finish(s,s.hits>=5,'挑战结束：'+s.hits+' 次成功');}
  function action(s,a){if(s.over)return false;
   if(a==='left')s.angle=clamp(s.angle-.08,-2.7,-.3);if(a==='right')s.angle=clamp(s.angle+.08,-2.7,-.3);
   if(a==='less')s.power=clamp(s.power-5,25,120);if(a==='more')s.power=clamp(s.power+5,25,120);
   if(m==='longjump'&&['left','right'].includes(a)){if(s.lastSide!==a&&!s.flight){s.speed=Math.min(140,s.speed+12);s.lastSide=a;}return true;}
   if(a!=='shoot')return true;
   if(m==='hurdle'){if(s.jump<=0){s.jumpV=220;s.jump=1;}return true;}
   if(m==='longjump'){if(!s.flight){if(s.distance>180){s.message='越线犯规';next(s);}else{s.flight=true;s.jumpV=190;s.jump=1;s.takeoff=s.distance;s.flightDistance=0;}}return true;}
   if(m==='volley'){if(!s.ball)s.ball={x:300,y:100,vx:90,vy:160};return true;}
   if(s.ball)return false;
   if(m==='penalty'){const x=300+Math.cos(s.angle)*220;s.ball={x:300,y:400,vx:(x-300)*2,vy:-440};s.aim=x;return true;}
   s.ball={x:m==='curling'?300:80,y:400,vx:Math.cos(s.angle)*s.power*3,vy:Math.sin(s.angle)*s.power*3};
   return true;
  }
  function step(s,dt,input){if(s.over)return;s.elapsed+=dt;input=input||{};s.target=390+Math.sin(s.elapsed*1.2)*65;s.keeper=300+Math.sin(s.elapsed*2.3)*110;
   if(m==='hurdle'||m==='longjump'){
    if(m==='hurdle')s.speed=90;s.distance+=s.speed*dt;
    if(s.jump>0){s.jumpV-=420*dt;s.jump+=s.jumpV*dt;if(s.jump<=0){s.jump=0;if(m==='longjump'&&s.flight){const length=s.distance-s.takeoff;s.message='跳远 '+length.toFixed(1)+' 米';if(length>70){s.hits++;s.score+=Math.round(length);}next(s);}}}
    if(m==='hurdle'&&s.distance>s.next){if(s.jump<26){s.message='碰到栏架';s.score=Math.max(0,s.score-20);}else{s.strokes++;s.score+=30;}s.next+=120;if(s.next>720){s.hits+=s.strokes>=4?1:0;s.strokes=0;next(s);}}
    if(m==='longjump'&&!s.flight&&s.distance>190){s.message='错过起跳线';next(s);}return;
   }
   if(m==='volley')s.paddle=clamp(s.paddle+((input.right?1:0)-(input.left?1:0))*300*dt,45,555);
   const b=s.ball;if(!b)return;
   if(m==='curling'){b.vx*=Math.pow(input.shoot?.75:.4,dt);b.vy*=Math.pow(input.shoot?.75:.4,dt);b.x+=b.vx*dt;b.y+=b.vy*dt;if(Math.hypot(b.vx,b.vy)<8){const d=Math.hypot(b.x-300,b.y-130);s.message='离圆心 '+Math.round(d);if(d<65){s.hits++;s.score+=Math.round(150-d);}next(s);}return;}
   if(m==='volley'){
    b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x<10||b.x>590)b.vx*=-1;if(b.y<15)b.vy=Math.abs(b.vy);
    if(b.y>400&&b.vy>0&&Math.abs(b.x-s.paddle)<60){b.vy=-Math.abs(b.vy)*1.04;b.vx+=(b.x-s.paddle)*2;s.hits++;s.score+=100;if(s.hits>=10)finish(s,true,'十次截击成功！');}
    if(b.y>480){s.round++;s.ball=null;if(s.round>=3)finish(s,false,'三次漏球，比赛结束。');}return;
   }
   const py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
   if(m==='penalty'){if(b.y<160){const ok=Math.abs(b.x-300)<165&&Math.abs(b.x-s.keeper)>45;if(ok){s.hits++;s.score+=100;}s.message=ok?'进球！':'被扑出或偏出';next(s);}return;}
   b.vy+=220*dt;if(m==='archery')b.vx+=s.wind*dt;
   if(m==='basket'&&py<=220&&b.y>220&&b.vy>0&&Math.abs(b.x-s.target)<34){s.hits++;s.score+=100;s.message='空心入网！';next(s);return;}
   if(m==='archery'&&b.x>480){const d=Math.abs(b.y-220);if(d<65){s.hits++;s.score+=Math.round(100-d);}s.message='偏离靶心 '+Math.round(d);next(s);return;}
   if(b.y>475||b.x<0||b.x>610){s.message='未命中，请调整角度与力度。';next(s);}
  }
  E={newGame,action,step};
 }
 if(!E)throw Error('Unknown collection category '+category);
 const rawStep=E.step;E.step=(s,dt,input)=>{if(s.over||!Number.isFinite(dt)||dt<0)return;rawStep(s,Math.min(dt,.05),input);};
 E.restore=v=>{try{
  if(!v||v.version!==1||v.id!==cfg.id||v.over||!Number.isFinite(v.score)||v.score<0||!Number.isFinite(v.elapsed)||v.elapsed<0||!Number.isInteger(v.seed)||v.seed<0||v.seed>4294967295)return null;
  const fresh=E.newGame(()=>.5);
  function shape(a,b,depth){if(depth>12)return false;if(typeof a!==typeof b||a===undefined)return false;if(typeof b==='number')return Number.isFinite(a)&&Math.abs(a)<=4294967295;if(typeof b==='string')return a.length<1000;if(Array.isArray(b))return Array.isArray(a)&&a.length<2000;if(b&&typeof b==='object')return a&&Object.keys(b).every(k=>shape(a[k],b[k],depth+1));return true;}
  if(!shape(v,fresh,0))return null;
  const number=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b,integer=(x,a,b)=>Number.isInteger(x)&&number(x,a,b);
  if(category==='rpg'&&(v.map.length!==99||v.map.some(t=>!['wall','rock','floor','goal','camp','supply','exit','mirror','water'].includes(t))||!integer(v.x,1,9)||!integer(v.y,1,7)||v.hp<=0||v.hp>v.maxHp||v.enemies.some(e=>!e||!number(e.hp,-100,100)||!integer(e.x,1,9)||!integer(e.y,1,7))||v.plants.some(p=>!p||!integer(p.x,1,9)||!integer(p.y,1,7)||!number(p.at,0,v.turn))))return null;
  if(category==='cards'){const cards=[...v.deck,...v.waste,...v.removed,...v.piles.flat()];if(m!=='clock'&&(cards.length!==52||new Set(cards).size!==52))return null;if(cards.some(c=>!Number.isInteger(c)||c<0||c>51))return null;}
  if(category==='cards'&&(!v.piles.every(Array.isArray)||v.piles.length!==fresh.piles.length||v.found.length!==4||v.found.some(x=>!integer(x,0,13))||v.hist.length>60||v.selected&&(!['pile','waste'].includes(v.selected.zone)||!integer(v.selected.index,0,v.piles.length-1))))return null;
  if(category==='music'&&(!integer(v.round,0,7)||v.choices.length>8||!v.choices.every(x=>typeof x==='string')||v.sequence.some(n=>Array.isArray(n)?n.some(x=>!number(x,-1,36)):!number(n,-1,36))||v.events&&v.events.some(e=>!e||!number(e.at,0,30)||!integer(e.lane,0,1)||!number(e.hold,0,2)||typeof e.rest!=='boolean'||typeof e.done!=='boolean')))return null;
  if(category==='sports'&&(!integer(v.round,0,10)||v.ball&&['x','y','vx','vy'].some(k=>!number(v.ball[k],-10000,10000))))return null;
  if(category==='racing'&&(!number(v.x,0,600)||!number(v.y,0,480)||!number(v.health,.000001,100)||!number(v.elapsed,0,100)))return null;
  return clone(v);
 }catch(e){return null;}};
 return E;
});
