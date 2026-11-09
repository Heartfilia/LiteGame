// Keep generated catalog descriptions aligned after editorial corrections.
const fs=require('node:fs');
const selection=JSON.parse(fs.readFileSync('deploy/h5-selection.json','utf8'));
let catalog=fs.readFileSync('assets/js/games.js','utf8');
for(const row of selection){const file='games/crisp/'+row[0]+'/index.html';let page=fs.readFileSync(file,'utf8');page=page.replace(/(<p class="crisp-help">).*?( 鼠标或手机)/,(_,a,b)=>a+row[3]+b);fs.writeFileSync(file,page);catalog=catalog.replace(new RegExp('(\\"id\\": \\"aba-'+row[0]+'\\"[^\\n]*?\\"description\\": )\\"[^\\"]*\\"'),(_,prefix)=>prefix+JSON.stringify(row[3]));}
catalog=catalog.replace('在逐步推进的牌阵挑战中选择路线和卡牌。','相同数字的牌合力压倒较小的牌，抢先清空手牌和面前的牌。');
fs.writeFileSync('assets/js/games.js',catalog);
