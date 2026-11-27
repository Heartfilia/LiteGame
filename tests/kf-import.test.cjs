// 授权移植的产物检查：中文注入、去第三方脚本、本地依赖、目录登记。
// 不需要网络，跑的是导入脚本生成后的文件。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'deploy/kf-manifest.json'), 'utf8'));
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/games.js'), 'utf8'), { window });
const catalog = window.GAME_DATA.games;

test('每个清单里的游戏都已导入，且目录有对应条目', () => {
  for (const game of manifest.games) {
    const dir = path.join(root, 'games/kf-' + game.slug);
    assert.ok(fs.existsSync(path.join(dir, 'index.html')), game.slug + ' 未导入');
    const entry = catalog.find((g) => g.id === 'kf-' + game.slug);
    assert.ok(entry, game.slug + ' 未登记到目录');
    assert.equal(entry.category, 'premium');
    assert.ok(fs.existsSync(path.join(root, entry.cover)), game.slug + ' 封面缺失：' + entry.cover);
    assert.ok(fs.existsSync(path.join(root, entry.url.split('?')[0])), game.slug + ' 入口缺失');
    assert.ok(entry.title && entry.description, game.slug + ' 缺少中文标题或简介');
  }
});

test('导入页面：中文默认、去统计广告、依赖本地化、返回大厅', () => {
  for (const game of manifest.games) {
    const file = path.join(root, 'games/kf-' + game.slug, 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes('window.__KF_ZH__'), game.slug + ' 缺少中文语言包');
    assert.match(html, /let lang = \(window\.__KF_ZH__ \? 'zh' : 'en'\);/, game.slug + ' 默认语言未改为中文');
    // 有些作品是「按一下就切到英文」的按钮，没有下拉，就不要求 option
    if (/<select id="lang"/.test(html)) {
      assert.ok(html.includes('<option value="zh">中文</option>'), game.slug + ' 语言下拉缺少中文');
    }
    assert.ok(html.includes('href="../../index.html#/category/premium"'), game.slug + ' 返回键没指向大厅');
    assert.ok(!/googletagmanager/.test(html), game.slug + ' 仍带 Google Analytics');
    assert.ok(!/<script[^>]*\bsrc="[^"]*ad\.js"/.test(html), game.slug + ' 仍加载原站广告脚本');
    assert.ok(!/cdn\.jsdelivr\.net\/npm\/three/.test(html), game.slug + ' three.js 仍走 CDN');
    assert.ok(!/@dimforge\/rapier3d-compat@/.test(html), game.slug + ' rapier 仍走 CDN');
  }
});

test('中文本地化文件与授权说明都在仓库里', () => {
  for (const game of manifest.games) {
    assert.ok(fs.existsSync(path.join(root, 'deploy/kf-zh', game.slug + '.js')), game.slug + ' 缺少中文语言包源文件');
  }
  const license = fs.readFileSync(path.join(root, 'deploy/KF-LICENSE.md'), 'utf8');
  assert.match(license, /不得部署在日本/);
  assert.match(manifest.credit, /Kei Furukawa/);
  assert.ok(fs.existsSync(path.join(root, 'games/lib/three/build/three.module.js')), 'three.js 未本地化');
});