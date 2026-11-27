const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { NES, Controller } = require('../games/nes/vendor/jsnes.min.js');
const root = path.join(__dirname, '../games/nes');

test('NES catalog includes every source entry and deduplicated ROMs retain their checksums', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json')));
  assert.equal(catalog.games.length, 932);
  assert.equal(new Set(catalog.games.map(g => g.id)).size, 932);
  const checked = new Set();
  for (const game of catalog.games) {
    assert.match(game.id, /^nes-[a-f0-9]{16}$/);
    assert.match(game.rom, /^roms\/[a-f0-9]{64}\.nes$/);
    assert.ok(['boot', 'blank', 'unsupported', 'invalid', 'timeout'].includes(game.status), game.title);
    if (checked.has(game.sha256)) continue;
    const bytes = fs.readFileSync(path.join(root, game.rom));
    assert.equal(bytes.length, game.size);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), game.sha256);
    checked.add(game.sha256);
  }
});

test('Contra, Circus and Adventure Island boot and save states reproduce future frames', () => {
  const { games } = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json')));
  for (const title of ['魂斗罗', '马戏团', '冒险岛']) {
    const game = games.find(g => g.title === title && g.status === 'boot') || games.find(g => g.title.includes(title) && g.status === 'boot');
    assert.ok(game, title);
    let screen;
    const nes = new NES({ emulateSound: false, onFrame: buffer => { screen = Buffer.from(new Uint32Array(buffer).buffer); } });
    const bytes = fs.readFileSync(path.join(root, game.rom)); nes.loadROM(bytes);
    for (let i = 0; i < 120; i++) nes.frame();
    nes.buttonDown(1, Controller.BUTTON_START); nes.frame(); nes.buttonUp(1, Controller.BUTTON_START);
    const saved = JSON.parse(JSON.stringify(nes.toJSON()));
    for (let i = 0; i < 15; i++) nes.frame();
    const expected = crypto.createHash('sha256').update(screen).digest('hex');
    nes.fromJSON(saved);
    for (let i = 0; i < 15; i++) nes.frame();
    assert.equal(crypto.createHash('sha256').update(screen).digest('hex'), expected, game.title);
  }
});


test('匿名 ROM 已按指纹还原或隐藏，不再出现 z___game 名字', () => {
  const root = path.join(__dirname, '..');
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'games/nes/catalog.json')));
  const map = JSON.parse(fs.readFileSync(path.join(root, 'deploy/nes-title-map.json')));
  const byId = new Map(catalog.games.map((g) => [g.id, g]));

  assert.equal(catalog.games.filter((g) => /^z___game_/.test(g.title)).length, 0);
  for (const name of Object.keys(map)) {
    assert.ok(!catalog.games.some((g) => g.title === name), '仍有一条匿名标题：' + name);
  }
  for (const game of catalog.games.filter((g) => g.hidden)) {
    assert.ok(game.duplicateOf, game.id + ' 隐藏但没有 duplicateOf');
    assert.ok(catalog.games.some((g) => g.title === game.duplicateOf && !g.hidden), game.duplicateOf + ' 没有对应的可见条目');
  }
  for (const game of catalog.games.filter((g) => g.identifiedBy === 'near' || g.identifiedBy === 'high')) {
    assert.match(game.title, /（复刻版）$/, game.title + ' 缺少复刻版标记');
  }
  assert.ok(byId.size === catalog.games.length);
});
