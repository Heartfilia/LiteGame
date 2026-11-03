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
    var target = new URL('../../../../index.html', location.href);
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
      return out;
    };
    return ctx;
  };
})();
