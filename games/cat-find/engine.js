/* 猫猫找不同 · 规则引擎
 * 共享牌桌上摆 20 只猫，只有 1 只与题目完全一致；抢到得分，抢错冻结。
 * 房主权威：客人只提交点位，房主校验后广播。
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CatFindEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RULES = {
    boardSize: 20,
    seconds: 60,
    freezeMs: 900,
    comboCount: 96
  };

  const BODY = ['#e9d4b2', '#cdb28c', '#a9855f', '#9aa0a6', '#dcc6a8', '#b98f6b'];
  const PATTERN = ['tabby', 'spots', 'patch', 'plain'];
  const TONE = ['#6b4a33', '#3f3a36', '#8d5a3f', '#5a5f63'];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function allCombos() {
    const list = [];
    for (let b = 0; b < BODY.length; b += 1) {
      for (let p = 0; p < PATTERN.length; p += 1) {
        for (let t = 0; t < TONE.length; t += 1) list.push({ body: b, pattern: p, tone: t });
      }
    }
    return list;
  }

  const COMBOS = allCombos();

  function shuffle(list, rand) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function same(a, b) {
    return a.body === b.body && a.pattern === b.pattern && a.tone === b.tone;
  }

  /** 生成一桌猫：随机取 20 个组合，目标从中随机指定。 */
  function deal(rand) {
    const pool = shuffle(COMBOS.slice(), rand).slice(0, RULES.boardSize);
    const targetIndex = Math.floor(rand() * pool.length);
    const cats = pool.map((c, i) => ({
      id: i,
      body: c.body,
      pattern: c.pattern,
      tone: c.tone,
      isTarget: i === targetIndex
    }));
    return { cats, target: targetIndex };
  }

  function newMatch(opts = {}) {
    const seed = (opts.seed ?? Date.now()) >>> 0;
    const rand = mulberry32(seed);
    const dealt = deal(rand);
    return {
      v: 1,
      seed,
      round: 0,
      cats: dealt.cats,
      target: dealt.target,
      scores: [0, 0],
      over: false,
      winner: null,
      seconds: opts.seconds || RULES.seconds,
      startedAt: opts.now || 0,
      last: null
    };
  }

  function claim(state, player, id) {
    if (state.over) return { ok: false, error: '本局已结束' };
    const cat = state.cats.find((c) => c.id === id);
    if (!cat) return { ok: false, error: '没有这只猫' };
    if (!same(cat, state.cats[state.target])) return { ok: false, error: '不是同一只' };
    state.scores[player] += 1;
    state.round += 1;
    state.last = { player, id };
    const rand = mulberry32(state.seed + state.round * 7919);
    const dealt = deal(rand);
    state.cats = dealt.cats;
    state.target = dealt.target;
    return { ok: true, state, cat };
  }

  function tick(state, now) {
    if (state.over) return state;
    if (state.seconds && now - state.startedAt >= state.seconds * 1000) {
      state.over = true;
      const [a, b] = state.scores;
      state.winner = a > b ? 0 : b > a ? 1 : 'draw';
    }
    return state;
  }

  function timeLeft(state, now) {
    if (!state.seconds) return null;
    return Math.max(0, state.seconds * 1000 - (now - state.startedAt));
  }

  /** 电脑：按反应时间挑出目标；偶尔挑错（邻近的组合）。 */
  function cpuPick(state, player, rand = Math.random) {
    const delay = 1100 + rand() * 1600;
    if (rand() < 0.12) {
      const wrong = state.cats.filter((c) => !c.isTarget);
      return { id: wrong[Math.floor(rand() * wrong.length)].id, delay, miss: true };
    }
    return { id: state.target, delay, miss: false };
  }

  function clone(state) { return JSON.parse(JSON.stringify(state)); }

  return { RULES, BODY, PATTERN, TONE, newMatch, claim, tick, timeLeft, cpuPick, clone, mulberry32 };
});