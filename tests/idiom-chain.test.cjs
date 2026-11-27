// 成语接龙：词库连通性、发牌不变量、抢牌规则与电脑行为。
// 纯 Node 规则测试，无需浏览器：node --test tests/idiom-chain.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'games/idiom-chain/idioms.js'), 'utf8'), { window });
const DATA = window.IDIOM_CHAIN_DATA;
const E = require(path.join(root, 'games/idiom-chain/engine.js'));
const index = E.buildIndex(DATA);

test('词库规模与字形', () => {
  assert.ok(DATA.length >= 1500, '成语数量不足：' + DATA.length);
  const seen = new Set();
  for (const [w, p] of DATA) {
    assert.equal(w.length, 4, w);
    assert.match(w, /^[\u4e00-\u9fa5]{4}$/, w);
    assert.ok(p && p.length > 0, w + ' 缺拼音');
    assert.ok(!seen.has(w), '重复成语：' + w);
    seen.add(w);
  }
});

test('词库可用于接龙：每个尾字都有可接项', () => {
  const tails = new Set(DATA.map(([w]) => w[3]));
  const heads = new Set(DATA.map(([w]) => w[0]));
  for (const ch of tails) assert.ok(heads.has(ch), '尾字「' + ch + '」接不上任何成语');
});

test('开局：12 张牌桌、有可接的牌、无重复', () => {
  for (let seed = 1; seed <= 120; seed += 1) {
    const state = E.newMatch(DATA, { seed, seconds: 0, index });
    assert.equal(state.board.length, E.RULES.boardSize, '牌桌张数');
    assert.ok(E.matching(state).length >= 1, '无可接牌（seed ' + seed + '）');
    const board = state.board.map((c) => c.w);
    assert.equal(new Set(board).size, board.length, '牌桌上出现重复成语');
    const deck = state.deck.map((c) => c.w);
    assert.equal(new Set(deck).size, deck.length, '牌堆里出现重复成语');
    assert.equal(state.scores[0], 0);
    assert.equal(state.scores[1], 0);
  }
});

test('抢牌：只接受接得上的牌，且抢到后换尾字', () => {
  const state = E.newMatch(DATA, { seed: 7, seconds: 0, index });
  const need = state.need;
  const wrong = state.board.find((c) => c.w[0] !== need);
  assert.equal(E.claim(state, 0, wrong.w, { index }).ok, false, '接不上的牌应被拒绝');
  assert.equal(E.claim(state, 0, '不存在的成语', { index }).ok, false, '牌桌外的牌应被拒绝');
  assert.equal(state.scores[0], 0);

  const right = E.matching(state)[0];
  const result = E.claim(state, 1, right.w, { index });
  assert.equal(result.ok, true);
  assert.equal(state.scores[1], 1);
  assert.equal(state.scores[0], 0);
  assert.equal(state.need, right.w[3], '尾字应变成刚抢到的成语末字');
  assert.ok(!state.board.some((c) => c.w === right.w), '抢走的牌不该留在牌桌');
  assert.ok(E.matching(state).length >= 1, '补牌后仍要能继续接');
});

test('连续抢牌：牌桌始终有解，链不断裂', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const state = E.newMatch(DATA, { seed, seconds: 0, index });
    let moves = 0;
    while (moves < 60) {
      const options = E.matching(state);
      assert.ok(options.length > 0, '第 ' + moves + ' 手无牌可抢（seed ' + seed + '）');
      const pick = options[moves % options.length];
      const r = E.claim(state, moves % 2, pick.w, { index });
      assert.equal(r.ok, true);
      moves += 1;
    }
    for (let i = 1; i < state.chain.length; i += 1) {
      const prev = state.chain[i - 1].w;
      assert.equal(state.chain[i].w[0], prev[3], '接龙断裂：' + prev + ' → ' + state.chain[i].w);
    }
  }
});

test('计时结束按比分判胜负', () => {
  const state = E.newMatch(DATA, { seed: 3, seconds: 10, index, now: 0 });
  state.scores = [4, 2];
  E.tick(state, 9000, { index });
  assert.equal(state.over, false);
  E.tick(state, 10001, { index });
  assert.equal(state.over, true);
  assert.equal(state.winner, 0);
  assert.equal(E.timeLeft(state, 5000), 5000);

  const draw = E.newMatch(DATA, { seed: 4, seconds: 10, index, now: 0 });
  draw.scores = [3, 3];
  E.tick(draw, 10001, { index });
  assert.equal(draw.winner, 'draw');
});

test('电脑只会抢接得上的牌', () => {
  const state = E.newMatch(DATA, { seed: 11, seconds: 0, index });
  const valid = new Set(E.matching(state).map((c) => c.w));
  for (let i = 0; i < 50; i += 1) {
    const action = E.cpuAction(state, 1, () => i / 50);
    assert.ok(action && valid.has(action.card), '电脑选了不合法的牌');
    assert.ok(action.delay >= E.RULES.cpuMinDelay && action.delay <= E.RULES.cpuMaxDelay);
  }
});