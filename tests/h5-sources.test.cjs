const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
test('ABA provenance: every vendored game matches its pinned upstream hash',()=>{
 const manifest=JSON.parse(fs.readFileSync('games/crisp/manifest.json','utf8'));
 assert.equal(manifest.games.length,37);
 for(const g of manifest.games){const name=g.id.slice(4),file='games/crisp/'+name+'/main.js';assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),g.sha256,g.id);assert.ok(g.source.includes(manifest.repositories[g.source.includes('-11-games')?'crisp-game-lib-11-games':'crisp-game-lib-games']));}
 for(const name of Object.keys(manifest.repositories))assert.match(fs.readFileSync('games/crisp/'+name+'.LICENSE','utf8'),/Permission is hereby granted/);
 for(const p of manifest.packages)assert.ok(fs.existsSync('games/crisp/vendor/'+p.name+'.LICENSE'));
});
test('import entrypoints have only local script/style/frame dependencies',()=>{
 const dirs=JSON.parse(fs.readFileSync('deploy/h5-selection.json','utf8')).map(r=>'games/crisp/'+r[0]);
 for(const dir of dirs)for(const name of ['index.html','frame.html']){const html=fs.readFileSync(path.join(dir,name),'utf8');for(const m of html.matchAll(/<(?:script|iframe|link)\b[^>]*(?:src|href)="([^"]+)"/g)){assert.ok(!/^https?:/.test(m[1]),m[1]);assert.ok(fs.existsSync(path.resolve(dir,m[1])),m[1]);}}
});
