/* 饺子 · 界面与联机编排 */
(function () {
  'use strict';

  const E = window.GyozaEngine;
  const P = window.Premium;
  const $ = (sel) => document.querySelector(sel);
  const SAVE = P.save('gyoza.v1');

  const el = {
    start: $('#screen-start'),
    game: $('#screen-game'),
    table: $('#table'),
    turnLine: $('#turnLine'),
    actions: $('#actions'),
    eat1: $('#eat1'),
    eat2: $('#eat2'),
    cancel: $('#cancel'),
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
  let picked = null;
  let guestLeft = null;
  let loop = null;
  let cpuTimer = null;
  let net = null;

  // ---------- 画饺子 ----------
  function dumplingSVG() {
    return '<svg class="gy-dump" viewBox="0 0 32 24" aria-hidden="true">' +
      '<path d="M3 18c0-8 6-13 13-13s13 5 13 13c0 2-2 3-4 3H7c-2 0-4-1-4-3Z" fill="#f6e6c6"/>' +
      '<path d="M3 18c0-8 6-13 13-13s13 5 13 13" fill="none" stroke="#d9bd8e" stroke-width="1.4"/>' +
      '<g stroke="#c9a976" stroke-width="1.1" fill="none" stroke-linecap="round">' +
      '<path d="M9 15q2-3 4-1M14 12q2-3 4-1M19 12q2-3 4-1"/></g>' +
      '<path d="M8 21h16" stroke="#c9a976" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>' +
      '</svg>';
  }

  function render() {
    if (!state) return;
    el.youName.textContent = mode === 'net' ? (seat === 0 ? '你 · 1P' : '你 · 2P') : '你';
    el.rivalName.textContent = mode === 'net' ? (seat === 0 ? '好友 · 2P' : '好友 · 1P') : '电脑';
    el.youScore.textContent = state.piles.reduce((a, b) => a + b, 0);
    el.rivalScore.textContent = '';

    el.table.innerHTML = state.piles.map((count, i) => {
      const picks = Array.from({ length: count }, () => dumplingSVG()).join('');
      return '<button type="button" class="gy-steamer' + (picked === i ? ' is-picked' : '') +
        (count === 0 ? ' is-dead' : '') + '" data-plate="' + i + '" aria-label="第 ' + (i + 1) + ' 笼，' + count + ' 只">' +
        '<div class="gy-basket">' + picks + '</div>' +
        '<div class="gy-count">' + count + ' <span>只</span></div></button>';
    }).join('');

    const myTurn = state.turn === seat && !state.over;
    el.turnLine.innerHTML = state.over
      ? '本局结束'
      : myTurn ? '<b>轮到你</b>，挑一笼' : (mode === 'net' ? '等好友下筷…' : '电脑在想…');
    el.hint.textContent = myTurn ? '点一笼，再选吃几只' : '';
    el.actions.hidden = !myTurn || picked == null;

    if (picked != null && state.piles[picked] != null) {
      el.eat1.disabled = state.piles[picked] < 1;
      el.eat2.disabled = state.piles[picked] < 2;
    }

    const left = mode === 'net' && seat === 1
      ? guestLeft
      : Math.max(0, E.RULES.turnSeconds * 1000 - (Date.now() - state.turnStartedAt));
    const ratio = Math.max(0, Math.min(1, (left ?? 0) / (E.RULES.turnSeconds * 1000)));
    el.timerFill.style.transform = 'scaleX(' + ratio + ')';
    el.timer.classList.toggle('is-low', ratio < 0.25);
    el.clock.textContent = P.fmtClock(left ?? 0);
  }

  function flash(text) {
    el.flash.textContent = text;
    el.flash.classList.remove('is-hide');
    clearTimeout(flash.timer);
    flash.timer = setTimeout(() => el.flash.classList.add('is-hide'), 900);
  }

  // ---------- 循环（超时替手 + 计时） ----------
  function startLoop() {
    clearInterval(loop);
    loop = setInterval(() => {
      if (!state || state.over) return;
      if (mode === 'single') {
        if (state.turn === 1) { cpuStep(); return; }
        const r = E.forceTurn(state, Date.now());
        if (r.ok) { P.sfx.tap(); flash('超时，替你吃了 ' + r.state.last.n + ' 只'); render(); if (state.over) endGame(); }
        else render();
      } else if (net?.isHost) {
        // 双方都限时 20 秒：房主统一判超时，结果广播给客人。
        const r = E.forceTurn(state, Date.now());
        if (r.ok) {
          net.deliver({ type: 'state', state });
          render();
          if (state.over) endGame();
        } else {
          render();
          net.deliver({ type: 'clock', left: Math.max(0, E.RULES.turnSeconds * 1000 - (Date.now() - state.turnStartedAt)) });
        }
      } else {
        render();
      }
    }, 250);
  }

  function cpuStep() {
    if (mode !== 'single' || state.over || state.turn !== 1 || cpuTimer) return;
    cpuTimer = setTimeout(() => {
      cpuTimer = null;
      if (!state || state.over || state.turn !== 1) return;
      const mv = E.cpuMove(state, 1);
      if (!mv) return;
      const r = E.play(state, 1, mv.plate, mv.n, Date.now());
      if (!r.ok) return;
      P.sfx.tap();
      if (r.ateLast) { render(); endGame(); return; }
      render();
    }, 800 + Math.random() * 700);
  }

  // ---------- 操作 ----------
  function pickPlate(i) {
    if (!state || state.over || state.turn !== seat) return;
    if (state.piles[i] === 0) return;
    picked = picked === i ? null : i;
    P.sfx.tap();
    render();
  }

  function eat(n) {
    if (!state || state.over || state.turn !== seat || picked == null) return;
    if (state.piles[picked] < n) return;
    const plate = picked;
    picked = null;
    if (mode === 'single') {
      const r = E.play(state, 0, plate, n, Date.now());
      if (!r.ok) return;
      P.sfx.ok();
      render();
      if (state.over) endGame();
      return;
    }
    if (net.isHost) {
      const r = E.play(state, 0, plate, n, Date.now());
      if (!r.ok) return;
      P.sfx.ok();
      net.deliver({ type: 'state', state });
      render();
      if (state.over) endGame();
    } else {
      net.deliver({ type: 'move', plate, n });
      el.hint.textContent = '已出筷，等对面…';
    }
  }

  // ---------- 结算 ----------
  function endGame() {
    clearInterval(loop);
    loop = null;
    clearTimeout(cpuTimer);
    cpuTimer = null;
    const save = SAVE.read();
    const win = state.winner === seat;
    SAVE.write({
      plays: (save.plays || 0) + 1,
      wins: (save.wins || 0) + (win ? 1 : 0)
    });
    P.showResult({
      title: win ? '你赢了' : '惜败',
      why: win ? '最后一只饺子归你了。' : '最后一只被对面夹走了。',
      showFinal: false,
      best: '共 ' + (save.plays || 0) + ' 局 · 胜 ' + ((save.wins || 0) + (win ? 1 : 0)),
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

  // ---------- 单机 / 联机 ----------
  function startSingle() {
    mode = 'single';
    seat = 0;
    picked = null;
    guestLeft = null;
    state = E.newMatch({ now: Date.now() });
    showGame();
    P.hideResult();
    render();
    startLoop();
    cpuStep();
  }

  function hostStart() {
    mode = 'net';
    seat = 0;
    picked = null;
    state = E.newMatch({ now: Date.now() });
    showGame();
    P.hideResult();
    render();
    startLoop();
    return state;
  }

  function adopt(next, isStart) {
    mode = 'net';
    seat = 1;
    picked = null;
    state = next;
    guestLeft = isStart ? 20000 : guestLeft;
    showGame();
    P.hideResult();
    render();
    if (isStart) startLoop();
    if (state.over) endGame();
  }

  function showGame() {
    el.start.hidden = true;
    el.game.hidden = false;
  }

  net = P.net(
    { gameId: 'gyoza', gameTitle: '饺子', url: 'games/gyoza/index.html' },
    {
      hostStart,
      hostState(next) { state = next; showGame(); render(); startLoop(); },
      adopt,
      action(msg) {
        if (!net.isHost || !state) return;
        if (msg.type === 'move') {
          const r = E.play(state, 1, msg.plate, msg.n, Date.now());
          if (!r.ok) return;
          P.sfx.tap();
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
          state.winner = seat;
          endGame();
        }
      },
      closed() { el.netBadge.hidden = true; },
      clock(msg) { if (seat === 1) { guestLeft = msg.left; render(); } }
    }
  );

  el.table.addEventListener('click', (event) => {
    const node = event.target.closest('[data-plate]');
    if (node) pickPlate(Number(node.getAttribute('data-plate')));
  });
  el.eat1.addEventListener('click', () => eat(1));
  el.eat2.addEventListener('click', () => eat(2));
  el.cancel.addEventListener('click', () => { picked = null; render(); });
  $('#startSingle').addEventListener('click', startSingle);
  $('#startNet').addEventListener('click', () => net.open());
  P.mountChrome({ onRoom: () => net.open() });
  el.start.hidden = false;
})();