/* 猫猫找不同 · 界面与联机编排 */
(function () {
  'use strict';

  const E = window.CatFindEngine;
  const P = window.Premium;
  const $ = (sel) => document.querySelector(sel);
  const SAVE = P.save('cat-find.v1');
  const HOST_CLAIM_DELAY = 60;

  const el = {
    start: $('#screen-start'),
    game: $('#screen-game'),
    board: $('#board'),
    targetFace: $('#targetFace'),
    youScore: $('#youScore'),
    rivalScore: $('#rivalScore'),
    youName: $('#youName'),
    rivalName: $('#rivalName'),
    clock: $('#clock'),
    timer: $('#timer'),
    timerFill: $('#timerFill'),
    hint: $('#hint'),
    flash: $('#flash'),
    netBadge: $('#netBadge')
  };

  let mode = 'single';
  let seat = 0;
  let state = null;
  let guestLeft = null;
  let loop = null;
  let frozenUntil = 0;
  let cpuTimer = null;
  let net = null;
  let lastSig = '';

  // ---------- 画猫 ----------
  function catSVG(cat, size) {
    const body = E.BODY[cat.body];
    const tone = E.TONE[cat.tone];
    const pattern = E.PATTERN[cat.pattern];
    let marks = '';
    if (pattern === 'tabby') {
      marks = '<g fill="' + tone + '" opacity="0.85">' +
        '<rect x="23" y="15" width="4" height="13" rx="2"/>' +
        '<rect x="30" y="13" width="4" height="15" rx="2"/>' +
        '<rect x="37" y="15" width="4" height="13" rx="2"/></g>';
    } else if (pattern === 'spots') {
      marks = '<g fill="' + tone + '" opacity="0.85">' +
        '<circle cx="18" cy="26" r="3"/><circle cx="46" cy="27" r="2.6"/>' +
        '<circle cx="22" cy="44" r="2.8"/><circle cx="43" cy="45" r="2.4"/>' +
        '<circle cx="32" cy="18" r="2.2"/></g>';
    } else if (pattern === 'patch') {
      marks = '<path d="M12 30a12 12 0 0 1 14-8 14 14 0 0 0-6 16 12 12 0 0 1-8-8Z" fill="' + tone + '" opacity="0.85"/>';
    }
    return '<svg viewBox="0 0 64 64" role="img" aria-label="一只猫">' +
      '<path d="M13 23 11 7l15 8Z" fill="' + body + '"/>' +
      '<path d="M51 23 53 7 38 15Z" fill="' + body + '"/>' +
      '<ellipse cx="32" cy="35" rx="23" ry="21" fill="' + body + '"/>' +
      marks +
      '<ellipse cx="24" cy="32" rx="3.3" ry="4.2" fill="#2b2622"/>' +
      '<ellipse cx="40" cy="32" rx="3.3" ry="4.2" fill="#2b2622"/>' +
      '<circle cx="25.2" cy="30.6" r="1.1" fill="#fff" opacity="0.85"/>' +
      '<circle cx="41.2" cy="30.6" r="1.1" fill="#fff" opacity="0.85"/>' +
      '<path d="M32 39l2.6 2.4h-5.2Z" fill="#c98a86"/>' +
      '<path d="M28.6 44q3.4 3 6.8 0" stroke="#2b2622" stroke-width="1.3" fill="none" stroke-linecap="round"/>' +
      '<g stroke="' + tone + '" stroke-width="1.1" opacity="0.6" stroke-linecap="round">' +
      '<path d="M12 36h-6M12 41l-6 2M52 36h6M52 41l6 2"/></g>' +
      '</svg>';
  }

  // ---------- 渲染 ----------
  function showGame() {
    el.start.hidden = true;
    el.game.hidden = false;
  }

  function render() {
    if (!state) return;
    el.youName.textContent = mode === 'net' ? (seat === 0 ? '你 · 1P' : '你 · 2P') : '你';
    el.rivalName.textContent = mode === 'net' ? (seat === 0 ? '好友 · 2P' : '好友 · 1P') : '电脑';
    el.youScore.textContent = state.scores[seat];
    el.rivalScore.textContent = state.scores[1 - seat];

    const target = state.cats[state.target];
    el.targetFace.innerHTML = catSVG(target);

    const sig = state.cats.map((c) => c.id + ':' + c.body + c.pattern + c.tone).join('|') + '#' + state.target;
    if (sig !== lastSig) {
      lastSig = sig;
      el.board.innerHTML = state.cats.map((cat) =>
        '<button type="button" class="cf-cat" data-id="' + cat.id + '" aria-label="猫 ' + (cat.id + 1) + '">' +
        catSVG(cat) + '</button>').join('');
    }

    const left = mode === 'net' && seat === 1
      ? guestLeft
      : Math.max(0, state.seconds * 1000 - (Date.now() - state.startedAt));
    const ratio = state.seconds ? Math.max(0, Math.min(1, (left ?? 0) / (state.seconds * 1000))) : 0;
    el.timerFill.style.transform = 'scaleX(' + ratio + ')';
    el.timer.classList.toggle('is-low', ratio < 0.25);
    el.clock.textContent = P.fmtClock(left ?? 0);
  }

  function flash(text) {
    el.flash.textContent = text;
    clearTimeout(flash.timer);
    flash.timer = setTimeout(() => { el.flash.textContent = ''; }, 900);
  }

  function freeze() {
    frozenUntil = Date.now() + E.RULES.freezeMs;
    el.board.classList.add('is-frozen');
    el.hint.textContent = '看仔细，别乱点';
    setTimeout(() => {
      if (Date.now() >= frozenUntil - 20) {
        el.board.classList.remove('is-frozen');
        el.hint.textContent = '点中题目里的那只猫';
      }
    }, E.RULES.freezeMs);
  }

  // ---------- 循环 ----------
  function startLoop() {
    clearInterval(loop);
    loop = setInterval(() => {
      if (!state || state.over) return;
      if (mode === 'single') {
        E.tick(state, Date.now());
        cpuStep();
        render();
        if (state.over) endGame();
      } else if (net?.isHost) {
        E.tick(state, Date.now());
        render();
        if (state.over) {
          net.deliver({ type: 'state', state });
          endGame();
          return;
        }
        net.deliver({ type: 'clock', left: E.timeLeft(state, Date.now()) });
      } else {
        render();
      }
    }, 250);
  }

  function cpuStep() {
    if (mode !== 'single' || state.over) return;
    if (cpuTimer) return;
    const plan = E.cpuPick(state, 1);
    cpuTimer = setTimeout(() => {
      cpuTimer = null;
      if (!state || state.over) return;
      if (plan.miss) return; // 电脑这只抓空了，不扣分，重新瞄
      const r = E.claim(state, 1, plan.id);
      if (r.ok) {
        P.sfx.ok(state.scores[1]);
        render();
        if (state.over) endGame();
      }
    }, plan.delay);
  }

  // ---------- 操作 ----------
  function attempt(id) {
    if (!state || state.over) return;
    if (Date.now() < frozenUntil) return;
    const cat = state.cats.find((c) => c.id === id);
    if (!cat) return;
    if (!cat.isTarget) {
      P.sfx.bad();
      flash('不是这只');
      freeze();
      const node = el.board.querySelector('[data-id="' + id + '"]');
      if (node) {
        node.classList.add('is-wrong');
        setTimeout(() => node.classList.remove('is-wrong'), 320);
      }
      return;
    }
    const node = el.board.querySelector('[data-id="' + id + '"]');
    if (node) node.classList.add('is-hit');

    if (mode === 'single') {
      const r = E.claim(state, 0, id);
      if (r.ok) { P.sfx.ok(state.scores[0]); render(); }
      return;
    }
    if (seat === 0) {
      setTimeout(() => {
        if (!state || state.over) return;
        const r = E.claim(state, 0, id);
        if (!r.ok) return;
        P.sfx.ok(state.scores[0]);
        net.deliver({ type: 'state', state });
        render();
        if (state.over) endGame();
      }, HOST_CLAIM_DELAY);
    } else {
      net.deliver({ type: 'claim', id });
    }
  }

  // ---------- 结算 ----------
  function endGame() {
    clearInterval(loop);
    loop = null;
    clearTimeout(cpuTimer);
    cpuTimer = null;
    const save = SAVE.read();
    const me = state.scores[seat];
    const win = state.winner === seat;
    SAVE.write({
      plays: (save.plays || 0) + 1,
      best: Math.max(save.best || 0, me),
      wins: (save.wins || 0) + (win ? 1 : 0)
    });
    P.showResult({
      title: state.winner === 'draw' ? '平局' : win ? '你赢了' : '惜败',
      why: state.winner === 'draw' ? '眼力相当，再找一局？' : win ? '眼睛比对方快。' : '对面手更快一点。',
      showFinal: true,
      left: me,
      right: state.scores[1 - seat],
      best: '最高 ' + Math.max(save.best || 0, me) + ' 只 · 已玩 ' + ((save.plays || 0) + 1) + ' 局',
      againLabel: mode === 'net' && !net?.isHost ? '等房主再来' : '再来一局',
      onAgain: restart,
      onExit: exit
    });
  }

  function restart() {
    if (mode === 'single') { startSingle(); return; }
    if (net?.isHost) {
      state = hostStart();
      net.deliver({ type: 'start', state });
      render();
      return;
    }
    net.deliver({ type: 'again' });
    P.toast('已请求再来一局，等待房主');
  }

  function exit() {
    net?.leave();
    location.href = '../../index.html#/category/premium';
  }

  // ---------- 单机 ----------
  function startSingle() {
    mode = 'single';
    seat = 0;
    guestLeft = null;
    frozenUntil = 0;
    lastSig = '';
    state = E.newMatch({ seed: Date.now(), now: Date.now(), seconds: 60 });
    showGame();
    P.hideResult();
    render();
    startLoop();
  }

  // ---------- 联机 ----------
  function hostStart() {
    mode = 'net';
    seat = 0;
    frozenUntil = 0;
    lastSig = '';
    state = E.newMatch({ seed: Date.now(), now: Date.now(), seconds: 60 });
    showGame();
    P.hideResult();
    render();
    startLoop();
    return state;
  }

  function adopt(next, isStart) {
    mode = 'net';
    seat = 1;
    frozenUntil = 0;
    lastSig = '';
    state = next;
    guestLeft = isStart ? state.seconds * 1000 : guestLeft;
    showGame();
    P.hideResult();
    render();
    if (isStart) startLoop();
    if (state.over) endGame();
  }

  net = P.net(
    { gameId: 'cat-find', gameTitle: '猫猫找不同', url: 'games/cat-find/index.html' },
    {
      hostStart,
      hostState(next) { state = next; showGame(); render(); startLoop(); },
      adopt,
      action(msg) {
        if (!net.isHost || !state) return;
        if (msg.type === 'claim') {
          const r = E.claim(state, 1, msg.id);
          if (!r.ok) return;
          P.sfx.ok(state.scores[1]);
          net.deliver({ type: 'state', state });
          render();
          if (state.over) endGame();
        }
      },
      againRequested() {
        if (!net.isHost) return;
        state = hostStart();
        net.deliver({ type: 'start', state });
      },
      peer(joined) {
        el.netBadge.hidden = !joined;
        if (!joined && state && !state.over) {
          P.toast('好友离开了房间');
          state.over = true;
          state.winner = 'draw';
          endGame();
        }
      },
      closed() { el.netBadge.hidden = true; },
      clock(msg) {
        if (seat !== 1) return;
        guestLeft = msg.left;
        render();
      }
    }
  );

  el.board.addEventListener('click', (event) => {
    const btn = event.target.closest('.cf-cat');
    if (btn) attempt(Number(btn.getAttribute('data-id')));
  });

  $('#startSingle').addEventListener('click', startSingle);
  $('#startNet').addEventListener('click', () => net.open());
  P.mountChrome({ onRoom: () => net.open() });
  el.start.hidden = false;
})();