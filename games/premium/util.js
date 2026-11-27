/* 精致游戏 · 共用工具
 * 存档、音效、提示、结算层，以及「房主权威」的双人房编排。
 * 各游戏只写规则与画面，联机样板收在这里。
 */
(function (root) {
  'use strict';
  if (root.Premium) return;
  const doc = root.document;

  // ---------- 存档（litegame.* 会被大厅同步） ----------
  function save(namespace) {
    const key = 'litegame.' + namespace;
    function read() {
      try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { return {}; }
    }
    return {
      read,
      write(patch) {
        const next = Object.assign(read(), patch);
        try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
        return next;
      }
    };
  }

  // ---------- 音效 ----------
  let soundOn = true;
  let audio = null;
  function ensureAudio() {
    if (!audio) {
      const Ctx = root.AudioContext || root.webkitAudioContext;
      if (Ctx) audio = new Ctx();
    }
    if (audio?.state === 'suspended') audio.resume();
    return audio;
  }
  function beep(freq, duration, type, gainValue) {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.value = gainValue ?? 0.05;
      osc.connect(gain).connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (_) {}
  }
  const sfx = {
    tap: () => beep(420, 0.07, 'triangle', 0.03),
    ok: (n = 0) => beep(520 + Math.min(n, 8) * 55, 0.12, 'triangle', 0.045),
    bad: () => beep(150, 0.16, 'sawtooth', 0.035),
    tick: () => beep(880, 0.03, 'square', 0.015),
    end: () => { beep(392, 0.2, 'sine', 0.05); setTimeout(() => beep(523, 0.3, 'sine', 0.05), 130); }
  };

  // ---------- 提示 ----------
  let toastTimer = null;
  function toast(text) {
    let node = doc.getElementById('pxToast');
    if (!node) {
      node = doc.createElement('div');
      node.id = 'pxToast';
      node.className = 'px-toast';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      doc.body.append(node);
    }
    node.textContent = text;
    node.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('is-show'), 1800);
  }

  // ---------- 结算层 ----------
  let overlay = null;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = doc.createElement('div');
    overlay.className = 'px-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="px-result" role="dialog" aria-modal="true" aria-labelledby="pxResultTitle">
        <h2 id="pxResultTitle"></h2>
        <p class="px-why"></p>
        <div class="px-final"><span class="px-left"></span><span>比</span><span class="px-right"></span></div>
        <p class="px-best"></p>
        <div class="px-acts">
          <button type="button" class="px-again"></button>
          <button type="button" class="px-exit is-ghost">返回大厅</button>
        </div>
      </div>`;
    doc.body.append(overlay);
    return overlay;
  }

  function showResult(opts) {
    const node = ensureOverlay();
    node.querySelector('#pxResultTitle').textContent = opts.title || '对局结束';
    node.querySelector('.px-why').textContent = opts.why || '';
    node.querySelector('.px-left').textContent = opts.left ?? 0;
    node.querySelector('.px-right').textContent = opts.right ?? 0;
    node.querySelector('.px-best').textContent = opts.best || '';
    node.querySelector('.px-final').hidden = !opts.showFinal;
    const again = node.querySelector('.px-again');
    again.textContent = opts.againLabel || '再来一局';
    again.onclick = () => { node.hidden = true; opts.onAgain?.(); };
    node.querySelector('.px-exit').onclick = () => {
      if (opts.onExit) opts.onExit();
      else root.location.href = '../../index.html#/category/premium';
    };
    node.hidden = false;
    sfx.end();
  }

  function hideResult() {
    if (overlay) overlay.hidden = true;
  }

  // ---------- 顶部栏与音效开关 ----------
  function mountChrome(opts) {
    const btn = doc.getElementById('btnSound');
    if (btn) {
      btn.classList.add('is-on');
      btn.setAttribute('aria-pressed', 'true');
      btn.addEventListener('click', () => {
        soundOn = !soundOn;
        btn.classList.toggle('is-on', soundOn);
        btn.textContent = soundOn ? '音' : '静';
        btn.setAttribute('aria-pressed', String(soundOn));
        sfx.tap();
      });
    }
    const roomBtn = doc.getElementById('btnRoom');
    if (roomBtn && opts?.onRoom) roomBtn.addEventListener('click', opts.onRoom);
    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden && audio?.state === 'running') audio.suspend();
    });
  }

  /**
   * 房主权威的双人房编排。
   * 房主生成 state、校验动作并广播；客人只提交动作、渲染 state。
   * 复用 /api/v1/rooms（kind=board），服务端无需改动。
   */
  function net(cfg, handlers) {
    let ctrl = null;
    let role = 0; // 1 = 房主，2 = 客人
    let joined = false;

    function open() {
      if (ctrl) { ctrl.show('host'); return; }
      ctrl = root.LiteRoom.open({
        gameId: cfg.gameId,
        gameTitle: cfg.gameTitle,
        url: cfg.url,
        onMessage(msg) {
          switch (msg.type) {
            case 'ready': {
              role = role || 1;
              joined = true;
              handlers.peer?.(true);
              const start = handlers.hostStart?.();
              if (start) {
                ctrl.send({ type: 'start', state: start });
                handlers.hostState?.(start);
              }
              ctrl.hide();
              break;
            }
            case 'start':
              role = 2;
              joined = true;
              handlers.peer?.(true);
              ctrl.hide();
              handlers.adopt?.(msg.state, true);
              break;
            case 'state':
              handlers.adopt?.(msg.state, false);
              break;
            case 'clock':
              handlers.clock?.(msg);
              break;
            case 'again':
              handlers.againRequested?.();
              break;
            default:
              handlers.action?.(msg);
          }
        },
        onPeer(state) { joined = state; handlers.peer?.(state); },
        onClosed() { joined = false; handlers.closed?.(); },
        onExit() { handlers.exit?.(); }
      });
      ctrl.show('host');
      // 邀请链接（?room=&server=）进来时自动加入，不打断开局流程。
      ctrl.autoJoinFromURL();
    }

    // 邀请链接直接进来时自动开面板并入房，不用玩家先点「双人」。
    if (param('room')) setTimeout(open, 0);

    return {
      open,
      deliver(payload) { if (ctrl) ctrl.send(payload); },
      get role() { return role; },
      get isHost() { return role === 1; },
      get joined() { return joined; },
      leave() { ctrl?.leave(); }
    };
  }

  function fmtClock(ms) {
    return Math.max(0, Math.ceil(ms / 1000)) + 's';
  }

  function param(name) {
    try { return new URLSearchParams(root.location.search).get(name); } catch (_) { return null; }
  }

  root.Premium = {
    save, sfx, toast, showResult, hideResult, mountChrome, net, fmtClock, param,
    get soundOn() { return soundOn; },
    setSound(on) { soundOn = !!on; }
  };
})(typeof window !== 'undefined' ? window : globalThis);