// A journal separate from the arcade session: finishing the story never deletes it.
(function(root,factory){if(typeof module!=='undefined'&&module.exports)module.exports=factory;else root.FogtownSaves=factory;})(typeof window!=='undefined'?window:this,function(E,storage){
  'use strict';
  var KEY='litegame.fogtown.save', BACKUP=KEY+'.backup', expected=null, blocked=false, reason='', lastGood=null;
  function checksum(text){var h=2166136261;for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
  function encode(s){var valid=E.restore(s);if(!valid)throw new Error('当前进度未通过校验，原存档未覆盖。');var data=JSON.stringify(valid);return JSON.stringify({game:'fogtown',format:1,savedAt:Date.now(),checksum:checksum(data),data:valid});}
  function decode(text){
    if(typeof text!=='string'||text.length>250000)throw new Error('存档为空或文件过大。');
    var p;try{p=JSON.parse(text);}catch(e){throw new Error('存档不是有效的 JSON。');}
    if(!p||p.game!=='fogtown'||p.format!==1||!p.data||p.data.version!==E.VERSION)throw new Error('存档格式或版本不支持，请使用对应版本的游戏。');
    if(p.checksum!==checksum(JSON.stringify(p.data)))throw new Error('存档校验失败，文件可能不完整。');
    var s=E.restore(p.data);if(!s)throw new Error('存档内容不完整或进度不一致。');return s;
  }
  function valid(text){try{return decode(text);}catch(e){return null;}}
  function load(){
    try{
      expected=storage.getItem(KEY);var backup=storage.getItem(BACKUP),s=valid(expected);blocked=false;reason='';
      if(s){lastGood=expected;return {state:s,status:'loaded'};}
      // Do not replace a newer-format primary with an older backup.
      if(expected){try{var p=JSON.parse(expected);if(p&&p.game==='fogtown'&&(p.format>1||p.data&&p.data.version>E.VERSION)){blocked=true;reason='version';return {state:null,status:'version'};}}catch(e){/* corrupt primary: try backup */}}
      s=valid(backup);if(s){lastGood=backup;return {state:s,status:'recovered'};}
      if(expected!==null||backup!==null){blocked=true;reason='corrupt';return {state:null,status:'corrupt'};}
      lastGood=null;return {state:null,status:'new'};
    }catch(e){blocked=true;reason='unavailable';return {state:null,status:'unavailable'};}
  }
  function save(s){
    if(blocked)return {ok:false,reason:reason};
    try{
      var current=storage.getItem(KEY);if(current!==expected){blocked=true;reason='conflict';return {ok:false,reason:reason};}
      var text=encode(s),old=lastGood&&valid(lastGood);
      if(old&&JSON.stringify(old)===JSON.stringify(E.restore(s))&&current===lastGood)return {ok:true};
      if(lastGood)storage.setItem(BACKUP,lastGood);
      storage.setItem(KEY,text);expected=text;lastGood=text;return {ok:true};
    }catch(e){return {ok:false,reason:'write',message:e.message};}
  }
  // Explicit user-confirmed import/new adventure. Preserve the old good save first.
  function replace(s){
    try{
      var text=encode(s),current=storage.getItem(KEY);
      if(current!==expected)return {ok:false,reason:'conflict'};
      if(valid(current))storage.setItem(BACKUP,current);
      else if(lastGood)storage.setItem(BACKUP,lastGood);
      storage.setItem(KEY,text);expected=text;lastGood=text;blocked=false;reason='';return {ok:true};
    }catch(e){return {ok:false,reason:'write',message:e.message};}
  }
  function backup(){try{return decode(storage.getItem(BACKUP));}catch(e){return null;}}
  function hasExternalChange(){try{return storage.getItem(KEY)!==expected;}catch(e){return false;}}
  return {KEY:KEY,BACKUP:BACKUP,load:load,save:save,replace:replace,encode:encode,decode:decode,backup:backup,checksum:checksum,hasExternalChange:hasExternalChange};
});
