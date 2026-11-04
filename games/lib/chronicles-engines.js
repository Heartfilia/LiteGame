// Six small, independent rule engines. No DOM, timers, or external dependencies.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.ChroniclesEngines=factory;})(typeof window==='object'?window:this,function(id){
  'use strict';
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function log(s,t){s.log.unshift(t);s.log=s.log.slice(0,6);}
  function base(){return {version:1,seed:19457,won:false,log:['新的旅程开始了。']};}
  function rnd(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
  function shuffle(s,a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(rnd(s)*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
  function num(n,min,max){return Number.isInteger(n)&&n>=min&&n<=max;}
  function common(v){return v&&v.version===1&&num(v.seed,0,4294967295)&&typeof v.won==='boolean'&&Array.isArray(v.log)&&v.log.length<=6&&v.log.every(function(t){return typeof t==='string'&&t.length<500;});}
  function numbers(obj,spec){return obj&&Object.keys(spec).every(function(k){return num(obj[k],0,spec[k]);});}
  function restoreWith(check){return function(v){try{return common(v)&&check(v)?clone(v):null;}catch(e){return null;}};}
  var engines={};

  engines.starfarm=function(){
    var crops={turnip:{name:'星萝卜',days:2,cost:3,sell:9},berry:{name:'月莓',days:3,cost:5,sell:16},wheat:{name:'金麦',days:2,cost:4,sell:11}};
    function fresh(){return Object.assign(base(),{day:1,gold:30,energy:12,plots:Array.from({length:9},function(){return {crop:null,age:0,watered:false};}),stock:{turnip:0,berry:0,wheat:0,fish:0,bread:0},seeds:{turnip:4,berry:1,wheat:2},buildings:{well:false,kitchen:false,pond:false},orders:0,harvests:0,tool:'water',selectedCrop:'turnip'});}
    function order(s){return [{item:'turnip',n:3,pay:40},{item:'wheat',n:3,pay:48},{item:'berry',n:3,pay:65},{item:'bread',n:2,pay:75},{item:'fish',n:2,pay:50},{item:'bread',n:3,pay:100},{item:'berry',n:4,pay:100},{item:'fish',n:4,pay:110}][s.orders%8];}
    function act(s,a,n){
      if(a==='crop'&&crops[n]){s.selectedCrop=n;s.tool='plant';return true;}
      if(a==='tool'&&['water','harvest','plant'].includes(n)){s.tool=n;return true;}
      if(a==='plot'&&num(n,0,8)){
        var p=s.plots[n];if(!s.energy){log(s,'体力用完了，结束一天即可恢复。');return false;}
        if(s.tool==='plant'&&!p.crop&&s.seeds[s.selectedCrop]>0){p.crop=s.selectedCrop;p.age=0;p.watered=false;s.seeds[p.crop]--;s.energy--;log(s,'播下了'+crops[p.crop].name+'。');return true;}
        if(s.tool==='water'&&p.crop&&!p.watered&&p.age<crops[p.crop].days){p.watered=true;s.energy--;return true;}
        if(s.tool==='harvest'&&p.crop&&p.age>=crops[p.crop].days){s.stock[p.crop]++;s.harvests++;s.seeds[p.crop]++;s.energy--;log(s,'收获'+crops[p.crop].name+'，并留下一份种子。');s.plots[n]={crop:null,age:0,watered:false};return true;}
        log(s,'空地才能播种；作物每天浇水后过夜成长。成熟时选择收获。');return false;
      }
      if(a==='sleep'){s.plots.forEach(function(p){if(p.crop&&p.watered)p.age=Math.min(crops[p.crop].days,p.age+1);p.watered=false;});s.day++;s.energy=s.buildings.well?16:12;log(s,'第 '+s.day+' 天。没有现实时间倒计时，离开不会损失作物。');return true;}
      if(a==='seed'&&crops[n]&&s.gold>=crops[n].cost){s.gold-=crops[n].cost;s.seeds[n]++;return true;}
      if(a==='sell'&&Object.hasOwn(s.stock,n)&&s.stock[n]>0){s.stock[n]--;s.gold+=crops[n]?crops[n].sell:n==='bread'?28:15;return true;}
      if(a==='build'&&Object.hasOwn(s.buildings,n)&&!s.buildings[n]){var cost={well:50,kitchen:75,pond:60}[n];if(s.gold<cost)return false;s.gold-=cost;s.buildings[n]=true;log(s,'设施建成！');if(s.orders>=8&&Object.values(s.buildings).every(Boolean)){s.won=true;log(s,'牧场重新开张！可继续经营。');}return true;}
      if(a==='cook'&&s.buildings.kitchen&&s.stock.wheat>=2&&s.energy>=1){s.stock.wheat-=2;s.stock.bread++;s.energy--;return true;}
      if(a==='fish'&&s.buildings.pond&&s.energy>=3){s.energy-=3;s.stock.fish++;log(s,'钓到一条星砂鱼。');return true;}
      if(a==='order'){var o=order(s);if(s.stock[o.item]<o.n)return false;s.stock[o.item]-=o.n;s.gold+=o.pay;s.orders++;log(s,'订单完成！获得 '+o.pay+' 金币。');if(s.orders>=8&&Object.values(s.buildings).every(Boolean)){s.won=true;log(s,'牧场重新开张！村民送来星砂牧场的招牌。可继续经营。');}return true;}
      return false;
    }
    return {newGame:fresh,act:act,crops:crops,order:order,restore:restoreWith(function(s){return numbers(s,{day:100000,gold:10000000,energy:16,orders:100000,harvests:100000})&&s.day>=1&&['water','plant','harvest'].includes(s.tool)&&Object.hasOwn(crops,s.selectedCrop)&&numbers(s.stock,{turnip:100000,berry:100000,wheat:100000,fish:100000,bread:100000})&&numbers(s.seeds,{turnip:100000,berry:100000,wheat:100000})&&['well','kitchen','pond'].every(function(k){return typeof s.buildings[k]==='boolean';})&&s.plots.length===9&&s.plots.every(function(p){return p&&typeof p.watered==='boolean'&&(p.crop===null&&p.age===0||Object.hasOwn(crops,p.crop)&&num(p.age,0,crops[p.crop].days));})&&(!s.won||s.orders>=8&&Object.values(s.buildings).every(Boolean));})};
  };

  engines.runetraveler=function(){
    var cards={strike:{name:'符刃',cost:1,damage:7,text:'造成 7 点伤害。'},guard:{name:'岩盾',cost:1,block:7,text:'获得 7 护盾。'},ember:{name:'余烬',cost:1,damage:3,poison:3,text:'伤害 3，施加 3 层灼烧。'},drain:{name:'汲取',cost:2,damage:10,heal:5,text:'伤害 10，回复 5 生命。'},echo:{name:'回响',cost:0,draw:2,text:'抽 2 张牌。'},bash:{name:'震荡',cost:2,damage:15,text:'造成 15 点伤害。'},fort:{name:'堡垒',cost:2,block:18,text:'获得 18 护盾。'}};
    function fresh(){return Object.assign(base(),{hp:65,maxHp:65,stage:0,gold:0,deck:['strike','strike','strike','guard','guard','ember'],draw:[],hand:[],discard:[],phase:'route',enemy:null,energy:3,block:0,relic:0,rewards:[],dead:false});}
    function draw(s,n){for(var i=0;i<n;i++){if(!s.draw.length){s.draw=shuffle(s,s.discard);s.discard=[];}if(s.draw.length&&s.hand.length<10)s.hand.push(s.draw.pop());}}
    function start(s,hard){s.stage++;s.phase='battle';s.enemy={hp:23+s.stage*6+(hard?8:0),max:23+s.stage*6+(hard?8:0),atk:5+Math.floor(s.stage/2)+(hard?2:0),turn:0,poison:0,hard:hard};if(s.stage===9){s.enemy.hp=s.enemy.max=100;s.enemy.atk=12;}s.draw=shuffle(s,s.deck);s.hand=[];s.discard=[];s.energy=3;s.block=s.relic;draw(s,5);log(s,'第 '+s.stage+' 战：'+(s.stage===9?'封印之主':hard?'精英符兽':'迷途守卫')+'。');}
    function victory(s){s.gold+=s.enemy.hard?25:15;s.enemy=null;s.draw=[];s.hand=[];s.discard=[];if(s.stage===9){s.won=true;s.phase='complete';log(s,'封印解除！你的牌组成为了新的旅人传说。');}else{s.phase='reward';s.rewards=shuffle(s,Object.keys(cards)).slice(0,3);log(s,'战斗胜利，选择一张卡加入牌组，或跳过。');}}
    function damage(s,n){s.enemy.hp=Math.max(0,s.enemy.hp-n);if(!s.enemy.hp)victory(s);}
    function act(s,a,n){
      if(s.dead||s.won)return false;
      if(s.phase==='route'&&a==='route'&&['safe','elite','rest'].includes(n)){if(n==='rest'){s.hp=Math.min(s.maxHp,s.hp+16);log(s,'营火恢复 16 生命后继续前行。');}start(s,n==='elite');return true;}
      if(s.phase==='reward'&&a==='reward'&&(n==='skip'||s.rewards.includes(n))){if(n!=='skip')s.deck.push(n);s.rewards=[];s.phase='route';return true;}
      if(s.phase==='route'&&a==='heal'&&s.gold>=20){s.gold-=20;s.hp=Math.min(s.maxHp,s.hp+22);return true;}
      if(s.phase==='route'&&a==='relic'&&s.gold>=40&&s.relic<6){s.gold-=40;s.relic+=2;log(s,'石纹遗物：每回合额外 '+s.relic+' 护盾。');return true;}
      if(s.phase==='route'&&a==='remove'&&num(n,0,s.deck.length-1)&&s.gold>=20&&s.deck.length>5){s.gold-=20;s.deck.splice(n,1);return true;}
      if(s.phase!=='battle')return false;
      if(a==='play'&&num(n,0,s.hand.length-1)){var id=s.hand[n],c=cards[id];if(s.energy<c.cost)return false;s.energy-=c.cost;s.hand.splice(n,1);s.discard.push(id);s.block+=c.block||0;s.hp=Math.min(s.maxHp,s.hp+(c.heal||0));if(c.poison)s.enemy.poison+=c.poison;if(c.draw)draw(s,c.draw);if(c.damage)damage(s,c.damage);return true;}
      if(a==='end'){var e=s.enemy;if(e.poison){e.hp=Math.max(0,e.hp-e.poison);e.poison=Math.max(0,e.poison-1);}if(!e.hp){victory(s);return true;}var hit=e.turn%3===2?e.atk*2:e.turn%3===1?0:e.atk;s.hp=Math.max(0,s.hp-Math.max(0,hit-s.block));log(s,hit?'敌人攻击 '+hit+'，护盾抵挡 '+Math.min(hit,s.block)+'。':'敌人蓄力，下回合发动双倍重击。');e.turn++;if(!s.hp){s.dead=true;s.phase='defeat';log(s,'旅途暂告一段落。存档保留，可从营火重整。');return true;}s.discard.push.apply(s.discard,s.hand);s.hand=[];s.block=s.relic;s.energy=3;draw(s,5);return true;}return false;
    }
    function revive(s){if(!s.dead)return false;s.dead=false;s.hp=s.maxHp;s.gold=Math.floor(s.gold/2);s.stage=Math.max(0,s.stage-1);s.phase='route';s.enemy=null;s.hand=[];s.draw=[];s.discard=[];log(s,'营火重整，损失一半金币，牌组保留。');return true;}
    return {newGame:fresh,cards:cards,act:act,revive:revive,restore:restoreWith(function(s){var arrays=['deck','draw','hand','discard','rewards'];if(!numbers(s,{hp:65,maxHp:65,stage:9,gold:100000,energy:3,block:10000,relic:6})||s.maxHp!==65||s.relic%2||typeof s.dead!=='boolean'||!['route','battle','reward','complete','defeat'].includes(s.phase)||!arrays.every(function(k){return Array.isArray(s[k])&&s[k].length<=100&&s[k].every(function(c){return Object.hasOwn(cards,c);});})||s.deck.length<5||s.hand.length>10)return false;if(s.phase==='battle'){var e=s.enemy;if(!e||!numbers(e,{hp:200,max:200,atk:30,turn:100000,poison:10000})||!e.hp||e.hp>e.max||typeof e.hard!=='boolean')return false;var used=s.draw.concat(s.hand,s.discard).sort().join(',');if(used!==s.deck.slice().sort().join(','))return false;}return (!s.won||s.stage===9&&s.phase==='complete')&&(!s.dead||s.hp===0&&s.phase==='defeat')&&(s.phase==='battle'||s.enemy===null);})};
  };

  engines.caravan=function(){
    var goods=[{id:'grain',name:'麦粮',base:9},{id:'salt',name:'盐晶',base:17},{id:'silk',name:'云绸',base:31},{id:'tea',name:'山茶',base:23}],cities=['溪谷镇','盐风港','织云城','青山驿','王都'];
    var modifiers=[[.7,1.4,1.2,1.2],[1.3,.65,1.4,1.1],[1.1,1.3,.65,1.4],[1.1,1.2,1.3,.65],[1.3,1.2,1.3,1.3]];
    function fresh(){return Object.assign(base(),{day:1,city:0,gold:100,cargo:[0,0,0,0],cart:0,guards:0,reputation:0,deliveries:0,event:null,visited:[0],road:0});}
    function price(s,i){return Math.max(2,Math.round(goods[i].base*modifiers[s.city][i]*(1+(((s.day*3+s.city*5+i*7)%9)-4)*.035)));}
    function capacity(s){return 12+s.cart*8;}
    function contract(s){var i=s.deliveries%4;return {city:(s.deliveries%4)+1,item:i,n:3+(s.deliveries%3),pay:goods[i].base*(3+s.deliveries%3)*2};}
    function finish(s){if(s.deliveries>=6&&s.cart>=2&&s.reputation>=12){s.won=true;log(s,'王都授予你商路执照！商队成为五城之间的桥梁，可继续自由贸易。');}}
    function act(s,a,n){
      if(s.event&&a!=='event')return false;
      if(a==='buy'&&num(n,0,3)&&s.gold>=price(s,n)&&s.cargo.reduce(function(a,b){return a+b;},0)<capacity(s)){s.gold-=price(s,n);s.cargo[n]++;return true;}
      if(a==='sell'&&num(n,0,3)&&s.cargo[n]>0){s.cargo[n]--;s.gold+=Math.max(1,Math.floor(price(s,n)*.9));return true;}
      if(a==='travel'&&num(n,0,4)&&n!==s.city){var distance=Math.abs(s.city-n)+1;s.city=n;s.day+=distance;s.road++;if(!s.visited.includes(n))s.visited.push(n);var r=rnd(s);if(r<.28){s.event='bandits';log(s,'路遇盗匪：选择交路费，或让护卫应对。');}else if(r<.55){s.event='traveler';log(s,'路旁旅人请求一份麦粮。');}else log(s,'平安抵达'+cities[n]+'。市场价格已变化。');return true;}
      if(a==='event'&&s.event){if(s.event==='bandits'){if(n==='pay'){var fee=Math.min(s.gold,12+s.cart*5);s.gold-=fee;log(s,'支付 '+fee+' 金币通行。');}else if(n==='guard'){if(s.guards){s.reputation++;log(s,'护卫赶走了盗匪，声望 +1。');}else{var lost=s.cargo.findIndex(function(q){return q>0;});if(lost>=0)s.cargo[lost]--;s.gold=Math.max(0,s.gold-5);log(s,'你绕路逃脱，损失少量货物和金币。');}}else return false;}else{if(n==='give'&&s.cargo[0]>0){s.cargo[0]--;s.reputation+=2;s.gold+=12;log(s,'旅人赠予 12 金币，声望 +2。');}else if(n==='leave')log(s,'你向旅人指明了城镇方向。');else return false;}s.event=null;finish(s);return true;}
      if(a==='cart'&&s.cart<3&&s.gold>=80*(s.cart+1)){s.gold-=80*(s.cart+1);s.cart++;finish(s);return true;}
      if(a==='guard'&&s.guards<2&&s.gold>=60){s.gold-=60;s.guards++;return true;}
      if(a==='contract'){var c=contract(s);if(s.city!==c.city||s.cargo[c.item]<c.n)return false;s.cargo[c.item]-=c.n;s.gold+=c.pay;s.deliveries++;s.reputation+=2;log(s,'商会委托完成：'+c.pay+' 金币、声望 +2。');finish(s);return true;}
      if(a==='work'){s.day++;s.gold+=12;log(s,'帮商会搬运一天，赚得 12 金币。即使破产也能重新出发。');return true;}return false;
    }
    return {newGame:fresh,act:act,goods:goods,cities:cities,price:price,capacity:capacity,contract:contract,restore:restoreWith(function(s){return numbers(s,{day:100000,city:4,gold:10000000,cart:3,guards:2,reputation:100000,deliveries:100000,road:100000})&&s.day>0&&Array.isArray(s.cargo)&&s.cargo.length===4&&s.cargo.every(function(n){return num(n,0,36);})&&s.cargo.reduce(function(a,b){return a+b;},0)<=capacity(s)&&Array.isArray(s.visited)&&s.visited.length<=5&&new Set(s.visited).size===s.visited.length&&s.visited.includes(s.city)&&s.visited.every(function(n){return num(n,0,4);})&&[null,'bandits','traveler'].includes(s.event)&&(!s.won||s.deliveries>=6&&s.cart>=2&&s.reputation>=12);})};
  };

  engines.island=function(){
    var recipes={axe:{wood:3,stone:2},pick:{wood:3,stone:4},shelter:{wood:8,leaf:5},fire:{wood:4,stone:3},sail:{leaf:12,wood:3},hull:{wood:22,stone:8},beacon:{wood:8,ore:6}};
    function fresh(){return Object.assign(base(),{day:1,energy:12,hp:80,food:5,water:6,wood:0,stone:0,leaf:0,ore:0,zone:0,known:[0],made:[],relics:[],event:null,steps:0});}
    function act(s,a,n){
      if(s.won)return false;
      if(a==='rest'){s.day++;var need=s.made.includes('shelter')?1:2;if(s.food>=need&&s.water>=need){s.food-=need;s.water-=need;s.hp=Math.min(80,s.hp+(s.made.includes('fire')?25:15));}else{s.food=Math.max(0,s.food-need);s.water=Math.max(0,s.water-need);s.hp=Math.max(1,s.hp-15);log(s,'补给不足，身体虚弱。海滩拾贝与泉水仍能维持生存。');}s.energy=s.made.includes('shelter')?16:12;return true;}
      if(a==='travel'&&num(n,0,3)&&s.energy>=1){if(n===2&&!s.made.includes('axe')||n===3&&!s.made.includes('pick')){log(s,n===2?'需要石斧开辟林路。':'需要石镐进入洞穴。');return false;}s.zone=n;s.energy--;s.steps++;if(!s.known.includes(n))s.known.push(n);return true;}
      if(a==='gather'&&s.energy>=2){s.energy-=2;s.steps++;if(s.zone===0){s.food+=3;s.wood+=1;s.stone+=1;log(s,'拾到贝类、漂流木与卵石。');}if(s.zone===1){s.water+=5;s.leaf+=2;log(s,'装满清水，采集宽叶。');}if(s.zone===2){s.wood+=s.made.includes('axe')?5:2;s.leaf+=3;s.food++;log(s,'采集木材、叶片和野果。');}if(s.zone===3){s.stone+=4;s.ore+=2;log(s,'采到石料与铁矿。');}return true;}
      if(a==='search'&&s.energy>=3){s.energy-=3;s.steps++;if(!s.relics.includes(s.zone)){s.relics.push(s.zone);s.food+=2;log(s,'找到航海手记碎片 '+s.relics.length+'/4：'+['南方的星指向故乡。','风起时，帆比桨更有力量。','修好船身，别忘了发出信号。','点燃灯标，远航的人会看见你。'][s.zone]);}else{s.wood+=2;s.food++;log(s,'旧营地还有一些可用的补给。');}return true;}
      if(a==='craft'&&recipes[n]&&!s.made.includes(n)){var r=recipes[n];if(!Object.keys(r).every(function(k){return s[k]>=r[k];}))return false;Object.keys(r).forEach(function(k){s[k]-=r[k];});s.made.push(n);log(s,'制作完成！');return true;}
      if(a==='eat'&&s.food>0&&s.hp<80){s.food--;s.hp=Math.min(80,s.hp+12);return true;}
      if(a==='rescue'&&['hull','sail','beacon'].every(function(k){return s.made.includes(k);})&&s.relics.length===4){s.won=true;log(s,'灯标点亮，帆船驶离海湾。你把荒岛手记带回了故乡。');return true;}return false;
    }
    return {newGame:fresh,act:act,recipes:recipes,zones:['潮汐海滩','清泉湿地','密林深处','回声洞穴'],names:{axe:'石斧',pick:'石镐',shelter:'避风营地',fire:'篝火',sail:'船帆',hull:'修复船身',beacon:'求救灯标'},restore:restoreWith(function(s){return numbers(s,{day:100000,energy:16,hp:80,food:100000,water:100000,wood:100000,stone:100000,leaf:100000,ore:100000,zone:3,steps:10000000})&&s.hp>0&&s.day>0&&['known','relics'].every(function(k){return Array.isArray(s[k])&&s[k].length<=4&&new Set(s[k]).size===s[k].length&&s[k].every(function(n){return num(n,0,3);});})&&s.known.includes(s.zone)&&Array.isArray(s.made)&&new Set(s.made).size===s.made.length&&s.made.every(function(k){return Object.hasOwn(recipes,k);})&&(!s.won||s.relics.length===4&&['hull','sail','beacon'].every(function(k){return s.made.includes(k);}));})};
  };

  engines.wardens=function(){
    var walls=[10,11,17,25,31,38],roles=['剑卫','游侠','医师'];
    function pos(i){return [i%7,Math.floor(i/7)];}function distance(a,b){var p=pos(a),q=pos(b);return Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1]);}
    function fresh(){var s=Object.assign(base(),{mission:1,gold:0,level:0,phase:'battle',selected:0,round:1,units:[],enemies:[],walls:walls.slice(),history:[]});setup(s);return s;}
    function setup(s){s.units=[{role:0,pos:42,hp:48+s.level*8,max:48+s.level*8,ap:2},{role:1,pos:43,hp:34+s.level*8,max:34+s.level*8,ap:2},{role:2,pos:44,hp:32+s.level*8,max:32+s.level*8,ap:2}];s.enemies=[{pos:2,hp:18+s.mission*4,max:18+s.mission*4,atk:5+s.mission},{pos:4,hp:18+s.mission*4,max:18+s.mission*4,atk:5+s.mission},{pos:13,hp:25+s.mission*5,max:25+s.mission*5,atk:6+s.mission}];if(s.mission>=4)s.enemies.push({pos:6,hp:24+s.mission*4,max:24+s.mission*4,atk:6+s.mission});s.round=1;s.selected=0;s.phase='battle';s.history=[];}
    function blocked(s,p){return s.walls.includes(p)||s.units.some(function(u){return u.hp>0&&u.pos===p;})||s.enemies.some(function(u){return u.hp>0&&u.pos===p;});}
    function path(s,from,to){var q=[[from,[]]],seen=new Set();while(q.length){var a=q.shift();if(seen.has(a[0]))continue;seen.add(a[0]);if(a[0]===to)return a[1];for(var p=0;p<49;p++)if(distance(p,a[0])===1&&(!blocked(s,p)||p===to))q.push([p,a[1].concat(p)]);}return [];}
    function sight(s,a,b){var p=pos(a),q=pos(b),steps=Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]));for(var i=1;i<steps;i++){var x=Math.round(p[0]+(q[0]-p[0])*i/steps),y=Math.round(p[1]+(q[1]-p[1])*i/steps);if(s.walls.includes(y*7+x))return false;}return true;}
    function check(s){if(s.enemies.every(function(e){return e.hp<=0;})){s.gold+=35;s.phase='camp';s.history=[];if(s.mission===6){s.won=true;s.phase='complete';log(s,'六座遗迹被重新封印，三位守望者平安归来。');}else log(s,'关卡完成！获得 35 金币，营地完全恢复。');}else if(s.units.every(function(u){return u.hp<=0;})){s.phase='defeat';log(s,'小队失守。可重试当前关卡，成长保留。');}}
    function act(s,a,n){
      if(a==='retry'&&s.phase==='defeat'){setup(s);return true;}
      if(a==='upgrade'&&s.phase==='camp'&&s.gold>=30&&s.level<5){s.gold-=30;s.level++;return true;}
      if(a==='next'&&s.phase==='camp'){s.mission++;setup(s);return true;}
      if(s.phase!=='battle')return false;
      if(a==='select'&&num(n,0,2)&&s.units[n].hp>0){s.selected=n;return true;}
      var u=s.units[s.selected];
      if(a==='cell'&&num(n,0,48)){var ally=s.units.findIndex(function(t){return t.hp>0&&t.pos===n;});if(ally>=0){s.selected=ally;return true;}if(!u.hp||!u.ap)return false;var e=s.enemies.find(function(t){return t.hp>0&&t.pos===n;});
        if(e){var range=u.role===1?4:u.role===2?2:1;if(distance(u.pos,n)>range||!sight(s,u.pos,n)){log(s,'目标超出射程或被石墙遮挡。');return false;}e.hp=Math.max(0,e.hp-(u.role===0?16:u.role===1?12:9)-s.level*3);u.ap--;check(s);return true;}
        var route=path(s,u.pos,n);if(blocked(s,n)||!route.length||route.length>3||route.some(function(p){return blocked(s,p);}))return false;u.pos=n;u.ap--;return true;
      }
      if(a==='heal'&&u.role===2&&u.hp>0&&u.ap&&num(n,0,2)){var t=s.units[n];if(t.hp<=0||t.hp===t.max||distance(u.pos,t.pos)>3)return false;t.hp=Math.min(t.max,t.hp+15+s.level*2);u.ap--;return true;}
      if(a==='end'){
        s.enemies.forEach(function(e){if(e.hp<=0)return;var targets=s.units.filter(function(u){return u.hp>0;}).sort(function(a,b){return distance(a.pos,e.pos)-distance(b.pos,e.pos);});var t=targets[0];if(!t)return;if(distance(t.pos,e.pos)>1){var route=path(s,e.pos,t.pos);for(var i=0;i<Math.min(2,route.length);i++){if(blocked(s,route[i]))break;e.pos=route[i];}}if(distance(t.pos,e.pos)<=1)t.hp=Math.max(0,t.hp-e.atk);});s.round++;s.units.forEach(function(u){u.ap=u.hp>0?2:0;});check(s);if(s.units[s.selected].hp<=0)s.selected=Math.max(0,s.units.findIndex(function(u){return u.hp>0;}));log(s,'第 '+s.round+' 回合，小队恢复行动点。');return true;
      }return false;
    }
    return {newGame:fresh,act:act,roles:roles,distance:distance,path:path,sight:sight,restore:restoreWith(function(s){if(!numbers(s,{mission:6,gold:100000,level:5,selected:2,round:100000})||s.mission<1||s.round<1||!['battle','camp','complete','defeat'].includes(s.phase)||!Array.isArray(s.units)||s.units.length!==3||!Array.isArray(s.enemies)||s.enemies.length<3||s.enemies.length>4||JSON.stringify(s.walls)!==JSON.stringify(walls))return false;var all=s.units.concat(s.enemies);if(!all.every(function(u){return numbers(u,{pos:48,hp:1000,max:1000})&&u.hp<=u.max&&!walls.includes(u.pos);})||!s.units.every(function(u,i){return u.role===i&&num(u.ap,0,2);})||!s.enemies.every(function(e){return num(e.atk,1,20);}))return false;var live=all.filter(function(u){return u.hp>0;}).map(function(u){return u.pos;});return new Set(live).size===live.length&&(!s.won||s.mission===6&&s.phase==='complete');})};
  };

  engines.magictower=function(){
    // One hundred compact, deterministic floors; every ten floors has a guardian.
    function tile(f,p){var x=p%9,y=Math.floor(p/9);if(x===0||y===0||x===8||y===8)return '#';if(p===10)return 'down';if(p===70)return 'up';if(p===22)return 'key';if(p===24)return 'potion';if(p===40)return 'enemy';if(p===42)return 'attack';if(p===58)return 'defense';if(p===60)return 'door';if(p===67)return f%10===0?'boss':'enemy';if(p===12)return f%5===0?'shop':'coin';if([20,29,38,47,56,32,41,50].includes(p))return '#';return '.';}
    function fresh(){return Object.assign(base(),{floor:1,pos:10,hp:180,atk:14,def:4,keys:1,gold:0,cleared:{},maxFloor:1,message:'向塔顶出发。战斗前可以预览损伤，打不过就先找强化。'});}
    function enemy(s,boss){var f=s.floor;return {hp:20+f*5+(boss?30:0),atk:8+f*2+(boss?4:0),def:2+Math.floor(f*.7),gold:boss?25:10};}
    function loss(s,boss){var e=enemy(s,boss),hit=s.atk-e.def;if(hit<=0)return Infinity;return Math.max(0,Math.ceil(e.hp/hit)-1)*Math.max(0,e.atk-s.def);}
    function current(s,p){return (s.cleared[s.floor]||[]).includes(p)?'.':tile(s.floor,p);}
    function clear(s,p){if(!s.cleared[s.floor])s.cleared[s.floor]=[];if(!s.cleared[s.floor].includes(p))s.cleared[s.floor].push(p);}
    function act(s,a,n){
      if(a==='buy'&&s.gold>=20&&['hp','atk','def'].includes(n)&&s.pos===12&&s.floor%5===0){s.gold-=20;s[n]+=n==='hp'?100:n==='atk'?5:3;return true;}
      if(a!=='move'||!['up','down','left','right'].includes(n)||s.won)return false;
      var p=s.pos+{up:-9,down:9,left:-1,right:1}[n];if(p<0||p>=81||Math.abs(p%9-s.pos%9)+Math.abs(Math.floor(p/9)-Math.floor(s.pos/9))!==1)return false;var t=current(s,p);
      if(t==='#')return false;
      if(t==='enemy'||t==='boss'){var cost=loss(s,t==='boss');if(cost>=s.hp){s.message='无法安全击败，预计损伤 '+(Number.isFinite(cost)?cost:'∞')+'。先取强化或去商店。';return false;}s.hp-=cost;s.gold+=enemy(s,t==='boss').gold;clear(s,p);log(s,'击败'+(t==='boss'?'守层者':'魔物')+'，损失 '+cost+' 生命。');}
      if(t==='door'){if(!s.keys){s.message='需要一把黄钥匙。';return false;}s.keys--;clear(s,p);}
      if(t==='key'){s.keys++;clear(s,p);}if(t==='potion'){s.hp+=65+s.floor*2;clear(s,p);}if(t==='attack'){s.atk+=3;clear(s,p);}if(t==='defense'){s.def+=2;clear(s,p);}if(t==='coin'){s.gold+=8;clear(s,p);}
      if(t==='up'){
        if(s.floor%10===0&&!(s.cleared[s.floor]||[]).includes(67)){s.message='本层守层者尚未击败，封印着楼梯。';return false;}
        if(s.floor===100){s.won=true;s.pos=p;log(s,'第一百层的星门开启，你解除了魔塔的百年封印。');return true;}
        s.floor++;s.maxFloor=Math.max(s.maxFloor,s.floor);s.pos=10;s.message='抵达第 '+s.floor+' 层。';return true;
      }
      if(t==='down'&&s.floor>1){s.floor--;s.pos=69;s.message='返回第 '+s.floor+' 层。';return true;}
      s.pos=p;s.message=t==='shop'?'商店：每次花费 20 金币，可提升生命、攻击或防御。':'点击相邻格或方向按钮移动。';return true;
    }
    return {newGame:fresh,act:act,tile:tile,current:current,enemy:enemy,loss:loss,restore:restoreWith(function(s){return numbers(s,{floor:100,pos:80,hp:1000000,atk:100000,def:100000,keys:1000,gold:1000000,maxFloor:100})&&s.floor>=1&&s.maxFloor>=s.floor&&s.hp>0&&tile(s.floor,s.pos)!=='#'&&typeof s.message==='string'&&s.message.length<300&&s.cleared&&Object.keys(s.cleared).length<=100&&Object.keys(s.cleared).every(function(f){return /^[1-9]\d*$/.test(f)&&Number(f)<=100&&Array.isArray(s.cleared[f])&&new Set(s.cleared[f]).size===s.cleared[f].length&&s.cleared[f].every(function(p){return num(p,0,80)&&['key','potion','enemy','boss','attack','defense','door','coin'].includes(tile(Number(f),p));});})&&(!s.won||s.floor===100&&(s.cleared[100]||[]).includes(67));})};
  };
  if(!engines[id])throw Error('Unknown campaign '+id);return engines[id]();
});
