(function(){
  'use strict';
  var id=document.body.dataset.game,E=ChroniclesEngines(id),C=Chogan,el=C.el;
  var info={starfarm:['星砂牧场','种植、钓鱼与订单，让荒废牧场重新开张。','#9ec681','☘'],runetraveler:['符文旅人','构筑牌组，选择路线，挑战九场符文试炼。','#c49fe1','◇'],caravan:['口袋商队','低买高卖，升级商队，连通五座城镇。','#dfbc80','⚑'],wardens:['遗迹守望者','三人小队，六座遗迹，回合制战术。','#8ebaca','♜'],island:['荒岛手记','采集、制作、寻找航海手记，修船归乡。','#87c4ad','⚓'],magictower:['百层魔塔','计算战斗损伤，规划强化与钥匙，抵达第一百层。','#ba9bd7','♜']}[id];
  C.boot({});var ctx=C.game({id:id,name:{zh:info[0],en:info[0]},accent:info[2],scroll:true});
  var store=CampaignSave(id,E,{getItem:function(k){return localStorage.getItem(k);},setItem:function(k,v){localStorage.setItem(k,v);}}),loaded=store.load(),S=loaded.state||E.newGame(),locked=['corrupt','version','unavailable'].includes(loaded.status),notice='',error=false;
  var main=el('div',{class:'cp-main'}),side=el('aside',{class:'cp-side'}),saveStatus=el('div',{class:'cp-save-status',role:'status'}),wrap=el('div',{class:'cp-wrap'}),sheet=el('div',{class:'cp-sheet',hidden:''}),dialog=el('section',{class:'cp-dialog',role:'dialog','aria-modal':'true','aria-label':'游戏菜单'});
  var file=el('input',{type:'file',accept:'.json,application/json',class:'cp-hidden'}),returnFocus=null;
  var toolbar=el('div',{class:'cp-toolbar'},[button('玩法',help),button('存档',saveMenu),button('重新开始',function(){confirm('开始新旅程？当前有效存档会保留为备份。建议先导出。',function(){replace(E.newGame());});})]);
  wrap.append(el('header',{class:'cp-banner'},[el('div',{},[el('h1',{text:info[0]}),el('small',{text:info[1]})]),el('b',{text:info[3],style:{'font-size':'36px','color':info[2]}})]),toolbar,el('div',{class:'cp-body'},[main,side]),saveStatus);
  ctx.main.appendChild(wrap);ctx.button({icon:'help',label:'玩法说明',onClick:help});ctx.mount();sheet.appendChild(dialog);document.body.append(sheet,file);
  function button(text,fn,disabled,cls){var b=el('button',{class:'cp-btn'+(cls?' '+cls:''),type:'button',text:text});b.disabled=!!disabled;b.addEventListener('click',fn);return b;}
  function action(text,a,n,disabled,cls){var b=button(text,function(){act(a,n);},disabled,cls);b.dataset.action=a;if(n!==undefined)b.dataset.value=String(n);return b;}
  function p(t){return el('p',{text:t});}
  function panel(title,children){return el('section',{class:'cp-panel'},[el('h2',{text:title})].concat(children||[]));}
  function stats(items){return el('div',{class:'cp-stats'},items.map(function(t){return el('span',{class:'cp-stat',text:t});}));}
  function row(name,desc,buttons){return el('div',{class:'cp-row'},[el('div',{},[el('strong',{text:name}),el('small',{text:desc})]),el('div',{class:'cp-actions'},buttons)]);}
  function svgText(text,x,y,size,fill,weight){return '<text x="'+x+'" y="'+y+'" font-family="system-ui,sans-serif" font-size="'+size+'" fill="'+fill+'" font-weight="'+(weight||600)+'">'+text+'</text>';}
  function sceneSvg(name){
    var common='<defs><linearGradient id="cp-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#172742"/><stop offset="1" stop-color="#6b9b9a"/></linearGradient><linearGradient id="cp-night" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#11152e"/><stop offset="1" stop-color="#493b68"/></linearGradient><filter id="cp-glow"><feGaussianBlur stdDeviation="4"/></filter></defs>';
    var s=common+'<rect width="760" height="230" rx="14" fill="#17242b"/>';
    if(id==='starfarm'){
      s+='<rect width="760" height="230" rx="14" fill="url(#cp-sky)"/><circle cx="650" cy="43" r="25" fill="#ffe4a0"/><circle cx="650" cy="43" r="39" fill="#ffe4a0" opacity=".18" filter="url(#cp-glow)"/><path d="M0 145 Q150 88 300 143 T760 125V230H0Z" fill="#365d50"/><path d="M0 175 Q200 132 380 176 T760 158V230H0Z" fill="#244638"/><rect x="42" y="108" width="116" height="76" rx="4" fill="#a85f4a"/><path d="M32 111 100 62l70 49Z" fill="#593c4f"/><rect x="87" y="138" width="27" height="46" fill="#4a3540"/><circle cx="62" cy="145" r="12" fill="#e2ba65"/><path d="M196 178h285v34H196Z" fill="#765333"/>';
      for(var i=0;i<9;i++){var x=210+(i%3)*92,y=130+Math.floor(i/3)*29,g=S.plots[i]&&S.plots[i].crop;s+='<rect x="'+x+'" y="'+y+'" width="78" height="22" rx="5" fill="'+(g?'#527c47':'#8b6340')+'" stroke="#c39b5b"/><path d="M'+(x+39)+' '+(y+17)+'v-8m-8 3 8-6 8 6" stroke="'+(g?'#b8d870':'#b08352')+'" stroke-width="3" fill="none"/>';}
      s+='<path d="M530 181q12-55 25-70 13 15 25 70Z" fill="#315c45"/><circle cx="555" cy="93" r="25" fill="#4d8654"/><circle cx="535" cy="105" r="20" fill="#568e5a"/><circle cx="575" cy="105" r="20" fill="#568e5a"/>'+svgText(name,22,31,18,'#fff1c7',800)+svgText('第 '+S.day+' 天 · 田园与收成',22,52,12,'#d8e8d1',500);
    } else if(id==='runetraveler'){
      s+='<rect width="760" height="230" rx="14" fill="url(#cp-night)"/><circle cx="610" cy="55" r="43" fill="#d8c4ff" opacity=".18"/><circle cx="610" cy="55" r="22" fill="#e5d9ff"/><path d="M0 183 135 109l125 65 120-74 150 73 130-83 130 72v68H0Z" fill="#202b4a"/><path d="M60 190 C190 151 260 185 355 151 S570 161 700 132" fill="none" stroke="#d9a7ff" stroke-width="4" stroke-dasharray="9 8"/>';
      for(var r=0;r<5;r++){var rx=100+r*132,ry=168-(r%2)*25;s+='<circle cx="'+rx+'" cy="'+ry+'" r="13" fill="'+(r<S.stage?'#8b6bb9':'#302b58')+'" stroke="#e4c8ff" stroke-width="2"/><path d="M'+(rx-5)+' '+ry+'h10M'+rx+' '+(ry-5)+'v10" stroke="#fff1bd" stroke-width="2"/>';}
      s+='<path d="M520 155l18-42 18 42-18 25Z" fill="#b38bd4" stroke="#f5d6ff" stroke-width="3"/><circle cx="538" cy="105" r="14" fill="#e8c9ff"/><path d="M513 178q25-18 50 0" fill="#6f4d9a"/>'+svgText(name,22,31,18,'#fff1d4',800)+svgText('第 '+S.stage+' / 9 战 · 符文之路',22,52,12,'#e0d0f3',500);
    } else if(id==='caravan'){
      s+='<rect width="760" height="230" rx="14" fill="#e6b878"/><circle cx="650" cy="44" r="28" fill="#fff0ae"/><path d="M0 124 120 54l105 70 116-92 115 92 130-62 174 62v106H0Z" fill="#8b604d"/><path d="M0 174q190-40 350 0t410-8v64H0Z" fill="#d39b59"/><path d="M65 230q120-75 250-45t180-18q95-31 200 63" fill="none" stroke="#8f5e42" stroke-width="18" opacity=".75"/><path d="M278 183h130l-20 42H296Z" fill="#a76342" stroke="#543f43" stroke-width="4"/><path d="M295 183v-45h95v45" fill="#d07a50" stroke="#543f43" stroke-width="4"/><path d="M282 140h122l-61-37Z" fill="#704b59"/><circle cx="305" cy="222" r="17" fill="#3a3540"/><circle cx="381" cy="222" r="17" fill="#3a3540"/><path d="M442 185q22-40 44 0m-37 0q22-29 44 0" stroke="#4c3f3b" stroke-width="8" fill="none"/>'+svgText(name,22,31,18,'#4c3440',800)+svgText(E.cities[S.city]+' · 第 '+S.day+' 天 · 商路',22,52,12,'#704b42',600);
    } else if(id==='wardens'){
      s+='<rect width="760" height="230" rx="14" fill="#202e3c"/><path d="M0 0h760v230H0Z" fill="#314452"/><path d="M0 185 130 35h75l-70 195H0Zm540 45L610 35h80l-48 195Z" fill="#596878" opacity=".55"/><rect x="178" y="24" width="410" height="178" rx="10" fill="#1c2935" stroke="#91b1b4" stroke-width="3"/>';
      for(var gy=0;gy<7;gy++)for(var gx=0;gx<7;gx++)s+='<rect x="190" y="35" width="54" height="22" transform="translate('+(gx*55)+' '+(gy*23)+')" fill="'+((gx+gy)%2?'#304550':'#273b44')+'" stroke="#5e7476"/>';
      var roles=['#e2b86b','#8bc8e1','#b58be0'];for(var u=0;u<S.units.length;u++){var up=S.units[u].pos,ux=190+(up%7)*55+27,uy=46+Math.floor(up/7)*23;s+='<circle cx="'+ux+'" cy="'+uy+'" r="10" fill="'+roles[u]+'" stroke="#fff4cf" stroke-width="2"/><path d="M'+(ux-6)+' '+(uy+6)+'h12" stroke="#24313c" stroke-width="3"/>';}
      for(var q=0;q<S.enemies.length;q++){if(!S.enemies[q].hp)continue;var ep=S.enemies[q].pos,ex=190+(ep%7)*55+27,ey=46+Math.floor(ep/7)*23;s+='<path d="M'+ex+' '+(ey-10)+'l10 18h-20Z" fill="#ca777d" stroke="#ffe1bb" stroke-width="2"/>';}
      s+=svgText(name,22,31,18,'#f4dfb5',800)+svgText('遗迹 '+S.mission+' / 6 · 第 '+S.round+' 回合',22,52,12,'#bfd1d0',500);
    } else if(id==='island'){
      s+='<rect width="760" height="230" rx="14" fill="#4e9da9"/><path d="M0 0h760v35H0Z" fill="#86d1c5" opacity=".35"/><path d="M0 170q140-25 280 5t270-4q120-25 210 8v51H0Z" fill="#e5c47b"/><path d="M0 199q190-35 370 5t390-3v29H0Z" fill="#c49a61"/><path d="M184 171q45-90 100 0Z" fill="#486947"/><path d="M220 169V66" stroke="#684a3d" stroke-width="8"/><path d="M220 75q-62-30-79 12 55-7 79 16 23-44 86-27-34-45-86-1Z" fill="#397a59"/><path d="M500 191q58-48 115 2l-13 21H512Z" fill="#9b5a42" stroke="#513f46" stroke-width="4"/><path d="M555 194v-49" stroke="#513f46" stroke-width="4"/><path d="M555 146l38 30h-38Z" fill="#ecd594"/><path d="M80 190q14-30 28 0m-14-17v-20" stroke="#e6dfab" stroke-width="5"/>'+svgText(name,22,31,18,'#f5f3cf',800)+svgText(E.zones[S.zone]+' · 第 '+S.day+' 天 · 海岛',22,52,12,'#d9f1df',500);
    } else {
      s+='<rect width="760" height="230" rx="14" fill="url(#cp-night)"/><path d="M135 210V55l38-31h414l38 31v155Z" fill="#36394c" stroke="#b28ec7" stroke-width="4"/><path d="M173 55h414M173 92h414M173 129h414M173 166h414" stroke="#5e6076" stroke-width="3"/><path d="M173 55v155M242 55v155M311 55v155M380 55v155M449 55v155M518 55v155" stroke="#5e6076" stroke-width="3"/>';
      s+='<circle cx="381" cy="145" r="13" fill="#e1b66e" stroke="#fff0bc" stroke-width="3"/><path d="M365 165q16-20 32 0" fill="#8b5b9c"/><path d="M210 79l-7 17h14Z M550 79l-7 17h14Z" fill="#d7a3e5"/><rect x="270" y="177" width="22" height="25" fill="#c7925b"/><rect x="470" y="177" width="22" height="25" fill="#c7925b"/>'+svgText(name,22,31,18,'#f0dcff',800)+svgText('第 '+S.floor+' / 100 层 · 封印之塔',22,52,12,'#d9c7eb',500);
    }
    // 状态反馈层：场景中的光效、标记和角色状态随操作变化，而不是一张
    // 永远不变的装饰图。它们只读游戏状态，不参与规则计算。
    if(id==='starfarm'){
      if(S.tool==='water'){
        for(var d=0;d<7;d++)s+='<path class="cp-scene-rain" d="M'+(225+d*45)+' 112l-5 12" stroke="#bde8f2" stroke-width="3" stroke-linecap="round"/>';
      }
      if(S.plots.some(function(p){return p.crop&&p.age>=2;}))s+='<circle class="cp-scene-pulse" cx="430" cy="136" r="18" fill="none" stroke="#d6ee86" stroke-width="3"/>';
    } else if(id==='runetraveler'){
      if(S.phase==='battle')s+='<circle class="cp-scene-pulse" cx="538" cy="128" r="28" fill="none" stroke="#ef9aaf" stroke-width="4"/><path class="cp-scene-spark" d="M505 117l-12-12m49 3 11-15m-1 40 16 8" stroke="#ffe7a4" stroke-width="3" stroke-linecap="round"/>';
      else s+='<path class="cp-scene-fire" d="M390 172q-13-28 8-36-3 17 9 20 12-19 18 4 3 18-18 22-15-1-17-10Z" fill="#f0a75b"/>';
    } else if(id==='caravan'){
      if(S.event==='bandits')s+='<g class="cp-scene-alert"><path d="M535 107l22 40h-44Z" fill="#b95c5c" stroke="#ffe3a7" stroke-width="3"/>'+svgText('!',548,137,27,'#fff3c0',900)+'</g>';
      else if(S.event==='traveler')s+='<g class="cp-scene-spark"><circle cx="535" cy="137" r="17" fill="#8bd2c2"/><path d="M520 167q15-27 30 0" fill="#4b7690"/></g>';
      else s+='<path d="M444 185h72" stroke="#fff0be" stroke-width="3" stroke-dasharray="8 7" opacity=".7"/>';
    } else if(id==='wardens'){
      if(S.phase==='battle'&&S.units[S.selected]&&S.units[S.selected].hp){var sp=S.units[S.selected].pos,sx=190+(sp%7)*55+27,sy=46+Math.floor(sp/7)*23;s+='<rect class="cp-scene-selected" x="'+(sx-19)+'" y="'+(sy-19)+'" width="38" height="38" rx="8" fill="none" stroke="#ffe59a" stroke-width="3"/>';}
      s+='<path d="M636 190h76" stroke="#d5e5d1" stroke-width="4" stroke-linecap="round"/><path d="M636 190h'+Math.max(8,76-Math.min(76,S.enemies.reduce(function(n,e){return n+(e.hp>0?e.hp:0);},0)))+'" stroke="#d2787c" stroke-width="4" stroke-linecap="round"/>';
    } else if(id==='island'){
      var madeCount=S.made.length;s+='<g class="cp-scene-craft">'+svgText('制作 '+madeCount+'/7',625,202,12,'#fff1c2',800)+'<path d="M626 211h92" stroke="#172f35" stroke-width="5"/><path d="M626 211h'+Math.min(92,madeCount*13)+'" stroke="#d8c16d" stroke-width="5"/></g>';
      if(S.zone===3)s+='<circle class="cp-scene-pulse" cx="92" cy="166" r="17" fill="none" stroke="#b6d7ec" stroke-width="3"/>';
    } else if(id==='magictower'){
      var tx=173+(S.pos%9)*69+34,ty=55+Math.floor(S.pos/9)*37+18;s+='<rect class="cp-scene-selected" x="'+(tx-18)+'" y="'+(ty-18)+'" width="36" height="36" rx="7" fill="none" stroke="#ffe79d" stroke-width="3"/>';
      if(S.floor%10===0)s+='<circle class="cp-scene-pulse" cx="381" cy="77" r="20" fill="none" stroke="#df9ee8" stroke-width="4"/>';
    }
    return '<svg class="cp-scene-svg" viewBox="0 0 760 230" role="img" aria-label="'+name+'场景" preserveAspectRatio="xMidYMid slice">'+s+'</svg>';
  }
  function art(name,symbol){return el('div',{class:'cp-scene',role:'img','aria-label':name,html:sceneSvg(name)});}
  function show(title){returnFocus=sheet.hidden?document.activeElement:returnFocus;dialog.replaceChildren(el('h2',{text:title}));sheet.hidden=false;wrap.inert=true;ctx.bar.inert=true;}
  function close(){if(locked)return;sheet.hidden=true;wrap.inert=false;ctx.bar.inert=false;if(returnFocus&&returnFocus.isConnected)returnFocus.focus();}
  function dismiss(){var b=button('返回游戏',close);dialog.appendChild(b);b.focus();}
  function confirm(text,fn){show('请确认');dialog.append(p(text),button('确认',fn,false,'cp-btn--primary'));dismiss();}
  function persist(){if(locked)return false;var out=store.save(S);error=!out.ok;notice=out.ok?'已自动保存 · 本地进度':out.reason==='conflict'?'另一标签页更新了存档，请重新载入。':'保存失败，请导出进度文件。';saveStatus.textContent=notice;saveStatus.toggleAttribute('data-error',error);if(out.reason==='conflict'){locked=true;recovery('conflict');}return out.ok;}
  function act(a,n){if(locked||!sheet.hidden)return;var ok=a==='revive'&&E.revive?E.revive(S):E.act(S,a,n);if(ok){persist();render();}else render();}
  function replace(s){var out=store.replace(s);if(!out.ok){dialog.append(p('保存失败，原进度未覆盖。请重新载入或检查存储权限。'));return;}S=s;locked=false;error=false;notice='新进度已保存';close();render();}
  function exportSave(){try{var url=URL.createObjectURL(new Blob([store.encode(S)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=id+'-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},5000);}catch(e){dialog.append(p(e.message));}}
  function saveMenu(){show('存档与备份');dialog.append(p('每次有效操作后保存。通关后保留进度；离线期间游戏不会自动推进。\n'+notice),button('导出存档 .json',exportSave,false,'cp-btn--primary'),button('导入存档文件',function(){file.value='';file.click();}),button('恢复上一份备份',function(){var b=store.backup();if(b)confirm('将载入上一份有效进度，当前进度会保留为备份。',function(){replace(b);});else dialog.append(p('没有有效备份。'));}),button('重新载入',function(){location.reload();}),p('存档在当前浏览器和域名下。清除网站数据会删除本地进度，换设备请导出再导入。'));dismiss();}
  function recovery(reason){show('存档需要处理');dialog.append(p({conflict:'另一标签页修改了进度，此页已停止覆盖。',corrupt:'主存档和备份均无效，已停止自动覆盖。',version:'发现更高版本的存档，请使用对应版本的游戏。',unavailable:'浏览器存储不可用，请允许此站点保存数据。'}[reason]),button('重新载入',function(){location.reload();}),button('导入备份文件',function(){file.value='';file.click();}));if(reason==='conflict')dialog.append(button('导出此页进度',exportSave));if(reason==='corrupt')dialog.append(button('确认放弃损坏存档并重开',function(){replace(E.newGame());}));dialog.querySelector('button').focus();}
  var helps={
    starfarm:'目标：建设水井、厨房、鱼塘，并完成 8 份商会订单。\n选择作物后点空地播种；切换浇水，每天浇水后点击结束一天才会成长；成熟后切换收获。每次收获会留下一份种子，因此不会因缺钱而卡死。\n水井增加体力，厨房将 2 份麦子烤成面包，鱼塘每次钓鱼消耗 3 体力。可以出售收成或提交订单。天数由你主动推进，没有离线枯萎。',
    runetraveler:'目标：完成 9 场战斗，击败封印之主。\n每回合 3 能量，点击手牌打出。护盾吸收当前回合伤害，下回合重置；灼烧在敌人行动前结算。留意敌人每三回合一次的蓄力重击。\n胜利后选卡或跳过；路线可选营火回复、普通战斗或精英战斗。金币可以买回复、永久护盾遗物或移除卡牌。倒下后可在营火恢复，牌组保留、金币减半，重试当前战斗。',
    caravan:'目标：完成 6 份商会委托，货车升到 2 级，声望达到 12。\n城市特产价格低，异地出售通常更划算。买卖以当前价格成交，卖价是标价的九折。旅行推进天数并改变行情，货舱容量有限。\n委托必须在指定城市交货；途中可遇盗匪或旅人，护卫减少风险。没钱时可打工一天赚 12 金币，不会破产卡死。',
    island:'目标：收集四片航海手记，造好船身、船帆和灯标，出航获救。\n海滩产食物和漂流木，泉水产饮水与叶片，森林产木材，洞穴产石料与矿石。石斧解锁森林，石镐解锁洞穴。\n采集消耗体力，休息恢复体力并消耗食物和水。营地降低过夜消耗，篝火提升回血。不足补给时会虚弱，但仍能采集海滩和泉水恢复。每天只在你点击休息时推进。',
    wardens:'目标：三人小队完成 6 关。\n点击己方单位选中，再点空格移动或敌人攻击。每人每回合 2 行动点，一次移动最多 3 格；剑卫射程 1，游侠 4，医师 2，石墙会挡住射线。医师还能治疗 3 格内队友。\n结束回合后敌人会移动并近战攻击。先利用游侠射程削弱敌人，再由剑卫拦截。胜利进入营地，可升级小队再继续；失败可重试当前关，成长保留。',
    magictower:'目标：登上 100 层，解除最后封印。\n按方向键/WASD、屏幕方向按钮或相邻格移动。踏入敌人格自动进行确定性战斗，右侧列出本层敌人属性与预计损伤，致命战斗会被阻止。\n剑 +3 攻击，盾 +2 防御，药水恢复生命，钥匙开门。每 5 层有商店，每 10 层必须击败守层者才能上楼。可以下楼回收遗漏资源，不会重复获得已经拿过的物品。'};
  function help(){show(info[0]+' · 玩法');dialog.append(p(helps[id]));dismiss();}
  file.addEventListener('change',async function(){var f=file.files[0];if(!f)return;try{if(f.size>900000)throw Error('文件过大。');var incoming=store.decode(await f.text());confirm('存档已通过校验。确认替换当前进度？',function(){replace(incoming);});}catch(e){dialog.append(p('导入失败：'+e.message+' 原存档未改动。'));}});
  window.addEventListener('storage',function(e){if((e.key===store.key||e.key===null)&&store.changed()){locked=true;recovery('conflict');}});
  window.addEventListener('pagehide',persist);C.onPause(persist);ctx.save=persist;
  window.addEventListener('keydown',function(e){if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(!sheet.hidden){if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){var ns=Array.from(dialog.querySelectorAll('button:not(:disabled)'));if(e.shiftKey&&document.activeElement===ns[0]){e.preventDefault();ns[ns.length-1].focus();}else if(!e.shiftKey&&document.activeElement===ns[ns.length-1]){e.preventDefault();ns[0].focus();}}return;}if(e.key==='Escape'){e.preventDefault();saveMenu();return;}if(id==='magictower'){var dir={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];if(dir){e.preventDefault();if(!e.repeat)act('move',dir);}}});
  function render(){
    var focused=document.activeElement,focusAction=focused&&focused.dataset.action,focusValue=focused&&focused.dataset.value;
    main.replaceChildren();side.replaceChildren();views[id]();
    if(S.won)main.prepend(panel('旅程完成', [p('恭喜完成主线！进度已永久保留。可导出通关存档；支持自由游玩的作品可以继续。'),button('导出通关存档',exportSave,false,'cp-btn--primary')]));
    side.append(panel('旅行手记',[el('ul',{class:'cp-log'},S.log.map(function(t){return el('li',{text:t});}))]));saveStatus.textContent=notice;saveStatus.toggleAttribute('data-error',error);
    if(focusAction){var match=Array.from(wrap.querySelectorAll('button[data-action]')).find(function(b){return b.dataset.action===focusAction&&b.dataset.value===focusValue&&!b.disabled;});if(match)match.focus({preventScroll:true});}
  }
  var views={};
  views.starfarm=function(){
    var names={turnip:'星萝卜',berry:'月莓',wheat:'金麦',fish:'星砂鱼',bread:'麦香面包'};
    main.append(art('第 '+S.day+' 天 · 星砂牧场','☘'),stats(['金币 '+S.gold,'体力 '+S.energy,'订单 '+S.orders+'/8']));
    var tools=el('div',{class:'cp-actions'});Object.keys(E.crops).forEach(function(k){var b=action('种'+names[k]+' ×'+S.seeds[k],'crop',k);b.toggleAttribute('data-selected',S.tool==='plant'&&S.selectedCrop===k);tools.appendChild(b);});['water','harvest'].forEach(function(k){var b=action(k==='water'?'浇水':'收获','tool',k);b.toggleAttribute('data-selected',S.tool===k);tools.appendChild(b);});
    var grid=el('div',{class:'cp-grid'});S.plots.forEach(function(p,i){var name=p.crop?names[p.crop]:'空地',desc=p.crop?p.age>=E.crops[p.crop].days?'成熟 · 可收获':p.age+'/'+E.crops[p.crop].days+' 天 · '+(p.watered?'已浇水':'需浇水'):'点选播种';var b=action(name+'\n'+desc,'plot',i,false,'cp-plot');b.toggleAttribute('data-grown',!!p.crop&&p.age>=E.crops[p.crop].days);grid.appendChild(b);});main.append(panel('九格田园',[tools,grid,action('结束一天 · 恢复体力','sleep',undefined,false,'cp-btn--primary')]));
    var o=E.order(S);side.append(panel('商会订单',[p(names[o.item]+' ×'+o.n+' → '+o.pay+' 金币'),action('交付订单','order',undefined,S.stock[o.item]<o.n)]));
    var inventory=panel('仓库与种子');Object.keys(S.stock).forEach(function(k){inventory.append(row(names[k]+' ×'+S.stock[k],E.crops[k]?'售价 '+E.crops[k].sell:'加工与订单材料',[action('出售 1','sell',k,S.stock[k]===0)]));});Object.keys(E.crops).forEach(function(k){inventory.append(action('买'+names[k]+'种子 · '+E.crops[k].cost+' G','seed',k,S.gold<E.crops[k].cost));});side.append(inventory);
    main.append(panel('牧场设施',[el('div',{class:'cp-actions'},['well','kitchen','pond'].map(function(k){return action(({well:'水井 50G',kitchen:'厨房 75G',pond:'鱼塘 60G'}[k])+(S.buildings[k]?' ✓':''),'build',k,S.buildings[k]||S.gold<({well:50,kitchen:75,pond:60}[k]));})),el('div',{class:'cp-actions'},[action('烤面包 · 2 麦 / 1 体力','cook',undefined,!S.buildings.kitchen||S.stock.wheat<2||S.energy<1),action('钓鱼 · 3 体力','fish',undefined,!S.buildings.pond||S.energy<3)])]));
  };
  views.runetraveler=function(){
    main.append(art('第 '+S.stage+' / 9 战 · 符文之路','◇'),stats(['生命 '+S.hp+'/'+S.maxHp,'金币 '+S.gold,'牌组 '+S.deck.length,'遗物护盾 '+S.relic]));
    if(S.phase==='route')main.append(panel('选择下一段旅程',[p('营火路线较稳妥；精英敌人更强，金币更多。'),el('div',{class:'cp-actions'},[action('营火 +16 生命','route','rest'),action('普通战斗','route','safe'),action('精英挑战','route','elite')]),el('div',{class:'cp-actions'},[action('补给 +22 HP · 20G','heal',undefined,S.gold<20||S.hp===S.maxHp),action('护盾遗物 +2 · 40G','relic',undefined,S.gold<40||S.relic>=6)])]));
    if(S.phase==='battle'){var e=S.enemy,intent=e.turn%3===1?'蓄力，下回合重击':e.turn%3===2?'重击 '+e.atk*2:'攻击 '+e.atk;main.append(panel('符文对决',[el('div',{class:'cp-enemy'},[el('div',{class:'cp-sigil',text:S.stage===9?'♛':'♟'}),el('div',{},[el('strong',{text:'敌人生命 '+e.hp+'/'+e.max}),p('意图：'+intent+'\n灼烧 '+e.poison)])]),stats(['能量 '+S.energy+'/3','护盾 '+S.block,'抽牌堆 '+S.draw.length,'弃牌堆 '+S.discard.length])]));var cards=el('div',{class:'cp-cards'});S.hand.forEach(function(k,i){var c=E.cards[k],b=action(c.name+' · '+c.cost,'play',i,c.cost>S.energy,'cp-card');b.appendChild(el('small',{text:c.text}));cards.appendChild(b);});main.append(cards,action('结束回合','end',undefined,false,'cp-btn--primary'));}
    if(S.phase==='reward')main.append(panel('选择战利品',[el('div',{class:'cp-actions'},S.rewards.map(function(k){return action(E.cards[k].name+' · '+E.cards[k].text,'reward',k);})),action('跳过，不增加卡牌','reward','skip')]));
    if(S.dead)main.append(panel('营火重整',[p('恢复生命并重试本战。保留牌组和遗物，金币减半。'),action('重整旗鼓','revive',undefined,false,'cp-btn--primary')]));
    var deck=panel('旅人的牌组');S.deck.forEach(function(k,i){deck.append(row(E.cards[k].name,E.cards[k].text,[action('移除 20G','remove',i,S.phase!=='route'||S.gold<20||S.deck.length<=5)]));});side.append(deck);
  };
  views.caravan=function(){
    main.append(art(E.cities[S.city]+' · 第 '+S.day+' 天','⚑'),stats(['金币 '+S.gold,'载货 '+S.cargo.reduce(function(a,b){return a+b;},0)+'/'+E.capacity(S),'声望 '+S.reputation,'护卫 '+S.guards]));
    if(S.event){var b=S.event==='bandits';main.append(panel(b?'山路上的盗匪':'路旁的旅人',[p(b?'支付路费，或依靠护卫。没有护卫也能绕路，但会损失少量物资。':'送出一份麦粮，可以获得声望与谢礼。'),el('div',{class:'cp-actions'},b?[action('支付路费','event','pay'),action('护卫 / 绕路','event','guard')]:[action('赠予麦粮','event','give',S.cargo[0]<1),action('继续赶路','event','leave')])]));}
    var market=panel('今日市场');E.goods.forEach(function(g,i){var pr=E.price(S,i);market.append(row(g.name+' ×'+S.cargo[i],'买价 '+pr+' / 卖价 '+Math.floor(pr*.9),[action('买 1','buy',i,!!S.event||S.gold<pr||S.cargo.reduce(function(a,b){return a+b;},0)>=E.capacity(S)),action('卖 1','sell',i,!!S.event||S.cargo[i]===0)]));});main.append(market,panel('商路',[el('div',{class:'cp-actions'},E.cities.map(function(c,i){return action(c,'travel',i,i===S.city||!!S.event);})),p('每次出行推进天数，行情随之变化。') ]));
    var c=E.contract(S);side.append(panel('商会委托 '+S.deliveries+'/6',[p('前往'+E.cities[c.city]+'，交付'+E.goods[c.item].name+' ×'+c.n+'\n报酬 '+c.pay+' 金币、声望 +2'),action('交付委托','contract',undefined,!!S.event||S.city!==c.city||S.cargo[c.item]<c.n)]),panel('商队建设',[p('主线需要货车等级 2、声望 12、完成 6 单。'),action('升级货车 Lv.'+S.cart+' · '+80*(S.cart+1)+'G','cart',undefined,!!S.event||S.cart>=3||S.gold<80*(S.cart+1)),action('雇护卫 60G','guard',undefined,!!S.event||S.guards>=2||S.gold<60),action('打工一天 +12G','work',undefined,!!S.event)]));
  };
  views.island=function(){
    main.append(art(E.zones[S.zone]+' · 第 '+S.day+' 天','⚓'),stats(['生命 '+S.hp+'/80','体力 '+S.energy,'食物 '+S.food,'饮水 '+S.water]),panel('探索与采集',[el('div',{class:'cp-actions'},[action('采集资源 · 2 体力','gather',undefined,S.energy<2||S.won),action('搜索手记 · 3 体力','search',undefined,S.energy<3||S.won),action('吃点食物 +12 HP','eat',undefined,!S.food||S.hp===80||S.won)]),el('div',{class:'cp-actions'},E.zones.map(function(z,i){return action(z,'travel',i,i===S.zone||S.energy<1||S.won||i===2&&!S.made.includes('axe')||i===3&&!S.made.includes('pick'));})),action('休息过夜 · 消耗食物和水','rest',undefined,S.won,'cp-btn--primary')]));
    var labels={wood:'木材',stone:'石料',leaf:'叶片',ore:'铁矿'};side.append(panel('营地仓库',[stats(Object.keys(labels).map(function(k){return labels[k]+' '+S[k];})),p('手记 '+S.relics.length+'/4\n每个地区搜索一次可获得一片手记。') ]));
    var craft=panel('制作与修复');Object.keys(E.recipes).forEach(function(k){var r=E.recipes[k],made=S.made.includes(k);craft.append(row(E.names[k],Object.keys(r).map(function(j){return labels[j]+' '+r[j];}).join(' / '),[action(made?'已建成':'制作','craft',k,made||S.won||!Object.keys(r).every(function(j){return S[j]>=r[j];}))]));});main.append(craft);side.append(panel('回家的航路',[p('修复船身、制作船帆和灯标，收齐四页手记。'),action('扬帆归乡','rescue',undefined,S.won||S.relics.length<4||!['hull','sail','beacon'].every(function(k){return S.made.includes(k);}), 'cp-btn--primary')]));
  };
  views.wardens=function(){
    main.append(art('遗迹 '+S.mission+' / 6 · 第 '+S.round+' 回合','♜'),stats(['营地金币 '+S.gold,'训练等级 '+S.level]));
    var grid=el('div',{class:'cp-board',role:'group','aria-label':'七乘七战术棋盘'});
    for(var i=0;i<49;i++){var u=S.units.find(function(u){return u.hp>0&&u.pos===i;}),e=S.enemies.find(function(e){return e.hp>0&&e.pos===i;}),text=u?['♜','➶','✚'][u.role]:e?'♟':S.walls.includes(i)?'▧':'·';var b=action(text,'cell',i,S.phase!=='battle','cp-cell');b.setAttribute('aria-label','格 '+i+(u?' '+E.roles[u.role]:e?' 敌人':''));if(u||e)b.appendChild(el('small',{text:(u||e).hp+' HP'}));b.toggleAttribute('data-wall',S.walls.includes(i));b.toggleAttribute('data-selected',!!u&&u===S.units[S.selected]);grid.appendChild(b);}main.append(grid);
    var units=panel('小队');S.units.forEach(function(u,i){units.append(row(E.roles[i]+' '+u.hp+'/'+u.max,'行动点 '+u.ap,[action('选中','select',i,!u.hp||S.phase!=='battle'),action('治疗','heal',i,S.phase!=='battle'||S.units[S.selected].role!==2||!S.units[S.selected].ap||u.hp<=0||u.hp===u.max||E.distance(u.pos,S.units[S.selected].pos)>3)]));});side.append(units,panel('战术提示',[p('先点己方单位，再点空格移动、敌人攻击。移动最多三格；每人每回合两点行动。游侠射程四格，医师能治疗。')]));
    if(S.phase==='battle')main.append(action('结束小队回合','end',undefined,false,'cp-btn--primary'));
    if(S.phase==='camp')main.append(panel('胜利营地',[p('下一关会完全恢复小队生命。'),action('训练全队 +属性 · 30G','upgrade',undefined,S.gold<30||S.level>=5),action('前往下一座遗迹','next',undefined,false,'cp-btn--primary')]));
    if(S.phase==='defeat')main.append(action('重试当前关卡','retry',undefined,false,'cp-btn--primary'));
  };
  views.magictower=function(){
    main.append(art('第 '+S.floor+' / 100 层','♜'),stats(['生命 '+S.hp,'攻击 '+S.atk,'防御 '+S.def,'钥匙 '+S.keys,'金币 '+S.gold]));var grid=el('div',{class:'cp-board cp-tower',role:'group','aria-label':'魔塔楼层'}),symbols={'#':'▧','.':'',key:'⚿',potion:'♥',enemy:'♟',boss:'♛',attack:'⚔',defense:'⛨',door:'▣',up:'▲',down:'▼',shop:'商',coin:'●'};
    for(var i=0;i<81;i++){var t=E.current(S,i),dx=i%9-S.pos%9,dy=Math.floor(i/9)-Math.floor(S.pos/9),dir=Math.abs(dx)+Math.abs(dy)===1?(dx?dx>0?'right':'left':dy>0?'down':'up'):null,b=action(i===S.pos?'☻':symbols[t],'move',dir,!dir||t==='#'||S.won,'cp-cell');b.setAttribute('aria-label','格 '+i+' '+(i===S.pos?'角色':t));b.toggleAttribute('data-wall',t==='#');b.toggleAttribute('data-selected',i===S.pos);grid.appendChild(b);}main.append(grid,p(S.message),el('div',{class:'cp-dpad'},['up','left','down','right'].map(function(d){return action({up:'▲',left:'◀',down:'▼',right:'▶'}[d],'move',d,S.won);})));var normal=E.enemy(S,false),boss=E.enemy(S,true);side.append(panel('战斗预览',[p('普通魔物：生命 '+normal.hp+' / 攻击 '+normal.atk+' / 防御 '+normal.def+'\n预计损伤 '+E.loss(S,false)),p('守层者：生命 '+boss.hp+' / 攻击 '+boss.atk+' / 防御 '+boss.def+'\n预计损伤 '+E.loss(S,true)),p('敌人损伤不会随机变化。致命战斗会被阻止；先拿剑盾，再挑战强敌。')]),panel('图例',[p('⚿ 钥匙　♥ 药水　⚔ 攻击宝石\n⛨ 防御宝石　▣ 门　● 金币\n▲ 上楼　▼ 下楼　商 商店')]));if(S.pos===12&&S.floor%5===0)side.append(panel('强化商店',[action('生命 +100 · 20G','buy','hp',S.gold<20),action('攻击 +5 · 20G','buy','atk',S.gold<20),action('防御 +3 · 20G','buy','def',S.gold<20)]));
  };
  if(!locked){notice=loaded.status==='recovered'?'已恢复上一份有效备份':'已载入本地进度';if(loaded.status==='new'||loaded.status==='recovered')persist();}render();if(locked)recovery(loaded.status);
})();
