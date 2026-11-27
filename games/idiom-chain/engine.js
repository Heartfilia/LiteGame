/* 成语接龙 · 规则引擎（抢接版）
 * 共享牌桌上的成语卡片，双方同时抢接「当前尾字」开头的成语，抢到计分。
 * 纯状态机，不依赖 DOM；联机时房主持有权威状态并广播。
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.IdiomChainEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RULES = {
    boardSize: 12,
    deckSize: 60,
    seconds: 75,
    minMatches: 2,
    cpuMinDelay: 900,
    cpuMaxDelay: 2000
  };

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

  function shuffle(list, rand) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function buildIndex(data) {
    const byFirst = new Map();
    const byLast = new Map();
    for (const [w, p] of data) {
      const card = { w, p };
      if (!byFirst.has(w[0])) byFirst.set(w[0], []);
      byFirst.get(w[0]).push(card);
      if (!byLast.has(w[w.length - 1])) byLast.set(w[w.length - 1], []);
      byLast.get(w[w.length - 1]).push(card);
    }
    return { byFirst, byLast, size: byFirst.size };
  }

  const lastOf = (w) => w[w.length - 1];

  /** 用随机游走铺一条长链，让牌堆前后能互相接上，摸牌手感更顺。 */
  function buildDeck(index, rand, size) {
    const starters = [];
    for (const [, cards] of index.byFirst) {
      for (const card of cards) {
        const next = index.byFirst.get(lastOf(card.w));
        if (next && next.length >= 5) starters.push(card);
      }
    }
    const start = starters.length ? starters[Math.floor(rand() * starters.length)] : { w: '一心一意', p: 'yī xīn yī yì' };
    const deck = [start];
    const used = new Set([start.w]);
    let guard = 0;
    while (deck.length < size && guard < size * 80) {
      guard += 1;
      const tail = deck[deck.length - 1];
      const options = (index.byFirst.get(lastOf(tail.w)) || []).filter((c) => !used.has(c.w));
      if (!options.length) break;
      const rich = options.filter((c) => (index.byFirst.get(lastOf(c.w)) || []).length >= 3);
      const pool = rich.length ? rich : options;
      const pick = pool[Math.floor(rand() * pool.length)];
      deck.push(pick);
      used.add(pick.w);
    }
    for (const [, cards] of index.byFirst) {
      if (deck.length >= size) break;
      for (const card of cards) {
        if (deck.length >= size) break;
        if (!used.has(card.w)) { deck.push(card); used.add(card.w); }
      }
    }
    return deck;
  }

  function newMatch(data, opts = {}) {
    const seed = (opts.seed ?? (Date.now() % 1e9)) >>> 0;
    const rand = mulberry32(seed);
    const index = opts.index || buildIndex(data);
    const deck = buildDeck(index, rand, RULES.deckSize);
    const head = deck[0];
    const board = deck.slice(1, 1 + RULES.boardSize).map((c) => ({ w: c.w, p: c.p }));
    const rest = deck.slice(1 + RULES.boardSize);
    const state = {
      v: 2,
      seed,
      pool: index.size,
      chain: [{ w: head.w, p: head.p }],
      need: lastOf(head.w),
      board,
      deck: rest.map((c) => ({ w: c.w, p: c.p })),
      scores: [0, 0],
      over: false,
      winner: null,
      seconds: opts.seconds || RULES.seconds,
      startedAt: opts.now || 0,
      last: null
    };
    ensureMatches(state, index, rand);
    return state;
  }

  function matching(state) {
    return state.board.filter((c) => c.w[0] === state.need);
  }

  /**
   * 保证牌桌上始终有 ≥ minMatches 张可接的牌。
   * 牌堆走完了就从词库里补，避免「无牌可抢」的死局。
   */
  function ensureMatches(state, index, rand) {
    const onBoard = () => new Set(state.board.map((c) => c.w));
    let guard = 0;
    while (matching(state).length < RULES.minMatches && guard < 24) {
      guard += 1;
      const need = state.need;
      const shown = onBoard();
      let candidate = state.deck.find((c) => c.w[0] === need && !shown.has(c.w));
      if (candidate) {
        state.deck = state.deck.filter((c) => c !== candidate);
      } else {
        // 牌堆里没有可接牌时，从全库补一张（允许复用已出过的成语，只避免牌桌内重复）。
        // 这样任何尾字都至少有一张能接的牌，不会出现「无牌可抢」的死局。
        const pool = (index.byFirst.get(need) || []).filter((c) => !shown.has(c.w));
        const rich = pool.filter((c) => (index.byFirst.get(lastOf(c.w)) || []).length >= 3);
        const pick = (rich.length ? rich : pool)[0];
        if (!pick) break;
        candidate = { w: pick.w, p: pick.p };
      }
      // 替换掉一张接不上的牌；牌桌没满就直接放入。
      const victims = state.board.filter((c) => c.w[0] !== need);
      if (state.board.length < RULES.boardSize || !victims.length) {
        state.board.push(candidate);
      } else {
        const victim = victims[Math.floor(rand() * victims.length)];
        state.board[state.board.indexOf(victim)] = candidate;
      }
    }
    return state;
  }

  function refill(state, index, rand) {
    while (state.board.length < RULES.boardSize && state.deck.length) {
      state.board.push(state.deck.shift());
    }
    ensureMatches(state, index, rand);
    return state;
  }

  function canClaim(state, player, word) {
    if (state.over) return { ok: false, error: '本局已结束' };
    const card = state.board.find((c) => c.w === word);
    if (!card) return { ok: false, error: '这张牌已经不在桌上' };
    if (card.w[0] !== state.need) return { ok: false, error: '要接「' + state.need + '」字开头的成语' };
    return { ok: true, card };
  }

  /** 抢牌：座位号 0/1，返回新状态。调用方负责串行化（联机时由房主调用）。 */
  function claim(state, player, word, ctx) {
    const check = canClaim(state, player, word);
    if (!check.ok) return check;
    const index = ctx?.index;
    const rand = ctx?.rand || mulberry32(state.seed + state.chain.length);
    const card = check.card;
    state.board.splice(state.board.indexOf(card), 1);
    state.chain.push({ w: card.w, p: card.p });
    state.need = lastOf(card.w);
    state.scores[player] += 1;
    state.last = { player, w: card.w, p: card.p, need: state.need };
    if (index) refill(state, index, rand);
    else while (state.board.length < RULES.boardSize && state.deck.length) state.board.push(state.deck.shift());
    if (!matching(state).length && (!index || !state.deck.length)) finish(state);
    return { ok: true, state, card };
  }

  function finish(state) {
    state.over = true;
    const [a, b] = state.scores;
    state.winner = a > b ? 0 : b > a ? 1 : 'draw';
    return state;
  }

  function tick(state, now, ctx) {
    if (state.over) return state;
    if (state.seconds && now - state.startedAt >= state.seconds * 1000) finish(state);
    return state;
  }

  function timeLeft(state, now) {
    if (!state.seconds) return null;
    return Math.max(0, state.seconds * 1000 - (now - state.startedAt));
  }

  /** 电脑：在可接的牌里随机挑一张，反应时间随分数略作调整。 */
  function cpuAction(state, player, rand) {
    const options = matching(state);
    if (!options.length) return null;
    const r = (rand || Math.random)();
    const card = options[Math.floor(r * options.length)];
    const delay = RULES.cpuMinDelay + r * (RULES.cpuMaxDelay - RULES.cpuMinDelay);
    return { card: card.w, delay };
  }

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  return {
    RULES,
    buildIndex,
    newMatch,
    claim,
    canClaim,
    matching,
    tick,
    timeLeft,
    finish,
    cpuAction,
    clone,
    mulberry32
  };
});