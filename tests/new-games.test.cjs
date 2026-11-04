// Pure rule engines live in each game page, like the existing Chogan games.
// Run with: node --test tests/new-games.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function engine(id) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'games', id, 'index.html'), 'utf8');
  const source = html.split('/* ==== ENGINE START ==== */')[1].split('/* ==== ENGINE END ==== */')[0];
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(source, sandbox);
  return sandbox.module.exports();
}
const merge = engine('2048'), snake = engine('snake'), rhythm = engine('rhythm');
const fixed = () => 0;

test('2048 merges each tile once, scores merges and spawns only after a valid move', () => {
  const s = { board: [2, 2, 2, 2, ...Array(12).fill(0)], score: 0, moves: 0, elapsed: 0 };
  assert.equal(merge.move(s, 'left', fixed), true);
  assert.deepEqual(s.board.slice(0, 4), [4, 4, 2, 0]);
  assert.equal(s.score, 8);
  assert.equal(s.moves, 1);
  const noMove = { board: [2, 0, 0, 0, ...Array(12).fill(0)], score: 0, moves: 0 };
  assert.equal(merge.move(noMove, 'left', fixed), false);
  assert.equal(noMove.board.filter(Boolean).length, 1);
  assert.equal(noMove.moves, 0);
});

test('2048 handles all four directions and detects a blocked board', () => {
  for (const [dir, cells, target] of [['left', [0, 1], 0], ['right', [0, 1], 3], ['up', [0, 4], 0], ['down', [0, 4], 12]]) {
    const s = { board: Array(16).fill(0), score: 0, moves: 0 };
    cells.forEach(i => { s.board[i] = 1024; });
    merge.move(s, dir, fixed);
    assert.equal(s.board[target], 2048);
    assert.equal(s.score, 2048);
  }
  const s = { board: [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2] };
  assert.equal(merge.canMove(s), false);
  s.board[1] = 2;
  assert.equal(merge.canMove(s), true);
});

test('snake rejects reversals and queues fast turns without reversing into itself', () => {
  const s = snake.newGame(fixed, 0);
  assert.equal(snake.turn(s, 'left'), false);
  assert.equal(snake.turn(s, 'up'), true);
  assert.equal(snake.turn(s, 'down'), false);
  assert.equal(snake.turn(s, 'left'), true);
  snake.step(s, fixed);
  assert.equal(s.body[0], 152);
  snake.step(s, fixed);
  assert.equal(s.body[0], 151);
  assert.equal(s.over, false);
});

test('snake grows, places food outside its body and permits a vacating tail cell', () => {
  const s = snake.newGame(fixed, 0);
  s.food = 171;
  snake.step(s, fixed);
  assert.equal(s.score, 1);
  assert.equal(s.body.length, 4);
  assert.equal(s.body.includes(s.food), false);
  const loop = { body: [19, 20, 38, 37], dir: 'down', queue: [], food: 0, score: 1, over: false };
  snake.step(loop, fixed);
  assert.equal(loop.body[0], 37);
  assert.equal(loop.over, false);
});

test('snake detects walls, self collisions and a completely filled board', () => {
  const wall = snake.newGame(fixed, 0);
  wall.body = [17, 16, 15];
  snake.step(wall, fixed);
  assert.equal(wall.over, true);
  const self = { body: [19, 20, 38, 37, 36], dir: 'down', queue: [], food: 0, over: false };
  snake.step(self, fixed);
  assert.equal(self.over, true);
  const full = snake.newGame(fixed, 0);
  full.body = [1, ...Array.from({ length: 324 }, (_, i) => i).filter(i => i !== 0 && i !== 1)];
  full.food = 0; full.dir = 'left'; full.score = 320;
  snake.step(full, fixed);
  assert.equal(full.won, true);
  assert.equal(full.food, -1);
});

test('rhythm grades timing windows and cannot score the same note twice', () => {
  for (const [delta, grade] of [[0, '完美'], [0.09, '很棒'], [0.15, '命中']]) {
    const s = rhythm.newGame(0);
    rhythm.advance(s, 2 + delta);
    assert.equal(rhythm.hit(s, 0), grade);
    assert.equal(s.hits, 1);
    assert.equal(rhythm.hit(s, 0), '空拍');
    assert.equal(s.hits, 1);
    assert.equal(s.combo, 0);
  }
});

test('rhythm registers misses once and a perfect full run reaches 100% accuracy', () => {
  const missed = rhythm.newGame(0);
  assert.equal(rhythm.advance(missed, 2.19), 1);
  assert.equal(rhythm.advance(missed, 2.2), 0);
  assert.equal(missed.misses, 1);
  for (const mode of [0, 1]) {
    const s = rhythm.newGame(mode);
    for (const n of s.notes) { rhythm.advance(s, n.at); assert.equal(rhythm.hit(s, n.lane), '完美'); }
    rhythm.advance(s, s.notes[63].at + 1);
    assert.equal(s.maxCombo, 64);
    assert.equal(s.weight, 6400);
    assert.equal(s.over, true);
    assert.equal(s.misses, 0);
  }
});

test('save restore preserves progress and rejects malformed saves', () => {
  for (const [e, s] of [[merge, merge.newGame(fixed)], [snake, snake.newGame(fixed, 0)], [rhythm, rhythm.newGame(0)]]) {
    const restored = e.restore(JSON.parse(JSON.stringify(s)));
    assert.ok(restored);
    assert.equal(JSON.stringify(restored), JSON.stringify(s));
    assert.equal(e.restore(null), null);
    assert.equal(e.restore({}), null);
  }
  const badMerge = merge.newGame(fixed); badMerge.board[0] = 3;
  assert.equal(merge.restore(badMerge), null);
  const badSnake = snake.newGame(fixed, 0); badSnake.food = badSnake.body[0];
  assert.equal(snake.restore(badSnake), null);
  const badRhythm = rhythm.newGame(0); badRhythm.notes[0].at = 999;
  assert.equal(rhythm.restore(badRhythm), null);
});

test('catalog has playable entries and local covers in every category', () => {
  const window = {};
  const root = path.join(__dirname, '..');
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/games.js'), 'utf8'), { window });
  const { games, categories } = window.GAME_DATA;
  assert.equal(new Set(games.map(g => g.id)).size, games.length);
  // The original eight sections were expanded to three; RPG starts with one campaign.
  for (const c of categories) assert.ok(games.filter(g => g.category === c.id).length >= 3, c.id + ' has too few games');
  for (const g of games) {
    assert.ok(fs.existsSync(path.join(root, g.url.split('?')[0])), g.url);
    assert.ok(fs.existsSync(path.join(root, g.cover)), g.cover);
  }
});
