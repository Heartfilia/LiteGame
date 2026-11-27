/* 成语接龙 · 界面与联机编排 */
(function () {
  'use strict';

  const E = window.IdiomChainEngine;
  const DATA = window.IDIOM_CHAIN_DATA;
  const RULES = E.RULES;
  const SAVE_KEY = 'litegame.idiom-chain.v1';
  const HOST_CLAIM_DELAY = 60; // 房主本地出牌延迟，抵消客人往返时延带来的不公平

  const $ = (sel) => document.querySelector(sel);

  /** 可用 ?secs=20 开短局（10–180 秒），方便练习或测试。 */
  function matchSeconds() {
    const raw = Number(new URLSearchParams(location.search).get('secs'));
    if (!Number.isFinite(raw) || raw <= 0) return RULES.seconds;
    return Math.max(10, Math.min(180, Math.round(raw)));
  }
  const index = E.buildIndex(DATA);
  const ctx = { index };

  let mode = 'single';
  let seat = 0;
  let state = null;
  let room = null;
  let guestLeft = null;
  let clockTimer = null;
  let cpuTimer = null;
  let nextCpuAt = 0;
  let lastValidSig = '';
  let soundOn = true;

  const el = {
    start: $('#screen-start'),
    game: $('#screen-game'),
    board: $('#board'),
    youScore: $('#youScore'),
    rivalScore: $('#rivalScore'),
    youName: $('#youName'),
    rivalName: $('#rivalName'),
    clock: $('#clock'),
    timerFill: $('#timerFill'),
    timer: $('#timer'),
    nowWord: $('#nowWord'),
    nowPy: $('#nowPy'),
    needChar: $('#needChar'),
    overlay: $('#overlay'),
    resultTitle: $('#resultTitle'),
    resultWhy: $('#resultWhy'),
    resultYou: $('#resultYou'),
    resultRival: $('#resultRival'),
    resultBest: $('#resultBest'),
    againBtn: $('#againBtn'),
    exitBtn: $('#exitBtn'),
    toast: $('#toast'),
    roomBtn: $('#btnRoom'),
    soundBtn: $('#btnSound'),
    netBadge: $('#netBadge'),
    flash: $('#flash')
  };

  // ---------- 存档 ----------
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return Object.assign({ best: 0, plays: 0, wins: 0 }, data || {});
    } catch (_) { return { best: 0, plays: 0, wins: 0 }; }
  }

  function saveSave(next) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); } catch (_) {}
  }

  // ---------- 声音 ----------
  let audio = null;
  function beep(freq, duration, type, gainValue) {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.value = gainValue ?? 0.05;
      osc.connect(gain).connect(audio.destination);
      const now = audio.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (_) {}
  }
  const sfx = {
    claim: (combo) => beep(520 + Math.min(combo, 8) * 55, 0.12, 'triangle', 0.045),
    wrong: () => beep(150, 0.16, 'sawtooth', 0.035),
    end: () => { beep(392, 0.2, 'sine', 0.05); setTimeout(() => beep(523, 0.3, 'sine', 0.05), 130); }
  };

  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.toast.classList.remove('show'), 1800);
  }

  function flash(text) {
    el.flash.textContent = text;
    el.flash.classList.remove('hide');
    clearTimeout(flash.timer);
    flash.timer = setTimeout(() => el.flash.classList.add('hide'), 900);
  }

  // ---------- 渲染 ----------
  function needChar() {
    return state ? state.need : '';
  }

  function render() {
    if (!state) return;
    const me = state.scores[seat];
    const rival = state.scores[1 - seat];
    el.youScore.textContent = me;
    el.rivalScore.textContent = rival;
    el.youName.textContent = mode === 'net' ? (seat === 0 ? '你 · 1P' : '你 · 2P') : '你';
    el.rivalName.textContent = mode === 'net' ? (seat === 0 ? '好友 · 2P' : '好友 · 1P') : '电脑';

    const head = state.chain[state.chain.length - 1];
    const chars = head.w.split('');
    const last = chars.pop();
    el.nowWord.innerHTML = chars.join('') + '<em>' + last + '</em>';
    el.nowPy.textContent = head.p;
    el.needChar.textContent = state.need;

    const valid = new Set(state.board.filter((c) => c.w[0] === state.need).map((c) => c.w));
    const sig = state.board.map((c) => c.w).join('|') + '#' + state.need;
    if (sig !== lastValidSig) {
      lastValidSig = sig;
      el.board.innerHTML = state.board.map((card) => {
        const ok = valid.has(card.w);
        return '<button type="button" class="card' + (ok ? ' valid' : '') + '" data-word="' + card.w + '" aria-label="' +
          card.w + '，' + (ok ? '可以接' : '接不上') + '"><span class="w">' + card.w + '</span><span class="p">' + card.p + '</span></button>';
      }).join('');
    }

    // 房主按本机时钟算，客人按房主下发的剩余时间算，避免两台设备时钟不一致。
    const left = mode === 'net' && seat === 1
      ? guestLeft
      : Math.max(0, state.seconds * 1000 - (Date.now() - state.startedAt));
    const ratio = state.seconds ? Math.max(0, Math.min(1, (left ?? 0) / (state.seconds * 1000))) : 0;
    el.timerFill.style.transform = 'scaleX(' + ratio + ')';
    el.timer.classList.toggle('is-low', ratio < 0.25);
    el.clock.textContent = Math.ceil((left ?? 0) / 1000) + 's';
  }

  function showScreen(name) {
    el.start.hidden = name !== 'start';
    el.game.hidden = name !== 'game';
  }

  // ---------- 单机 ----------
  function startSingle() {
    mode = 'single';
    seat = 0;
    guestLeft = null;
    state = E.newMatch(DATA, { seed: Date.now() % 1e9, index, seconds: matchSeconds() });
    state.startedAt = Date.now();
    lastValidSig = '';
    nextCpuAt = performance.now() + 700;
    showScreen('game');
    el.overlay.hidden = true;
    render();
    startClock();
  }

  function startClock() {
    clearInterval(clockTimer);
    clockTimer = setInterval(() => {
      if (!state || state.over) return;
      if (mode === 'single') {
        E.tick(state, Date.now(), ctx);
        if (state.over) return endGame();
        cpuStep();
        render();
      } else if (mode === 'net') {
        if (seat === 0) {
          E.tick(state, Date.now(), ctx);
          if (state.over) { broadcast({ type: 'state', state }); return endGame(); }
          broadcast({ type: 'clock', left: E.timeLeft(state, Date.now()) });
        }
        render();
      }
    }, 250);
  }

  function cpuStep() {
    if (mode !== 'single' || state.over) return;
    const now = performance.now();
    if (now < nextCpuAt) return;
    const action = E.cpuAction(state, 1);
    if (!action) return;
    const r = E.claim(state, 1, action.card, ctx);
    if (r.ok) {
      sfx.claim(state.scores[1]);
      render();
      if (state.over) endGame();
    }
    nextCpuAt = now + action.delay;
  }

  // ---------- 出牌 ----------
  function attempt(word) {
    if (!state || state.over) return;
    const card = state.board.find((c) => c.w === word);
    if (!card) return;
    if (card.w[0] !== state.need) {
      sfx.wrong();
      flash('要接「' + state.need + '」');
      const node = el.board.querySelector('[data-word="' + word + '"]');
      if (node) {
        node.classList.add('wrong');
        setTimeout(() => node.classList.remove('wrong'), 320);
      }
      return;
    }
    if (mode === 'single') {
      const r = E.claim(state, 0, word, ctx);
      if (r.ok) {
        sfx.claim(state.scores[0]);
        render();
        if (state.over) endGame();
      }
      return;
    }
    if (!room) return;
    if (seat === 0) {
      // 房主：稍作延迟再结算自己的抢牌，给客人一个公平的到达窗口
      const snapshot = word;
      setTimeout(() => {
        if (!state || state.over) return;
        const r = E.claim(state, 0, snapshot, ctx);
        if (!r.ok) return;
        sfx.claim(state.scores[0]);
        broadcast({ type: 'state', state });
        render();
        if (state.over) endGame();
      }, HOST_CLAIM_DELAY);
    } else {
      room.send({ type: 'claim', w: word });
      const node = el.board.querySelector('[data-word="' + word + '"]');
      if (node) node.classList.add('taken');
    }
  }

  // ---------- 结算 ----------
  function endGame() {
    clearInterval(clockTimer);
    clockTimer = null;
    const save = loadSave();
    save.plays += 1;
    if (mode === 'single') {
      save.best = Math.max(save.best, state.scores[0]);
      if (state.winner === 0) save.wins += 1;
    }
    saveSave(save);

    const me = state.scores[seat];
    const rival = state.scores[1 - seat];
    let title;
    if (state.winner === 'draw') title = '平局';
    else if (state.winner === seat) title = '你赢了';
    else title = '惜败';

    el.resultTitle.textContent = title;
    el.resultYou.textContent = me;
    el.resultRival.textContent = rival;
    el.resultWhy.textContent = state.winner === 'draw'
      ? '双方抢到一样多，再来一局？'
      : (state.winner === seat ? '尾字抢得漂亮。' : '慢了半拍，再试一次。');
    el.resultBest.textContent = mode === 'single'
      ? '最高分 ' + save.best + ' · 已玩 ' + save.plays + ' 局'
      : '本局共 ' + (me + rival) + ' 张成语';
    el.againBtn.textContent = mode === 'net' && seat !== 0 ? '等房主再来' : '再来一局';
    el.overlay.hidden = false;
    sfx.end();
  }

  function restart() {
    if (mode === 'single') { startSingle(); return; }
    if (seat === 0) {
      state = E.newMatch(DATA, { seed: Date.now() % 1e9, index, seconds: matchSeconds() });
      state.startedAt = Date.now();
      lastValidSig = '';
      guestLeft = state.seconds * 1000;
      el.overlay.hidden = true;
      broadcast({ type: 'start', state });
      render();
      startClock();
    } else {
      room.send({ type: 'again' });
      toast('已请求再来一局，等待房主');
    }
  }

  function exitToLobby() {
    if (room) room.leave();
    location.href = '../../index.html#/category/premium';
  }

  // ---------- 联机 ----------
  function broadcast(payload) {
    if (room) room.send(payload);
  }

  function startHostMatch() {
    if (!room || !room.isHost()) return;
    state = E.newMatch(DATA, { seed: Date.now() % 1e9, index, seconds: matchSeconds() });
    state.startedAt = Date.now();
    lastValidSig = '';
    guestLeft = state.seconds * 1000;
    el.overlay.hidden = true;
    broadcast({ type: 'start', state });
    showScreen('game');
    render();
    startClock();
    room.hide();
  }

  function openRoomPanel() {
    if (!room) {
      room = window.LiteRoom.open({
        gameId: 'idiom-chain',
        gameTitle: '成语接龙',
        url: 'games/idiom-chain/index.html',
        onMessage(msg) {
          if (msg.type === 'ready') {
            if (seat === 0 || mode !== 'net') { mode = 'net'; seat = 0; }
            startHostMatch();
            return;
          }
          if (msg.type === 'claim') {
            if (seat !== 0 || !state || state.over) return;
            const r = E.claim(state, 1, msg.w, ctx);
            if (!r.ok) return;
            sfx.claim(state.scores[1]);
            broadcast({ type: 'state', state });
            render();
            if (state.over) endGame();
            return;
          }
          if (msg.type === 'again') {
            if (seat === 0) restart();
            return;
          }
          if (msg.type === 'start') {
            mode = 'net';
            seat = 1;
            state = msg.state;
            guestLeft = state.seconds * 1000;
            lastValidSig = '';
            el.overlay.hidden = true;
            showScreen('game');
            room.hide();
            render();
            startClock();
            return;
          }
          if (msg.type === 'state') {
            if (seat !== 1) return;
            state = msg.state;
            guestLeft = E.timeLeft(state, Date.now()) ?? guestLeft;
            render();
            if (state.over) endGame();
            return;
          }
          if (msg.type === 'clock') {
            if (seat !== 1) return;
            guestLeft = msg.left;
            render();
          }
        },
        onPeer(joined) {
          el.netBadge.hidden = !joined;
          if (!joined && state && !state.over) {
            state.over = true;
            state.winner = 'draw';
            el.overlay.hidden = true;
            toast('好友离开了房间');
          }
        },
        onClosed() {
          el.netBadge.hidden = true;
          room = null;
          if (mode === 'net' && state && !state.over) {
            toast('房间已关闭');
          }
        },
        onExit() {
          el.netBadge.hidden = true;
        }
      });
    }
    room.show('host');
  }

  // ---------- 事件 ----------
  el.board.addEventListener('click', (event) => {
    const card = event.target.closest('.card');
    if (card) attempt(card.getAttribute('data-word'));
  });

  $('#startSingle').addEventListener('click', startSingle);
  $('#startNet').addEventListener('click', openRoomPanel);
  el.roomBtn.addEventListener('click', openRoomPanel);
  el.againBtn.addEventListener('click', restart);
  el.exitBtn.addEventListener('click', exitToLobby);
  el.soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    el.soundBtn.classList.toggle('is-on', soundOn);
    el.soundBtn.textContent = soundOn ? '音' : '静';
    el.soundBtn.setAttribute('aria-pressed', String(soundOn));
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && audio?.state === 'running') audio.suspend();
  });

  // 邀请链接：?room=123456&server=https://...
  const params = new URLSearchParams(location.search);
  if (params.get('room')) {
    openRoomPanel();
    room.join(params.get('room'), params.get('server') || '');
    const url = new URL(location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('server');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  showScreen('start');
})();