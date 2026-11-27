#!/usr/bin/env node
/* 把 games/nes/catalog.json 同步进 games.js 的街机目录区块
 *
 * 与 deploy/import-nes.py 的 publish_catalog 保持一致，但不需要重新导入 ROM：
 * 改名、隐藏重复条目后跑一次即可。
 *
 * 用法：node deploy/sync-nes-catalog.cjs [--dry]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const START = '// BEGIN GENERATED NES CATALOG';
const END = '// END GENERATED NES CATALOG';
const dry = process.argv.includes('--dry');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'games/nes/catalog.json'), 'utf8'));
const fames = { '魂斗罗': 0, '马戏团': 1, '冒险岛1': 2 };

const games = manifest.games
  .filter((e) => !e.hidden)
  .map((e) => ({
    id: e.id,
    title: e.title,
    category: 'retro',
    url: 'games/nes/index.html?game=' + e.id + '&from=retro',
    cover: 'assets/images/covers/nes.svg',
    tags: ['FC / NES', e.status === 'boot' ? '启动已检查' : e.status === 'pending' ? '兼容性待确认' : '暂不兼容', '触屏手柄'],
    description: e.detail,
    source: 'mengfei523060/nesrom'
  }))
  .sort((a, b) => {
    const fa = fames[a.title] ?? 3;
    const fb = fames[b.title] ?? 3;
    if (fa !== fb) return fa - fb;
    const ba = a.tags.includes('启动已检查') ? 0 : 1;
    const bb = b.tags.includes('启动已检查') ? 0 : 1;
    if (ba !== bb) return ba - bb;
    return a.title.localeCompare(b.title, 'zh');
  });

const file = path.join(ROOT, 'assets/js/games.js');
let text = fs.readFileSync(file, 'utf8');
if (text.includes(START)) {
  text = text.slice(0, text.indexOf(START)) + text.slice(text.indexOf(END) + END.length);
}
text = text.trimEnd() + '\n\n' + START + '\nwindow.GAME_DATA.games.push(...' + JSON.stringify(games) + ');\n' + END + '\n';

if (!dry) fs.writeFileSync(file, text);
console.log(JSON.stringify({ published: games.length, hidden: manifest.games.length - games.length, dry }));