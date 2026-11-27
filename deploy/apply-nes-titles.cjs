#!/usr/bin/env node
/* 用内容指纹还原街机里 z___game_XXX 的真实名字
 *
 * 依据 deploy/nes-title-map.json：
 *   exact  → 与已有条目字节相同，标为重复并隐藏（真实名字已存在）
 *   near   → 相似度 ≥0.98，改名为「原名（复刻版）」
 *   high   → 0.8–0.98，同样按复刻版处理
 *   其余   → 改成「未识别 · mapper N」，把猜测写进 detail 便于人工复核
 *
 * 用法：node deploy/apply-nes-titles.cjs [--dry]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CATALOG = path.join(ROOT, 'games/nes/catalog.json');
const MAP = path.join(__dirname, 'nes-title-map.json');
const dry = process.argv.includes('--dry');

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));

let hidden = 0;
let renamed = 0;
let unknown = 0;
let untouched = 0;

for (const game of catalog.games) {
  const info = map[game.title];
  if (!info) { untouched += 1; continue; }
  if (info.level === 'exact') {
    game.title = info.title;
    game.duplicateOf = info.title;
    game.hidden = true;
    hidden += 1;
  } else if (info.level === 'near' || info.level === 'high') {
    game.title = info.title + '（复刻版）';
    game.identifiedBy = info.level;
    renamed += 1;
  } else {
    game.title = '未识别 · mapper ' + game.mapper;
    game.identifiedBy = info.level;
    if (info.title) {
      game.detail = (game.detail || '') + '；疑似基于「' + info.title + '」（相似度 ' + info.score + '）';
    }
    unknown += 1;
  }
}

catalog.unknownCount = catalog.games.filter((g) => g.identifiedBy === 'low' || g.identifiedBy === 'mid' || g.identifiedBy === 'weak').length;

if (!dry) {
  fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'games/nes/catalog.js'),
    'window.NES_LIBRARY = ' + JSON.stringify(catalog) + ';\n');
}

console.log(JSON.stringify({ hidden, renamed, unknown, untouched, dry }, null, 1));