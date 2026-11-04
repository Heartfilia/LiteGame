// Versioned, portable saves for long-running single-player games.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.CampaignSave=factory;})(typeof window==='object'?window:this,function(id,E,storage){
  'use strict';
  var key='litegame.'+id+'.campaign',backup=key+'.backup',expected=null,lastGood=null,locked=false;
  function hash(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
  function encode(s){var data=E.restore(s);if(!data)throw Error('进度校验失败，未覆盖已有存档。');return JSON.stringify({game:id,format:1,at:Date.now(),data:data,hash:hash(JSON.stringify(data))});}
  function decode(text){if(typeof text!=='string'||text.length>900000)throw Error('存档为空或超过 900KB。');var v=JSON.parse(text);if(!v||v.game!==id||v.format!==1||!v.data||v.data.version!==1)throw Error('游戏或存档版本不匹配。');if(hash(JSON.stringify(v.data))!==v.hash)throw Error('存档校验失败。');var s=E.restore(v.data);if(!s)throw Error('存档内容无效。');return s;}
  function valid(t){try{return decode(t);}catch(e){return null;}}
  function newer(t){try{var p=JSON.parse(t);return p.game===id&&(p.format>1||p.data&&p.data.version>1);}catch(e){return false;}}
  function load(){try{expected=storage.getItem(key);var b=storage.getItem(backup),s=valid(expected);locked=false;if(s){lastGood=expected;return {state:s,status:'loaded'};}if(newer(expected)){locked=true;return {status:'version'};}s=valid(b);if(s){lastGood=b;return {state:s,status:'recovered'};}if(expected!==null||b!==null){locked=true;return {status:'corrupt'};}return {status:'new'};}catch(e){locked=true;return {status:'unavailable'};}}
  function changed(){try{return storage.getItem(key)!==expected;}catch(e){return false;}}
  function write(s,replace){try{if(changed()){locked=true;return {ok:false,reason:'conflict'};}if(locked&&!replace)return {ok:false,reason:'locked'};var text=encode(s);if(expected&&valid(expected)&&JSON.parse(expected).hash===JSON.parse(text).hash){locked=false;return {ok:true};}if(lastGood)storage.setItem(backup,lastGood);storage.setItem(key,text);expected=lastGood=text;locked=false;return {ok:true};}catch(e){return {ok:false,reason:'write',message:e.message};}}
  return {key:key,backupKey:backup,load:load,save:function(s){return write(s,false);},replace:function(s){return write(s,true);},encode:encode,decode:decode,changed:changed,backup:function(){try{return valid(storage.getItem(backup));}catch(e){return null;}}};
});
