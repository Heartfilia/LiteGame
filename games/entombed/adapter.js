// LiteGame adaptation, MIT, 2026. Rebuild prototypes from a validated seed journal.
window.entombedSeed=0;
const portEntityTypes={Bat,Ghost,Urn,Ladder,Cobweb,Key,ManaPotion,HealthPotion};
const portFields=['x','y','health','attackCooldown'];
function entombedValidate(s){try{
 const number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(!s||s.version!==1||!Number.isInteger(s.seed)||!number(s.seed,1,2147483646)||![2,3,4].includes(s.state)||!number(s.elapsed,0,1e10)||!s.player||!number(s.player.x,0,55)||!number(s.player.y,0,55)||!number(s.player.health,-100,100)||!number(s.player.mana,0,100)||typeof s.player.hasKey!=='boolean'||!s.player.direction||!number(s.player.direction.x,-1,1)||!number(s.player.direction.y,-1,1)||Math.hypot(s.player.direction.x,s.player.direction.y)<.9)return null;
 if(!Array.isArray(s.tiles)||s.tiles.length!==55||!s.tiles.every(row=>Array.isArray(row)&&row.length===55&&row.every(t=>t===null||Array.isArray(t)&&t.length===4&&['.',' ','-','~','=','D','d','L','l','X'].includes(t[0])&&number(t[1],0,1)&&number(t[2],0,3)&&typeof t[3]==='boolean')))return null;
 if(!Array.isArray(s.entities)||s.entities.length>500||!s.entities.every(e=>e&&Object.hasOwn(portEntityTypes,e.kind)&&number(e.x,0,55)&&number(e.y,0,55)&&(e.health===undefined||number(e.health,0,120))&&(e.attackCooldown===undefined||number(e.attackCooldown,0,100000))))return null;
 if(!s.stats||!Object.keys(resetStats()).every(k=>k==='timeTaken'?(typeof s.stats[k]==='string'&&s.stats[k].length<40||number(s.stats[k],0,1e10)):number(s.stats[k],0,1e9))||!s.achievements||!Object.keys(resetAchievements()).every(k=>typeof s.achievements[k]==='boolean'))return null;
 return JSON.parse(JSON.stringify(s));
 }catch(e){return null;}}
let portDungeonTiles=null,portDungeonEntities=null;
function portRelease(){Object.keys(downKeys).forEach(k=>downKeys[k]=false);Object.keys(downButtons).forEach(k=>downButtons[k]=false);player.velocity.x=player.velocity.y=0;}
function portPause(){portRelease();if(state===STATE_PLAY)setState(STATE_PAUSE);if(document.pointerLockElement)document.exitPointerLock();}
function portSnapshot(){if(!window.entombedSeed)return null;
 if(map.width===55){portDungeonTiles=map.data.map(row=>row.map(t=>t?[t.type,t.offset||0,t.damage||0,!!t.opening]:null));portDungeonEntities=map.entities.filter(e=>e.alive&&Object.hasOwn(portEntityTypes,e.constructor.name)).map(e=>{const o={kind:e.constructor.name};for(const k of portFields)if(e[k]!==undefined)o[k]=e[k];return o;});}
 if(!portDungeonTiles)return null;
 return {version:1,seed:window.entombedSeed,state:state===STATE_DEAD?STATE_DEAD:state===STATE_WIN?STATE_WIN:STATE_PLAY,elapsed:Math.max(0,Date.now()-startTime),player:{x:player.x,y:player.y,health:player.health,mana:player.mana,hasKey:player.hasKey,direction:{...player.direction}},tiles:portDungeonTiles,entities:portDungeonEntities,stats:{...stats},achievements:{...achievements}};
}
function portRestore(s){portRelease();window.entombedSeed=s.seed;startTime=Date.now()-s.elapsed;stats={...s.stats};achievements={...s.achievements};const dungeon=generateDungeon(new RNG(s.seed));
 dungeon.data.forEach((row,y)=>row.forEach((t,x)=>{const v=s.tiles[y][x];if(!v){row[x]=null;return;}const tile=row[x]={x,y,type:v[0],offset:v[1],damage:v[2]};if(['D','d','L','l'].includes(tile.type)){tile.locked=['L','l'].includes(tile.type);tile.tooltip=tile.locked&&!s.player.hasKey?'Locked':'E: Open';tile.onInteract=open_door;}}));
 dungeon.entities=s.entities.map(e=>{const o=new portEntityTypes[e.kind](e.x,e.y);for(const k of portFields)if(e[k]!==undefined)o[k]=e[k];return o;});
 loadMap(dungeon);Object.assign(player,s.player);player.velocity={x:0,y:0};player.attackCooldown=0;player.mapX=-1;player.mapY=-1;
 dungeon.data.forEach((row,y)=>row.forEach((t,x)=>{if(t&&s.tiles[y][x][3]&&isDoor(t))open_door(t);}));
 portDungeonTiles=s.tiles;portDungeonEntities=s.entities;
 if(s.state===STATE_WIN){loadMap(generateOverworld());setState(STATE_WIN);}else if(s.state===STATE_DEAD)setState(STATE_DEAD);else{state=STATE_PLAY;setState(STATE_PAUSE);}mouseEnabled=true;
}
window.entombedPort=PortShell({id:'entombed',validate:entombedValidate,saveLabel:'每 5 秒与暂停时保存位置、地图、敌人和角色；瞬时弹丸不保存',snapshot:portSnapshot,restore:portRestore,newGame(){start();setState(STATE_PLAY);portSnapshot();portPause();},pause:portPause,release:portRelease,resume(){if(!mouseEnabled)return;if(!audioContext)audioContext=new AudioContext();audioContext.resume();if(state===STATE_TITLE){start();setState(STATE_PLAY);portSnapshot();entombedPort.save();}else if(state===STATE_PAUSE)setState(STATE_PLAY);},input(k,on){if(state!==STATE_PLAY)return;if(k==='shoot')downButtons[MOUSE_LEFT]=on;else if(k==='melee')downButtons[MOUSE_RIGHT]=on;else downKeys[k]=on;}});
document.getElementById('port-interact').onclick=()=>{if(!entombedPort.blocked())interact();};
document.getElementById('port-map').onclick=()=>showMiniMap=!showMiniMap;
outputCanvas.addEventListener('contextmenu',e=>e.preventDefault());
let turnPointer=null,turnX=0;
outputCanvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||state!==STATE_PLAY||entombedPort.blocked())return;e.preventDefault();turnPointer=e.pointerId;turnX=e.clientX;outputCanvas.setPointerCapture(e.pointerId);});
outputCanvas.addEventListener('pointermove',e=>{if(e.pointerId===turnPointer&&state===STATE_PLAY){rotate(player.direction,(e.clientX-turnX)/180);turnX=e.clientX;}});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])outputCanvas.addEventListener(ev,()=>turnPointer=null);
// Capture the dungeon before the original victory transition replaces its map.
const portOriginalLoadMap=loadMap;loadMap=function(m){if(m.name==='surface'&&map&&map.width===55)portSnapshot();portOriginalLoadMap(m);};
img.src='assets.png';
