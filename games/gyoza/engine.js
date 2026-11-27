/* 饺子 · 规则引擎
 * 三笼蒸饺，轮流挑一笼吃 1–2 只，吃到最后一只的人赢。
 * 纯状态机；联机由房主校验每一步。
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GyozaEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RULES = {
    start: [7, 5, 3],
    maxTake: 2,
    turnSeconds: 20
  };

  function newMatch(opts = {}) {
    return {
      v: 1,
      piles: (opts.piles || RULES.start).slice(),
      turn: 0,
      over: false,
      winner: null,
      moves: 0,
      last: null,
      startedAt: opts.now || 0,
      turnStartedAt: opts.now || 0,
      seed: (opts.seed ?? Date.now()) >>> 0
    };
  }

  function total(state) {
    return state.piles.reduce((a, b) => a + b, 0);
  }

  function legalMoves(state, plate) {
    const list = [];
    const plates = plate == null ? state.piles.map((_, i) => i) : [plate];
    for (const p of plates) {
      for (let n = 1; n <= RULES.maxTake; n += 1) {
        if (state.piles[p] >= n) list.push({ plate: p, n });
      }
    }
    return list;
  }

  function allMoves(state) {
    const list = [];
    for (let p = 0; p < state.piles.length; p += 1) {
      for (let n = 1; n <= RULES.maxTake; n += 1) {
        if (state.piles[p] >= n) list.push({ plate: p, n });
      }
    }
    return list;
  }

  function play(state, player, plate, n, now = 0) {
    if (state.over) return { ok: false, error: '本局已结束' };
    if (state.turn !== player) return { ok: false, error: '还没轮到你' };
    if (!Number.isInteger(plate) || plate < 0 || plate >= state.piles.length) return { ok: false, error: '没有这笼' };
    if (!Number.isInteger(n) || n < 1 || n > RULES.maxTake) return { ok: false, error: '一次只能吃 1–2 只' };
    if (state.piles[plate] < n) return { ok: false, error: '这笼不够了' };
    state.piles[plate] -= n;
    state.moves += 1;
    state.last = { player, plate, n };
    state.turnStartedAt = now;
    if (total(state) === 0) {
      state.over = true;
      state.winner = player;
      return { ok: true, state, ateLast: true };
    }
    state.turn = 1 - player;
    return { ok: true, state, ateLast: false };
  }

  /** 20 秒不走就随机替一步，避免对局卡死。 */
  function forceTurn(state, now, rand = Math.random) {
    if (state.over) return { ok: false };
    if (now - state.turnStartedAt < RULES.turnSeconds * 1000) return { ok: false, error: '还没超时' };
    const moves = allMoves(state);
    if (!moves.length) return { ok: false };
    const pick = moves[Math.floor(rand() * moves.length)];
    return play(state, state.turn, pick.plate, pick.n, now);
  }

  // 只能取 1–2 个的取子游戏：每笼的 Grundy 值是数量 mod 3，异或为 0 是必败位。
  function xorKey(piles) {
    return piles.reduce((acc, n) => acc ^ (n % 3), 0);
  }

  function winningMoves(state) {
    const out = [];
    for (const mv of allMoves(state)) {
      const next = state.piles.slice();
      next[mv.plate] -= mv.n;
      if (xorKey(next) === 0) out.push(mv);
    }
    return out;
  }

  /** 电脑：七成走最优解，三成随手，避免每局都被算死。 */
  function cpuMove(state, player, rand = Math.random) {
    const moves = allMoves(state);
    if (!moves.length) return null;
    const best = winningMoves(state);
    const useBest = best.length && rand() < 0.7;
    const pool = useBest ? best : moves;
    const pick = pool[Math.floor(rand() * pool.length)];
    return { plate: pick.plate, n: pick.n };
  }

  function clone(state) { return JSON.parse(JSON.stringify(state)); }

  return { RULES, newMatch, play, legalMoves, allMoves, total, forceTurn, cpuMove, xorKey, winningMoves, clone };
});