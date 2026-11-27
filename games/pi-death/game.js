/* π 死亡游戏 · 界面与联机编排 */
(function () {
  'use strict';

  const E = window.PiDeathEngine;
  const P = window.Premium;
  const $ = (sel) => document.querySelector(sel);
  const SAVE = P.save('pi-death.v1');

  const el = {
    start: $('#screen-start'),
    game: $('#screen-game'),
    stream: $('#stream'),
    status: $('#status'),
    posNum: $('#posNum'),
    youLives: $('#youLives'),
    rivalLives: $('#rivalLives'),
    youName: $('#youName'),
    rivalName: $('#rivalName'),
    yourDigit: $('#yourDigit'),
    pickbox: $('#pickbox'),
    pickTip: $('#pickTip'),
    picker: $('#picker'),
    flash: $('#flash'),
    netBadge: $('#netBadge')
  };

  let mode = 'single';
  let seat = 0;
  let state = null;
  let loop = null;
  let net = null;
  let pendingPick = null;
  let cpuTimer = null;

  // ---------- 渲染 ----------
  function lives(n) {
    return Array.from({ length: E.RULES.lives }, (_, i) =>
      '<span class="pd-life' + (i < n ? '' : ' is-lost') + '"></span>').join('');
  }

  function showGame() {
    el.start.hidden = true;
    el.game.hidden = false;
  }

  function render() {
    if (!state) return;
    el.youName.textContent = mode === 'net' ? (seat === 0 ? '你 · 1P' : '你 · 2P') : '你';
    el.rivalName.textContent = mode === 'net' ? (seat === 0 ? '好友 · 2P' : '好友 · 1P') : '电脑';
    el.youLives.innerHTML = lives(state.lives[seat]);
    el.rivalLives.innerHTML = lives(state.lives[1 - seat]);
    el.posNum.textContent = state.pos;

    const recent = state.digits.slice(-12);
    el.stream.innerHTML = recent.length
      ? recent.map((d, i) => {
        const isLast = i === recent.length - 1;
        const hit = isLast && state.lastHit && state.lastHit.pos === state.pos &&
          state.lastHit.players.includes(seat);
        return '<span class="' + (hit ? 'is-hit' : isLast ? 'is-last' : '') + '">' + d + '</span>';
      }).join('')
      : '<span class="is-last">?</span><span>?</span><span>?</span>';

    const mine = pendingPick != null ? pendingPick : state.picks[seat];
    el.yourDigit.textContent = mine == null ? '–' : mine;
    el.pickbox.classList.toggle('is-dead', state.lives[seat] <= 0);
    const picking = state.phase === 'pick' && state.picks[seat] == null;
    el.picker.hidden = !picking;
    el.picker.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('is-selected', mine != null && Number(btn.dataset.d) === mine);
    });

    if (state.over) {
      el.status.textContent = state.winner === 'draw' ? '同归于尽' : (state.winner === seat ? '你活下来了' : '你出局了');
    } else if (state.phase === 'pick') {
      el.status.innerHTML = state.picks[seat] == null
        ? '选一个数字，<b>它出现就掉命</b>'
        : (mode === 'net' ? '已选 <b>' + state.picks[seat] + '</b>，等好友选完' : '已选 <b>' + state.picks[seat] + '</b>，准备开盘');
    } else {
      const fatal = state.lastHit && state.lastHit.pos === state.pos;
      el.status.innerHTML = fatal && state.lastHit.players.includes(seat)
        ? '命中 <b>' + state.lastHit.digit + '</b>！掉一条命'
        : 'π 第 <b>' + state.pos + '</b> 位';
    }
  }

  function flash(text) {
    el.flash.textContent = text;
    clearTimeout(flash.timer);
    flash.timer = setTimeout(() => { el.flash.textContent = ''; }, 1000);
  }

  // ---------- 主循环 ----------
  function startLoop() {
    clearInterval(loop);
    loop = setInterval(() => {
      if (!state || state.over) return;
      if (mode === 'single') {
        if (state.phase === 'reveal' && Date.now() >= state.nextAt) {
          const r = E.step(state, Date.now());
          if (r.ok) afterStep();
        }
      } else if (net?.isHost) {
        if (state.phase === 'reveal' && Date.now() >= state.nextAt) {
          const r = E.step(state, Date.now());
          if (r.ok) { afterStep(); net.deliver({ type: 'state', state }); }
        }
      }
    }, 60);
  }

  function afterStep() {
    render();
    if (state.lastHit && state.lastHit.pos === state.pos) {
      P.sfx.bad();
      flash('命中 ' + state.lastHit.digit);
    } else {
      P.sfx.tick();
    }
    if (state.over) endGame();
  }

  // ---------- 单机 ----------
  function startSingle() {
    mode = 'single';
    seat = 0;
    pendingPick = null;
    state = E.newMatch({ seed: Date.now() });
    showGame();
    P.hideResult();
    render();
    startLoop();
  }

  function choose(digit) {
    if (!state || state.over) return;
    if (state.phase !== 'pick' || state.picks[seat] != null || pendingPick != null) return;
    P.sfx.tap();
    if (mode === 'net') {
      if (net.isHost) {
        E.pick(state, 0, digit);
        render();
        maybeBegin();
        net.deliver({ type: 'state', state });
      } else {
        pendingPick = digit;
        net.deliver({ type: 'pick', d: digit });
        render();
      }
      return;
    }
    E.pick(state, 0, digit);
    render();
    clearTimeout(cpuTimer);
    cpuTimer = setTimeout(() => {
      if (!state || state.over || state.phase !== 'pick') return;
      E.pick(state, 1, E.cpuPick(state, 1));
      maybeBegin();
      render();
    }, 550);
  }

  function maybeBegin() {
    if (!E.bothPicked(state)) return;
    E.begin(state, Date.now());
    if (mode === 'net' && net.isHost) net.deliver({ type: 'state', state });
    render();
  }

  // ---------- 结算 ----------
  function endGame() {
    const save = SAVE.read();
    const survived = state.pos;
    const win = state.winner === seat;
    SAVE.write({
      plays: (save.plays || 0) + 1,
      best: Math.max(save.best || 0, survived),
      wins: (save.wins || 0) + (win ? 1 : 0)
    });
    const title = state.winner === 'draw' ? '平局' : win ? '你赢了' : '惜败';
    const why = state.winner === 'draw'
      ? '同一位数字，两个人一起出局。'
      : win ? '你撑到了第 ' + survived + ' 位。' : '你的数字太活跃了。';
    P.showResult({
      title,
      why,
      showFinal: false,
      best: '撑过 ' + survived + ' 位 · 最高 ' + Math.max(save.best || 0, survived) + ' 位 · 已玩 ' + ((save.plays || 0) + 1) + ' 局',
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

  // ---------- 联机 ----------
  function hostStart() {
    mode = 'net';
    seat = 0;
    pendingPick = null;
    state = E.newMatch({ seed: Date.now() });
    showGame();
    P.hideResult();
    render();
    startLoop();
    return state;
  }

  function adopt(next, isStart) {
    mode = 'net';
    seat = 1;
    pendingPick = null;
    state = next;
    showGame();
    P.hideResult();
    render();
    if (isStart) startLoop();
    if (state.over) endGame();
  }

  net = P.net(
    { gameId: 'pi-death', gameTitle: 'π 死亡游戏', url: 'games/pi-death/index.html' },
    {
      hostStart,
      hostState(next) { state = next; showGame(); render(); startLoop(); },
      adopt,
      action(msg) {
        if (!net.isHost || !state) return;
        if (msg.type === 'pick') {
          E.pick(state, 1, msg.d);
          render();
          maybeBegin();
          net.deliver({ type: 'state', state });
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
      closed() { el.netBadge.hidden = true; }
    }
  );

  // ---------- 事件 ----------
  for (let d = 0; d <= 9; d += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.d = String(d);
    btn.textContent = String(d);
    btn.setAttribute('aria-label', '选择数字 ' + d);
    btn.addEventListener('click', () => choose(d));
    el.picker.append(btn);
  }

  $('#startSingle').addEventListener('click', startSingle);
  $('#startNet').addEventListener('click', () => net.open());
  P.mountChrome({ onRoom: () => net.open() });
  el.start.hidden = false;
})();