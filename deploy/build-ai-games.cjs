// Dependencies live outside the site. Set AI_SPEED_MODULES / AI_CF_MODULES to node_modules.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  for (const [id, env, category] of [['ai-speed', 'AI_SPEED_MODULES', 'racing'], ['ai-cf', 'AI_CF_MODULES', 'shooting']]) {
    const modules = process.env[env];
    if (!modules) throw new Error('Missing ' + env);
    const esbuild = require(path.join(modules, 'esbuild'));
    const dir = path.join(root, 'games', id);
    await esbuild.build({ entryPoints: [path.join(dir, 'src/main.js')], bundle: true, minify: true, format: 'iife', nodePaths: [modules], outfile: path.join(dir, 'game.js'), legalComments: 'eof' });
    fs.copyFileSync(path.join(modules, 'three/LICENSE'), path.join(dir, 'THREE-LICENSE'));
    let html = fs.readFileSync(path.join(dir, 'src/index.html'), 'utf8');
    html = html.replace(/<script\b[^>]*src=["'][^"']+["'][^>]*><\/script>/g, '')
      .replace(/<link\b[^>]*href=["'](?:\.\/)?style\.css["'][^>]*>/g, '')
      .replace('width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no', 'width=device-width,initial-scale=1,viewport-fit=cover');
    if (id === 'ai-cf') html = html.replace('</head>', '<link rel="stylesheet" href="src/style.css">\n</head>');
    html = html.replace('</head>', '<link rel="stylesheet" href="../lib/ai-shell.css">\n</head>')
      .replace('<body>', '<body data-game-id="' + id + '" data-category="' + category + '">')
      .replace('</body>', '<script src="../../assets/js/games.js"></script><script src="../../assets/js/favorites.js"></script><script src="../lib/ai-shell.js"></script><script src="game.js"></script></body>');
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
