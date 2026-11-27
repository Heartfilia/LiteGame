/* π 死亡游戏 · 规则引擎
 * 双方各选一个数字，圆周率逐位揭示；每出现一次你的数字就掉一条命。
 * 纯状态机：房主推进 state，客人只提交选择。
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PiDeathEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RULES = {
    lives: 3,
    revealMs: 340,
    maxDigits: 120,
    countdownMs: 800
  };

  /** 用 Machin 公式在 BigInt 定点数上算圆周率，取小数点后 count 位。 */
  function piDigits(count) {
    const guard = 12;
    const scale = 10n ** BigInt(count + guard);
    function arctanInv(x) {
      const bx = BigInt(x);
      let sum = 0n;
      let term = scale / bx;
      let n = 1n;
      const x2 = bx * bx;
      let sign = 1n;
      while (term !== 0n) {
        sum += sign * (term / n);
        term /= x2;
        n += 2n;
        sign = -sign;
      }
      return sum;
    }
    const pi = 4n * (4n * arctanInv(5) - arctanInv(239));
    const text = pi.toString();
    // 去掉整数位 "3"，并丢掉末尾用于防截断误差的 guard 位。
    return text.slice(1, 1 + count);
  }

  const DIGITS = piDigits(RULES.maxDigits);

  function newMatch(opts = {}) {
    const state = {
      v: 1,
      seed: (opts.seed ?? Date.now()) >>> 0,
      phase: 'pick', // pick → reveal → over
      lives: [RULES.lives, RULES.lives],
      picks: [null, null],
      pos: 0,
      digits: [],
      over: false,
      winner: null,
      nextAt: 0,
      lastHit: null
    };
    return state;
  }

  function bothPicked(state) {
    return state.picks[0] != null && state.picks[1] != null;
  }

  function pick(state, player, digit) {
    if (state.over) return { ok: false, error: '本局已结束' };
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return { ok: false, error: '只能选 0–9' };
    if (state.phase !== 'pick') return { ok: false, error: '已经开盘了' };
    if (state.picks[player] != null) return { ok: false, error: '已经选过了' };
    state.picks[player] = digit;
    return { ok: true, state };
  }

  /** 选完数字后进入揭示阶段；房主用 now 计时。 */
  function begin(state, now) {
    if (state.phase !== 'pick' || !bothPicked(state)) return state;
    state.phase = 'reveal';
    state.nextAt = now + RULES.countdownMs;
    return state;
  }

  /** 揭示下一位；返回 {state, digit, hit}。 */
  function step(state, now) {
    if (state.phase !== 'reveal' || state.over) return { ok: false, error: '还没到揭示阶段' };
    if (now < state.nextAt) return { ok: false, error: '还不到时间' };
    const digit = Number(DIGITS[state.pos]);
    state.digits.push(digit);
    state.pos += 1;
    state.nextAt = now + RULES.revealMs;
    const hit = [];
    for (let p = 0; p < 2; p += 1) {
      if (state.picks[p] === digit && state.lives[p] > 0) {
        state.lives[p] -= 1;
        hit.push(p);
      }
    }
    if (hit.length) state.lastHit = { pos: state.pos, digit, players: hit };
    const out = [state.lives[0] <= 0, state.lives[1] <= 0];
    if (out[0] && out[1]) {
      state.phase = 'over';
      state.over = true;
      state.winner = 'draw';
    } else if (out[0] || out[1]) {
      state.phase = 'over';
      state.over = true;
      state.winner = out[0] ? 1 : 0;
    } else if (state.pos >= RULES.maxDigits) {
      state.phase = 'over';
      state.over = true;
      state.winner = state.lives[0] === state.lives[1] ? 'draw' : state.lives[0] > state.lives[1] ? 0 : 1;
    }
    return { ok: true, state, digit, hit };
  }

  /** 电脑：避开刚刚出现过的数字，其余随机。 */
  function cpuPick(state, player, rand = Math.random) {
    const recent = new Set(state.digits.slice(-3));
    const options = [];
    for (let d = 0; d < 10; d += 1) if (!recent.has(d)) options.push(d);
    const pool = options.length ? options : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    return pool[Math.floor(rand() * pool.length)];
  }

  function clone(state) { return JSON.parse(JSON.stringify(state)); }

  return { RULES, DIGITS, piDigits, newMatch, pick, begin, step, cpuPick, bothPicked, clone };
});