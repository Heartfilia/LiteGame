// 精致游戏三款联机/对局引擎：π 死亡游戏、猫猫找不同、饺子。
// 纯 Node 规则测试：node --test tests/premium-games.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');
const PI = require(path.join(root, 'games/pi-death/engine.js'));
const CAT = require(path.join(root, 'games/cat-find/engine.js'));
const GY = require(path.join(root, 'games/gyoza/engine.js'));

// ---------- π 死亡游戏 ----------
test('π 前 50 位与常数一致', () => {
  assert.equal(PI.DIGITS.slice(0, 50), '14159265358979323846264338327950288419716939937510');
  assert.equal(PI.DIGITS.length, PI.RULES.maxDigits);
  assert.ok(/^[0-9]+$/.test(PI.DIGITS));
});

test('π：选数字、开盘、命中掉命、出局判负', () => {
  const state = PI.newMatch({ seed: 1 });
  assert.equal(state.phase, 'pick');
  assert.equal(PI.pick(state, 0, 7).ok, true);
  assert.equal(PI.pick(state, 0, 3).ok, false, '选完之后不能再改');
  assert.equal(PI.pick(state, 1, 11).ok, false, '只能是 0–9');
  assert.equal(PI.pick(state, 1, 7).ok, true);

  PI.begin(state, 0);
  assert.equal(state.phase, 'reveal');

  // 一直揭示，直到有人出局
  let now = 0;
  let guard = 0;
  while (!state.over && guard < 400) {
    now += 800; // 开盘有 800ms 预备，之后每 340ms 揭一位；这里按大步推进

    const r = PI.step(state, now);
    assert.equal(r.ok, true);
    for (const p of [0, 1]) {
      assert.ok(state.lives[p] >= 0 && state.lives[p] <= PI.RULES.lives);
    }
  }
  assert.equal(state.over, true);
  assert.ok(state.lives[0] === 0 || state.lives[1] === 0);
  if (state.winner !== 'draw') {
    const loser = state.winner === 0 ? 1 : 0;
    assert.equal(state.lives[loser], 0);
    assert.ok(state.lives[state.winner] > 0);
  }
});

test('π：每掉一次命都发生在揭示到自己的数字时', () => {
  const state = PI.newMatch({ seed: 9 });
  PI.pick(state, 0, 3);
  PI.pick(state, 1, 8);
  PI.begin(state, 0);
  let now = 0;
  let hits = 0;
  while (!state.over && now < 600000) {
    now += 800;
    const before = state.lives.slice();
    const r = PI.step(state, now);
    for (const p of [0, 1]) {
      if (state.lives[p] < before[p]) {
        assert.equal(r.digit, state.picks[p], '掉命必须是因为揭示到了自己选的数字');
        hits += 1;
      }
    }
  }
  assert.ok(hits >= 1);
});

// ---------- 猫猫找不同 ----------
test('猫猫：一桌 20 只，组合唯一且只有一只是题目', () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    const state = CAT.newMatch({ seed, seconds: 0 });
    assert.equal(state.cats.length, CAT.RULES.boardSize);
    const keys = state.cats.map((c) => c.body + '-' + c.pattern + '-' + c.tone);
    assert.equal(new Set(keys).size, keys.length, '牌桌上有两只一模一样的猫');
    const targets = state.cats.filter((c) => c.isTarget);
    assert.equal(targets.length, 1);
    assert.equal(state.cats[state.target].id, targets[0].id);
  }
});

test('猫猫：点对得分并换桌，点错不得分', () => {
  const state = CAT.newMatch({ seed: 5, seconds: 0 });
  const wrong = state.cats.find((c) => !c.isTarget);
  const before = state.cats.map((c) => c.id).join();
  assert.equal(CAT.claim(state, 0, wrong.id).ok, false);
  assert.equal(state.scores[0], 0);
  assert.equal(state.cats.map((c) => c.id).join(), before, '点错不应换桌');

  const ok = CAT.claim(state, 1, state.target);
  assert.equal(ok.ok, true);
  assert.equal(state.scores[1], 1);
  assert.equal(state.round, 1);
  const targets = state.cats.filter((c) => c.isTarget);
  assert.equal(targets.length, 1, '换桌后仍然只有一只目标');
});

test('猫猫：计时结束按比分判胜', () => {
  const state = CAT.newMatch({ seed: 2, seconds: 10, now: 0 });
  state.scores = [5, 3];
  CAT.tick(state, 9999);
  assert.equal(state.over, false);
  CAT.tick(state, 10000);
  assert.equal(state.over, true);
  assert.equal(state.winner, 0);
  assert.equal(CAT.timeLeft(state, 4000), 6000);
});

test('猫猫：电脑不会在目标之外乱指认', () => {
  const state = CAT.newMatch({ seed: 4, seconds: 0 });
  let hits = 0;
  for (let i = 0; i < 60; i += 1) {
    const plan = CAT.cpuPick(state, 1, () => i / 60);
    assert.ok(plan.id >= 0 && plan.id < CAT.RULES.boardSize);
    if (!plan.miss) { hits += 1; assert.equal(plan.id, state.target); }
  }
  assert.ok(hits > 0);
});

// ---------- 饺子 ----------
test('饺子：初始三笼 7/5/3，只能吃 1–2 只', () => {
  const state = GY.newMatch({ now: 0 });
  assert.deepEqual(state.piles, [7, 5, 3]);
  assert.equal(GY.play(state, 0, 0, 3).ok, false, '不能一次吃 3 只');
  assert.equal(GY.play(state, 0, 0, 0).ok, false, '不能吃 0 只');
  assert.equal(GY.play(state, 1, 0, 1).ok, false, '没轮到 2P');
  assert.equal(GY.play(state, 0, 0, 2).ok, true);
  assert.deepEqual(state.piles, [5, 5, 3]);
  assert.equal(state.turn, 1);
});

test('饺子：吃到最后一只的人赢', () => {
  const state = GY.newMatch({ piles: [2, 0, 0], now: 0 });
  const r = GY.play(state, 0, 0, 2, 0);
  assert.equal(r.ok, true);
  assert.equal(r.ateLast, true);
  assert.equal(state.over, true);
  assert.equal(state.winner, 0);
  assert.equal(GY.total(state), 0);
});

test('饺子：Grundy 值决定必败位', () => {
  assert.equal(GY.xorKey([7, 5, 3]), 1 ^ 2 ^ 0);
  assert.equal(GY.xorKey([3, 3, 3]), 0);
  assert.equal(GY.xorKey([1, 1, 0]), 0);
  // 从必败位出发，任何一步都会走到必胜位
  const losable = GY.newMatch({ piles: [3, 3, 3], now: 0 });
  for (const mv of GY.allMoves(losable)) {
    const next = losable.piles.slice();
    next[mv.plate] -= mv.n;
    assert.notEqual(GY.xorKey(next), 0, '必败位不该有走到必败位的招');
  }
});

test('饺子：电脑只在合法招里选，且能收尾', () => {
  const state = GY.newMatch({ now: 0 });
  for (let i = 0; i < 80; i += 1) {
    const mv = GY.cpuMove(state, state.turn, () => (i % 10) / 10);
    assert.ok(mv);
    assert.ok(state.piles[mv.plate] >= mv.n, '电脑选了吃不到的饺子');
    assert.ok(mv.n >= 1 && mv.n <= 2);
    const r = GY.play(state, state.turn, mv.plate, mv.n, 0);
    assert.equal(r.ok, true);
    if (state.over) break;
  }
  assert.equal(state.over, true, '一直按合法招走必须能吃完');
  assert.ok(state.winner === 0 || state.winner === 1);
});

test('饺子：20 秒不走自动替一手，且不越界', () => {
  const state = GY.newMatch({ now: 0 });
  assert.equal(GY.forceTurn(state, 5000).ok, false, '还没超时');
  const r = GY.forceTurn(state, 21000);
  assert.equal(r.ok, true);
  assert.equal(GY.total(state), 15 - r.state.last.n);
  assert.equal(state.turn, 1);
});