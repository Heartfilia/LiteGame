(function () {
  'use strict';

  var C = window.Chogan;
  if (!C) return;

  var CATEGORY_NAMES = {
    racing: '赛车',
    action: '动作',
    puzzle: '益智',
    board: '桌游',
    cards: '卡牌',
    casual: '休闲',
    music: '音乐',
    sports: '体育'
  };

  var from = '';
  try {
    from = new URLSearchParams(location.search).get('from') || '';
  } catch (e) {
    from = '';
  }
  var categoryName = CATEGORY_NAMES[from] || '';

  C.strings({ zh: { appName: 'LiteGame' } });
  C.pageTitle = function () {
    return 'LiteGame 轻量游戏厅';
  };

  var nativeSetAccent = C.setAccent;
  C.setAccent = function (color, soft) {
    nativeSetAccent(color, color ? C.alpha(color, 0.16) : soft);
  };

  var nativeApplyTheme = C.applyTheme;
  C.applyTheme = function () {
    nativeApplyTheme();
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#07070f');
  };

  C.setTheme('dark');
  C.setLang('zh');

  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.lang = 'zh-CN';
  document.documentElement.dir = 'ltr';
  document.title = 'LiteGame 轻量游戏厅';

  var themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', '#07070f');

  C.back = function () {
    var target = new URL('../../../index.html', location.href);
    target.search = '';
    target.hash = categoryName ? '#/category/' + from : '#/';
    location.href = target.href;
  };

  function decorateGameBar() {
    try {
      document.documentElement.lang = 'zh-CN';
      document.documentElement.setAttribute('data-theme', 'dark');
      var titleEl = document.querySelector('.ch-gamebar__title');
      if (titleEl && !titleEl.querySelector('.lg-bar-sub')) {
        titleEl.classList.add('lg-bar-title');
        var sub = document.createElement('span');
        sub.className = 'lg-bar-sub';
        sub.textContent = 'LiteGame' + (categoryName ? ' · ' + categoryName : ' 轻量游戏厅');
        titleEl.appendChild(sub);
      }
      var backBtn = document.querySelector('.ch-gamebar .ch-iconbtn');
      if (backBtn) {
        backBtn.title = categoryName ? '返回' + categoryName + '分区' : '返回 LiteGame';
      }
    } catch (e) {
      /* the game bar is decoration; a failure here must not stop the game */
    }
  }

  var nativeGame = C.game;
  C.game = function (cfg) {
    var ctx = nativeGame(cfg);
    var nativeMount = ctx.mount;
    ctx.mount = function () {
      var out = nativeMount.apply(ctx, arguments);
      decorateGameBar();
      mountPad(cfg && cfg.id);
      return out;
    };
    return ctx;
  };

  /* -------- 虚拟按键：只给需要键盘持续操作的游戏，在触屏设备上显示 -------- */

  var PAD_GAMES = {
    breakout: { dirs: ['left', 'right'], actions: [{ key: ' ', code: 'Space', label: '发射' }] },
    hop: { dirs: ['left', 'right'], actions: [] },
    pingpong: { dirs: ['left', 'right'], actions: [{ key: ' ', code: 'Space', label: '发球' }] },
    airhockey: { dirs: ['left', 'right', 'up', 'down'], actions: [{ key: ' ', code: 'Space', label: '开球' }] }
  };

  var PAD_DIRS = {
    left: { key: 'ArrowLeft', code: 'ArrowLeft' },
    right: { key: 'ArrowRight', code: 'ArrowRight' },
    up: { key: 'ArrowUp', code: 'ArrowUp' },
    down: { key: 'ArrowDown', code: 'ArrowDown' }
  };

  var PAD_ARROW = {
    left: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
    right: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 14.5 12 8l6.5 6.5"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 9.5 12 16l6.5-6.5"/></svg>'
  };

  function isTouchPrimary() {
    try {
      return window.matchMedia('(pointer: coarse)').matches &&
        window.matchMedia('(hover: none)').matches;
    } catch (e) {
      return false;
    }
  }

  function sendKey(type, key, code) {
    try {
      window.dispatchEvent(new KeyboardEvent(type, { key: key, code: code, bubbles: true, cancelable: true }));
    } catch (e) {
      /* 旧浏览器没有 KeyboardEvent 构造器，虚拟按键静默降级 */
    }
  }

  function mountPad(gameId) {
    var cfg = PAD_GAMES[gameId];
    if (!cfg || !isTouchPrimary()) return;
    var root = document.querySelector('.ch-gameroot');
    var main = document.querySelector('.ch-gamemain');
    if (!root || !main || document.querySelector('.lg-pad')) return;
    main.classList.add('lg-pad-space');
    if (cfg.dirs && cfg.dirs.length > 2) main.classList.add('lg-pad-space--tall');

    var pad = document.createElement('div');
    pad.className = 'lg-pad';

    if (cfg.dirs && cfg.dirs.length) {
      var dpad = document.createElement('div');
      dpad.className = 'lg-pad__dpad' + (cfg.dirs.length > 2 ? ' lg-pad__dpad--4' : ' lg-pad__dpad--2');
      cfg.dirs.forEach(function (dir) {
        var def = PAD_DIRS[dir];
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'lg-pad__btn lg-pad__btn--' + dir;
        b.innerHTML = PAD_ARROW[dir];
        b.setAttribute('aria-label', { left: '左移', right: '右移', up: '上', down: '下' }[dir] || dir);
        var press = function (e) {
          e.preventDefault();
          if (b.setPointerCapture && e.pointerId != null) {
            try { b.setPointerCapture(e.pointerId); } catch (er) { /* 忽略 */ }
          }
          sendKey('keydown', def.key, def.code);
        };
        var release = function () { sendKey('keyup', def.key, def.code); };
        b.addEventListener('pointerdown', press);
        b.addEventListener('pointerup', release);
        b.addEventListener('pointercancel', release);
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        dpad.appendChild(b);
      });
      pad.appendChild(dpad);
    }

    if (cfg.actions && cfg.actions.length) {
      var acts = document.createElement('div');
      acts.className = 'lg-pad__actions';
      cfg.actions.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'lg-pad__btn lg-pad__btn--act';
        b.textContent = a.label;
        b.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          sendKey('keydown', a.key, a.code);
          sendKey('keyup', a.key, a.code);
        });
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        acts.appendChild(b);
      });
      pad.appendChild(acts);
    }

    root.appendChild(pad);
  }
})();
