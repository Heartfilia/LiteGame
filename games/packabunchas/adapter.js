// MIT, LiteGame contributors 2026. Original game.js: Mattia Fortunati, 2021.
(function(){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),palette=['#FFEA7E','#A09CF1','#C2FDFF','#FFC886','#94DEC3','#D8D0FF','#FED1E6','#7DC864'];
 let paused=true,selected=null,pointer=null,dragOrigin=null,completed=false,rescued=0,round=1,mode=0,hints=0,solutions=[],hintUntil=0;
 const text=document.getElementById('packing-message'),head=document.getElementById('packing-stats'),next=document.getElementById('packing-next');
 const sizeOf=s=>({minX:Math.min(...s.map(b=>b[0])),minY:Math.min(...s.map(b=>b[1])),maxX:Math.max(...s.map(b=>b[0])),maxY:Math.max(...s.map(b=>b[1]))});
 function prepare(){state='game';gameStarted=true;isCinematic=false;GENERATING=false;toDrawPieces=true;showFire=false;overlayAlpha=0;gridOffsetX=0;buttons=[];draggedBlock=null;lastDraggedBlock=null;isMousePressed=false;}
 function arrangeTray(){pieces.forEach((p,i)=>{const box=sizeOf(p.blocks),col=i%4,row=Math.floor(i/4);p.originalPosition={x:(1+col*3-box.minX)*blockSize,y:(2+row*4-box.minY)*blockSize};p.position={...p.originalPosition};});}
 function generate(){prepare();completed=false;selected=null;hints=0;hintUntil=0;pieces=[];solutions=[];const count=[4,5,6,2,3][mode],occupied=new Set();bag={blocks:[],originalPosition:{x:blockSize,y:blockSize*10},position:{x:blockSize,y:blockSize*10},contains(x,y){return this.blocks.some(b=>Math.abs(this.originalPosition.x+b[0]*blockSize-x)<bSize&&Math.abs(this.originalPosition.y+b[1]*blockSize-y)<bSize);}};
 let fallback=false;
 for(let i=0;i<count;i++){
  const size=mode===1?5:mode===2?2+Math.floor(Math.random()*4):mode===3?3:4;let blocks,box;
  for(let tries=0;tries<40;tries++){blocks=generatePolyomino(size);box=sizeOf(blocks);if(box.maxX-box.minX<=2&&box.maxY-box.minY<=2)break;}
  if(box.maxX-box.minX>2||box.maxY-box.minY>2)blocks=[[0,0,.1],[1,0,0],[0,1,0],[1,1,.1],[0,2,0]].slice(0,size);
  createPiece(0,0,blocks,palette[i]);const p=pieces[i];p.portId=i;box=sizeOf(p.blocks);const candidates=[];
  for(let y=0;y<5-(box.maxY-box.minY);y++)for(let x=0;x<11-(box.maxX-box.minX);x++){
   const ox=x-box.minX,oy=y-box.minY,cells=p.blocks.map(b=>[b[0]+ox,b[1]+oy]);if(cells.some(([a,b])=>occupied.has(a+','+b)))continue;
   const contacts=cells.reduce((sum,[a,b])=>sum+[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>occupied.has((a+dx)+','+(b+dy))).length,0);
   candidates.push({ox,oy,cells,score:contacts*10-y-x*.2+Math.random()});
  }
  candidates.sort((a,b)=>b.score-a.score);
  if(!candidates.length){fallback=true;continue;}
  const best=candidates[0];best.cells.forEach(([a,b])=>{occupied.add(a+','+b);bag.blocks.push([a,b]);});solutions.push({id:i,x:best.ox,y:best.oy,angle:0});
 }
 // A bounded 3-by-2 slot layout always fits our six at-most-3-by-3 shapes.
 if(fallback){bag.blocks=[];solutions=[];pieces.forEach((p,i)=>{const box=sizeOf(p.blocks),x=(i%3)*3-box.minX,y=Math.floor(i/3)*3-box.minY;solutions.push({id:i,x,y,angle:0});p.blocks.forEach(b=>bag.blocks.push([b[0]+x,b[1]+y]));});}
 pieces.forEach(p=>p.rotateTo([0,90,180,270][Math.floor(Math.random()*4)]));
 const box=sizeOf(bag.blocks);bag.originalPosition.x=Math.round((w/blockSize-1-box.maxX)/2)*blockSize;bag.position={...bag.originalPosition};arrangeTray();text.textContent='把所有生物装进飞船，不要重叠。';update();}
 function snap(p){const box=sizeOf(p.blocks);p.originalPosition.x=Math.max(1-box.minX,Math.min(Math.floor(w/blockSize-.5)-box.maxX,Math.round(p.originalPosition.x/blockSize)))*blockSize;p.originalPosition.y=Math.max(1-box.minY,Math.min(Math.floor(h/blockSize-.5)-box.maxY,Math.round(p.originalPosition.y/blockSize)))*blockSize;}
 function release(){if(pointer!==null&&dragOrigin&&selected)selected.originalPosition={...dragOrigin};pointer=null;dragOrigin=null;pieces.forEach(p=>p.isDragged=false);draggedBlock=null;isMousePressed=false;}
 function settle(){if(selected)snap(selected);if(!completed&&checkCompleted()){completed=true;rescued+=pieces.length;text.textContent=rescued>=100?'救援里程碑达成：已救出 '+rescued+' 只生物！可以继续探索宇宙。':'飞船装好啦！本盘救出 '+pieces.length+' 只生物。';}port.save();update();}
 function update(){head.replaceChildren(...['第 '+round+' 盘','累计救出 '+rescued+'/100','本盘 '+pieces.length+' 只'].map(t=>{const e=document.createElement('span');e.textContent=t;return e;}));next.hidden=!completed;document.getElementById('packing-pause').textContent=paused?'已暂停 · 点击开始 / 继续':'拖动生物 · 点击选择后可旋转';for(const id of ['packing-select','packing-rotate','packing-hint','packing-shuffle'])document.getElementById(id).disabled=paused||completed&&id!=='packing-shuffle';}
 function snapshot(){return {version:1,round,rescued,mode,completed,hints,bag:{blocks:clone(bag.blocks),position:{...bag.originalPosition}},pieces:pieces.map(p=>({id:p.portId,blocks:clone(p.blocks),position:{...p.originalPosition},angle:p.angle,color:p.fillColor,type:p.type,eye:p.eyeBlock})),solutions:clone(solutions)};}
 function validate(s){try{const n=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b,point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=3000&&Math.abs(p.y)<=3000,blocks=(b,max)=>Array.isArray(b)&&b.length>0&&b.length<=max&&b.every(p=>Array.isArray(p)&&p.length>=2&&p.length<=3&&n(p[0],-12,12)&&n(p[1],-12,12)&&(p.length===2||[0,.1].includes(p[2])))&&new Set(b.map(p=>p[0]+','+p[1])).size===b.length;
 if(!s||s.version!==1||!n(s.round,1,100000)||!n(s.rescued,0,1000000)||!n(s.mode,0,4)||!n(s.hints,0,100000)||typeof s.completed!=='boolean'||!s.bag||!blocks(s.bag.blocks,50)||!point(s.bag.position)||!Array.isArray(s.pieces)||s.pieces.length!==[4,5,6,2,3][s.mode]||!s.pieces.every(p=>p&&n(p.id,0,s.pieces.length-1)&&blocks(p.blocks,7)&&point(p.position)&&[0,90,180,270].includes(p.angle)&&palette.includes(p.color)&&['regular','striped','pois'].includes(p.type)&&n(p.eye,0,p.blocks.length-1))||new Set(s.pieces.map(p=>p.id)).size!==s.pieces.length||!Array.isArray(s.solutions)||s.solutions.length!==s.pieces.length||!s.solutions.every(p=>p&&n(p.id,0,s.pieces.length-1)&&n(p.x,-12,12)&&n(p.y,-12,12)&&p.angle===0)||new Set(s.solutions.map(p=>p.id)).size!==s.pieces.length)return null;
 const cells=new Set();for(const p of s.pieces){const goal=s.solutions.find(t=>t.id===p.id);for(const b of p.blocks){let x=b[0],y=b[1];for(let r=0;r<p.angle/90;r++)[x,y]=[y,-x];const key=(x+goal.x)+','+(y+goal.y);if(cells.has(key)||!s.bag.blocks.some(c=>c[0]===x+goal.x&&c[1]===y+goal.y))return null;cells.add(key);}}if(cells.size!==s.bag.blocks.length)return null;
 if(s.completed){const placed=new Set();if(s.rescued<s.pieces.length)return null;for(const p of s.pieces)for(const b of p.blocks){const x=(p.position.x-s.bag.position.x)/blockSize+b[0],y=(p.position.y-s.bag.position.y)/blockSize+b[1],cell=s.bag.blocks.findIndex(c=>Math.abs(c[0]-x)<.5&&Math.abs(c[1]-y)<.5);if(cell<0||placed.has(cell))return null;placed.add(cell);}}
 return clone(s);}catch(e){return null;}}
 function restore(s){release();round=s.round;rescued=s.rescued;mode=s.mode;completed=s.completed;hints=s.hints;solutions=clone(s.solutions);prepare();pieces=[];for(const p of s.pieces){createPiece(p.position.x,p.position.y,clone(p.blocks),p.color);const o=pieces[pieces.length-1];o.blocks=clone(p.blocks);o.angle=p.angle;o.portId=p.id;o.type=p.type;o.eyeBlock=p.eye;o.position={...p.position};}bag={blocks:clone(s.bag.blocks),originalPosition:{...s.bag.position},position:{...s.bag.position},contains(x,y){return this.blocks.some(b=>Math.abs(this.originalPosition.x+b[0]*blockSize-x)<bSize&&Math.abs(this.originalPosition.y+b[1]*blockSize-y)<bSize);}};selected=null;paused=true;document.getElementById('packing-mode').value=mode;text.textContent=completed?'已恢复完成的拼盘，可继续下一盘。':'已恢复拼盘，点击继续。';update();}
 generate();
 const port=PortShell({id:'packabunchas',validate,snapshot,restore,newGame(){release();round=1;rescued=0;mode=0;document.getElementById('packing-mode').value=0;generate();paused=true;update();},pause(){release();paused=true;update();},release,resume(){paused=false;update();},input(){}});
 function active(){return !paused&&!completed&&!port.blocked();}
 c.addEventListener('pointerdown',e=>{if(!active()||pointer!==null)return;e.preventDefault();const p=getMousePos(c,e);selected=[...pieces].reverse().find(o=>o.contains(p.x,p.y))||null;hintUntil=0;if(!selected)return;pointer=e.pointerId;c.setPointerCapture(pointer);dragOrigin={...selected.originalPosition};startingMouseX=p.x;startingMouseY=p.y;mouseX=p.x;mouseY=p.y;selected.isDragged=true;draggedBlock=selected;isMousePressed=true;});
 c.addEventListener('pointermove',e=>{if(e.pointerId!==pointer||!active())return;const p=getMousePos(c,e);selected.originalPosition.x=dragOrigin.x+p.x-startingMouseX;selected.originalPosition.y=dragOrigin.y+p.y-startingMouseY;mouseX=p.x;mouseY=p.y;});
 c.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;pointer=null;dragOrigin=null;selected.isDragged=false;draggedBlock=null;isMousePressed=false;settle();});for(const ev of ['pointercancel','lostpointercapture'])c.addEventListener(ev,()=>{if(pointer!==null){release();port.save();}});
 const rotate=()=>{if(!active()||!selected)return;selected.rotate();snap(selected);hintUntil=0;settle();};document.getElementById('packing-rotate').onclick=rotate;
 document.getElementById('packing-select').onclick=()=>{if(!active())return;selected=pieces[(pieces.indexOf(selected)+1)%pieces.length];hintUntil=0;};
 document.getElementById('packing-hint').onclick=()=>{if(!active())return;if(!selected)selected=pieces[0];hints++;hintUntil=performance.now()+6000;text.textContent='虚线显示选中生物的参考位置与朝向；可以先移开占位的其他生物。';port.save();};
 document.getElementById('packing-shuffle').onclick=()=>{if(paused||port.blocked())return;mode=Number(document.getElementById('packing-mode').value);generate();port.save();};
 next.onclick=()=>{if(!completed||port.blocked())return;round++;mode=Number(document.getElementById('packing-mode').value);generate();paused=false;port.save();update();};
 c.addEventListener('keydown',e=>{if(!active()||!selected)return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();selected.originalPosition.x+=d[0]*blockSize;selected.originalPosition.y+=d[1]*blockSize;settle();}if(e.key.toLowerCase()==='r'){e.preventDefault();rotate();}});
 function frame(){requestAnimationFrame(frame);ctx.fillStyle='#223649';ctx.fillRect(0,0,w,h);ctx.fillStyle='#abc5cb';for(let i=0;i<24;i++){ctx.beginPath();ctx.arc((i*173+45)%w,(i*257+30)%h,2,0,7);ctx.fill();}drawPieces();if(selected){ctx.strokeStyle='#fff4cf';ctx.lineWidth=6;ctx.setLineDash([10,8]);for(const b of selected.blocks)ctx.strokeRect(selected.originalPosition.x+b[0]*blockSize-bSize,selected.originalPosition.y+b[1]*blockSize-bSize,blockSize,blockSize);ctx.setLineDash([]);}if(hintUntil>performance.now()&&selected){const goal=solutions.find(s=>s.id===selected.portId);ctx.strokeStyle='#ffffff';ctx.lineWidth=6;ctx.setLineDash([12,8]);for(const b of selected.blocks){let x=b[0],y=b[1];for(let r=0;r<selected.angle/90;r++)[x,y]=[y,-x];ctx.strokeRect(bag.originalPosition.x+(x+goal.x)*blockSize-bSize,bag.originalPosition.y+(y+goal.y)*blockSize-bSize,blockSize,blockSize);}ctx.setLineDash([]);}}
 port.ready();port.save();document.getElementById('casual-loading').remove();frame();
 // Expose the same snapshot/restore boundary used by the journal, for integration tests.
 window.PackingPort={snapshot,validate,restore,settle,get selected(){return selected;}};
})();
