// Four original games. Deterministic rules, no DOM or audio dependencies.
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.FiveEngines = factory;
})(typeof window === 'object' ? window : this, function(id) {
  'use strict';
  const clone = v => JSON.parse(JSON.stringify(v));
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const base = () => ({version:1,elapsed:0,score:0,over:false,won:false});
  const random = s => { s.seed = (Math.imul(s.seed,1664525)+1013904223)>>>0; return s.seed/4294967296; };
  const finite = (v,a,b) => typeof v === 'number' && Number.isFinite(v) && v>=a && v<=b;
  const integer = (v,a,b) => Number.isInteger(v) && finite(v,a,b);
  function safe(check) { return v => { try { return v && v.version===1 && !v.over && v.won===false && finite(v.elapsed,0,1e7) && finite(v.score,0,1e8) && check(v) ? clone(v) : null; } catch(e) { return null; } }; }
  function delta(s,dt) { if(s.over || !finite(dt,0,1))return 0;dt=Math.min(dt,.05);s.elapsed+=dt;return dt; }
  if(id==='ridge-rally') {
    const center = d => 300 + Math.sin(d/190)*100 + Math.sin(d/83)*32;
    function newGame(){return Object.assign(base(),{distance:0,speed:0,x:300,health:100,offroad:0});}
    function step(s,dt,input) {
      dt=delta(s,dt);if(!dt)return;input=input||{};
      const outside=Math.abs(s.x-center(s.distance))>77;
      s.speed=clamp(s.speed+(input.brake?-110:input.gas?50:16)*dt,0,outside?65:150);
      s.x=clamp(s.x+((input.right?1:0)-(input.left?1:0))*(95+s.speed*.65)*dt,20,580);
      s.distance+=s.speed*dt;
      if(Math.abs(s.x-center(s.distance))>77){s.health=Math.max(0,s.health-15*dt);s.offroad+=dt;}
      s.score=Math.floor(s.distance/4+s.health*2);
      if(s.distance>=3600){s.distance=3600;s.over=true;s.won=true;s.score+=Math.floor(Math.max(0,80-s.elapsed)*20);}
      else if(s.health<=0||s.elapsed>=80){s.over=true;s.won=false;}
    }
    return {newGame,step,center,restore:safe(v=>finite(v.distance,0,3600)&&finite(v.speed,0,150)&&finite(v.x,20,580)&&finite(v.health,0,100)&&finite(v.offroad,0,v.elapsed)&&v.elapsed<80&&v.distance<3600&&v.health>0)};
  }
  if(id==='neon-traffic') {
    function newGame(rnd){return Object.assign(base(),{seed:Math.floor((rnd||Math.random)()*4294967296)>>>0,lane:1,cooldown:0,spawn:0,traffic:[],passed:0,lives:3,invincible:0,distance:0});}
    function action(s,direction){if(s.over||s.cooldown>0||![-1,1].includes(direction))return false;const lane=clamp(s.lane+direction,0,2);if(lane===s.lane)return false;s.lane=lane;s.cooldown=.13;return true;}
    function step(s,dt){dt=delta(s,dt);if(!dt)return;s.cooldown=Math.max(0,s.cooldown-dt);s.invincible=Math.max(0,s.invincible-dt);s.distance+=dt*60;s.spawn-=dt;
      if(s.spawn<=0){const gap=Math.floor(random(s)*3);for(let lane=0;lane<3;lane++)if(lane!==gap)s.traffic.push({lane,y:-65,color:Math.floor(random(s)*3),hit:false});s.spawn=1.65;}
      const speed=135+s.elapsed*1.2;
      for(const car of s.traffic){car.y+=dt*speed;if(!car.hit&&Math.abs(car.y-375)<48&&car.lane===s.lane){car.hit=true;if(s.invincible===0){s.lives--;s.invincible=1.3;}}if(!car.hit&&car.y>440){car.hit=true;s.passed++;}}
      s.traffic=s.traffic.filter(car=>car.y<530);s.score=Math.floor(s.distance)+s.passed*40;
      if(s.lives<=0||s.elapsed>=60){s.over=true;s.won=s.lives>0;}
    }
    return {newGame,step,action,restore:safe(v=>integer(v.seed,0,4294967295)&&integer(v.lane,0,2)&&finite(v.cooldown,0,.13)&&finite(v.spawn,-.05,1.65)&&integer(v.lives,1,3)&&finite(v.invincible,0,1.3)&&finite(v.distance,0,3601)&&integer(v.passed,0,500)&&v.elapsed<60&&Array.isArray(v.traffic)&&v.traffic.length<30&&v.traffic.every(c=>integer(c.lane,0,2)&&finite(c.y,-65,530)&&integer(c.color,0,2)&&typeof c.hit==='boolean'))};
  }
  if(id==='beat-echo') {
    const patterns=[[0,1,2,3],[0,1,3,4],[0,2,3,5],[0,1,1.5,3],[0,1.5,3,4],[0,.5,2,3],[0,1,2.5,4],[0,.5,1.5,3]];
    function newGame(){return Object.assign(base(),{round:0,phase:'ready',clock:0,taps:[],origin:0,correct:0,feedback:'',assisted:false});}
    function listen(s){if(s.over||s.phase==='listen'||s.phase==='record'||s.phase==='result')return false;s.phase='listen';s.clock=0;s.taps=[];s.feedback='';return true;}
    function tap(s){if(s.over||!['reply','record'].includes(s.phase))return false;if(s.phase==='reply'){s.phase='record';s.origin=s.elapsed;}
      const at=s.elapsed-s.origin;const previous=s.taps[s.taps.length-1];if(previous!==undefined&&at-previous<.1)return false;
      s.taps.push(at);
      if(s.taps.length===4){const p=patterns[s.round],error=s.taps.reduce((n,t,i)=>n+Math.abs(t-p[i]*.5),0)/3;const ok=error<=.14;if(ok)s.correct++;s.score+=Math.round(Math.max(0,1-error/.4)*(s.assisted?60:120));s.feedback=ok?'节奏准确！':'平均偏差 '+Math.round(error*1000)+' ms，再接再厉';s.phase='result';}
      return true;
    }
    function next(s){if(s.over||s.phase!=='result')return false;s.round++;if(s.round===8){s.over=true;s.won=s.correct>=5;}else{s.phase='ready';s.taps=[];s.clock=0;s.assisted=false;}return true;}
    function step(s,dt){dt=delta(s,dt);if(!dt)return;if(s.phase==='listen'){s.clock+=dt;if(s.clock>patterns[s.round][3]*.5+.7){s.phase='reply';s.clock=0;}}if(s.phase==='record'&&s.elapsed-s.origin>4){s.feedback='本轮超时，点击下一轮';s.phase='result';}}
    return {newGame,step,listen,tap,next,patterns,restore:safe(v=>integer(v.round,0,7)&&['ready','listen','reply','record','result'].includes(v.phase)&&finite(v.clock,0,4)&&finite(v.origin,0,v.elapsed)&&integer(v.correct,0,v.round+(v.phase==='result'?1:0))&&typeof v.feedback==='string'&&v.feedback.length<100&&typeof v.assisted==='boolean'&&Array.isArray(v.taps)&&v.taps.length<=4&&v.taps.every((t,i)=>finite(t,0,4)&&(i===0?t===0:t>v.taps[i-1])))};
  }
  if(id==='chord-lab') {
    function newGame(rnd){const s=Object.assign(base(),{seed:Math.floor((rnd||Math.random)()*4294967296)>>>0,round:0,rounds:[],selected:[],answered:false,correct:0,assisted:false});for(let i=0;i<10;i++){const root=Math.floor(random(s)*5),minor=random(s)<.5;s.rounds.push([root,root+(minor?3:4),root+7]);}return s;}
    function select(s,n){if(s.over||s.answered||!integer(n,0,11))return false;const i=s.selected.indexOf(n);if(i>=0)s.selected.splice(i,1);else if(s.selected.length<3)s.selected.push(n);else return false;return true;}
    function submit(s){if(s.over||s.answered||s.selected.length!==3)return false;s.answered=true;const ok=s.selected.slice().sort((a,b)=>a-b).every((n,i)=>n===s.rounds[s.round][i]);if(ok){s.correct++;s.score+=s.assisted?50:150;}return ok;}
    function next(s){if(s.over||!s.answered)return false;s.round++;if(s.round===10){s.over=true;s.won=s.correct>=7;}else{s.selected=[];s.answered=false;s.assisted=false;}return true;}
    function step(s,dt){delta(s,dt);}
    return {newGame,step,select,submit,next,restore:safe(v=>integer(v.seed,0,4294967295)&&integer(v.round,0,9)&&integer(v.correct,0,v.round+(v.answered?1:0))&&typeof v.answered==='boolean'&&typeof v.assisted==='boolean'&&Array.isArray(v.selected)&&v.selected.length<=3&&new Set(v.selected).size===v.selected.length&&v.selected.every(n=>integer(n,0,11))&&Array.isArray(v.rounds)&&v.rounds.length===10&&v.rounds.every(r=>Array.isArray(r)&&r.length===3&&integer(r[0],0,4)&&[3,4].includes(r[1]-r[0])&&r[2]-r[0]===7))};
  }
  throw Error('Unknown game: '+id);
});
