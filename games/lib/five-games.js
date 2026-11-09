(function(){
  'use strict';
  const id=document.body.dataset.game,E=FiveEngines(id),music=['beat-echo','chord-lab'].includes(id);
  const names={'ridge-rally':'山路拉力','neon-traffic':'车流穿梭','beat-echo':'节拍回声','chord-lab':'和弦工坊'};
  const notes=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  function car(g,x,y,color){g.fillStyle='#0005';g.fillRect(x-23,y-34,50,80);g.fillStyle=color;g.fillRect(x-20,y-38,40,76);g.fillStyle='#172b40';g.fillRect(x-15,y-22,30,17);g.fillRect(x-15,y+17,30,12);g.fillStyle='#ffe4a3';g.fillRect(x-17,y-37,9,5);g.fillRect(x+8,y-37,9,5);}
  let cfg={id,title:names[id],engine:E,music,accent:music?'#c08bff':'#68d8c9'};
  if(id==='ridge-rally')Object.assign(cfg,{
    hint:'长按 ← → 转向 · ↑ 加速 · ↓ 刹车 · 80 秒内跑完 3.6 km',
    help:'山路有连续弯道。长按左右方向修正车身，按加速提高速度，急弯前用刹车减速。松开加速仍会缓慢提速。驶离路面会减速并损耗车况；在 80 秒内到达 3.6 km 终点且车况大于零即可获胜。页面暂停或离开时保存进度。',
    controls:[{id:'left',label:'← 左转',keys:['arrowleft','a'],hold:true},{id:'brake',label:'刹车 ↓',keys:['arrowdown','s'],hold:true},{id:'gas',label:'加速 ↑',keys:['arrowup','w'],hold:true},{id:'right',label:'右转 →',keys:['arrowright','d'],hold:true}],action(){},
    status:s=>Math.floor(s.distance)+' / 3600 m · 车况 '+Math.ceil(s.health)+'% · 剩余 '+Math.max(0,Math.ceil(80-s.elapsed))+' 秒',
    result:s=>({title:s.won?'山路征服者！':'拉力赛结束',lines:[{label:'里程',value:Math.floor(s.distance)+' m'},{label:'车况',value:Math.ceil(s.health)+'%'},{label:'得分',value:s.score}]}),
    draw(g,s,a){g.fillStyle='#254d48';g.fillRect(0,0,600,480);for(let y=0;y<480;y+=8){let x=E.center(s.distance+(375-y)*.55);g.fillStyle='#d7b985';g.fillRect(x-96,y,192,8);g.fillStyle='#343d4b';g.fillRect(x-86,y,172,8);if(Math.floor((s.distance+375-y)/28)%2===0){g.fillStyle='#f8e4ab';g.fillRect(x-2,y,4,8);}}car(g,s.x,375,'#f3b56a');a.text('RIDGE RALLY',300,35,23);a.text(Math.round(s.speed)+' km/h',300,465,23);g.fillStyle='#172c38';g.fillRect(18,60,120,10);g.fillStyle='#83e3bd';g.fillRect(18,60,s.health*1.2,10);}
  });
  if(id==='neon-traffic')Object.assign(cfg,{
    hint:'点击 ← → 换道 · 观察前车空隙 · 坚持 60 秒',
    help:'三车道霓虹公路，每批车流都留有一个空道。点击左右键换一条车道，提前避开车辆。碰撞扣一格车况并获得短暂无敌；三格耗尽失败，坚持 60 秒获胜。安全超越车辆可得额外分数。键盘使用左右箭头或 A/D。',
    controls:[{id:'left',label:'← 向左换道',keys:['arrowleft','a']},{id:'right',label:'向右换道 →',keys:['arrowright','d']}],
    action(s,id){E.action(s,id==='left'?-1:1);},
    status:s=>'车况 '+s.lives+' / 3 · 超越 '+s.passed+' 辆 · 剩余 '+Math.max(0,Math.ceil(60-s.elapsed))+' 秒',
    result:s=>({title:s.won?'穿越霓虹车流！':'车流挑战结束',lines:[{label:'超越',value:s.passed+' 辆'},{label:'坚持',value:Math.floor(s.elapsed)+' 秒'},{label:'得分',value:s.score}]}),
    draw(g,s,a){g.fillStyle='#13152d';g.fillRect(0,0,600,480);for(let i=0;i<12;i++){g.fillStyle=i%2?'#423b68':'#254762';g.fillRect(i%2?490:20,(i*91+s.distance)%530-50,80,45);}g.fillStyle='#24283b';g.fillRect(150,0,300,480);g.fillStyle='#c16cf0';g.fillRect(145,0,4,480);g.fillRect(451,0,4,480);for(let y=-40;y<480;y+=60){g.fillStyle='#9cabc0';g.fillRect(248,y+s.distance%60,4,30);g.fillRect(348,y+s.distance%60,4,30);}for(const c of s.traffic)car(g,200+c.lane*100,c.y,['#bc88e8','#e8ae75','#80b7e1'][c.color]);if(!s.invincible||Math.floor(s.elapsed*12)%2)car(g,200+s.lane*100,375,'#65dfbf');a.text('NEON TRAFFIC',300,32,22);}
  });
  if(id==='beat-echo')Object.assign(cfg,{
    hint:'先听四个鼓点，再按空格或点鼓面复奏 · 第一拍由你开始',
    help:'共八轮，每轮听四个鼓点。听完后自由决定第一拍开始时间，之后按相同间隔点四次鼓面；每个间隔允许少量误差。复奏开始后四秒超时。五轮节奏准确即可达标。可以在作答前重听；显示节奏谱后本轮最高分减半。暂停会冻结计时，恢复后听音阶段请等待示意结束再重听。',
    controls:[{id:'listen',label:'▶ 听节奏 R',keys:['r']},{id:'tap',label:'● 敲鼓 / 空格',keys:[' ']},{id:'assist',label:'显示节奏谱',keys:['v']},{id:'next',label:'下一轮 N',keys:['n']}],
    action(s,id,a){if(id==='listen'&&E.listen(s)){const p=E.patterns[s.round],sequence=Array.from({length:p[3]*2+1},(_,i)=>p.includes(i/2)?0:-1);a.tone(sequence,.25);}if(id==='tap'){if(E.tap(s))a.tone([0],.08);}if(id==='assist'&&!s.over)s.assisted=true;if(id==='next')E.next(s);},
    tap(s,x,y,a){if(y>180&&E.tap(s))a.tone([0],.08);},
    update(s,a){a.button('listen').disabled=!['ready','reply'].includes(s.phase)||s.over;a.button('tap').disabled=!['reply','record'].includes(s.phase)||s.over;a.button('next').disabled=s.phase!=='result'||s.over;a.button('assist').disabled=s.assisted||s.over;},
    status:s=>'第 '+Math.min(8,s.round+1)+' / 8 轮 · '+(s.phase==='result'?s.feedback:s.phase==='listen'?'请听鼓点…':s.phase==='reply'?'轮到你了，敲出第一拍':s.phase==='record'?'已敲 '+s.taps.length+' / 4 拍':'点击听节奏开始'),
    result:s=>({title:s.won?'节奏记忆大师！':'节拍练习完成',lines:[{label:'准确轮数',value:s.correct+' / 8'},{label:'得分',value:s.score}]}),
    draw(g,s,a){g.fillStyle='#211c36';g.fillRect(0,0,600,480);a.text('BEAT ECHO',300,45,25,'#d6b9f4');const p=E.patterns[Math.min(7,s.round)],flash=s.phase==='listen'&&p.some(t=>Math.abs(s.clock-t*.5)<.1);g.beginPath();g.ellipse(300,290,125,95,0,0,Math.PI*2);g.fillStyle=flash?'#ffe0a1':'#b879b6';g.fill();g.lineWidth=12;g.strokeStyle='#e5b38a';g.stroke();a.text(s.phase==='listen'?'听':s.phase==='record'?s.taps.length+' / 4':'敲',300,305,38,'#251e3b');if(s.assisted||s.phase==='result'){a.text('节奏谱（圆点间距 = 间隔）',300,95,18);for(const t of p){g.beginPath();g.arc(130+t*65,135,9,0,7);g.fillStyle='#f7ce8c';g.fill();}}a.text('准确 '+s.correct+' 轮 · 得分 '+s.score,300,435,20);}
  });
  if(id==='chord-lab')Object.assign(cfg,{
    hint:'听目标和弦 · 点击三个音组成答案 · 可分别试听每个音',
    help:'十轮大三和弦／小三和弦辨听练习。先听目标和弦，再选择三个音；每次选中会试听该音，再点一次取消。选满三个后提交，答对七轮达标。点击“分解试听”依次播放目标音，分数不变；“显示音名”属于辅助，本轮答对得分减为 50。答完可查看答案，然后下一轮。支持数字键 1–9、0、减号、等号选择十二个音。',
    controls:[{id:'listen',label:'▶ 听和弦 R',keys:['r']},{id:'arp',label:'分解试听',keys:['p']},...notes.map((name,i)=>({id:'note'+i,label:name,keys:[['1','2','3','4','5','6','7','8','9','0','-','='][i]]})),{id:'submit',label:'提交和弦',keys:[' ']},{id:'assist',label:'显示音名',keys:['v']},{id:'next',label:'下一轮 N',keys:['n']}],
    action(s,id,a){const target=s.rounds[Math.min(9,s.round)];if(id==='listen')a.tone([target],1.2);else if(id==='arp')a.tone(target,.5);else if(id.startsWith('note')){let n=Number(id.slice(4));if(E.select(s,n))a.tone([n],.3);}else if(id==='submit')E.submit(s);else if(id==='assist')s.assisted=true;else if(id==='next')E.next(s);},
    update(s,a){for(let i=0;i<12;i++){a.button('note'+i).textContent=(s.selected.includes(i)?'✓ ':'')+notes[i];a.button('note'+i).disabled=s.answered||s.over;}a.button('submit').disabled=s.answered||s.selected.length!==3||s.over;a.button('next').disabled=!s.answered||s.over;a.button('assist').disabled=s.assisted||s.answered||s.over;},
    status:s=>'第 '+Math.min(10,s.round+1)+' / 10 轮 · '+(s.answered?'答案：'+s.rounds[Math.min(9,s.round)].map(n=>notes[n]).join(' + '):'已选 '+s.selected.length+' / 3 个音'),
    result:s=>({title:s.won?'和弦调音师！':'和弦练习完成',lines:[{label:'答对',value:s.correct+' / 10'},{label:'得分',value:s.score}]}),
    draw(g,s,a){g.fillStyle='#17263b';g.fillRect(0,0,600,480);a.text('CHORD LAB',300,45,26,'#b8d5f4');const target=s.rounds[Math.min(9,s.round)];a.text(s.assisted||s.answered?target.map(n=>notes[n]).join(' + '):'听一听，找到三个音',300,100,26,'#f5cd88');for(let i=0;i<12;i++){let x=30+i*45;g.fillStyle=s.selected.includes(i)?'#cf9ae7':notes[i].includes('♯')?'#35465e':'#e6ddce';g.fillRect(x,180,40,160);a.text(notes[i],x+20,310,17,s.selected.includes(i)||!notes[i].includes('♯')?'#25223b':'#e6ddce');}a.text('选中：'+s.selected.map(n=>notes[n]).join(' · '),300,395,22);a.text('答对 '+s.correct+' 轮',300,440,20);}
  });
  LiteArcade(cfg);
})();
