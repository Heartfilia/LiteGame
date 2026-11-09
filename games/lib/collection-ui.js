(function(){
 'use strict';
 const config=CollectionData.find(c=>c.id===document.body.dataset.game),E=CollectionEngine(config),m=config.mode,cat=config.category;
 const button=(id,label,keys,hold)=>({id,label,keys:keys||[],hold:!!hold});
 let controls=[];
 if(cat==='rpg')controls=[button('up','↑ 上',['arrowup','w']),button('left','← 左',['arrowleft','a']),button('down','↓ 下',['arrowdown','s']),button('right','右 →',['arrowright','d']),button('interact','交互 / E',['e']),button('skill','技能 / Q',['q']),button('guard','防守',['g']),button('heal','补给',['h']),button('wait','等待',[' '])];
 if(cat==='racing')controls=[button('left','← 左转',['arrowleft','a'],true),button('brake',m==='reverse'?'倒车 ↓':'刹车 ↓',['arrowdown','s'],true),button('gas','加速 ↑',['arrowup','w'],true),button('right','右转 →',['arrowright','d'],true),button('special',m==='delivery'?'投递':m==='pit'?'进站换胎':'氮气',[' '])];
 if(cat==='music')controls=[button('listen','▶ 听音 / 开始',['r']),...Array.from({length:7},(_,i)=>button('choice'+i,String(i+1),[String(i+1)],m==='hold'&&i===0)),button('assist','辅助提示',['v']),button('next','下一轮',['n'])];
 if(cat==='cards')controls=[button('deal',m==='monte'?'整理补牌':m==='clock'?'翻开当前牌':'发牌',[' ']),button('waste','选择废牌',['w']),...Array.from({length:4},(_,i)=>button('foundation'+i,'基础堆 '+(i+1),[String(i+1)])),button('undo','撤销',['z'])];
 if(cat==='sports')controls=[button('left',m==='volley'?'← 移动':'← 调整 / 助跑',['arrowleft','a'],m==='volley'),button('right',m==='volley'?'移动 →':'调整 / 助跑 →',['arrowright','d'],m==='volley'),button('less','力度 −',['arrowdown']),button('more','力度 +',['arrowup']),button('shoot',m==='hurdle'||m==='longjump'?'起跳':m==='curling'?'投壶 / 按住擦冰':'出手',[' '],m==='curling')];
 let holdPrev=false,curlPrev=false;
 let cardTray=null,traySignature='';
 function updateTray(s,api){if(!cardTray)return;const signature=JSON.stringify([s.piles,s.down,s.selected,s.revealed,s.active]);if(signature===traySignature)return;traySignature=signature;cardTray.replaceChildren();
  s.piles.forEach((p,i)=>{const cards=m==='yukon'?p.map((c,at)=>({c,at})).filter(v=>v.at>=s.down[i]):[{c:m==='clock'?p[s.revealed[i]-1]:p[p.length-1]}];if(!cards.length)cards.push({});cards.forEach(({c,at})=>{const b=document.createElement('button');b.type='button';b.className='ch-btn ch-btn--soft';b.style.minHeight='44px';b.textContent=(i+1)+'列 '+(c===undefined?(m==='clock'?'牌背':'空位'):['','A','2','3','4','5','6','7','8','9','10','J','Q','K'][c%13+1]+['♣','♦','♠','♥'][Math.floor(c/13)]);b.setAttribute('aria-pressed',String(!!s.selected&&s.selected.zone==='pile'&&s.selected.index===i&&(at===undefined||at===s.selected.at)));b.addEventListener('click',()=>api.act('pile'+i+(at===undefined?'':':'+at)));cardTray.appendChild(b);});});
 }
 const engine=Object.assign({},E,{step(s,dt,input){
  if(cat==='music'&&m==='hold'){if(input.choice0&&!holdPrev)E.action(s,'choice0');if(!input.choice0&&holdPrev)E.release(s);holdPrev=!!input.choice0;}
  if(cat==='sports'&&m==='curling'){if(input.shoot&&!curlPrev)E.action(s,'shoot');curlPrev=!!input.shoot;}
  E.step(s,dt,input);
 }});
 function action(s,id,a){
  const ok=E.action(s,id);
  if(cat==='music'&&id==='listen'&&ok){let seq=s.sequence;if(m==='repair'&&s.started)seq=s.sequence.map((v,i)=>i===s.missing?-1:v);if(E.timed){const subdivision=s.beat/2,count=Math.ceil((s.events[s.events.length-1].at+.5)/subdivision)+1;seq=Array(count).fill(-1);s.events.forEach((e,i)=>{if(!e.rest&&(m!=='tempo'||i<4))seq[Math.round(e.at/subdivision)]=e.lane?7:0;});a.tone(seq,subdivision);}else a.tone(seq,.4);s.started=true;}
  if(cat==='music'&&id.startsWith('choice')&&!E.timed){const i=Number(id.slice(6));if(['order','repair','bass','staff'].includes(m))a.tone([E.pitches[i]],.2);}
 }
 function text(g,a,t,x,y,size,color){a.text(String(t),x,y,size||20,color);}
 function card(g,a,c,x,y,w,h,selected,back){g.fillStyle=selected?'#ffe3a2':back?'#435f85':'#f2e8d8';g.fillRect(x,y,w,h);g.strokeStyle='#a0b0c4';g.strokeRect(x,y,w,h);if(c!==undefined&&!back){const rank=c%13+1,suit=Math.floor(c/13);text(g,a,['','A','2','3','4','5','6','7','8','9','10','J','Q','K'][rank]+['♣','♦','♠','♥'][suit],x+w/2,y+Math.min(22,h*.55),Math.min(18,w*.3),suit%2?'#b7354e':'#18283d');}}
 function layoutCards(s){const out=[];if(m==='pyramid'){for(let i=0;i<28;i++){const row=Math.floor((Math.sqrt(8*i+1)-1)/2),col=i-row*(row+1)/2;out.push({i,x:275-row*35+col*70,y:35+row*47,w:58,h:43});}}
  else if(m==='clock'){for(let i=0;i<13;i++){const angle=i*Math.PI/6-Math.PI/2;out.push({i,x:i===12?270:270+Math.cos(angle)*205,y:i===12?200:200+Math.sin(angle)*160,w:58,h:60});}}
  else if(m==='monte'){for(let i=0;i<s.piles.length;i++)out.push({i,x:85+i%5*87,y:35+Math.floor(i/5)*70,w:70,h:60});}
  else if(m==='accordion'){s.piles.forEach((p,i)=>{if(p.length){const n=out.length;out.push({i,x:12+n%10*58,y:35+Math.floor(n/10)*64,w:52,h:56});}});}
  else{s.piles.forEach((p,i)=>{const w=Math.min(70,550/s.piles.length-5),x=25+i*(550/s.piles.length);if(!p.length)out.push({i,x,y:90,w,h:70});p.forEach((c,j)=>out.push({i,at:j,x,y:90+j*Math.min(25,300/Math.max(1,p.length)),w,h:j===p.length-1?70:Math.min(25,300/Math.max(1,p.length))}));});}return out;
 }
 function draw(g,s,a){g.fillStyle='#15243a';g.fillRect(0,0,600,480);
  if(cat==='rpg'){
   const size=45,ox=52,oy=20,colors={wall:'#26344c',rock:'#526076',floor:'#24473f',goal:'#cbad50',camp:'#a56e40',supply:'#548b9d',exit:'#8d6fb0',mirror:s.realm?'#564c85':'#c7b8ee',water:Math.floor(s.turn/3)%2?'#24558a':'#597c8f'};
   s.map.forEach((t,i)=>{const x=ox+i%11*size,y=oy+Math.floor(i/11)*size;g.fillStyle=colors[t];g.fillRect(x,y,size-2,size-2);const symbol={goal:'◆',camp:'火',supply:'＋',exit:'门',mirror:'镜',water:'≈'}[t];if(symbol)text(g,a,symbol,x+21,y+28,21);});
   s.plants.forEach(p=>text(g,a,p.ripe?'✦':'芽',ox+p.x*size+21,oy+p.y*size+27,24,'#f2d782'));
   s.enemies.filter(e=>e.hp>0).forEach(e=>{const x=ox+e.x*size,y=oy+e.y*size;g.fillStyle=e.windup?'#ed745b':'#b85778';g.beginPath();g.arc(x+21,y+22,13,0,7);g.fill();text(g,a,e.hp,x+21,y+27,13);g.fillStyle='#151b33';g.fillRect(x+8,y+5,26,3);g.fillStyle='#ffb997';g.fillRect(x+8,y+5,26*e.hp/e.maxHp,3);});
   const px=ox+s.x*size+21,py=oy+s.y*size+22;g.fillStyle='#b0e4ec';g.beginPath();g.arc(px,py-7,9,0,7);g.fill();g.fillStyle='#719af2';g.fillRect(px-10,py+2,20,14);text(g,a,'Lv.'+s.level+'  HP '+s.hp+'/'+s.maxHp+'  MP '+s.mp+'  目标 '+s.goal+'/3',300,454,19);
   if(m==='escort'){text(g,a,'车',ox+s.cart.x*size+10,oy+s.cart.y*size+40,17,'#ffcf85');text(g,a,'货车 '+s.cart.hp,480,454,17,'#ffd095');}
   if(m==='lantern'){const gradient=g.createRadialGradient(px,py,65,px,py,Math.max(90,120+s.resource*3));gradient.addColorStop(0,'#06102100');gradient.addColorStop(1,'#061021ed');g.fillStyle=gradient;g.fillRect(ox,oy,495,405);}
  }
  if(cat==='racing'){
   g.fillStyle='#25483f';g.fillRect(0,0,600,480);
   if(m==='reverse'){g.fillStyle='#35455a';g.fillRect(20,35,560,420);g.fillStyle='#17263b';g.fillRect(20,35,220,135);g.fillRect(360,35,220,135);g.strokeStyle='#f5d893';g.lineWidth=4;g.strokeRect(250,60,100,100);text(g,a,'P',300,110,30);}
   else if(m==='ring'){g.strokeStyle='#4c5666';g.lineWidth=70;g.beginPath();g.arc(300,240,140,0,7);g.stroke();g.strokeStyle='#e8ce8a';g.lineWidth=2;g.beginPath();g.arc(300,240,140,0,7);g.stroke();text(g,a,s.lap+' / 3 圈',300,250,25);}
   else{for(let y=0;y<480;y+=8){const x=E.road(s.distance+(370-y)*.6);g.fillStyle='#ceb68c';g.fillRect(x-93,y,186,8);g.fillStyle='#344357';g.fillRect(x-82,y,164,8);if(Math.floor((s.distance+370-y)/30)%2){g.fillStyle='#e5dba9';g.fillRect(x-2,y,4,8);}}
    if(['checkpoints','cones','jump','delivery','fuel','pursuit'].includes(m)){const y=370-(s.next-s.distance)/.6,x=E.road(s.next);g.fillStyle=m==='delivery'?'#b9b6ed':'#efb458';if(m==='delivery'||m==='fuel'){g.fillRect(x+50,y-20,30,40);text(g,a,m==='delivery'?'包':'油',x+65,y+4,16,'#17233b');}else if(m==='jump'){g.fillRect(x-35,y-10,70,20);}else{const target=x+(s.progress%2?45:-45);g.fillRect(target-18,y-12,36,24);}}
   }
   g.save();g.translate(s.x,m==='reverse'||m==='ring'?s.y:370-s.air*20);g.rotate(m==='reverse'?s.angle+Math.PI/2:m==='ring'?s.ringAngle+Math.PI/2:0);g.fillStyle='#efb76e';g.fillRect(-16,-28,32,56);g.fillStyle='#20344d';g.fillRect(-11,-16,22,15);g.restore();
   if(m==='night'){const grad=g.createRadialGradient(s.x,370,60,s.x,370,270);grad.addColorStop(0,'#08112500');grad.addColorStop(1,'#081125f5');g.fillStyle=grad;g.fillRect(0,0,600,480);}
   text(g,a,Math.round(s.speed)+' km/h · 车况 '+Math.ceil(s.health)+'%',300,32,21);text(g,a,Math.floor(s.distance)+' m · '+Math.ceil(100-s.elapsed)+' 秒',300,462,18);
   if(m==='fuel'||m==='pit')text(g,a,m==='fuel'?'燃油 '+Math.ceil(s.fuel):'轮胎 '+Math.ceil(s.tires),100,65,19);
  }
  if(cat==='music'){
   text(g,a,'第 '+(s.round+1)+' / 8 轮 · 达标 '+s.correct,300,38,23,'#e5c6ff');
   if(E.timed){g.strokeStyle='#82d9d2';g.lineWidth=4;g.beginPath();g.moveTo(45,350);g.lineTo(555,350);g.stroke();s.events.forEach((e,i)=>{if(m==='tempo'&&i>=4&&!s.answered)return;const y=350-(e.at-s.clock)*100;if(y<-25||y>460)return;g.fillStyle=e.done?'#52667c':e.rest?'#ec9d91':'#d9b1f6';const x=m==='duet'?210+e.lane*180:300;if(e.hold)g.fillRect(x-16,y-e.hold*100,32,e.hold*100);g.beginPath();g.arc(x,y,20,0,7);g.fill();text(g,a,e.rest?'休':'♪',x,y+7,22,'#18253c');});text(g,a,s.hits+' 命中 / '+s.misses+' 失误',300,445,20);if(m==='tempo')text(g,a,s.clock<2+4*s.beat?'先听四拍示范':'继续保持原速度，敲击八拍',300,135,23);}
   else if(m==='staff'){g.strokeStyle='#a1b7d5';for(let i=0;i<5;i++){g.beginPath();g.moveTo(100,170+i*25);g.lineTo(500,170+i*25);g.stroke();}text(g,a,'𝄞',125,252,68);const y=295-s.answer*12.5;g.fillStyle='#f5cf85';g.beginPath();g.ellipse(310,y,15,10,-.3,0,7);g.fill();g.fillRect(322,y-65,3,65);if(s.answer===0){g.fillRect(285,295,50,2);}}
   else if(m==='duration'){text(g,a,'目标 '+s.target+' 拍',300,130,28);for(let i=0;i<s.target*2;i++){g.fillStyle=i<s.total*2?'#d7adf2':'#354a64';g.fillRect(60+i*480/(s.target*2),190,480/(s.target*2)-5,70);}text(g,a,'已填 '+s.total+' 拍',300,310,26);}
   else{text(g,a,s.started?'仔细听，选择你的答案':'点击“听音”播放本轮',300,140,25);s.sequence.forEach((n,i)=>{const x=70+i*460/Math.max(1,s.sequence.length-1);g.fillStyle='#cdabed';g.beginPath();g.arc(x,250,16,0,7);g.fill();text(g,a,'♪',x,257,22,'#17263e');});if(m==='order')text(g,a,'已选 '+s.selected.map(i=>s.choices[i]).join(' → '),300,335,24);if(m==='repair')text(g,a,'缺失位置：'+(s.missing+1),300,335,22);}
   if(s.assisted||s.answered){const answer=Array.isArray(s.answer)?s.answer.map(i=>s.choices[i]).join(' → '):s.choices[s.answer];text(g,a,E.timed?s.feedback:m==='duration'?'用时值凑齐 '+s.target+' 拍':'答案：'+answer,300,395,22,'#f4d899');}
   if(s.feedback)text(g,a,s.feedback,300,465,20);
  }
  if(cat==='cards'){
   for(const b of layoutCards(s)){const p=s.piles[b.i],at=m==='clock'?Math.max(0,s.revealed[b.i]-1):b.at===undefined?p.length-1:b.at,c=p[at],back=m==='clock'?s.revealed[b.i]===0:m==='yukon'&&at<s.down[b.i];if(c===undefined){g.strokeStyle='#71849d';g.strokeRect(b.x,b.y,b.w,b.h);continue;}card(g,a,c,b.x,b.y,b.w,b.h,s.selected&&s.selected.zone==='pile'&&s.selected.index===b.i,back);if(m==='clock'){text(g,a,(b.i+1)+' · '+s.revealed[b.i]+'/4',b.x+29,b.y+52,13,'#20314a');if(b.i===s.active){g.strokeStyle='#f8b956';g.lineWidth=4;g.strokeRect(b.x-3,b.y-3,b.w+6,b.h+6);g.lineWidth=1;}}}
   text(g,a,'牌库 '+s.deck.length+' · 移除 '+s.removed.length+' · 步数 '+s.moves,300,22,17);
   if(s.waste.length)card(g,a,s.waste[s.waste.length-1],500,400,65,65,s.selected&&s.selected.zone==='waste');
   if(['calculation','yukon'].includes(m))text(g,a,'基础堆：'+s.found.join(' / '),240,454,20);
  }
  if(cat==='sports'){
   g.fillStyle='#284e49';g.fillRect(0,0,600,480);g.strokeStyle='#dbe2c3';g.strokeRect(25,40,550,400);
   if(m==='basket'){g.strokeStyle='#f5be72';g.lineWidth=5;g.beginPath();g.moveTo(s.target-34,220);g.lineTo(s.target+34,220);g.stroke();g.strokeRect(s.target+35,155,8,80);}
   if(m==='archery'){for(let i=4;i>0;i--){g.fillStyle=['','#f5bf71','#d36769','#dfd6bf','#7388a4'][i];g.beginPath();g.ellipse(485,220,12*i,17*i,0,0,7);g.fill();}text(g,a,'风 '+s.wind,460,70,21);}
   if(m==='penalty'){g.strokeRect(130,60,340,105);g.fillStyle='#e6b75f';g.fillRect(s.keeper-35,130,70,25);}
   if(m==='curling'){[90,65,35].forEach((r,i)=>{g.fillStyle=['#b1c4d8','#596f9f','#d6b097'][i];g.beginPath();g.arc(300,130,r,0,7);g.fill();});}
   if(m==='volley'){g.fillStyle='#e6bc6e';g.fillRect(s.paddle-60,405,120,12);g.strokeStyle='#b6d5d4';g.beginPath();g.moveTo(30,240);g.lineTo(570,240);g.stroke();}
   if(m==='hurdle'||m==='longjump'){g.fillStyle='#a47c61';g.fillRect(25,380,550,60);const line=180-s.distance;g.fillStyle='#f0dca2';g.fillRect(100+line*2,360,5,80);if(m==='hurdle'){for(let d=s.next;d<s.next+360;d+=120){const x=100+(d-s.distance)*2;g.fillStyle='#f2d58d';g.fillRect(x,330,6,50);g.fillRect(x-10,330,30,5);}}g.fillStyle='#90ccf0';g.beginPath();g.arc(100,350-s.jump,12,0,7);g.fill();g.fillRect(94,360-s.jump,12,20);text(g,a,'速度 '+Math.round(s.speed)+' · 距离 '+Math.round(s.distance),300,95,23);}
   else{if(s.ball){g.fillStyle='#f7e4a9';g.beginPath();g.arc(s.ball.x,s.ball.y,9,0,7);g.fill();}else if(m!=='volley'){const x=m==='curling'?300:80;g.strokeStyle='#efd397';g.lineWidth=3;g.beginPath();g.moveTo(x,400);g.lineTo(x+Math.cos(s.angle)*s.power,400+Math.sin(s.angle)*s.power);g.stroke();}text(g,a,'力度 '+s.power+' · 角度 '+Math.round(-s.angle*180/Math.PI)+'°',300,465,19);}
   text(g,a,'第 '+(s.round+1)+' 次 · 成功 '+s.hits+' · 得分 '+s.score,300,30,21);
  }
 }
 const extra={rpg:'方向键移动，撞向敌人进行普通攻击。交互用于任务点、营地和出口；技能效果因职业不同。完成三个目标后前往紫色出口。补给可恢复生命。',racing:'左右控制方向，长按加速或刹车。车况耗尽或超过100秒失败。投递车需要减速到30以下并在包裹附近按投递；氮气共三次；维修需低速。',music:'共八轮，五轮达标获胜。听音题可重复播放，辅助提示会降低得分。节奏题在判定线处敲击，九个事件成功且不多于三次失误达标。长音用按住并松开完成。',cards:'点击牌面选择，再点目标牌堆完成移动。发牌按规则补充牌库；撤销可回退。育空接龙可选择列中任意明牌带着下方牌一起移动。无合法移动时可通过重新开始重开。',sports:'左右调整角度，上下调整力度，点击出手。十次机会中至少五次成功达标。截击用左右移动球拍并点击出手发球；跳远交替点击左右助跑，在起跳线前跳起。'};
 const port=LiteArcade({id:config.id,title:config.title,engine,music:cat==='music',accent:'#83cbbb',controls,hint:config.help,help:config.help+' '+extra[cat],action,
  tap(s,x,y,a){if(cat==='cards'){if(x>500&&y>400){action(s,'waste',a);return;}const boxes=layoutCards(s).filter(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h),b=boxes[boxes.length-1];if(b)action(s,'pile'+b.i+(b.at===undefined?'':':'+b.at),a);}},
  update(s,a){
   if(cat==='music'){for(let i=0;i<7;i++){const b=a.button('choice'+i);b.hidden=i>=s.choices.length;b.textContent=s.choices[i]||'';b.disabled=s.answered;}a.button('next').disabled=!s.answered;a.button('assist').disabled=s.assisted||s.answered||E.timed;}
   if(cat==='cards'){a.button('waste').hidden=!s.waste.length;for(let i=0;i<4;i++)a.button('foundation'+i).hidden=!['calculation','yukon'].includes(m);a.button('deal').hidden=['accordion','yukon'].includes(m);a.button('undo').disabled=!s.hist.length;updateTray(s,a);}
   if(cat==='racing')a.button('special').hidden=!['delivery','pit','pursuit'].includes(m);
   if(cat==='sports'&&['volley','hurdle','longjump'].includes(m)){a.button('less').hidden=true;a.button('more').hidden=true;}
  },status:s=>s.message+(cat==='rpg'?' · 材料 '+s.inventory+' · 生存资源 '+s.resource+' · 回合 '+s.turn:''),
  result:s=>({title:s.won?'挑战成功！':'本局结束',lines:[{label:'得分',value:s.score},{label:'结果',value:s.message}]}),draw
 });
 if(cat==='cards'){cardTray=document.createElement('div');cardTray.setAttribute('role','group');cardTray.setAttribute('aria-label','大按钮选牌区');cardTray.style.cssText='display:flex;flex-wrap:wrap;flex-shrink:0;gap:6px;width:100%;padding:8px;';document.querySelector('.arc-controls').after(cardTray);updateTray(port.state,port);}
})();
